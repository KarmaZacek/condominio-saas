import asyncio
from app.core.database import async_session_factory
from app.models.models import Category
from sqlalchemy import select
import uuid

CATEGORIES = [
    # Ingresos
    {"name": "Cuota de Mantenimiento", "type": "income", "description": "Cuota mensual ordinaria", "color": "#10B981", "icon": "home", "is_system": True},
    {"name": "Cuota Extraordinaria", "type": "income", "description": "Cuotas especiales aprobadas", "color": "#3B82F6", "icon": "star", "is_system": True},
    {"name": "Multas y Recargos", "type": "income", "description": "Multas por reglamento o recargos", "color": "#F59E0B", "icon": "alert-circle", "is_system": True},
    {"name": "Otros Ingresos", "type": "income", "description": "Ingresos diversos", "color": "#8B5CF6", "icon": "plus-circle", "is_system": False},
    
    # Gastos
    {"name": "Mantenimiento General", "type": "expense", "description": "Reparaciones y mantenimiento", "color": "#EF4444", "icon": "tool", "is_system": True},
    {"name": "Servicios (Luz/Agua)", "type": "expense", "description": "Pago de servicios públicos", "color": "#F97316", "icon": "zap", "is_system": True},
    {"name": "Vigilancia", "type": "expense", "description": "Seguridad y vigilancia", "color": "#EC4899", "icon": "shield", "is_system": True},
    {"name": "Jardinería", "type": "expense", "description": "Mantenimiento de áreas verdes", "color": "#22C55E", "icon": "sun", "is_system": True},
    {"name": "Limpieza", "type": "expense", "description": "Servicio de limpieza", "color": "#06B6D4", "icon": "trash-2", "is_system": True},
    {"name": "Administración", "type": "expense", "description": "Gastos administrativos", "color": "#6366F1", "icon": "briefcase", "is_system": True},
    {"name": "Otros Gastos", "type": "expense", "description": "Gastos diversos", "color": "#78716C", "icon": "minus-circle", "is_system": False},
]

async def seed_categories():
    async with async_session_factory() as session:
        # Verificar si ya hay categorías
        result = await session.execute(select(Category))
        existing = result.scalars().all()
        
        if existing:
            print(f"Ya existen {len(existing)} categorías")
            for cat in existing:
                print(f"  - {cat.name} ({cat.type})")
            return
        
        # Crear categorías
        for cat_data in CATEGORIES:
            category = Category(
                id=str(uuid.uuid4()),
                **cat_data,
                is_active=True
            )
            session.add(category)
        
        await session.commit()
        print(f"✅ Se crearon {len(CATEGORIES)} categorías")

if __name__ == "__main__":
    asyncio.run(seed_categories())
