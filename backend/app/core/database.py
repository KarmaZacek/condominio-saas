"""
Configuración de base de datos con SQLAlchemy async.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

# -------------------------------------------------------------------
# 🛠️ PARCHE PARA RAILWAY (Fix Definitivo de Protocolo)
# Railway puede entregar "postgres://" o "postgresql://".
# SQLAlchemy Async requiere estrictamente "postgresql+asyncpg://".
# -------------------------------------------------------------------

# 1. Leemos la URL original
database_url = settings.DATABASE_URL

if database_url:
    # Paso A: Si empieza con "postgres://", lo cambiamos a "postgresql://"
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    # Paso B: Si empieza con "postgresql://" y NO tiene "+asyncpg", se lo agregamos
    if database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# 2. Creamos el motor usando la URL CORREGIDA
engine = create_async_engine(
    database_url, 
    echo=settings.DEBUG,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Clase base para todos los modelos."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency para obtener sesión de base de datos.
    Uso: db: AsyncSession = Depends(get_db)
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Inicializa la base de datos creando todas las tablas."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Cierra las conexiones de base de datos."""
    await engine.dispose()
