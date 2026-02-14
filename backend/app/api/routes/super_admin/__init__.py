"""
Router principal del módulo Super Admin.
"""

from fastapi import APIRouter
from app.api.routes.super_admin import dashboard, condominiums, users

router = APIRouter(prefix="/super-admin", tags=["Super Admin"])

# Incluir sub-routers
router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Super Admin - Dashboard"]
)

router.include_router(
    condominiums.router,
    prefix="/condominiums",
    tags=["Super Admin - Condominiums"]
)

router.include_router(
    users.router,
    prefix="/users",
    tags=["Super Admin - Users"]
)
