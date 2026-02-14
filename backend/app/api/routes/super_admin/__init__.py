"""
Rutas de Super Admin.

Importa y registra todos los routers de super admin.
"""
from fastapi import APIRouter
from app.api.routes.super_admin import dashboard, condominiums

router = APIRouter()

# Registrar routers
router.include_router(dashboard.router)
router.include_router(condominiums.router)
