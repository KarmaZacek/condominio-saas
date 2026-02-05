import asyncio
from sqlalchemy import text
from app.core.database import async_session_factory

async def seed_all():
    async with async_session_factory() as session:
        # Verificar si ya hay categorías
        result = await session.execute(text("SELECT COUNT(*) FROM categories"))
        count = result.scalar()
        
        if count == 0:
            print("Insertando categorías...")
            await session.execute(text("""
                INSERT INTO categories (id, name, type, description, color, icon, is_active, is_system) VALUES
                (gen_random_uuid(), 'Cuota de Mantenimiento', 'INCOME', 'Cuota mensual ordinaria', '#10B981', 'home', true, true),
                (gen_random_uuid(), 'Cuota Extraordinaria', 'INCOME', 'Cuotas especiales aprobadas', '#3B82F6', 'star', true, true),
                (gen_random_uuid(), 'Multas y Recargos', 'INCOME', 'Multas por reglamento o recargos', '#F59E0B', 'alert-circle', true, true),
                (gen_random_uuid(), 'Otros Ingresos', 'INCOME', 'Ingresos diversos', '#8B5CF6', 'plus-circle', true, false),
                (gen_random_uuid(), 'Mantenimiento General', 'EXPENSE', 'Reparaciones y mantenimiento', '#EF4444', 'tool', true, true),
                (gen_random_uuid(), 'Servicios (Luz/Agua)', 'EXPENSE', 'Pago de servicios públicos', '#F97316', 'zap', true, true),
                (gen_random_uuid(), 'Vigilancia', 'EXPENSE', 'Seguridad y vigilancia', '#EC4899', 'shield', true, true),
                (gen_random_uuid(), 'Jardinería', 'EXPENSE', 'Mantenimiento de áreas verdes', '#22C55E', 'sun', true, true),
                (gen_random_uuid(), 'Limpieza', 'EXPENSE', 'Servicio de limpieza', '#06B6D4', 'trash-2', true, true),
                (gen_random_uuid(), 'Administración', 'EXPENSE', 'Gastos administrativos', '#6366F1', 'briefcase', true, true),
                (gen_random_uuid(), 'Otros Gastos', 'EXPENSE', 'Gastos diversos', '#78716C', 'minus-circle', true, false)
            """))
            await session.commit()
            print("✅ Categorías insertadas")
        else:
            print(f"Ya existen {count} categorías")
        
        # Verificar si ya hay unidades
        result = await session.execute(text("SELECT COUNT(*) FROM units"))
        count = result.scalar()
        
        if count == 0:
            print("Insertando unidades...")
            await session.execute(text("""
                INSERT INTO units (id, unit_number, building, floor, status, monthly_fee, balance, notes) VALUES
                (gen_random_uuid(), '101', 'A', 1, 'OCCUPIED', 1500.00, 0.00, 'Juan Pérez García'),
                (gen_random_uuid(), '102', 'A', 1, 'OCCUPIED', 1500.00, -3000.00, 'María García López'),
                (gen_random_uuid(), '103', 'A', 1, 'OCCUPIED', 1500.00, 1500.00, 'Carlos López Hernández'),
                (gen_random_uuid(), '104', 'A', 1, 'OCCUPIED', 1500.00, 0.00, 'Ana Martínez Ruiz'),
                (gen_random_uuid(), '105', 'A', 1, 'OCCUPIED', 1500.00, -1500.00, 'Roberto Sánchez Díaz'),
                (gen_random_uuid(), '106', 'A', 1, 'OCCUPIED', 1500.00, 0.00, 'Laura Torres Mendoza'),
                (gen_random_uuid(), '201', 'A', 2, 'OCCUPIED', 1600.00, 0.00, 'Pedro Ramírez Castro'),
                (gen_random_uuid(), '202', 'A', 2, 'OCCUPIED', 1600.00, 0.00, 'Sofía Flores Vega')
            """))
            await session.commit()
            print("✅ Unidades insertadas")
        else:
            print(f"Ya existen {count} unidades")
        
        # Mostrar resumen
        result = await session.execute(text("SELECT id, name, type FROM categories ORDER BY type, name"))
        categories = result.fetchall()
        print("\n📋 Categorías:")
        for cat in categories:
            print(f"  - {cat[1]} ({cat[2]})")
        
        result = await session.execute(text("SELECT id, unit_number, notes, balance FROM units ORDER BY unit_number"))
        units = result.fetchall()
        print("\n🏠 Unidades:")
        for unit in units:
            print(f"  - Casa {unit[1]}: {unit[2]} (Saldo: ${unit[3]})")

if __name__ == "__main__":
    asyncio.run(seed_all())
