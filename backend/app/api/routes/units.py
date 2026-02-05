"""
Rutas de viviendas/unidades.
"""

from datetime import date
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Unit, User, UnitStatus, Transaction, CategoryType, TransactionStatus
from app.schemas.entities import (
    UnitCreate, UnitUpdate, UnitResponse, UnitListResponse,
    UnitSummary, UnitBalance, PaginationMeta, TransactionResponse
)
from app.middleware.auth import (
    get_current_user, AuthenticatedUser, require_role
)


router = APIRouter(prefix="/units", tags=["Viviendas"])


@router.get(
    "",
    response_model=UnitListResponse,
    summary="Listar viviendas"
)
async def list_units(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[UnitStatus] = None,
    has_debt: Optional[bool] = None,
    building: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("unit_number", pattern=r'^(unit_number|balance|created_at)$'),
    order: str = Query("asc", pattern=r'^(asc|desc)$'),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista viviendas con filtros y paginación.
    
    - **Administradores**: ven todas las viviendas
    - **Residentes**: solo ven su vivienda
    """
    query = select(Unit).options(selectinload(Unit.owner), selectinload(Unit.tenant))
    
    # Si es residente, solo su vivienda
    if current_user.role == "resident":
        if current_user.unit_id:
            query = query.where(
                or_(
                    Unit.id == current_user.unit_id,
                    Unit.owner_user_id == current_user.id,
                    Unit.tenant_user_id == current_user.id
                )
            )
        else:
            return UnitListResponse(
                data=[],
                summary=UnitSummary(
                    total_units=0, occupied=0, vacant=0,
                    maintenance=0, total_debt=Decimal("0"), units_with_debt=0
                ),
                pagination=PaginationMeta(
                    page=1, limit=limit, total_items=0,
                    total_pages=0, has_next=False, has_prev=False
                )
            )
    
    # Filtros
    filters = []
    
    if status:
        filters.append(Unit.status == status)
    
    if has_debt is True:
        filters.append(Unit.balance < 0)
    elif has_debt is False:
        filters.append(Unit.balance >= 0)
    
    if building:
        filters.append(Unit.building.ilike(f"%{building}%"))
    
    if search:
        filters.append(Unit.unit_number.ilike(f"%{search}%"))
    
    if filters:
        from sqlalchemy import and_
        query = query.where(and_(*filters))
    
    # Contar total
    count_query = select(func.count(Unit.id))
    if filters:
        from sqlalchemy import and_
        count_query = count_query.where(and_(*filters))
    
    total_result = await db.execute(count_query)
    total_items = total_result.scalar()
    
    # Resumen
    summary_query = select(
        func.count(),
        func.count().filter(Unit.status == UnitStatus.OCCUPIED),
        func.count().filter(Unit.status == UnitStatus.VACANT),
        func.count().filter(Unit.status == UnitStatus.MAINTENANCE),
        func.coalesce(func.sum(Unit.balance).filter(Unit.balance < 0), 0),
        func.count().filter(Unit.balance < 0)
    )
    
    summary_result = await db.execute(summary_query)
    summary_row = summary_result.one()
    
    summary = UnitSummary(
        total_units=summary_row[0],
        occupied=summary_row[1],
        vacant=summary_row[2],
        maintenance=summary_row[3],
        total_debt=abs(summary_row[4]),
        units_with_debt=summary_row[5]
    )
    
    # Ordenar
    order_column = getattr(Unit, sort)
    if order == "desc":
        from sqlalchemy import desc as sql_desc
        query = query.order_by(sql_desc(order_column))
    else:
        query = query.order_by(order_column)
    
    # Paginar
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    units = result.scalars().all()
    
    # Convertir a respuesta
    unit_responses = [
        UnitResponse(
            id=u.id,
            unit_number=u.unit_number,
            building=u.building,
            floor=u.floor,
            area_m2=u.area_m2,
            status=u.status,
            monthly_fee=u.monthly_fee,
            balance=u.balance,
            notes=u.notes,
            owner_user_id=u.owner_user_id,
            owner_name=u.owner.full_name if u.owner else None,
            tenant_user_id=str(u.tenant_user_id) if u.tenant_user_id else None,
            tenant_name=u.tenant.full_name if u.tenant else None,
            created_at=u.created_at,
            updated_at=u.updated_at
        )
        for u in units
    ]
    
    total_pages = (total_items + limit - 1) // limit
    
    return UnitListResponse(
        data=unit_responses,
        summary=summary,
        pagination=PaginationMeta(
            page=page,
            limit=limit,
            total_items=total_items,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
    )


@router.get(
    "/debtors",
    response_model=UnitListResponse,
    summary="Listar viviendas con adeudo"
)
async def list_debtors(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista viviendas con saldo negativo (adeudo).
    
    **Solo administradores**
    """
    query = (
        select(Unit)
        .options(selectinload(Unit.owner), selectinload(Unit.tenant))
        .where(Unit.balance < 0)
        .order_by(Unit.balance)  # Los que más deben primero
    )
    
    # Contar
    count_result = await db.execute(
        select(func.count(Unit.id)).where(Unit.balance < 0)
    )
    total_items = count_result.scalar()
    
    # Resumen
    summary_result = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(Unit.balance), 0)
        ).where(Unit.balance < 0)
    )
    summary_row = summary_result.one()
    
    # Paginar
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    units = result.scalars().all()
    
    unit_responses = [
        UnitResponse(
            id=u.id,
            unit_number=u.unit_number,
            building=u.building,
            floor=u.floor,
            area_m2=u.area_m2,
            status=u.status,
            monthly_fee=u.monthly_fee,
            balance=u.balance,
            notes=u.notes,
            owner_user_id=u.owner_user_id,
            owner_name=u.owner.full_name if u.owner else None,
            tenant_user_id=str(u.tenant_user_id) if u.tenant_user_id else None,
            tenant_name=unit.tenant.full_name if unit.tenant else None,
            created_at=u.created_at,
            updated_at=u.updated_at
        )
        for u in units
    ]
    
    total_pages = (total_items + limit - 1) // limit
    
    return UnitListResponse(
        data=unit_responses,
        summary=UnitSummary(
            total_units=0,
            occupied=0,
            vacant=0,
            maintenance=0,
            total_debt=abs(summary_row[1]),
            units_with_debt=summary_row[0]
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


@router.get(
    "/{unit_id}",
    response_model=UnitResponse,
    summary="Obtener vivienda"
)
async def get_unit(
    unit_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene detalles de una vivienda.
    
    - Los residentes solo pueden ver su propia vivienda
    """
    # Verificar acceso para residentes
    if current_user.role == "resident" and str(current_user.unit_id or '') != str(unit_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "No tienes acceso a esta vivienda"
            }
        )
    
    result = await db.execute(
        select(Unit)
        .options(selectinload(Unit.owner), selectinload(Unit.tenant))
        .where(Unit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "UNIT_NOT_FOUND",
                "message": "Vivienda no encontrada"
            }
        )
    
    return UnitResponse(
        id=unit.id,
        unit_number=unit.unit_number,
        building=unit.building,
        floor=unit.floor,
        area_m2=unit.area_m2,
        status=unit.status,
        monthly_fee=unit.monthly_fee,
        balance=unit.balance,
        notes=unit.notes,
        owner_user_id=unit.owner_user_id,
        owner_name=unit.owner.full_name if unit.owner else None,
        tenant_user_id=str(unit.tenant_user_id) if unit.tenant_user_id else None,
        tenant_name=unit.tenant.full_name if unit.tenant else None,
        created_at=unit.created_at,
        updated_at=unit.updated_at
    )


@router.post(
    "",
    response_model=UnitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear vivienda"
)
async def create_unit(
    data: UnitCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva vivienda.
    
    **Solo administradores**
    """
    # Verificar número único
    existing = await db.execute(
        select(Unit).where(Unit.unit_number == data.unit_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "UNIT_NUMBER_EXISTS",
                "message": "Ya existe una vivienda con este número"
            }
        )
    
    # Verificar propietario si se especifica
    if data.owner_user_id:
        owner_result = await db.execute(
            select(User).where(User.id == data.owner_user_id)
        )
        if not owner_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "USER_NOT_FOUND",
                    "message": "Usuario propietario no encontrado"
                }
            )
    
    unit = Unit(
        unit_number=data.unit_number,
        building=data.building,
        floor=data.floor,
        area_m2=data.area_m2,
        status=data.status,
        monthly_fee=data.monthly_fee,
        owner_user_id=data.owner_user_id,
        notes=data.notes,
        balance=Decimal("0")
    )
    
    db.add(unit)
    await db.flush()
    # Actualizar unit_id del usuario propietario
    if data.owner_user_id:
        owner_result = await db.execute(
            select(User).where(User.id == data.owner_user_id)
        )
        owner = owner_result.scalar_one_or_none()
        if owner:
            owner.unit_id = unit.id
            await db.flush()
    
    await db.refresh(unit)
    
    return UnitResponse(
        id=unit.id,
        unit_number=unit.unit_number,
        building=unit.building,
        floor=unit.floor,
        area_m2=unit.area_m2,
        status=unit.status,
        monthly_fee=unit.monthly_fee,
        balance=unit.balance,
        notes=unit.notes,
        owner_user_id=unit.owner_user_id,
        owner_name=unit.owner.full_name if unit.owner else None,
        tenant_user_id=str(unit.tenant_user_id) if unit.tenant_user_id else None,
        tenant_name=unit.tenant.full_name if unit.tenant else None,
        created_at=unit.created_at,
        updated_at=unit.updated_at
    )


@router.put(
    "/{unit_id}",
    response_model=UnitResponse,
    summary="Actualizar vivienda"
)
async def update_unit(
    unit_id: str,
    data: UnitUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza una vivienda existente.
    
    **Solo administradores**
    """
    result = await db.execute(
        select(Unit).where(Unit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "UNIT_NOT_FOUND",
                "message": "Vivienda no encontrada"
            }
        )
    
    # Actualizar campos
    if data.unit_number is not None:
        # Verificar unicidad
        existing = await db.execute(
            select(Unit)
            .where(Unit.unit_number == data.unit_number)
            .where(Unit.id != unit_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "UNIT_NUMBER_EXISTS",
                    "message": "Ya existe una vivienda con este número"
                }
            )
        unit.unit_number = data.unit_number
    
    if data.building is not None:
        unit.building = data.building
    if data.floor is not None:
        unit.floor = data.floor
    if data.area_m2 is not None:
        unit.area_m2 = data.area_m2
    if data.status is not None:
        unit.status = data.status
    if data.monthly_fee is not None:
        unit.monthly_fee = data.monthly_fee
    if data.owner_user_id is not None:
        # Si cambia el propietario, actualizar unit_id de ambos usuarios
        old_owner_id = unit.owner_user_id
        new_owner_id = data.owner_user_id if data.owner_user_id != "" else None
        
        # Quitar unit_id del propietario anterior
        if old_owner_id and old_owner_id != new_owner_id:
            old_owner_result = await db.execute(
                select(User).where(User.id == old_owner_id)
            )
            old_owner = old_owner_result.scalar_one_or_none()
            if old_owner:
                old_owner.unit_id = None
        
        # Asignar unit_id al nuevo propietario
        if new_owner_id:
            new_owner_result = await db.execute(
                select(User).where(User.id == new_owner_id)
            )
            new_owner = new_owner_result.scalar_one_or_none()
            if new_owner:
                new_owner.unit_id = unit_id
        
        unit.owner_user_id = new_owner_id
    if data.notes is not None:
        unit.notes = data.notes
    
    await db.flush()
    await db.refresh(unit)
    
    return UnitResponse(
        id=unit.id,
        unit_number=unit.unit_number,
        building=unit.building,
        floor=unit.floor,
        area_m2=unit.area_m2,
        status=unit.status,
        monthly_fee=unit.monthly_fee,
        balance=unit.balance,
        notes=unit.notes,
        owner_user_id=unit.owner_user_id,
        owner_name=unit.owner.full_name if unit.owner else None,
        tenant_user_id=str(unit.tenant_user_id) if unit.tenant_user_id else None,
        tenant_name=unit.tenant.full_name if unit.tenant else None,
        created_at=unit.created_at,
        updated_at=unit.updated_at
    )


@router.get(
    "/{unit_id}/balance",
    response_model=UnitBalance,
    summary="Estado de cuenta"
)
async def get_unit_balance(
    unit_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el estado de cuenta detallado de una vivienda.
    
    - Incluye todas las transacciones del período
    - Calcula saldo corrido
    - Desglose mensual
    """
    # Verificar acceso
    if current_user.role == "resident" and str(current_user.unit_id or '') != str(unit_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN"}
        )
    
    # Obtener vivienda
    result = await db.execute(
        select(Unit).where(Unit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "UNIT_NOT_FOUND"}
        )
    
    # Obtener transacciones
    from app.services.transaction_service import get_transaction_service
    service = get_transaction_service(db)
    
    transactions = await service.get_unit_transactions(
        unit_id=unit_id,
        from_date=from_date,
        to_date=to_date
    )
    
    # Calcular totales
    total_charges = sum(t.amount for t in transactions if t.type == CategoryType.EXPENSE)
    total_payments = sum(t.amount for t in transactions if t.type == CategoryType.INCOME)
    
    return UnitBalance(
        unit_id=unit.id,
        unit_number=unit.unit_number,
        current_balance=unit.balance,
        total_charges=total_charges,
        total_payments=total_payments,
        transactions=transactions,
        monthly_breakdown=[]  # TODO: Implementar desglose mensual
    )


@router.delete(
    "/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar vivienda"
)
async def delete_unit(
    unit_id: str,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina una vivienda.
    
    **Solo administradores**
    
    - No se puede eliminar si tiene transacciones asociadas
    """
    result = await db.execute(
        select(Unit).where(Unit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "UNIT_NOT_FOUND"}
        )
    
    # Verificar transacciones
    trans_count = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.unit_id == unit_id)
    )
    if trans_count.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "UNIT_HAS_TRANSACTIONS",
                "message": "No se puede eliminar una vivienda con transacciones"
            }
        )
    
    await db.delete(unit)
