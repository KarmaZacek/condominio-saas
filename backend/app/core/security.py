"""
Utilidades de seguridad: JWT, hashing de contraseñas.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import hashlib
import secrets

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings


# Contexto de hashing para contraseñas
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica contraseña contra hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Genera hash de contraseña."""
    return pwd_context.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Crea token de acceso JWT.
    
    Args:
        data: Datos a incluir en el payload
        expires_delta: Tiempo de expiración personalizado
    
    Returns:
        Token JWT codificado
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })
    
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """
    Crea token de refresh.
    
    Returns:
        Tupla (token, token_hash, fecha_expiracion)
    """
    # Token aleatorio
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    
    return token, token_hash, expires_at


def decode_token(token: str) -> Optional[dict]:
    """
    Decodifica y valida token JWT.
    
    Returns:
        Payload del token o None si es inválido
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def hash_refresh_token(token: str) -> str:
    """Genera hash de refresh token para almacenamiento."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_password_reset_token(email: str) -> str:
    """Genera token para reset de contraseña."""
    data = {
        "sub": email,
        "type": "password_reset"
    }
    return create_access_token(
        data,
        expires_delta=timedelta(hours=1)
    )


def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verifica token de reset de contraseña.
    
    Returns:
        Email si el token es válido, None si no
    """
    payload = decode_token(token)
    if payload and payload.get("type") == "password_reset":
        return payload.get("sub")
    return None


class TokenPayload:
    """Clase para estructurar payload del token."""
    
    def __init__(
        self,
        sub: str,
        email: str,
        role: str,
        condominium_id: Optional[str] = None,  # ✅ AGREGADO
        unit_id: Optional[str] = None,
        permissions: list[str] = None
    ):
        self.sub = sub  # user_id
        self.email = email
        self.role = role
        self.condominium_id = condominium_id  # ✅ AGREGADO
        self.unit_id = unit_id
        self.permissions = permissions or []
    
    def to_dict(self) -> dict:
        return {
            "sub": self.sub,
            "email": self.email,
            "role": self.role,
            "condominium_id": str(self.condominium_id) if self.condominium_id else None,  # ✅ Convertir UUID a string
            "unit_id": str(self.unit_id) if self.unit_id else None,  # ✅ Convertir UUID a string también
            "permissions": self.permissions
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "TokenPayload":
        return cls(
            sub=data.get("sub"),
            email=data.get("email"),
            role=data.get("role"),
            condominium_id=data.get("condominium_id"),  # ✅ AGREGADO
            unit_id=data.get("unit_id"),
            permissions=data.get("permissions", [])
        )


# Permisos por rol
ROLE_PERMISSIONS = {
    "admin": [
        "read:all",
        "write:transactions",
        "write:categories",
        "write:units",
        "manage:users",
        "export:reports"
    ],
    "resident": [
        "read:own_unit",
        "read:own_transactions"
    ],
    "readonly": [
        "read:all"
    ]
}


def get_permissions_for_role(role: str) -> list[str]:
    """Obtiene permisos para un rol."""
    return ROLE_PERMISSIONS.get(role, [])
