"""
Rutas de API para gestión de usuarios del Super Admin.
"""

from fastapi import APIRouter, Depends, Query, Header, HTTPException
from typing import Optional
from jose import jwt, JWTError

from app.services.super_admin_users import SuperAdminUserService
from app.core.config import settings


router = APIRouter()


# Dependencias de autenticación
async def get_current_super_admin(authorization: str = Header(...)):
    """Verifica el token JWT del super admin."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    if payload.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    return payload


async def verify_super_admin_access(x_super_admin_key: str = Header(..., alias="X-Super-Admin-Key")):
    """Verifica la API key del super admin."""
    if x_super_admin_key != settings.SUPER_ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid super admin API key")
    
    return {"verified": True}


@router.get("")
async def list_users(
    search: Optional[str] = Query(None, description="Buscar por nombre o email"),
    condominium_id: Optional[str] = Query(None, description="Filtrar por condominio"),
    role: Optional[str] = Query(None, description="Filtrar por rol"),
    is_active: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(50, ge=1, le=100, description="Resultados por página"),
    sort_by: str = Query("created_at", description="Campo para ordenar"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Orden"),
    current_user: dict = Depends(get_current_super_admin),
    _: dict = Depends(verify_super_admin_access)
):
    """
    Lista todos los usuarios del sistema con filtros.
    
    Requiere autenticación de Super Admin.
    
    **Filtros disponibles:**
    - `search`: Buscar por nombre o email (case-insensitive)
    - `condominium_id`: Filtrar por condominio específico
    - `role`: Filtrar por rol (ADMIN, RESIDENT, ACCOUNTANT)
    - `is_active`: Filtrar por estado activo (true/false)
    
    **Ordenamiento:**
    - `sort_by`: created_at, full_name, email, last_login
    - `sort_order`: asc, desc
    
    **Paginación:**
    - `page`: Número de página (default: 1)
    - `limit`: Resultados por página (default: 50, max: 100)
    """
    service = SuperAdminUserService()
    return await service.list_users(
        search=search,
        condominium_id=condominium_id,
        role=role,
        is_active=is_active,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order
    )


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_super_admin),
    _: dict = Depends(verify_super_admin_access)
):
    """
    Obtiene los detalles completos de un usuario específico.
    
    Requiere autenticación de Super Admin.
    
    **Información retornada:**
    - Datos personales completos
    - Condominio asociado
    - Unidad asignada
    - Estado de la cuenta
    - Historial de acceso
    """
    service = SuperAdminUserService()
    return await service.get_user(user_id)


@router.post("/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    current_user: dict = Depends(get_current_super_admin),
    _: dict = Depends(verify_super_admin_access)
):
    """
    Activa o desactiva un usuario.
    
    Requiere autenticación de Super Admin.
    
    - Si el usuario está activo, lo desactiva
    - Si el usuario está inactivo, lo activa
    
    **Restricciones:**
    - No se pueden desactivar Super Admins
    """
    service = SuperAdminUserService()
    return await service.toggle_user_status(user_id)


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    current_user: dict = Depends(get_current_super_admin),
    _: dict = Depends(verify_super_admin_access)
):
    """
    Resetea la contraseña de un usuario y genera una contraseña temporal.
    
    Requiere autenticación de Super Admin.
    
    **Proceso:**
    1. Genera contraseña temporal aleatoria (12 caracteres)
    2. Actualiza la contraseña del usuario
    3. Resetea intentos de login fallidos
    4. Desbloquea la cuenta si estaba bloqueada
    
    **Retorna:**
    - Usuario
    - Contraseña temporal (debe ser comunicada al usuario de forma segura)
    
    **Restricciones:**
    - No se pueden resetear contraseñas de Super Admins
    
    **Nota:** La contraseña temporal debe ser cambiada por el usuario en su próximo login.
    """
    service = SuperAdminUserService()
    return await service.reset_user_password(user_id)
