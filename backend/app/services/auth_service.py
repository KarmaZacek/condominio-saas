"""
Servicio de autenticación.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import User, RefreshToken, UserRole
from app.schemas.auth import (
    UserRegister, UserLogin, LoginResponse, 
    TokenResponse, UserResponse
)
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, hash_refresh_token, decode_token,
    get_permissions_for_role, TokenPayload
)
from app.core.config import settings
from app.core.redis import redis_client


class AuthService:
    """Servicio de autenticación."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def register(self, data: UserRegister) -> User:
        """
        Registra un nuevo usuario.
        Los usuarios nuevos requieren activación por admin.
        """
        # Verificar email único
        existing = await self.db.execute(
            select(User).where(User.email == data.email.lower())
        )
        if existing.scalar_one_or_none():
            raise ValueError("EMAIL_EXISTS")
        
        # Crear usuario
        user = User(
            email=data.email.lower(),
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role=UserRole.RESIDENT,
            is_active=False  # Requiere activación
        )
        
        self.db.add(user)
        await self.db.flush()
        
        return user
    
    async def login(
        self, 
        data: UserLogin,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> LoginResponse:
        """
        Autentica usuario y genera tokens.
        """
        # Buscar usuario
        result = await self.db.execute(
            select(User).where(User.email == data.email.lower())
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("INVALID_CREDENTIALS")
        
        # Verificar bloqueo
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            # Calcular minutos restantes
            remaining = user.locked_until - datetime.now(timezone.utc)
            minutes_remaining = max(1, int(remaining.total_seconds() / 60))
            raise ValueError(f"ACCOUNT_LOCKED:{minutes_remaining}")
        
        # Verificar contraseña
        if not verify_password(data.password, user.password_hash):
            # Incrementar intentos fallidos
            user.failed_login_attempts += 1
            
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(
                    minutes=settings.LOCKOUT_DURATION_MINUTES
                )
            
            await self.db.flush()
            raise ValueError("INVALID_CREDENTIALS")
        
        # Verificar cuenta activa
        if not user.is_active:
            raise ValueError("ACCOUNT_INACTIVE")
        
        # Reset intentos fallidos
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.now(timezone.utc)
        
        # ✅ CORRECCIÓN: Generar tokens CON condominium_id
        token_payload = TokenPayload(
            sub=user.id,
            email=user.email,
            role=user.role.value,
            condominium_id=user.condominium_id,  # ✅ AGREGADO
            unit_id=user.unit_id,
            permissions=get_permissions_for_role(user.role.value)
        )
        
        access_token = create_access_token(token_payload.to_dict())
        refresh_token, token_hash, expires_at = create_refresh_token(user.id)
        
        # Guardar refresh token
        refresh_token_obj = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            device_info=data.device_info,
            expires_at=expires_at
        )
        self.db.add(refresh_token_obj)
        await self.db.flush()
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role.value,
                phone=user.phone,
                avatar_url=user.avatar_url,
                is_active=user.is_active,
                unit_id=user.unit_id,
                created_at=user.created_at,
                last_login=user.last_login
            )
        )
    
    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """
        Renueva el access token usando el refresh token.
        """
        token_hash = hash_refresh_token(refresh_token)
        
        # Buscar refresh token
        result = await self.db.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .where(RefreshToken.is_revoked == False)
            .where(RefreshToken.expires_at > datetime.now(timezone.utc))
        )
        token_obj = result.scalar_one_or_none()
        
        if not token_obj:
            raise ValueError("INVALID_REFRESH_TOKEN")
        
        # Obtener usuario
        result = await self.db.execute(
            select(User).where(User.id == token_obj.user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise ValueError("INVALID_REFRESH_TOKEN")
        
        # ✅ CORRECCIÓN: Generar nuevo access token CON condominium_id
        token_payload = TokenPayload(
            sub=user.id,
            email=user.email,
            role=user.role.value,
            condominium_id=user.condominium_id,  # ✅ AGREGADO
            unit_id=user.unit_id,
            permissions=get_permissions_for_role(user.role.value)
        )
        
        access_token = create_access_token(token_payload.to_dict())
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # Mantener el mismo
            token_type="Bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    async def logout(
        self, 
        user_id: str, 
        refresh_token: Optional[str] = None,
        all_devices: bool = False
    ) -> bool:
        """
        Cierra sesión revocando tokens.
        """
        if all_devices:
            # Revocar todos los tokens del usuario
            result = await self.db.execute(
                select(RefreshToken)
                .where(RefreshToken.user_id == user_id)
                .where(RefreshToken.is_revoked == False)
            )
            tokens = result.scalars().all()
            
            for token in tokens:
                token.is_revoked = True
        
        elif refresh_token:
            # Revocar token específico
            token_hash = hash_refresh_token(refresh_token)
            result = await self.db.execute(
                select(RefreshToken)
                .where(RefreshToken.token_hash == token_hash)
            )
            token_obj = result.scalar_one_or_none()
            
            if token_obj:
                token_obj.is_revoked = True
        
        await self.db.flush()
        return True
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Obtiene usuario por ID con su condominio."""
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.condominium))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Obtiene usuario por email con su condominio."""
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.condominium))
            .where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def update_password(
        self, 
        user_id: str, 
        current_password: str, 
        new_password: str
    ) -> bool:
        """Cambia la contraseña del usuario."""
        user = await self.get_user_by_id(user_id)
        
        if not user:
            raise ValueError("USER_NOT_FOUND")
        
        if not verify_password(current_password, user.password_hash):
            raise ValueError("INVALID_PASSWORD")
        
        user.password_hash = hash_password(new_password)
        await self.db.flush()
        
        # Revocar todos los refresh tokens
        await self.logout(user_id, all_devices=True)
        
        return True
    
    async def update_profile(
        self, 
        user_id: str, 
        full_name: Optional[str] = None,
        phone: Optional[str] = None
    ) -> User:
        """Actualiza perfil de usuario."""
        user = await self.get_user_by_id(user_id)
        
        if not user:
            raise ValueError("USER_NOT_FOUND")
        
        if full_name:
            user.full_name = full_name
        if phone is not None:
            user.phone = phone
        
        await self.db.flush()
        return user


def get_auth_service(db: AsyncSession) -> AuthService:
    """Factory para AuthService."""
    return AuthService(db)
