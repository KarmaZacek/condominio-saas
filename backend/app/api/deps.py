from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.models import User
from app.core.database import get_db
from app.middleware.auth import get_current_user 

async def get_current_active_user(
    current_user = Depends(get_current_user), # Este es el objeto ligero del token
    db: Session = Depends(get_db)             # Necesitamos acceso a la BD
) -> User:
    """
    1. Recibe el usuario autenticado (del token).
    2. Busca el registro completo en la Base de Datos.
    3. Verifica si está activo.
    Devuelve el modelo User de SQLAlchemy completo.
    """
    
    # Buscamos al usuario en la BD usando el ID del token
    user_db = db.query(User).filter(User.id == current_user.id).first()
    
    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
        
    if not user_db.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user_db