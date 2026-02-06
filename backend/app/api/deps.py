from fastapi import Depends, HTTPException, status
from app.models.models import User
# Importamos la función de autenticación que ya tienes en middleware
from app.middleware.auth import get_current_user 

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependencia para asegurar que el usuario:
    1. Está logueado (get_current_user lo verifica)
    2. Está activo (is_active=True)
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
