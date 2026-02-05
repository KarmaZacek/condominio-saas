import sys
import os
import asyncio
from sqlalchemy import select

# 1. Configurar el path para que encuentre tu aplicación 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session_factory as SessionLocal
from app.models.models import Condominium, User, Category, Unit, UserRole
from app.core.security import hash_password as get_password_hash # Asegúrate de que esta función exista en core/security.py
from app.models.models import UnitStatus # Asegúrate de que exista

# Colores estándar para las categorías (UI)
CATEGORY_COLORS = {
    "income": "#10B981", # Verde
    "expense": "#EF4444", # Rojo
    "common": "#3B82F6"   # Azul
}

async def create_client(name: str, admin_email: str, admin_pass: str, units_count: int):
    async with SessionLocal() as db:
        print(f"🏗️  Creando entorno para: {name}...")

        # --- 1. Crear el Condominio ---
        new_condo = Condominium(
            name=name,
            plan_type="pro",
            is_active=True
        )
        db.add(new_condo)
        await db.flush() # Flush para obtener el ID del condo
        print(f"✅ Condominio creado con ID: {new_condo.id}")

        # --- 2. Crear Categorías Base ---
        # Es vital crearlas asociadas a ESTE condominio
        base_categories = [
            # Ingresos
            {"name": "Cuota de Mantenimiento", "type": "INCOME", "is_common": True, "color": CATEGORY_COLORS["income"]},
            {"name": "Multas y Recargos", "type": "INCOME", "is_common": True, "color": "#F59E0B"},
            # Gastos
            {"name": "Servicios (Luz/Agua)", "type": "EXPENSE", "is_common": True, "color": CATEGORY_COLORS["common"]},
            {"name": "Vigilancia", "type": "EXPENSE", "is_common": True, "color": "#6366F1"},
            {"name": "Mantenimiento General", "type": "EXPENSE", "is_common": True, "color": "#6B7280"},
            {"name": "Jardinería", "type": "EXPENSE", "is_common": True, "color": "#10B981"},
            {"name": "Limpieza", "type": "EXPENSE", "is_common": True, "color": "#EC4899"},
            {"name": "Administración", "type": "EXPENSE", "is_common": True, "color": "#8B5CF6"},
            # Categorías Especiales (Ocultas en reportes de gastos reales)
            {"name": "Multas (Registro)", "type": "EXPENSE", "is_common": False, "color": "#EF4444"},
            {"name": "Emisión de Cuota", "type": "EXPENSE", "is_common": False, "color": "#9CA3AF"},
        ]

        for cat in base_categories:
            new_cat = Category(
                name=cat["name"],
                type=cat["type"], # Asegúrate que tu modelo use String o Enum aquí
                is_common_expense=cat["is_common"],
                color=cat["color"],
                condominium_id=new_condo.id
            )
            db.add(new_cat)
            await db.flush() # <--- ¡AGREGA ESTA LÍNEA! (Guarda uno por uno)
        print("✅ Categorías base creadas.")

        # --- 3. Crear Usuario Administrador ---
        admin_user = User(
            email=admin_email,
            password_hash=get_password_hash(admin_pass),
            full_name="Administrador Principal",
            role=UserRole.ADMIN if hasattr(UserRole, 'ADMIN') else "admin", # Ajusta según tu Enum
            is_active=True,
            email_verified=True,
            condominium_id=new_condo.id
        )
        db.add(admin_user)
        print(f"✅ Usuario Admin creado: {admin_email}")

        # --- 4. Crear Unidades (Casas) ---
        for i in range(1, units_count + 1):
            unit = Unit(
                unit_number=str(i),
                monthly_fee=1500.00, # Valor por defecto
                balance=0,
                status= UnitStatus.OCCUPIED, # O tu enum correspondiente
                condominium_id=new_condo.id
            )
            db.add(unit)
            await db.flush()
        print(f"✅ {units_count} Unidades creadas.")

        await db.commit()
        print("🚀 ¡PROCESO COMPLETADO EXITOSAMENTE!")

if __name__ == "__main__":
    # Cambia estos datos para tu prueba
    NOMBRE_CONDOMINIO = "Residencial Demo SaaS"
    ADMIN_EMAIL = "admin@demo.com"
    ADMIN_PASS = "123456"
    NUM_CASAS = 10

    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(create_client(NOMBRE_CONDOMINIO, ADMIN_EMAIL, ADMIN_PASS, NUM_CASAS))
