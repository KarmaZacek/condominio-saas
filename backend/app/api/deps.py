from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.models import User
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.services.user_service import UserService

def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)

async def get_current_active_user(
    current_user = Depends(get_current_user), # Objeto ligero del token
    db: AsyncSession = Depends(get_db)        # Sesión ASÍNCRONA
) -> User:
    """
    Versión Async: Busca al usuario completo en la BD usando su ID.
    """
    
    # Usamos sintaxis moderna de SQLAlchemy (select + await)
    result = await db.execute(select(User).filter(User.id == current_user.id))
    user_db = result.scalars().first()
    
    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
        
    if not user_db.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user_db
