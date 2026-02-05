"""
Rutas API para gestión de categorías
CORREGIDO: Límite de paginación aumentado para selectores
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role, AuthenticatedUser
from app.models.models import Category, Transaction
from app.schemas.entities import (
    CategoryCreate, CategoryUpdate, CategoryResponse, 
    PaginatedResponse
)

router = APIRouter(prefix="/categories", tags=["Categorías"])


@router.get("", response_model=PaginatedResponse[CategoryResponse])
async def list_categories(
    page: int = Query(1, ge=1),
    # ✅ CORRECCIÓN 1: Aumentamos el límite máximo a 1000 para permitir dropdowns completos
    limit: int = Query(100, ge=1, le=1000), 
    type: Optional[str] = Query(None, regex="^(income|expense)$"),
    is_system: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todas las categorías con filtros opcionales.
    Accesible por todos los usuarios autenticados.
    """
    query = select(Category).where(Category.is_active == True)
    count_query = select(func.count(Category.id)).where(Category.is_active == True)
    
    # Filtros
    if type:
        query = query.where(Category.type == type)
        count_query = count_query.where(Category.type == type)
    
    if is_system is not None:
        query = query.where(Category.is_system == is_system)
        count_query = count_query.where(Category.is_system == is_system)
    
    if search:
        search_filter = Category.name.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    # Contar total
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0
    
    # Paginación y ordenamiento
    query = query.order_by(Category.type, Category.name)
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    categories = result.scalars().all()
    
    total_pages = (total_items + limit - 1) // limit
    
    return PaginatedResponse(
        data=[CategoryResponse.model_validate(c) for c in categories],
        pagination={
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene una categoría por ID.
    """
    result = await db.execute(
        select(Category).where(
            and_(Category.id == category_id, Category.is_active == True)
        )
    )
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    return CategoryResponse.model_validate(category)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva categoría.
    Solo administradores.
    """
    # Verificar nombre único
    existing = await db.execute(
        select(Category).where(
            and_(
                func.lower(Category.name) == data.name.lower(),
                Category.type == data.type,
                Category.is_active == True
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una categoría con ese nombre para este tipo"
        )
    
    category = Category(
        name=data.name,
        type=data.type,
        description=data.description,
        color=data.color or "#6B7280",
        icon=data.icon or "folder",
        is_system=False,
        is_active=True # ✅ CORRECCIÓN 2: Asegurar explícitamente que nace activa
    )
    
    db.add(category)
    await db.commit()
    await db.refresh(category)
    
    return CategoryResponse.model_validate(category)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza una categoría existente.
    """
    result = await db.execute(
        select(Category).where(
            and_(Category.id == category_id, Category.is_active == True)
        )
    )
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    if category.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se pueden modificar categorías del sistema"
        )
    
    # Verificar nombre único si se está cambiando
    if data.name and data.name.lower() != category.name.lower():
        existing = await db.execute(
            select(Category).where(
                and_(
                    func.lower(Category.name) == data.name.lower(),
                    Category.type == category.type,
                    Category.id != category_id,
                    Category.is_active == True
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe una categoría con ese nombre"
            )
    
    # Actualizar campos
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina (soft delete) una categoría.
    """
    result = await db.execute(
        select(Category).where(
            and_(Category.id == category_id, Category.is_active == True)
        )
    )
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    if category.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se pueden eliminar categorías del sistema"
        )
    
    # Verificar si tiene transacciones
    tx_count = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.category_id == category_id)
    )
    if tx_count.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una categoría con transacciones asociadas"
        )
    
    # Soft delete
    category.is_active = False
    await db.commit()


@router.get("/{category_id}/stats")
async def get_category_stats(
    category_id: UUID,
    year: Optional[int] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene estadísticas de una categoría.
    """
    from datetime import datetime
    
    result = await db.execute(
        select(Category).where(
            and_(Category.id == category_id, Category.is_active == True)
        )
    )
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    # Filtro base
    base_filter = and_(
        Transaction.category_id == category_id,
        Transaction.status == "completed"
    )
    
    # Filtro por año
    if year:
        base_filter = and_(
            base_filter,
            func.extract('year', Transaction.transaction_date) == year
        )
    
    # Total de transacciones y monto
    stats_query = select(
        func.count(Transaction.id).label("total_transactions"),
        func.coalesce(func.sum(Transaction.amount), 0).label("total_amount"),
        func.coalesce(func.avg(Transaction.amount), 0).label("avg_amount"),
        func.min(Transaction.transaction_date).label("first_transaction"),
        func.max(Transaction.transaction_date).label("last_transaction")
    ).where(base_filter)
    
    stats_result = await db.execute(stats_query)
    stats = stats_result.one()
    
    # Transacciones por mes
    current_year = year or datetime.now().year
    monthly_query = select(
        func.extract('month', Transaction.transaction_date).label("month"),
        func.count(Transaction.id).label("count"),
        func.sum(Transaction.amount).label("total")
    ).where(
        and_(
            Transaction.category_id == category_id,
            Transaction.status == "completed",
            func.extract('year', Transaction.transaction_date) == current_year
        )
    ).group_by(
        func.extract('month', Transaction.transaction_date)
    ).order_by(
        func.extract('month', Transaction.transaction_date)
    )
    
    monthly_result = await db.execute(monthly_query)
    monthly_data = [
        {"month": int(row.month), "count": row.count, "total": float(row.total)}
        for row in monthly_result
    ]
    
    return {
        "category": CategoryResponse.model_validate(category),
        "stats": {
            "total_transactions": stats.total_transactions,
            "total_amount": float(stats.total_amount),
            "avg_amount": float(stats.avg_amount),
            "first_transaction": stats.first_transaction.isoformat() if stats.first_transaction else None,
            "last_transaction": stats.last_transaction.isoformat() if stats.last_transaction else None
        },
        "monthly_breakdown": monthly_data,
        "year": current_year
    }
