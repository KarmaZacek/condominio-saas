import asyncio
from app.core.database import async_session_factory
from app.models.models import Unit
from sqlalchemy import select
import uuid

UNITS = [
    {"unit_number": "101", "owner_name": "Juan Pérez García", "owner_email": "juan.perez@email.com", "owner_phone": "5551234567", "monthly_fee": 1500.00},
    {"unit_number": "102", "owner_name": "María García López", "owner_email": "maria.garcia@email.com", "owner_phone": "5552345678", "monthly_fee": 1500.00},
    {"unit_number": "103", "owner_name": "Carlos López Hernández", "owner_email": "carlos.lopez@email.com", "owner_phone": "5553456789", "monthly_fee": 1500.00},
    {"unit_number": "104", "owner_name": "Ana Martínez Ruiz", "owner_email": "ana.martinez@email.com", "owner_phone": "5554567890", "monthly_fee": 1500.00},
    {"unit_number": "105", "owner_name": "Roberto Sánchez Díaz", "owner_email": "roberto.sanchez@email.com", "owner_phone": "5555678901", "monthly_fee": 1500.00},
    {"unit_number": "106", "owner_name": "Laura Torres Mendoza", "owner_email": "laura.torres@email.com", "owner_phone": "5556789012", "monthly_fee": 1500.00},
    {"unit_number": "201", "owner_name": "Pedro Ramírez Castro", "owner_email": "pedro.ramirez@email.com", "owner_phone": "5557890123", "monthly_fee": 1600.00},
    {"unit_number": "202", "owner_name": "Sofía Flores Vega", "owner_email": "sofia.flores@email.com", "owner_phone": "5558901234", "monthly_fee": 1600.00},
]

async def seed_units():
    async with async_session_factory() as session:
        # Verificar si ya hay unidades
        result = await session.execute(select(Unit))
        existing = result.scalars().all()
        
        if existing:
            print(f"Ya existen {len(existing)} unidades")
            for unit in existing:
                print(f"  - {unit.unit_number}: {unit.owner_name}")
            return
        
        # Crear unidades
        for unit_data in UNITS:
            unit = Unit(
                id=str(uuid.uuid4()),
                **unit_data,
                current_balance=0.00,
                is_active=True
            )
            session.add(unit)
        
        await session.commit()
        print(f"✅ Se crearon {len(UNITS)} unidades")

if __name__ == "__main__":
    asyncio.run(seed_units())
