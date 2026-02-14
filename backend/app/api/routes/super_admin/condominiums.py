"""
Rutas API para gestión de condominios de Super Admin.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.super_admin import require_super_admin
from app.middleware.auth import AuthenticatedUser
from app.schemas.super_admin import (
    CondominiumListResponse,
    CondominiumDetail,
    CondominiumUpdate
)
from app.services.super_admin_condominiums import (
    get_super_admin_condominium_service,
    SuperAdminCondominiumService
)


router = APIRouter(prefix="/super-admin/condominiums", tags=["Super Admin - Condominiums"])


@router.get(
    "",
    response_model=CondominiumListResponse,
    summary="Listar condominios",
    description="""
    Lista todos los condominios con filtros y paginación.
    
    **Filtros disponibles:**
    - `search`: Búsqueda por nombre
    - `plan_type`: Filtrar por plan (FREE, PRO, ENTERPRISE)
    - `is_active`: Filtrar por estado (true/false)
    
    **Ordenamiento:**
    - `sort_by`: name, created_at, total_users, total_units
    - `sort_order`: asc, desc
    
    **Requiere:**
    - Token JWT de super admin
    - Header X-Super-Admin-Key
    """
)
async def list_condominiums(
    page: int = Query(1, ge=1, description="Página actual"),
    limit: int = Query(50, ge=1, le=100, description="Registros por página"),
    search: str = Query(None, description="Búsqueda por nombre"),
    plan_type: str = Query(None, description="Filtrar por plan"),
    is_active: bool = Query(None, description="Filtrar por estado activo"),
    sort_by: str = Query("created_at", description="Campo para ordenar"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Orden"),
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista condominios con filtros avanzados.
    """
    service = get_super_admin_condominium_service(db)
    
    return await service.list_condominiums(
        page=page,
        limit=limit,
        search=search,
        plan_type=plan_type,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order
    )


@router.get(
    "/{condominium_id}",
    response_model=CondominiumDetail,
    summary="Ver detalles de condominio",
    description="""
    Obtiene información detallada de un condominio específico.
    
    **Incluye:**
    - Información básica
    - Total de usuarios
    - Total de unidades
    - Total de transacciones
    - Fechas de creación y actualización
    
    **Requiere:**
    - Token JWT de super admin
    - Header X-Super-Admin-Key
    """
)
async def get_condominium(
    condominium_id: str,
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene detalles completos de un condominio.
    """
    service = get_super_admin_condominium_service(db)
    
    condo = await service.get_condominium(condominium_id)
    
    if not condo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "CONDOMINIUM_NOT_FOUND",
                "message": "Condominio no encontrado"
            }
        )
    
    return condo


@router.patch(
    "/{condominium_id}",
    response_model=CondominiumDetail,
    summary="Actualizar condominio",
    description="""
    Actualiza información de un condominio.
    
    **Campos actualizables:**
    - name: Nombre del condominio
    - plan_type: Plan (FREE, PRO, ENTERPRISE)
    - is_active: Estado activo/inactivo
    - default_monthly_fee: Cuota mensual por defecto
    
    **Requiere:**
    - Token JWT de super admin
    - Header X-Super-Admin-Key
    """
)
async def update_condominium(
    condominium_id: str,
    data: CondominiumUpdate,
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza un condominio.
    """
    service = get_super_admin_condominium_service(db)
    
    condo = await service.update_condominium(condominium_id, data)
    
    if not condo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "CONDOMINIUM_NOT_FOUND",
                "message": "Condominio no encontrado"
            }
        )
    
    await db.commit()
    
    return condo


@router.post(
    "/{condominium_id}/toggle-status",
    response_model=CondominiumDetail,
    summary="Activar/Desactivar condominio",
    description="""
    Cambia el estado activo/inactivo de un condominio.
    
    **Comportamiento:**
    - Si está activo → Lo desactiva
    - Si está inactivo → Lo activa
    
    **Nota:** Desactivar un condominio puede afectar:
    - Acceso de usuarios a la aplicación
    - Procesamiento de transacciones
    - Visibilidad de datos
    
    **Requiere:**
    - Token JWT de super admin
    - Header X-Super-Admin-Key
    """
)
async def toggle_condominium_status(
    condominium_id: str,
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Activa o desactiva un condominio.
    """
    service = get_super_admin_condominium_service(db)
    
    condo = await service.toggle_status(condominium_id)
    
    if not condo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "CONDOMINIUM_NOT_FOUND",
                "message": "Condominio no encontrado"
            }
        )
    
    await db.commit()
    
    return condo
