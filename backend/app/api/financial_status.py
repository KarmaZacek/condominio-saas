"""
Rutas API para Estado Financiero
Manejo dinámico de cuotas normales, atrasadas y adelantadas
CON CÁLCULO DE REMANENTE Y EXCLUSIÓN DE CARGOS VIRTUALES
"""
from uuid import UUID
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, case, extract, literal, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_user, AuthenticatedUser
from app.models.models import (
    Transaction, TransactionStatus, CategoryType, Unit, User, Category
)

router = APIRouter(prefix="/reports", tags=["Estado Financiero"])


# ==================== SCHEMAS ====================
# (Se mantienen igual que antes)
class IncomeBreakdown(BaseModel):
    normal_fees: Decimal
    normal_fees_count: int
    late_fees_received: Decimal
    late_fees_count: int
    advances_applied: Decimal
    advances_applied_count: int
    advances_received: Decimal
    advances_received_count: int

class FinancialTotals(BaseModel):
    initial_balance: Decimal
    total_income_cash: Decimal
    total_expenses: Decimal
    net_period_flow: Decimal
    final_balance: Decimal
    advance_reserve: Decimal
    available_balance: Decimal

class AdvanceReserveDetail(BaseModel):
    fiscal_period: str
    fiscal_period_label: str
    amount: Decimal
    units_count: int

class UnitAdvanceDetail(BaseModel):
    unit_id: str
    unit_number: str
    owner_name: Optional[str]
    fiscal_period: str
    fiscal_period_label: str
    amount: Decimal
    transaction_date: date
    description: str

class LatePaymentDetail(BaseModel):
    unit_id: str
    unit_number: str
    owner_name: Optional[str]
    original_period: str
    original_period_label: str
    amount: Decimal
    received_date: date
    description: str

class FinancialStatusResponse(BaseModel):
    period: str
    period_label: str
    income_breakdown: IncomeBreakdown
    totals: FinancialTotals
    advance_reserve_summary: List[AdvanceReserveDetail]
    advance_reserve_detail: List[UnitAdvanceDetail]
    late_payments_received: List[LatePaymentDetail]


# ==================== HELPERS ====================

