"""
Rutas de Super Admin.
"""
from fastapi import APIRouter
from app.api.routes.super_admin import dashboard

router = APIRouter()
router.include_router(dashboard.router)
