"""
Servicio de recuperación de contraseña.
"""

import random
import string
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, PasswordResetCode
from app.core.security import hash_password
from app.services.email_service import get_email_service

logger = logging.getLogger(__name__)

# Configuración
CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 15
MAX_ATTEMPTS = 5
MAX_REQUESTS_PER_HOUR = 3


class PasswordResetService:
    """Servicio para recuperación de contraseña."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = get_email_service()
    
    def _generate_code(self) -> str:
        """Genera un código numérico de 6 dígitos."""
        return ''.join(random.choices(string.digits, k=CODE_LENGTH))
    
    async def request_reset(self, email: str) -> dict:
        """
        Solicita un código de recuperación de contraseña.
        
        Returns:
            dict con mensaje de éxito (siempre, por seguridad)
        """
        # Buscar usuario
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalar_one_or_none()
        
        # Por seguridad, siempre retornamos éxito
        if not user:
            logger.info(f"Intento de reset para email no existente: {email}")
            return {
                "message": "Si el correo existe, recibirás un código de recuperación"
            }
        
        if not user.is_active:
            logger.info(f"Intento de reset para cuenta inactiva: {email}")
            return {
                "message": "Si el correo existe, recibirás un código de recuperación"
            }
        
        # Verificar límite de solicitudes por hora
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_requests = await self.db.execute(
            select(PasswordResetCode).where(
                and_(
                    PasswordResetCode.user_id == user.id,
                    PasswordResetCode.created_at >= one_hour_ago
                )
            )
        )
        request_count = len(recent_requests.scalars().all())
        
        if request_count >= MAX_REQUESTS_PER_HOUR:
            logger.warning(f"Límite de solicitudes excedido para: {email}")
            return {
                "message": "Si el correo existe, recibirás un código de recuperación"
            }
        
        # Invalidar códigos anteriores
        await self.db.execute(
            select(PasswordResetCode).where(
                and_(
                    PasswordResetCode.user_id == user.id,
                    PasswordResetCode.is_used == False
                )
            )
        )
        # Marcar como usados los códigos anteriores
        old_codes_result = await self.db.execute(
            select(PasswordResetCode).where(
                and_(
                    PasswordResetCode.user_id == user.id,
                    PasswordResetCode.is_used == False
                )
            )
        )
        for old_code in old_codes_result.scalars():
            old_code.is_used = True
        
        # Generar nuevo código
        code = self._generate_code()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
        
        reset_code = PasswordResetCode(
            user_id=user.id,
            code=code,
            expires_at=expires_at
        )
        
        self.db.add(reset_code)
        await self.db.flush()
        
        # Enviar email (o mostrar en logs si no hay SMTP)
        await self.email_service.send_password_reset_code(
            to_email=user.email,
            user_name=user.full_name,
            code=code
        )
        
        logger.info(f"Código de reset generado para: {email}")
        
        # En modo desarrollo, también retornamos el código para facilitar pruebas
        # IMPORTANTE: Quitar esto en producción
        return {
            "message": "Si el correo existe, recibirás un código de recuperación",
            # Solo para desarrollo:
            "_dev_code": code if not self.email_service._is_configured() else None
        }
    
    async def verify_code(self, email: str, code: str) -> Optional[str]:
        """
        Verifica si un código es válido.
        
        Returns:
            user_id si es válido, None si no
        """
        # Buscar usuario
        user_result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            return None
        
        # Buscar código
        code_result = await self.db.execute(
            select(PasswordResetCode).where(
                and_(
                    PasswordResetCode.user_id == user.id,
                    PasswordResetCode.code == code,
                    PasswordResetCode.is_used == False
                )
            )
        )
        reset_code = code_result.scalar_one_or_none()
        
        if not reset_code:
            logger.warning(f"Código inválido para: {email}")
            return None
        
        # Verificar expiración
        if reset_code.expires_at < datetime.now(timezone.utc):
            logger.warning(f"Código expirado para: {email}")
            return None
        
        # Verificar intentos
        if reset_code.attempts >= MAX_ATTEMPTS:
            logger.warning(f"Máximo de intentos excedido para: {email}")
            return None
        
        return user.id
    
    async def reset_password(
        self, 
        email: str, 
        code: str, 
        new_password: str
    ) -> dict:
        """
        Restablece la contraseña usando el código.
        
        Returns:
            dict con resultado
        """
        # Buscar usuario
        user_result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            return {"success": False, "error": "INVALID_CODE"}
        
        # Buscar código
        code_result = await self.db.execute(
            select(PasswordResetCode).where(
                and_(
                    PasswordResetCode.user_id == user.id,
                    PasswordResetCode.code == code,
                    PasswordResetCode.is_used == False
                )
            )
        )
        reset_code = code_result.scalar_one_or_none()
        
        if not reset_code:
            return {"success": False, "error": "INVALID_CODE"}
        
        # Incrementar intentos
        reset_code.attempts += 1
        
        # Verificar expiración
        if reset_code.expires_at < datetime.now(timezone.utc):
            await self.db.flush()
            return {"success": False, "error": "CODE_EXPIRED"}
        
        # Verificar intentos
        if reset_code.attempts > MAX_ATTEMPTS:
            await self.db.flush()
            return {"success": False, "error": "MAX_ATTEMPTS_EXCEEDED"}
        
        # Actualizar contraseña
        user.password_hash = hash_password(new_password)
        
        # Marcar código como usado
        reset_code.is_used = True
        
        # Resetear intentos de login fallidos
        user.failed_login_attempts = 0
        user.locked_until = None
        
        await self.db.flush()
        
        logger.info(f"Contraseña restablecida para: {email}")
        
        return {"success": True, "message": "Contraseña actualizada correctamente"}


def get_password_reset_service(db: AsyncSession) -> PasswordResetService:
    """Factory para PasswordResetService."""
    return PasswordResetService(db)
