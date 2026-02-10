"""
Servicio de Automatización de Cargos Mensuales
"""
from datetime import date
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import select, and_, func
from app.models.models import Unit, Transaction, Category, User, TransactionStatus, CategoryType
from app.core.database import async_session_factory

async def generate_monthly_fees_job():
    """
    Tarea programada: Genera los cargos de 'Emisión de Cuota' para el mes actual.
    Retorna un diccionario con el resultado de la operación.
    """
    print(f"⏰ [AUTOMATION] Iniciando generación de cuotas...")
    
    async with async_session_factory() as db:
        try:
            # 1. Definir fechas
            today = date.today()
            current_period = today.strftime("%Y-%m")
            charge_date = today.replace(day=1) # Siempre el día 1

            # 2. Validar Categoría
            cat_query = select(Category).where(Category.name == "Emisión de Cuota")
            cat_result = await db.execute(cat_query)
            category = cat_result.scalar_one_or_none()

            if not category:
                print("❌ Error: No existe categoría 'Emisión de Cuota'")
                return {"success": False, "message": "Falta categoría 'Emisión de Cuota'", "count": 0}

            # 3. Validar Admin (Usamos el primero que encontremos como 'System User')
            admin_query = select(User).where(User.role == "admin").limit(1)
            admin_result = await db.execute(admin_query)
            admin_user = admin_result.scalar_one_or_none()
            
            if not admin_user:
                return {"success": False, "message": "No hay usuario admin para asignar el cargo", "count": 0}

            # 4. CHEQUEO DE SEGURIDAD (¿Ya existen?)
            # Evita duplicar cargos si se corre el script dos veces en el mismo mes
            check_query = select(func.count(Transaction.id)).where(
                and_(
                    Transaction.category_id == category.id,
                    Transaction.fiscal_period == current_period,
                    Transaction.type == CategoryType.EXPENSE
                )
            )
            check_result = await db.execute(check_query)
            existing_count = check_result.scalar()

            if existing_count > 0:
                msg = f"Ya existen {existing_count} cargos para {current_period}. No se duplicaron."
                print(f"⚠️ {msg}")
                return {"success": True, "message": msg, "count": 0, "existing": existing_count}

            # 5. Obtener Unidades Ocupadas
            units_query = select(Unit).where(Unit.status == 'OCCUPIED')
            units_result = await db.execute(units_query)
            units = units_result.scalars().all()

            if not units:
                return {"success": True, "message": "No hay unidades ocupadas", "count": 0}

            # 6. Generar Cargos
            count = 0
            total_amount = 0

            for unit in units:
                amount = unit.monthly_fee if unit.monthly_fee else Decimal("300.00")
                
                new_tx = Transaction(
                    id=uuid4(),
                    unit_id=unit.id,
                    category_id=category.id,
                    created_by=admin_user.id,
                    type=CategoryType.EXPENSE,
                    amount=amount,
                    description=f"Emisión de Cuota - {current_period}",
                    transaction_date=charge_date,
                    status=TransactionStatus.CONFIRMED,
                    fiscal_period=current_period,
                    is_advance_payment=False,
                    is_late_payment=False,
                    
                    # ✅ CORRECCIÓN CRÍTICA AQUÍ:
                    # Pasamos el ID del condominio de la unidad a la transacción
                    condominium_id=unit.condominium_id 
                )
                db.add(new_tx)
                
                # Actualizar saldo de la unidad (Cargo = Resta saldo)
                # Nota: Dependiendo de tu lógica contable, un "cargo" (deuda) podría restar saldo a favor
                # o sumar deuda. Asumimos que resta del balance actual.
                unit.balance -= amount
                count += 1
                total_amount += amount

            await db.commit()
            
            success_msg = f"Corte completado. Se generaron {count} cargos."
            print(f"✅ {success_msg}")
            return {"success": True, "message": success_msg, "count": count}

        except Exception as e:
            await db.rollback()
            print(f"❌ Error crítico: {e}")
            # Importante: Imprimir el traceback para depurar si vuelve a fallar
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Error interno: {str(e)}", "count": 0}
