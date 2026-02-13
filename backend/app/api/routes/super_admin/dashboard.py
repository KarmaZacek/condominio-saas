"""
Rutas API para Dashboard de Super Admin.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.super_admin import require_super_admin
from app.middleware.auth import AuthenticatedUser
from app.schemas.super_admin import DashboardResponse
from app.services.super_admin_dashboard import (
    get_super_admin_dashboard_service,
    SuperAdminDashboardService
)


router = APIRouter(prefix="/super-admin", tags=["Super Admin - Dashboard"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Dashboard de Super Admin",
    description="""
    Obtiene todas las métricas y estadísticas del sistema.
    
    **Requiere:**
    - Token JWT de usuario con role `super_admin`
    - Header `X-Super-Admin-Key` con API Key válida
    
    **Retorna:**
    - Métricas generales del sistema
    - Distribución de planes
    - Distribución de usuarios por rol
    - Top 5 condominios por actividad
    - Últimos 10 logins
    """
)
async def get_dashboard(
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Dashboard completo con métricas del sistema.
    """
    service = get_super_admin_dashboard_service(db)
    return await service.get_dashboard_data()
