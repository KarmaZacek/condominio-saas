import asyncio
from app.core.database import async_session_factory
from app.models.models import User
from app.core.security import hash_password
from sqlalchemy import select
import uuid

async def create_admin():
    print("🔄 Creando usuario administrador...")
    
    async with async_session_factory() as session:
        # Verificar si ya existe
        result = await session.execute(
            select(User).where(User.email == "admin@condominio.com")
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            print("⚠️  El usuario admin ya existe")
            return
        
        # Crear admin
        admin = User(
            id=str(uuid.uuid4()),
            email="admin@condominio.com",
            password_hash=hash_password("admin123"),
            full_name="Administrador",
            role="admin",
            is_active=True
        )
        
        session.add(admin)
        await session.commit()
        print("✅ Usuario administrador creado!")
        print("📧 Email: admin@condominio.com")
        print("🔑 Contraseña: admin123")

if __name__ == "__main__":
    asyncio.run(create_admin())
