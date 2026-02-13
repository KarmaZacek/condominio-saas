"""
Middleware de autenticación para Super Admin.
Requiere doble verificación: JWT + API Key.
"""

from fastapi import Depends, HTTPException, status, Header
from app.middleware.auth import get_current_user, AuthenticatedUser
from app.core.config import settings


async def require_super_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
    x_super_admin_key: str = Header(..., alias="X-Super-Admin-Key")
) -> AuthenticatedUser:
    """
    Middleware de doble autenticación para Super Admin.
    
    Requiere:
    1. Token JWT válido
    2. Role = SUPER_ADMIN
    3. API Key correcta en header
    
    Args:
        current_user: Usuario autenticado del JWT
        x_super_admin_key: API Key en header
    
    Returns:
        AuthenticatedUser con role super_admin
    
    Raises:
        HTTPException 403: Si no cumple requisitos
    """
    # Verificación 1: Role correcto
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "INSUFFICIENT_PERMISSIONS",
                "message": "Esta acción requiere permisos de Super Admin"
            }
        )
    
    # Verificación 2: API Key válida
    if x_super_admin_key != settings.SUPER_ADMIN_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "INVALID_API_KEY",
                "message": "API Key de Super Admin inválida"
            }
        )
    
    # Verificación 3: Super admin no debe tener condominium_id
    if current_user.condominium_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "INVALID_SUPER_ADMIN",
                "message": "Super Admin no puede estar asignado a un condominio"
            }
        )
    
    return current_user


async def optional_super_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
    x_super_admin_key: str = Header(None, alias="X-Super-Admin-Key")
) -> tuple[AuthenticatedUser, bool]:
    """
    Verifica si el usuario es super admin pero no lo requiere.
    Útil para endpoints que tienen comportamiento diferente según el rol.
    
    Returns:
        tuple: (usuario, es_super_admin)
    """
    is_super_admin = (
        current_user.role == "super_admin" and
        x_super_admin_key == settings.SUPER_ADMIN_KEY and
        current_user.condominium_id is None
    )
    
    return current_user, is_super_admin
