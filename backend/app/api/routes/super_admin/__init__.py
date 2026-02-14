"""
Router principal del módulo Super Admin.
Combina todas las sub-rutas de administración.
"""

from fastapi import APIRouter
from app.api.routes.super_admin import dashboard, condominiums, users

router = APIRouter()

# Incluir sub-routers
router.include_router(dashboard.router)
router.include_router(condominiums.router)
router.include_router(users.router)

__all__ = ["router"]
