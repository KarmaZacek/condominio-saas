from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import User
from app.core.security import hash_password # Asegúrate que esta función exista en security, si no, ajusta el import

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(func.lower(User.email) == email.lower()))
        return result.scalars().first()

    async def get(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalars().first()

    # Puedes agregar más métodos aquí según crezca tu app