def get_period_label(period: str) -> str:
    months = {
        "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
        "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
        "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    }
    year, month = period.split("-")
    return f"{months.get(month, month)} {year}"


def get_month_date_range(year: int, month: int) -> tuple:
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    return start_date, end_date


# ==================== ENDPOINT PRINCIPAL ====================

@router.get(
    "/financial-status",
    response_model=FinancialStatusResponse,
    summary="Estado financiero del condominio"
)
async def get_financial_status(
    period: Optional[str] = Query(
        None, 
        pattern=r'^\d{4}-(0[1-9]|1[0-2])$',
        description="Período a consultar (YYYY-MM). Por defecto: mes actual"
    ),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el estado financiero completo.
    EXCLUYE cargos virtuales ("Emisión de Cuota") de los totales de caja.
    """
    today = date.today()
    current_period = today.strftime("%Y-%m")
    
    if period is None:
        period = current_period
    
    year, month = map(int, period.split("-"))
    month_start, month_end = get_month_date_range(year, month)
    
    base_filter = Transaction.status == TransactionStatus.CONFIRMED
    
    # 🔍 1. IDENTIFICAR CATEGORÍA DE CARGO VIRTUAL
    # Buscamos el ID de la categoría que usamos para generar deuda pero que no es gasto real
    # ✅ CRÍTICO: Filtrar por condominio
    cat_query = select(Category.id).where(
        and_(
            Category.name == "Emisión de Cuota",
            or_(
                Category.is_system == True,
                Category.condominium_id == current_user.condominium_id
            )
        )
    )
    cat_result = await db.execute(cat_query)
    internal_charge_id = cat_result.scalar()

    # Filtro para EXCLUIR cargos internos de los cálculos de dinero
    # Si existe la categoría, excluimos ese ID. Si no existe (primera vez), no excluimos nada.
    exclude_internal_charges = Transaction.category_id != internal_charge_id if internal_charge_id else True

    # ========================================
    # 2. CÁLCULO DE SALDO INICIAL (REMANENTE)
    # ========================================
    # Suma de (Ingresos - Gastos Reales) ANTES del mes consultado
    # ✅ CRÍTICO: Filtrar por condominio
    
    initial_balance_query = select(
        func.coalesce(func.sum(
            case(
                (Transaction.type == CategoryType.INCOME, Transaction.amount),
                # Solo restamos si es Gasto Y NO es cargo virtual
                else_=case(
                    (and_(
                        Transaction.type == CategoryType.EXPENSE,
                        exclude_internal_charges  # <--- CLAVE: Excluir cargo virtual
                    ), -Transaction.amount),
                    else_=0
                )
            )
        ), 0)
    ).where(and_(
        base_filter,
        Transaction.condominium_id == current_user.condominium_id,  # ✅ Filtro multi-tenancy
        Transaction.transaction_date < month_start
    ))
    
    initial_balance_result = await db.execute(initial_balance_query)
    initial_balance = initial_balance_result.scalar() or Decimal(0)

    # ========================================
    # 3. CÁLCULO DE FLUJO DEL MES
    # ========================================
    
    income_query = select(
        # --- INGRESOS (NO TOCAR - Aquí queremos ver TODO el dinero que entra, incluidas multas) ---
        func.coalesce(func.sum(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period == period,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), Transaction.amount), else_=0
        )), 0).label("normal_fees"),
        
        func.count(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period == period,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), 1), else_=None
        )).label("normal_fees_count"),
        
        # ... (Mantén los bloques de late_fees y advances igual que antes) ...
        func.coalesce(func.sum(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period < period,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), Transaction.amount), else_=0
        )), 0).label("late_fees_received"),

        func.count(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period < period,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), 1), else_=None
        )).label("late_fees_count"),

        func.coalesce(func.sum(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period == period,
                Transaction.transaction_date < month_start
            ), Transaction.amount), else_=0
        )), 0).label("advances_applied"),

        func.count(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period == period,
                Transaction.transaction_date < month_start
            ), 1), else_=None
        )).label("advances_applied_count"),

        func.coalesce(func.sum(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period > period,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), Transaction.amount), else_=0
        )), 0).label("advances_received"),

        func.count(case(
            (and_(
                Transaction.type == CategoryType.INCOME,
                Transaction.fiscal_period > period,
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), 1), else_=None
        )).label("advances_received_count"),

        # --- GASTOS REALES (Lógica Blindada) ---
        func.coalesce(func.sum(case(
            (and_(
                Transaction.type == CategoryType.EXPENSE,
                
                # 1. Filtro de cargos internos (igual que antes)
                exclude_internal_charges, 
                
                # ✅ USAR ESTA LÓGICA (requiere importar or_ al inicio)
                or_(
                    Category.is_common_expense == True,
                    Category.is_common_expense == None 
                ),

                Transaction.transaction_date >= month_start,
                Transaction.transaction_date < month_end
            ), Transaction.amount), else_=0
        )), 0).label("total_expenses"),
        
    ).outerjoin( # <--- ✅ CAMBIO CRÍTICO: Usar 'outerjoin' (LEFT JOIN)
        Category, 
        Transaction.category_id == Category.id
    ).where(and_(
        base_filter,
        Transaction.condominium_id == current_user.condominium_id  # ✅ Filtro multi-tenancy
    ))
    
    income_result = await db.execute(income_query)
    income_data = income_result.one()
    
    # ========================================
    # 4. RESERVA DE ADELANTOS
    # ========================================
    # ✅ CRÍTICO: Filtrar por condominio
    
    reserve_query = select(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).where(and_(
        base_filter,
        Transaction.condominium_id == current_user.condominium_id,  # ✅ Filtro multi-tenancy
        Transaction.type == CategoryType.INCOME,
        Transaction.fiscal_period > period
    ))
    
    reserve_result = await db.execute(reserve_query)
    advance_reserve = reserve_result.scalar() or Decimal(0)
    
    # ========================================
    # 5. DETALLES (Summary y Listas)
    # ========================================
    
    # ... (Se mantiene igual, solo ingresos y adelantos, no afecta gastos) ...
    reserve_detail_query = select(
        Transaction.fiscal_period,
        func.sum(Transaction.amount).label("amount"),
        func.count(func.distinct(Transaction.unit_id)).label("units_count")
    ).where(and_(
        base_filter,
        Transaction.condominium_id == current_user.condominium_id,  # ✅ Filtro multi-tenancy
        Transaction.type == CategoryType.INCOME,
        Transaction.fiscal_period > period
    )).group_by(Transaction.fiscal_period).order_by(Transaction.fiscal_period)
    
    reserve_detail_result = await db.execute(reserve_detail_query)
    reserve_summary = [
        AdvanceReserveDetail(
            fiscal_period=row.fiscal_period,
            fiscal_period_label=get_period_label(row.fiscal_period),
            amount=row.amount,
            units_count=row.units_count
        ) for row in reserve_detail_result
    ]
    
    advance_detail_query = select(Transaction).options(
        selectinload(Transaction.unit).selectinload(Unit.owner)
    ).where(and_(
        base_filter,
        Transaction.condominium_id == current_user.condominium_id,  # ✅ Filtro multi-tenancy
        Transaction.type == CategoryType.INCOME,
        Transaction.fiscal_period > period,
        Transaction.unit_id.isnot(None)
    )).order_by(Transaction.fiscal_period, Transaction.transaction_date)
    
    advance_detail_result = await db.execute(advance_detail_query)
    advance_detail = [
        UnitAdvanceDetail(
            unit_id=str(tx.unit_id),
            unit_number=tx.unit.unit_number if tx.unit else "N/A",
            owner_name=tx.unit.owner.full_name if tx.unit and tx.unit.owner else None,
            fiscal_period=tx.fiscal_period,
            fiscal_period_label=get_period_label(tx.fiscal_period),
            amount=tx.amount,
            transaction_date=tx.transaction_date,
            description=tx.description or ""
        ) for tx in advance_detail_result.scalars().all()
    ]
    
    late_payments_query = select(Transaction).options(
        selectinload(Transaction.unit).selectinload(Unit.owner)
    ).where(and_(
        base_filter,
        Transaction.condominium_id == current_user.condominium_id,  # ✅ Filtro multi-tenancy
        Transaction.type == CategoryType.INCOME,
        Transaction.fiscal_period < period,
        Transaction.transaction_date >= month_start,
        Transaction.transaction_date < month_end,
        Transaction.unit_id.isnot(None)
    )).order_by(Transaction.fiscal_period, Transaction.transaction_date)
    
    late_payments_result = await db.execute(late_payments_query)
    late_payments_detail = [
        LatePaymentDetail(
            unit_id=str(tx.unit_id),
            unit_number=tx.unit.unit_number if tx.unit else "N/A",
            owner_name=tx.unit.owner.full_name if tx.unit and tx.unit.owner else None,
            original_period=tx.fiscal_period,
            original_period_label=get_period_label(tx.fiscal_period),
            amount=tx.amount,
            received_date=tx.transaction_date,
            description=tx.description or ""
        ) for tx in late_payments_result.scalars().all()
    ]
    
    # ========================================
    # 6. CÁLCULOS FINALES
    # ========================================
    
    normal_fees = Decimal(income_data.normal_fees)
    late_fees_received = Decimal(income_data.late_fees_received)
    advances_applied = Decimal(income_data.advances_applied)
    advances_received = Decimal(income_data.advances_received)
    total_expenses = Decimal(income_data.total_expenses)
    
    # Ingresos en caja del mes
    total_income_cash = normal_fees + late_fees_received + advances_received
    
    # Flujo neto del mes
    net_period_flow = total_income_cash - total_expenses
    
    # Saldo Final en Caja = Saldo Inicial + Flujo Neto
    final_balance = initial_balance + net_period_flow
    
    # Saldo Disponible = Saldo Final - Reserva de Adelantos
    available_balance = final_balance - advance_reserve
    
    return FinancialStatusResponse(
        period=period,
        period_label=get_period_label(period),
        income_breakdown=IncomeBreakdown(
            normal_fees=normal_fees,
            normal_fees_count=income_data.normal_fees_count,
            late_fees_received=late_fees_received,
            late_fees_count=income_data.late_fees_count,
            advances_applied=advances_applied,
            advances_applied_count=income_data.advances_applied_count,
            advances_received=advances_received,
            advances_received_count=income_data.advances_received_count
        ),
        totals=FinancialTotals(
            initial_balance=initial_balance,
            total_income_cash=total_income_cash,
            total_expenses=total_expenses,
            net_period_flow=net_period_flow,
            final_balance=final_balance,
            advance_reserve=advance_reserve,
            available_balance=available_balance
        ),
        advance_reserve_summary=reserve_summary,
        advance_reserve_detail=advance_detail,
        late_payments_received=late_payments_detail
    )
