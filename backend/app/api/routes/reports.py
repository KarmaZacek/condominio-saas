"""
Rutas API para reportes y dashboard
Incluye exportación a Excel con desglose de pagos adelantados y atrasados
"""
from uuid import UUID
from typing import Optional
from datetime import datetime, date, timedelta
from io import BytesIO
from fastapi import Path,  APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_, case, extract, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role, AuthenticatedUser
from app.models.models import (
    Transaction, TransactionStatus, Category, Unit, User, CategoryType, MonthlyReport
)

router = APIRouter(prefix="/reports", tags=["Reportes"])


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_dashboard(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene datos del dashboard principal.
    Los residentes ven solo sus datos, los admin ven todo.
    """
    is_admin = current_user.role == "admin"
    today = date.today()
    current_month_start = today.replace(day=1)
    current_year = today.year
    current_fiscal_period = today.strftime("%Y-%m")
    
    # 🔍 1. IDENTIFICAR CATEGORÍA VIRTUAL
    cat_query = select(Category.id).where(Category.name == "Emisión de Cuota")
    cat_result = await db.execute(cat_query)
    internal_charge_id = cat_result.scalar()

    # Si existe la categoría, excluimos ese ID. Si no, permitimos todo (True)
    exclude_virtual = Transaction.category_id != internal_charge_id if internal_charge_id else True

    # Filtro base - TODOS ven datos del condominio completo
    # Los residentes ven el resumen financiero general (transparencia)
    # pero NO ven admin_stats (deudores, detalles de otras viviendas)
    base_filter = Transaction.status == TransactionStatus.CONFIRMED
    # NOTA: Ya no filtramos por unit_id aquí - el residente ve el resumen del condominio
    # if not is_admin and current_user.unit_id:
    #     base_filter = and_(base_filter, Transaction.unit_id == current_user.unit_id)
    
    # Definimos qué es un gasto real (Común o Sin Categoría)
    # Esto excluye las Multas (que son is_common_expense=False)
    is_common_expense_filter = or_(
        Category.is_common_expense == True,
        Category.is_common_expense == None
    )   
    # === Totales del mes actual CON desglose de adelantados/atrasados ===
    month_query = (
        select(
            # 1. Total de ingresos (Igual que antes)
            func.coalesce(func.sum(
                case((Transaction.type == CategoryType.INCOME, Transaction.amount), else_=0)
            ), 0).label("income"),

            # 2. Gastos (MODIFICADO)
            func.coalesce(func.sum(
                case((and_(
                    Transaction.type == CategoryType.EXPENSE,
                    exclude_virtual,           # Tu filtro de cuota interna
                    is_common_expense_filter   # ✅ NUEVO: Filtro de multas
                ), Transaction.amount), else_=0)
            ), 0).label("expense"),

            # Ingresos adelantados (pagos que aplican a meses futuros)
            func.coalesce(func.sum(
                case((and_(
                    Transaction.type == CategoryType.INCOME,
                    Transaction.is_advance_payment == True
                ), Transaction.amount), else_=0)
            ), 0).label("advance_income"),
            # Ingresos atrasados (pagos que aplican a meses anteriores)
            func.coalesce(func.sum(
                case((and_(
                    Transaction.type == CategoryType.INCOME,
                    Transaction.is_late_payment == True
                ), Transaction.amount), else_=0)
            ), 0).label("late_income")
        )
        .select_from(Transaction)              # Aseguramos origen
        .outerjoin(Category, Transaction.category_id == Category.id) # ✅ VITAL: Unir categorías
        .where(
            # Aquí van tus filtros de fecha que ya tenías
            Transaction.transaction_date >= current_month_start,
            Transaction.status == TransactionStatus.CONFIRMED 
            # (Ajusta los filtros del where según lo que ya tenías en tu código original)
        )
    )
    
    month_result = await db.execute(month_query)
    month_data = month_result.one()
    
    # Calcular ingresos normales (no adelantados ni atrasados)
    total_income = float(month_data.income)
    advance_income = float(month_data.advance_income)
    late_income = float(month_data.late_income)
    normal_income = total_income - advance_income - late_income
    
    ## === Totales del año ===
    year_start = date(current_year, 1, 1)
    year_query = (
        select(
            # 1. Ingresos (Igual)
            func.coalesce(func.sum(
                case((Transaction.type == CategoryType.INCOME, Transaction.amount), else_=0)
            ), 0).label("income"),
            
            # 2. Gastos (CORREGIDO)
            func.coalesce(func.sum(
                case((and_(
                    Transaction.type == CategoryType.EXPENSE,
                    exclude_virtual,            # Tu filtro de cuota interna
                    is_common_expense_filter    # ✅ AGREGADO: Filtro de multas
                ), Transaction.amount), else_=0)
            ), 0).label("expense")
        )
        .select_from(Transaction)
        .outerjoin(Category, Transaction.category_id == Category.id) # ✅ VITAL: El join
        .where(
            and_(base_filter, Transaction.transaction_date >= year_start)
        )
    )
        
    year_result = await db.execute(year_query)
    year_data = year_result.one()
    
    # === Gráfica Mensual (Últimos 12 meses) ===
    twelve_months_ago = today - timedelta(days=365)
    monthly_query = select(
        extract('year', Transaction.transaction_date).label("year"),
        extract('month', Transaction.transaction_date).label("month"),
        func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)).label("income"),
        # Gastos filtrados para la gráfica
        func.sum(case((and_(
            Transaction.type == CategoryType.EXPENSE,
            exclude_virtual 
        ), Transaction.amount), else_=0)).label("expense")
    ).where(
        and_(base_filter, Transaction.transaction_date >= twelve_months_ago)
    ).group_by(
        extract('year', Transaction.transaction_date),
        extract('month', Transaction.transaction_date)
    ).order_by(
        extract('year', Transaction.transaction_date),
        extract('month', Transaction.transaction_date)
    )
    
    monthly_result = await db.execute(monthly_query)
    monthly_data = [
        {
            "year": int(row.year),
            "month": int(row.month),
            "income": float(row.income or 0),
            "expense": float(row.expense or 0),
            "balance": float((row.income or 0) - (row.expense or 0))
        }
        for row in monthly_result
    ]
    
    # === Top categorías (Pie Chart) ===
    # Excluimos explícitamente la categoría virtual del top
    top_categories_query = select(
        Category.name,
        Category.color,
        func.sum(Transaction.amount).label("total")
    ).join(
        Transaction, Transaction.category_id == Category.id
    ).where(
        and_(
            base_filter,
            Transaction.type == 'expense', # Solo gastos en el pie chart
            exclude_virtual,               # <--- FILTRO
            Transaction.transaction_date >= current_month_start,
            # ✅ AGREGAR ESTO PARA QUE LA MULTA NO SALGA EN LA GRÁFICA:
            Category.is_common_expense == True
        )
    ).group_by(
        Category.name, Category.color
    ).order_by(
        func.sum(Transaction.amount).desc()
    ).limit(5)
    
    top_cats_result = await db.execute(top_categories_query)
    top_categories = [
        {
            "name": row.name,
            "color": row.color or "#9CA3AF",
            "total": float(row.total)
        }
        for row in top_cats_result
    ]
    
    response = {
        "current_month": {
            "income": total_income,
            "expense": float(month_data.expense),
            "balance": float(total_income - float(month_data.expense)),
            "income_breakdown": {
                "normal": normal_income,
                "advance": advance_income,
                "late": late_income
            }
        },
        "current_year": {
            "income": float(year_data.income),
            "expense": float(year_data.expense),
            "balance": float(year_data.income - year_data.expense)
        },
        "monthly_trend": monthly_data,
        "top_categories": top_categories
    }
    
    # === Estadísticas Admin ===
    if is_admin:
        # Unidades con deuda (Aquí SÍ usamos el balance total, incluyendo cargos virtuales)
        debtors_query = select(func.count(Unit.id)).where(Unit.balance < 0)
        debtors_result = await db.execute(debtors_query)
        
        total_debt_query = select(func.coalesce(func.sum(Unit.balance), 0)).where(Unit.balance < 0)
        total_debt_result = await db.execute(total_debt_query)
        
        active_users_query = select(func.count(User.id)).where(User.is_active == True)
        active_users_result = await db.execute(active_users_query)
        
        pending_tx_query = select(func.count(Transaction.id)).where(Transaction.status == TransactionStatus.PENDING)
        pending_tx_result = await db.execute(pending_tx_query)
        
        response["admin_stats"] = {
            "units_with_debt": debtors_result.scalar() or 0,
            "total_debt": abs(float(total_debt_result.scalar() or 0)),
            "active_users": active_users_result.scalar() or 0,
            "pending_transactions": pending_tx_result.scalar() or 0
        }
    
    return response


# ==================== REPORTES MENSUALES ====================

@router.get("/monthly/{year}/{month}")
async def get_monthly_report(
    year: int = Path(..., ge=2020, le=2100),
    month: int = Path(..., ge=1, le=12),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el reporte mensual detallado.
    Solo administradores.
    """
    fiscal_period = f"{year}-{month:02d}"
    start_date = date(year, month, 1)
    
    # Calcular fin del mes
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    # Obtener transacciones del mes
    transactions_query = select(Transaction).options(
        selectinload(Transaction.category),
        selectinload(Transaction.unit)
    ).where(
        and_(
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.status == TransactionStatus.CONFIRMED
        )
    ).order_by(Transaction.transaction_date)
    
    tx_result = await db.execute(transactions_query)
    transactions = tx_result.scalars().all()
    
    # Calcular totales con desglose
    total_income = sum(t.amount for t in transactions if t.type == "income")
    total_expense = sum(t.amount for t in transactions if t.type == "expense")
    
    # Desglose de ingresos
    advance_income = sum(t.amount for t in transactions 
                        if t.type == "income" and getattr(t, 'is_advance_payment', False))
    late_income = sum(t.amount for t in transactions 
                     if t.type == "income" and getattr(t, 'is_late_payment', False))
    normal_income = total_income - advance_income - late_income
    
    # Agrupar por categoría
    income_by_category = {}
    expense_by_category = {}
    
    for tx in transactions:
        cat_name = tx.category.name if tx.category else "Sin categoría"
        if tx.type == "income":
            income_by_category[cat_name] = income_by_category.get(cat_name, 0) + float(tx.amount)
        else:
            expense_by_category[cat_name] = expense_by_category.get(cat_name, 0) + float(tx.amount)
    
    # Agrupar por unidad (solo ingresos)
    income_by_unit = {}
    for tx in transactions:
        if tx.type == "income" and tx.unit:
            unit_num = tx.unit.unit_number
            income_by_unit[unit_num] = income_by_unit.get(unit_num, 0) + float(tx.amount)
    
    return {
        "fiscal_period": fiscal_period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "summary": {
            "total_income": float(total_income),
            "total_expense": float(total_expense),
            "balance": float(total_income - total_expense),
            "transaction_count": len(transactions),
            # Nuevo desglose
            "income_breakdown": {
                "normal": float(normal_income),
                "advance": float(advance_income),
                "late": float(late_income)
            }
        },
        "income_by_category": income_by_category,
        "expense_by_category": expense_by_category,
        "income_by_unit": income_by_unit,
        "transactions": [
            {
                "id": str(tx.id),
                "date": tx.transaction_date.isoformat(),
                "type": tx.type,
                "category": tx.category.name if tx.category else None,
                "unit": tx.unit.unit_number if tx.unit else None,
                "description": tx.description,
                "amount": float(tx.amount),
                "is_advance": getattr(tx, 'is_advance_payment', False),
                "is_late": getattr(tx, 'is_late_payment', False)
            }
            for tx in transactions
        ]
    }


# ==================== ESTADO DE CUENTA ====================

@router.get("/account-statement")
async def get_account_statement(
    unit_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Genera estado de cuenta de una unidad.
    Residentes solo pueden ver su unidad.
    """
    is_admin = current_user.role == "admin"
    
    # Determinar unidad a consultar
    if not is_admin:
        if not current_user.unit_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes una unidad asignada"
            )
        unit_id = current_user.unit_id
    elif not unit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe especificar unit_id"
        )
    
    # Obtener unidad
    unit_result = await db.execute(
        select(Unit).options(selectinload(Unit.owner)).where(Unit.id == unit_id)
    )
    unit = unit_result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unidad no encontrada"
        )
    
    # Filtros de fecha
    today = date.today()
    if not start_date:
        start_date = date(today.year, 1, 1)
    if not end_date:
        end_date = today
    
    # Obtener transacciones
    tx_query = select(Transaction).options(
        selectinload(Transaction.category)
    ).where(
        and_(
            Transaction.unit_id == unit_id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.status == TransactionStatus.CONFIRMED
        )
    ).order_by(Transaction.transaction_date)
    
    tx_result = await db.execute(tx_query)
    transactions = tx_result.scalars().all()
    
    # Calcular saldo inicial (transacciones antes del período)
    initial_balance_query = select(
        func.coalesce(func.sum(
            case(
                (Transaction.type == "income", Transaction.amount),
                else_=-Transaction.amount
            )
        ), 0)
    ).where(
        and_(
            Transaction.unit_id == unit_id,
            Transaction.transaction_date < start_date,
            Transaction.status == TransactionStatus.CONFIRMED
        )
    )
    
    initial_result = await db.execute(initial_balance_query)
    initial_balance = float(initial_result.scalar() or 0)
    
    # Construir movimientos con saldo acumulado
    running_balance = initial_balance
    movements = []
    
    for tx in transactions:
        if tx.type == "income":
            running_balance += float(tx.amount)
            amount_display = float(tx.amount)
        else:
            running_balance -= float(tx.amount)
            amount_display = -float(tx.amount)
        
        movements.append({
            "id": str(tx.id),
            "date": tx.transaction_date.isoformat(),
            "type": tx.type,
            "category": tx.category.name if tx.category else None,
            "description": tx.description,
            "amount": amount_display,
            "balance": round(running_balance, 2)
        })
    
    return {
        "unit": {
            "id": str(unit.id),
            "unit_number": unit.unit_number,
            "owner": unit.owner.full_name if unit.owner else None,
            "monthly_fee": float(unit.monthly_fee),
            "current_balance": float(unit.balance)
        },
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "initial_balance": initial_balance,
        "final_balance": running_balance,
        "total_income": sum(m["amount"] for m in movements if m["amount"] > 0),
        "total_expense": abs(sum(m["amount"] for m in movements if m["amount"] < 0)),
        "movements": movements
    }


# ==================== EXPORTACIÓN A EXCEL ====================

@router.get("/export/monthly/{year}/{month}")
async def export_monthly_report_excel(
    year: int = Path(..., ge=2020, le=2100),
    month: int = Path(..., ge=1, le=12),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Exporta reporte mensual a Excel con desglose de pagos adelantados y atrasados.
    CORREGIDO: Excluye los cargos virtuales "Emisión de Cuota" de la lista y totales.
    Solo administradores.
    """
    # Obtener datos del reporte
    fiscal_period = f"{year}-{month:02d}"
    start_date = date(year, month, 1)
    
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    # 🔍 IDENTIFICAR CATEGORÍA VIRTUAL (Para excluirla)
    cat_query = select(Category.id).where(Category.name == "Emisión de Cuota")
    cat_result = await db.execute(cat_query)
    internal_charge_id = cat_result.scalar()

    # Filtro de exclusión
    exclude_virtual = Transaction.category_id != internal_charge_id if internal_charge_id else True
    
    # Obtener transacciones (Aplicando el filtro de exclusión)
    tx_query = select(Transaction).options(
        selectinload(Transaction.category),
        selectinload(Transaction.unit),
    ).where(
        and_(
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.status == TransactionStatus.CONFIRMED,
            exclude_virtual  # <--- FILTRO CLAVE: Excluye "Emisión de Cuota"
        )
    ).order_by(Transaction.transaction_date)
    
    tx_result = await db.execute(tx_query)
    transactions = tx_result.scalars().all()
    
    # Crear workbook
    wb = openpyxl.Workbook()
    
    # === Hoja de Resumen ===
    ws_summary = wb.active
    ws_summary.title = "Resumen"
    
    # Estilos
    header_font = Font(bold=True, size=12)
    title_font = Font(bold=True, size=14)
    subtitle_font = Font(bold=True, size=11, color="666666")
    money_format = '#,##0.00'
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font_white = Font(bold=True, color="FFFFFF")
    advance_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    late_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Título
    ws_summary["A1"] = f"Reporte Mensual - {fiscal_period}"
    ws_summary["A1"].font = title_font
    ws_summary.merge_cells("A1:D1")
    
    # Período
    ws_summary["A3"] = "Período:"
    ws_summary["B3"] = f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
    
    # Calcular totales con desglose (ya filtrados, sin "Emisión de Cuota")
    total_income = sum(t.amount for t in transactions if t.type == "income")
    total_expense = sum(t.amount for t in transactions if t.type == "expense")
    
    # Desglose de ingresos
    advance_income = sum(t.amount for t in transactions 
                        if t.type == "income" and getattr(t, 'is_advance_payment', False))
    late_income = sum(t.amount for t in transactions 
                     if t.type == "income" and getattr(t, 'is_late_payment', False))
    normal_income = total_income - advance_income - late_income
    
    # Contar transacciones por tipo
    advance_count = sum(1 for t in transactions 
                       if t.type == "income" and getattr(t, 'is_advance_payment', False))
    late_count = sum(1 for t in transactions 
                    if t.type == "income" and getattr(t, 'is_late_payment', False))
    normal_count = sum(1 for t in transactions if t.type == "income") - advance_count - late_count
    
    # Totales principales
    ws_summary["A5"] = "Total Ingresos:"
    ws_summary["B5"] = float(total_income)
    ws_summary["B5"].number_format = money_format
    ws_summary["A5"].font = header_font
    
    ws_summary["A6"] = "Total Egresos:"
    ws_summary["B6"] = float(total_expense)
    ws_summary["B6"].number_format = money_format
    ws_summary["A6"].font = header_font
    
    ws_summary["A7"] = "Balance:"
    ws_summary["B7"] = float(total_income - total_expense)
    ws_summary["B7"].number_format = money_format
    ws_summary["A7"].font = header_font
    
    # === NUEVA SECCIÓN: Desglose de Ingresos ===
    ws_summary["A9"] = "Desglose de Ingresos"
    ws_summary["A9"].font = title_font
    
    # Cuotas del mes (normales)
    ws_summary["A10"] = "  Cuotas del Mes:"
    ws_summary["B10"] = float(normal_income)
    ws_summary["B10"].number_format = money_format
    ws_summary["C10"] = f"({normal_count} pagos)"
    ws_summary["C10"].font = subtitle_font
    
    # Cuotas adelantadas
    ws_summary["A11"] = "  Cuotas Adelantadas:"
    ws_summary["A11"].fill = advance_fill
    ws_summary["B11"] = float(advance_income)
    ws_summary["B11"].number_format = money_format
    ws_summary["B11"].fill = advance_fill
    ws_summary["C11"] = f"({advance_count} pagos)"
    ws_summary["C11"].font = subtitle_font
    ws_summary["C11"].fill = advance_fill
    
    # Cuotas atrasadas
    ws_summary["A12"] = "  Cuotas Atrasadas:"
    ws_summary["A12"].fill = late_fill
    ws_summary["B12"] = float(late_income)
    ws_summary["B12"].number_format = money_format
    ws_summary["B12"].fill = late_fill
    ws_summary["C12"] = f"({late_count} pagos)"
    ws_summary["C12"].font = subtitle_font
    ws_summary["C12"].fill = late_fill
    
    # Resumen por categoría
    ws_summary["A15"] = "Ingresos por Categoría"
    ws_summary["A15"].font = title_font
    
    income_by_cat = {}
    expense_by_cat = {}
    for tx in transactions:
        cat_name = tx.category.name if tx.category else "Sin categoría"
        if tx.type == "income":
            income_by_cat[cat_name] = income_by_cat.get(cat_name, 0) + float(tx.amount)
        else:
            expense_by_cat[cat_name] = expense_by_cat.get(cat_name, 0) + float(tx.amount)
    
    row = 16
    for cat, amount in sorted(income_by_cat.items(), key=lambda x: -x[1]):
        ws_summary[f"A{row}"] = cat
        ws_summary[f"B{row}"] = amount
        ws_summary[f"B{row}"].number_format = money_format
        row += 1
    
    row += 2
    ws_summary[f"A{row}"] = "Egresos por Categoría"
    ws_summary[f"A{row}"].font = title_font
    row += 1
    
    for cat, amount in sorted(expense_by_cat.items(), key=lambda x: -x[1]):
        ws_summary[f"A{row}"] = cat
        ws_summary[f"B{row}"] = amount
        ws_summary[f"B{row}"].number_format = money_format
        row += 1
    
    # Ajustar anchos
    ws_summary.column_dimensions['A'].width = 28
    ws_summary.column_dimensions['B'].width = 15
    ws_summary.column_dimensions['C'].width = 15
    
    # === Hoja de Transacciones ===
    ws_tx = wb.create_sheet("Transacciones")
    
    headers = ["Fecha", "Tipo", "Categoría", "Unidad", "Descripción", "Monto", "Estado Pago"]
    for col, header in enumerate(headers, 1):
        cell = ws_tx.cell(row=1, column=col, value=header)
        cell.font = header_font_white
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center')
    
    for row_num, tx in enumerate(transactions, 2):
        ws_tx.cell(row=row_num, column=1, value=tx.transaction_date.strftime('%d/%m/%Y'))
        ws_tx.cell(row=row_num, column=2, value="Ingreso" if tx.type == "income" else "Egreso")
        ws_tx.cell(row=row_num, column=3, value=tx.category.name if tx.category else "")
        ws_tx.cell(row=row_num, column=4, value=tx.unit.unit_number if tx.unit else "")
        ws_tx.cell(row=row_num, column=5, value=tx.description or "")
        
        amount_cell = ws_tx.cell(row=row_num, column=6, value=float(tx.amount))
        amount_cell.number_format = money_format
        
        # Estado del pago (Normal, Adelantado, Atrasado)
        payment_status = "Normal"
        row_fill = None
        if tx.type == "income":
            if getattr(tx, 'is_advance_payment', False):
                payment_status = "Adelantado"
                row_fill = advance_fill
            elif getattr(tx, 'is_late_payment', False):
                payment_status = "Atrasado"
                row_fill = late_fill
        else:
            payment_status = "-"
        
        ws_tx.cell(row=row_num, column=7, value=payment_status)
        
        # Aplicar color de fondo a la fila si es adelantado o atrasado
        if row_fill:
            for col in range(1, 8):
                ws_tx.cell(row=row_num, column=col).fill = row_fill
        
        for col in range(1, 8):
            ws_tx.cell(row=row_num, column=col).border = thin_border
    
    # Ajustar anchos
    ws_tx.column_dimensions['A'].width = 12
    ws_tx.column_dimensions['B'].width = 10
    ws_tx.column_dimensions['C'].width = 22
    ws_tx.column_dimensions['D'].width = 10
    ws_tx.column_dimensions['E'].width = 40
    ws_tx.column_dimensions['F'].width = 15
    ws_tx.column_dimensions['G'].width = 12
    
    # Guardar en buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"reporte_mensual_{fiscal_period}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/account-statement/{unit_id}")
async def export_account_statement_excel(
    unit_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Exporta estado de cuenta a Excel.
    Residentes solo pueden exportar su unidad.
    """
    is_admin = current_user.role == "admin"
    
    # Verificar permisos
    if not is_admin:
        if not current_user.unit_id or current_user.unit_id != unit_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para exportar este estado de cuenta"
            )
    
    # Obtener unidad
    unit_result = await db.execute(
        select(Unit).options(selectinload(Unit.owner)).where(Unit.id == unit_id)
    )
    unit = unit_result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unidad no encontrada"
        )
    
    # Fechas
    today = date.today()
    if not start_date:
        start_date = date(today.year, 1, 1)
    if not end_date:
        end_date = today
    
    # Obtener transacciones
    tx_query = select(Transaction).options(
        selectinload(Transaction.category)
    ).where(
        and_(
            Transaction.unit_id == unit_id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.status == TransactionStatus.CONFIRMED
        )
    ).order_by(Transaction.transaction_date)
    
    tx_result = await db.execute(tx_query)
    transactions = tx_result.scalars().all()
    
    # Saldo inicial
    initial_balance_query = select(
        func.coalesce(func.sum(
            case(
                (Transaction.type == "income", Transaction.amount),
                else_=-Transaction.amount
            )
        ), 0)
    ).where(
        and_(
            Transaction.unit_id == unit_id,
            Transaction.transaction_date < start_date,
            Transaction.status == TransactionStatus.CONFIRMED
        )
    )
    
    initial_result = await db.execute(initial_balance_query)
    initial_balance = float(initial_result.scalar() or 0)
    
    # Crear workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Estado de Cuenta"
    
    # Estilos
    title_font = Font(bold=True, size=14)
    header_font = Font(bold=True, size=11)
    money_format = '#,##0.00'
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font_white = Font(bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Encabezado
    ws["A1"] = "ESTADO DE CUENTA"
    ws["A1"].font = title_font
    ws.merge_cells("A1:F1")
    
    ws["A3"] = "Unidad:"
    ws["B3"] = unit.unit_number
    ws["B3"].font = header_font
    
    ws["A4"] = "Propietario:"
    ws["B4"] = unit.owner.full_name if unit.owner else "N/A"
    
    ws["A5"] = "Período:"
    ws["B5"] = f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
    
    ws["A6"] = "Cuota mensual:"
    ws["B6"] = float(unit.monthly_fee)
    ws["B6"].number_format = money_format
    
    # Saldo inicial
    ws["A8"] = "Saldo Inicial:"
    ws["B8"] = initial_balance
    ws["B8"].number_format = money_format
    ws["A8"].font = header_font
    
    # Tabla de movimientos
    headers = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto", "Saldo"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=10, column=col, value=header)
        cell.font = header_font_white
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center')
    
    running_balance = initial_balance
    for row_num, tx in enumerate(transactions, 11):
        if tx.type == "income":
            running_balance += float(tx.amount)
            amount = float(tx.amount)
        else:
            running_balance -= float(tx.amount)
            amount = -float(tx.amount)
        
        ws.cell(row=row_num, column=1, value=tx.transaction_date.strftime('%d/%m/%Y'))
        ws.cell(row=row_num, column=2, value="Ingreso" if tx.type == "income" else "Egreso")
        ws.cell(row=row_num, column=3, value=tx.category.name if tx.category else "")
        ws.cell(row=row_num, column=4, value=tx.description or "")
        
        amount_cell = ws.cell(row=row_num, column=5, value=amount)
        amount_cell.number_format = money_format
        
        balance_cell = ws.cell(row=row_num, column=6, value=round(running_balance, 2))
        balance_cell.number_format = money_format
        
        for col in range(1, 7):
            ws.cell(row=row_num, column=col).border = thin_border
    
    # Saldo final
    final_row = 11 + len(transactions) + 1
    ws[f"A{final_row}"] = "Saldo Final:"
    ws[f"A{final_row}"].font = header_font
    ws[f"B{final_row}"] = float(unit.balance)
    ws[f"B{final_row}"].number_format = money_format
    ws[f"B{final_row}"].font = header_font
    
    # Ajustar anchos
    ws.column_dimensions['A'].width = 12
    ws.column_dimensions['B'].width = 12
    ws.column_dimensions['C'].width = 20
    ws.column_dimensions['D'].width = 35
    ws.column_dimensions['E'].width = 15
    ws.column_dimensions['F'].width = 15
    
    # Guardar
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"estado_cuenta_{unit.unit_number}_{end_date.strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/debtors")
async def export_debtors_excel(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Exporta lista de deudores a Excel.
    Solo administradores.
    """
    # Obtener unidades con deuda
    units_query = select(Unit).options(
        selectinload(Unit.owner)
    ).where(Unit.balance < 0).order_by(Unit.balance)
    
    units_result = await db.execute(units_query)
    units = units_result.scalars().all()
    
    # Crear workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Deudores"
    
    # Estilos
    title_font = Font(bold=True, size=14)
    header_font_white = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="C0392B", end_color="C0392B", fill_type="solid")
    money_format = '#,##0.00'
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Título
    ws["A1"] = "REPORTE DE DEUDORES"
    ws["A1"].font = title_font
    ws.merge_cells("A1:E1")
    
    ws["A3"] = f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    
    # Headers
    headers = ["Unidad", "Propietario", "Email", "Teléfono", "Saldo"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=5, column=col, value=header)
        cell.font = header_font_white
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center')
    
    total_debt = 0
    for row_num, unit in enumerate(units, 6):
        ws.cell(row=row_num, column=1, value=unit.unit_number)
        ws.cell(row=row_num, column=2, value=unit.owner.full_name if unit.owner else (unit.notes or "N/A"))
        ws.cell(row=row_num, column=3, value=unit.owner.email if unit.owner else "")
        ws.cell(row=row_num, column=4, value=unit.owner.phone if unit.owner else "")
        
        balance_cell = ws.cell(row=row_num, column=5, value=float(unit.balance))
        balance_cell.number_format = money_format
        
        total_debt += float(unit.balance)
        
        for col in range(1, 6):
            ws.cell(row=row_num, column=col).border = thin_border
    
    # Total
    total_row = 6 + len(units) + 1
    ws[f"D{total_row}"] = "TOTAL DEUDA:"
    ws[f"D{total_row}"].font = Font(bold=True)
    ws[f"E{total_row}"] = abs(total_debt)
    ws[f"E{total_row}"].number_format = money_format
    ws[f"E{total_row}"].font = Font(bold=True)
    
    # Ajustar anchos
    ws.column_dimensions['A'].width = 12
    ws.column_dimensions['B'].width = 25
    ws.column_dimensions['C'].width = 30
    ws.column_dimensions['D'].width = 15
    ws.column_dimensions['E'].width = 15
    
    # Guardar
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"deudores_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
