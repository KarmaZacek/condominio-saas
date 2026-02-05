import asyncio
from app.core.database import engine, Base
from app.models.models import *  # Importa todos los modelos

async def init_db():
    print("🔄 Creando tablas en la base de datos...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tablas creadas exitosamente!")

if __name__ == "__main__":
    asyncio.run(init_db())
