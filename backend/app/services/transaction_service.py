"""
Servicio de transacciones.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Tuple
from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.models import (
    Transaction, Category, Unit, User,
    CategoryType, TransactionStatus, PaymentMethod
)
from app.schemas.entities import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    TransactionSummary, TransactionListResponse, TransactionWithBalance,
    PaginationMeta
)


def get_current_fiscal_period() -> str:
    """Obtiene el período fiscal actual (YYYY-MM)."""
    return datetime.now().strftime("%Y-%m")


def classify_payment(fiscal_period: str, transaction_date: date) -> tuple:
    """Clasifica un pago como adelantado, atrasado o normal."""
    transaction_period = transaction_date.strftime("%Y-%m")
    is_advance = fiscal_period > transaction_period
    is_late = fiscal_period < transaction_period
    return (is_advance, is_late)


class TransactionService:
    """Servicio para gestión de transacciones."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_transactions(
        self,
        page: int = 1,
        limit: int = 50,
        type: Optional[CategoryType] = None,
        category_id: Optional[str] = None,
        unit_id: Optional[str] = None,
        status: Optional[TransactionStatus] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        fiscal_period: Optional[str] = None,
        min_amount: Optional[Decimal] = None,
        max_amount: Optional[Decimal] = None,
        search: Optional[str] = None,
        has_receipt: Optional[bool] = None,
        is_advance: Optional[bool] = None,
        is_late: Optional[bool] = None,
        user_id: Optional[str] = None,
        user_role: str = "admin"
    ) -> TransactionListResponse:
        
        # --- 1. Filtros ---
        filters = []
        if type: 
            filters.append(Transaction.type == type)
        if category_id: filters.append(Transaction.category_id == category_id)
        if unit_id: filters.append(Transaction.unit_id == unit_id)
        if fiscal_period: filters.append(Transaction.fiscal_period == fiscal_period)
        if from_date: filters.append(Transaction.transaction_date >= from_date)
        if to_date: filters.append(Transaction.transaction_date <= to_date)
        if min_amount: filters.append(Transaction.amount >= min_amount)
        if max_amount: filters.append(Transaction.amount <= max_amount)
        if search: filters.append(Transaction.description.ilike(f"%{search}%"))
        
        if has_receipt is not None:
            filters.append(Transaction.receipt_url.isnot(None) if has_receipt else Transaction.receipt_url.is_(None))
        
        # Filtros booleanos explícitos (Sin .is_(True) para máxima compatibilidad)
        if is_advance is not None: 
            filters.append(Transaction.is_advance_payment == is_advance)
        if is_late is not None: 
            filters.append(Transaction.is_late_payment == is_late)
        
        # Filtro de Status
        if status:
            filters.append(Transaction.status == status)
        else:
            filters.append(or_(
                Transaction.status != TransactionStatus.CANCELLED,
                Transaction.status.is_(None)
            ))

        if user_role == "resident" and unit_id:
            filters.append(Transaction.unit_id == unit_id)
            
        # ------------------------------------------------------------------
        # NUEVO: Obtener ID de "Emisión de Cuota" para excluirlo de sumas
        # ------------------------------------------------------------------
        cat_query = select(Category.id).where(Category.name == "Emisión de Cuota")
        cat_result = await self.db.execute(cat_query)
        internal_charge_id = cat_result.scalar()
        
        # ------------------------------------------------------------------
        # 1. Definición de "Dinero Real" (Combinando tus dos reglas)
        # ------------------------------------------------------------------
        
        # Regla A: No ser "Emisión de Cuota"
        rule_not_internal = (Transaction.category_id != internal_charge_id) if internal_charge_id else True
        
        # Regla B: Ser Gasto Común
        rule_is_common = or_(
            Category.is_common_expense == True,
            Category.is_common_expense == None
        )
        
        # Combinación: Dinero Real
        is_real_money = and_(rule_not_internal, rule_is_common)

        # ------------------------------------------------------------------
        # Obtener IDs de categorías NO comunes (ej: Multas) para excluir sus GASTOS
        # ------------------------------------------------------------------
        non_common_query = select(Category.id).where(Category.is_common_expense == False)
        non_common_result = await self.db.execute(non_common_query)
        non_common_ids = [row[0] for row in non_common_result.fetchall()]
        
        # Excluir gastos de categorías no comunes (los ingresos de multas SÍ pasan)
        if non_common_ids:
            filters.append(
                or_(
                    Transaction.type == CategoryType.INCOME,
                    Transaction.category_id.notin_(non_common_ids)
                )
            )

        # ------------------------------------------------------------------
        # 2. DEFINICIÓN DE COLUMNAS (Para evitar errores de paréntesis)
        # ------------------------------------------------------------------
        
        # [0] Total Ingresos
        col_income = func.coalesce(func.sum(case((Transaction.type == CategoryType.INCOME, Transaction.amount), else_=0)), 0)
        
        # [1] Total Gastos (Usando la variable is_real_money que definimos antes)
        col_expense = func.coalesce(func.sum(case(
            (and_(Transaction.type == CategoryType.EXPENSE, is_real_money), Transaction.amount), 
            else_=0
        )), 0)
        
        # [2] Conteo Total
        col_count = func.count(Transaction.id)
        
        # [3] Conteo Adelantados
        col_adv_count = func.count(case((and_(Transaction.is_advance_payment, Transaction.type == CategoryType.INCOME), 1), else_=None))
        
        # [4] Monto Adelantados
        col_adv_amount = func.coalesce(func.sum(case((and_(Transaction.is_advance_payment, Transaction.type == CategoryType.INCOME), Transaction.amount), else_=0)), 0)
        
        # [5] Conteo Atrasados
        col_late_count = func.count(case((and_(Transaction.is_late_payment, Transaction.type == CategoryType.INCOME), 1), else_=None))
        
        # [6] Monto Atrasados
        col_late_amount = func.coalesce(func.sum(case((and_(Transaction.is_late_payment, Transaction.type == CategoryType.INCOME), Transaction.amount), else_=0)), 0)

        # ------------------------------------------------------------------
        # 3. CONSTRUCCIÓN DE LA QUERY
        # ------------------------------------------------------------------
        summary_query = select(
            col_income,      # 0
            col_expense,     # 1
            col_count,       # 2
            col_adv_count,   # 3
            col_adv_amount,  # 4
            col_late_count,  # 5
            col_late_amount  # 6
        ).outerjoin(
            Category, Transaction.category_id == Category.id
        )
        
        if filters:
            summary_query = summary_query.where(and_(*filters))
        
        summary_result = await self.db.execute(summary_query)
        summary_row = summary_result.one()
        
        # Extracción segura
        total_income = summary_row[0] or Decimal(0)
        total_expense = summary_row[1] or Decimal(0)
        total_items = summary_row[2] or 0
        advance_count = summary_row[3] or 0
        advance_amount = summary_row[4] or Decimal(0)
        late_count = summary_row[5] or 0
        late_amount = summary_row[6] or Decimal(0)
        
        # --- 3. Query de Lista ---
        query = (
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.unit),
                selectinload(Transaction.created_by_user)
            )
        )
        
        if filters:
            query = query.where(and_(*filters))
            
        query = query.order_by(desc(Transaction.transaction_date), desc(Transaction.created_at))
        
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        transactions = result.scalars().all()
        
        transaction_responses = [self._to_response(t) for t in transactions]
        total_pages = (total_items + limit - 1) // limit
        
        return TransactionListResponse(
            data=transaction_responses,
            summary=TransactionSummary(
                total_income=total_income,
                total_expense=total_expense,
                net_balance=total_income - total_expense,
                transaction_count=total_items,
                advance_payment_count=advance_count,
                advance_payment_amount=advance_amount,
                late_payment_count=late_count,
                late_payment_amount=late_amount,
            ),
            pagination=PaginationMeta(
                page=page,
                limit=limit,
                total_items=total_items,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )
        )
    
    
    # ✅ ESTA ES LA FUNCIÓN QUE FALTABA (Restaurada)
    async def get_unit_transactions(
        self,
        unit_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> List[TransactionResponse]:
        """Obtiene transacciones simples de una vivienda (usado por Units router)."""
        query = (
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.unit),
                selectinload(Transaction.created_by_user)
            )
            .where(Transaction.unit_id == unit_id)
            .where(
                or_(
                    Transaction.status == TransactionStatus.CONFIRMED,
                    Transaction.status.is_(None)
                )
            )
        )
        
        if from_date:
            query = query.where(Transaction.transaction_date >= from_date)
        if to_date:
            query = query.where(Transaction.transaction_date <= to_date)
        
        query = query.order_by(desc(Transaction.transaction_date))
        
        result = await self.db.execute(query)
        transactions = result.scalars().all()
        
        return [self._to_response(t) for t in transactions]

    async def get_transaction(self, transaction_id: str) -> Optional[Transaction]:
        result = await self.db.execute(
            select(Transaction)
            .options(selectinload(Transaction.category), selectinload(Transaction.unit), selectinload(Transaction.created_by_user))
            .where(Transaction.id == transaction_id)
        )
        return result.scalars().first()
    
    async def create_transaction(self, data: TransactionCreate, created_by: str) -> TransactionWithBalance:
        category = await self._get_category(data.category_id)
        if not category: raise ValueError("CATEGORY_NOT_FOUND")
        if category.type != data.type: raise ValueError("CATEGORY_TYPE_MISMATCH")
        
        unit = None
        if data.unit_id:
            unit = await self._get_unit(data.unit_id)
            if not unit: raise ValueError("UNIT_NOT_FOUND")
        elif data.type == CategoryType.INCOME:
            if category.name not in ["Intereses bancarios", "Otros ingresos"]:
                raise ValueError("INCOME_REQUIRES_UNIT")
        
        fiscal_period = data.fiscal_period or data.transaction_date.strftime("%Y-%m")

        if data.type == CategoryType.INCOME and data.unit_id and category.name == "Cuota de Mantenimiento":
            existing = await self._check_duplicate_payment(data.unit_id, data.category_id, fiscal_period)
            if existing: raise ValueError("DUPLICATE_PAYMENT_SAME_PERIOD")
        
        is_advance, is_late = classify_payment(fiscal_period, data.transaction_date)
        
        transaction = Transaction(
            type=data.type, amount=data.amount, description=data.description,
            transaction_date=data.transaction_date, category_id=data.category_id,
            unit_id=data.unit_id, payment_method=data.payment_method,
            reference_number=data.reference_number, notes=data.notes,
            fiscal_period=fiscal_period, is_advance_payment=is_advance,
            is_late_payment=is_late, created_by=created_by,
            status=TransactionStatus.CONFIRMED
        )
        
        self.db.add(transaction)
        
        new_balance = None
        if unit:
            if data.type == CategoryType.INCOME: unit.balance += data.amount
            else: unit.balance -= data.amount
            new_balance = unit.balance
        
        await self.db.flush()
        await self.db.refresh(transaction, ["category", "unit", "created_by_user"])
        return TransactionWithBalance(transaction=self._to_response(transaction), unit_new_balance=new_balance)
    
    async def update_transaction(self, transaction_id: str, data: TransactionUpdate) -> TransactionResponse:
        transaction = await self.get_transaction(transaction_id)
        if not transaction: raise ValueError("TRANSACTION_NOT_FOUND")
        
        old_amount = transaction.amount
        old_unit_id = transaction.unit_id
        old_type = transaction.type
        old_status = transaction.status
        
        if data.amount is not None: transaction.amount = data.amount
        if data.description is not None: transaction.description = data.description
        if data.payment_method is not None: transaction.payment_method = data.payment_method
        if data.reference_number is not None: transaction.reference_number = data.reference_number
        if data.notes is not None: transaction.notes = data.notes
        if data.status is not None: transaction.status = data.status
        
        if data.transaction_date is not None:
            transaction.transaction_date = data.transaction_date
            if transaction.fiscal_period and transaction.type == CategoryType.INCOME:
                adv, late = classify_payment(transaction.fiscal_period, data.transaction_date)
                transaction.is_advance_payment = adv
                transaction.is_late_payment = late
        
        if data.category_id is not None:
            if not await self._get_category(data.category_id): raise ValueError("CATEGORY_NOT_FOUND")
            transaction.category_id = data.category_id
            
        if data.unit_id is not None:
            if data.unit_id and not await self._get_unit(data.unit_id): raise ValueError("UNIT_NOT_FOUND")
            transaction.unit_id = data.unit_id

        if data.status and old_status == TransactionStatus.CONFIRMED:
            if data.status in [TransactionStatus.CANCELLED, TransactionStatus.REFUNDED]:
                if old_unit_id:
                    unit = await self._get_unit(old_unit_id)
                    if unit:
                        if old_type == CategoryType.INCOME: unit.balance -= old_amount
                        else: unit.balance += old_amount
        
        await self.db.flush()
        await self.db.refresh(transaction, ["category", "unit", "created_by_user"])
        return self._to_response(transaction)
    
    async def delete_transaction(self, transaction_id: str) -> bool:
        transaction = await self.get_transaction(transaction_id)
        if not transaction: raise ValueError("TRANSACTION_NOT_FOUND")
        if transaction.status != TransactionStatus.CANCELLED:
            transaction.status = TransactionStatus.CANCELLED
            if transaction.unit_id:
                unit = await self._get_unit(transaction.unit_id)
                if unit:
                    if transaction.type == CategoryType.INCOME: unit.balance -= transaction.amount
                    else: unit.balance += transaction.amount
        await self.db.flush()
        return True
    # ... (Otros métodos existentes como create_transaction, get_transactions...)

    async def cancel_transaction(self, transaction_id: str, user_id: str) -> TransactionResponse:
        """
        Cancela una transacción y revierte su impacto en el saldo.
        """
        # 1. Buscar la transacción (Cargamos Unit para la lógica de saldo)
        query = select(Transaction).options(
            selectinload(Transaction.unit)
        ).where(Transaction.id == transaction_id)
        
        result = await self.db.execute(query)
        transaction = result.scalar_one_or_none()

        if not transaction:
            raise HTTPException(status_code=404, detail="Transacción no encontrada")

        if transaction.status == TransactionStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="La transacción ya está cancelada")

        # 2. Revertir Saldo de la Unidad
        if transaction.status == TransactionStatus.CONFIRMED and transaction.unit:
            # Nota: Al usar selectinload arriba, transaction.unit ya está disponible sin error
            if transaction.type == CategoryType.INCOME:
                transaction.unit.balance -= transaction.amount
            elif transaction.type == CategoryType.EXPENSE:
                transaction.unit.balance += transaction.amount

        # 3. Actualizar estado
        transaction.status = TransactionStatus.CANCELLED
        transaction.updated_at = func.now()
        
        # Guardar cambios
        await self.db.commit()
        
        # ---------------------------------------------------------
        # PASO CRÍTICO (Solución del error MissingGreenlet):
        # ---------------------------------------------------------
        # En Async, después de un commit, el objeto expira. Si intentamos acceder a
        # transaction.category en _to_response, fallará.
        # Debemos RE-CONSULTAR la transacción cargando explícitamente todas las relaciones.
        
        q_refresh = select(Transaction).options(
            selectinload(Transaction.category),
            selectinload(Transaction.unit),
            selectinload(Transaction.created_by_user)
        ).outerjoin(
            Category, Transaction.category_id == Category.id
        )
        result_refresh = await self.db.execute(q_refresh)
        transaction_refreshed = result_refresh.scalar_one()

        return self._to_response(transaction_refreshed)   

    async def add_receipt(self, transaction_id: str, receipt_url: str, thumbnail_url: Optional[str] = None) -> TransactionResponse:
        transaction = await self.get_transaction(transaction_id)
        if not transaction: raise ValueError("TRANSACTION_NOT_FOUND")
        transaction.receipt_url = receipt_url
        transaction.receipt_thumbnail_url = thumbnail_url
        await self.db.commit()
        await self.db.refresh(transaction)
        return self._to_response(transaction)

    async def _check_duplicate_payment(self, unit_id: str, category_id: str, fiscal_period: str) -> Optional[Transaction]:
        result = await self.db.execute(select(Transaction).where(and_(
            Transaction.unit_id == unit_id,
            Transaction.category_id == category_id,
            Transaction.fiscal_period == fiscal_period,
            Transaction.type == CategoryType.INCOME,
            Transaction.status != TransactionStatus.CANCELLED
        )))
        return result.scalars().first()
    
    async def _get_category(self, category_id: str) -> Optional[Category]:
        return (await self.db.execute(select(Category).where(Category.id == category_id))).scalars().first()
    
    async def _get_unit(self, unit_id: str) -> Optional[Unit]:
        return (await self.db.execute(select(Unit).where(Unit.id == unit_id))).scalars().first()
    
    def _to_response(self, transaction: Transaction) -> TransactionResponse:
        return TransactionResponse(
            id=transaction.id,
            type=transaction.type,
            amount=transaction.amount,
            description=transaction.description,
            transaction_date=transaction.transaction_date,
            status=transaction.status,
            category_id=transaction.category_id,
            category_name=transaction.category.name if transaction.category else "",
            category_color=transaction.category.color if transaction.category else "#6B7280",
            unit_id=transaction.unit_id,
            unit_number=transaction.unit.unit_number if transaction.unit else None,
            payment_method=transaction.payment_method,
            reference_number=transaction.reference_number,
            receipt_url=transaction.receipt_url,
            receipt_thumbnail_url=transaction.receipt_thumbnail_url,
            notes=transaction.notes,
            fiscal_period=transaction.fiscal_period,
            is_advance_payment=getattr(transaction, 'is_advance_payment', False),
            is_late_payment=getattr(transaction, 'is_late_payment', False),
            created_by=transaction.created_by,
            created_by_name=transaction.created_by_user.full_name if transaction.created_by_user else "",
            created_at=transaction.created_at,
            updated_at=transaction.updated_at
        )

def get_transaction_service(db: AsyncSession) -> TransactionService:
    return TransactionService(db)
