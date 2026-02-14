"""
Servicio de gestión de condominios para Super Admin.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from typing import Optional, Tuple, List
from datetime import datetime

from app.models.models import Condominium, User, Unit, Transaction
from app.schemas.super_admin import (
    CondominiumListItem,
    CondominiumListResponse,
    CondominiumDetail,
    CondominiumUpdate
)


class SuperAdminCondominiumService:
    """Servicio para gestión de condominios por Super Admin."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list_condominiums(
        self,
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        plan_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> CondominiumListResponse:
        """
        Lista condominios con filtros y paginación.
        
        Args:
            page: Página actual (1-indexed)
            limit: Registros por página
            search: Búsqueda por nombre
            plan_type: Filtrar por plan (FREE, PRO, ENTERPRISE)
            is_active: Filtrar por estado activo/inactivo
            sort_by: Campo para ordenar (name, created_at, total_users, total_units)
            sort_order: Orden (asc, desc)
        """
        # Construir filtros
        filters = []
        
        if search:
            filters.append(Condominium.name.ilike(f"%{search}%"))
        
        if plan_type:
            filters.append(func.upper(Condominium.plan_type) == plan_type.upper())
        
        if is_active is not None:
            filters.append(Condominium.is_active == is_active)
        
        # Query base con agregaciones
        base_query = (
            select(
                Condominium,
                func.count(func.distinct(User.id)).label('total_users'),
                func.count(func.distinct(Unit.id)).label('total_units')
            )
            .outerjoin(User, Condominium.id == User.condominium_id)
            .outerjoin(Unit, Condominium.id == Unit.condominium_id)
            .group_by(Condominium.id)
        )
        
        if filters:
            base_query = base_query.where(and_(*filters))
        
        # Contar total antes de paginar
        count_query = select(func.count(func.distinct(Condominium.id)))
        if filters:
            count_query = count_query.select_from(Condominium).where(and_(*filters))
        
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Ordenamiento
        if sort_by == "name":
            order_column = Condominium.name
        elif sort_by == "total_users":
            order_column = func.count(func.distinct(User.id))
        elif sort_by == "total_units":
            order_column = func.count(func.distinct(Unit.id))
        else:  # created_at por defecto
            order_column = Condominium.created_at
        
        if sort_order == "asc":
            base_query = base_query.order_by(order_column.asc())
        else:
            base_query = base_query.order_by(order_column.desc())
        
        # Paginación
        offset = (page - 1) * limit
        base_query = base_query.limit(limit).offset(offset)
        
        # Ejecutar query
        result = await self.db.execute(base_query)
        rows = result.all()
        
        # Construir respuesta
        items = []
        for row in rows:
            condo = row[0]
            total_users = row[1] or 0
            total_units = row[2] or 0
            
            items.append(CondominiumListItem(
                id=str(condo.id),
                name=condo.name,
                slug=condo.slug,
                plan_type=condo.plan_type,
                is_active=condo.is_active,
                is_setup_completed=condo.is_setup_completed,
                total_users=total_users,
                total_units=total_units,
                created_at=condo.created_at
            ))
        
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        
        return CondominiumListResponse(
            data=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    
    async def get_condominium(self, condominium_id: str) -> Optional[CondominiumDetail]:
        """
        Obtiene detalles completos de un condominio.
        """
        # Query con agregaciones
        query = (
            select(
                Condominium,
                func.count(func.distinct(User.id)).label('total_users'),
                func.count(func.distinct(Unit.id)).label('total_units'),
                func.count(func.distinct(Transaction.id)).label('total_transactions')
            )
            .outerjoin(User, Condominium.id == User.condominium_id)
            .outerjoin(Unit, Condominium.id == Unit.condominium_id)
            .outerjoin(Transaction, Condominium.id == Transaction.condominium_id)
            .where(Condominium.id == condominium_id)
            .group_by(Condominium.id)
        )
        
        result = await self.db.execute(query)
        row = result.first()
        
        if not row:
            return None
        
        condo = row[0]
        total_users = row[1] or 0
        total_units = row[2] or 0
        total_transactions = row[3] or 0
        
        return CondominiumDetail(
            id=str(condo.id),
            name=condo.name,
            slug=condo.slug,
            address=condo.address,
            phone=condo.phone,
            email=condo.email,
            plan_type=condo.plan_type,
            is_active=condo.is_active,
            is_setup_completed=condo.is_setup_completed,
            logo_url=condo.logo_url,
            default_monthly_fee=condo.default_monthly_fee,
            total_users=total_users,
            total_units=total_units,
            total_transactions=total_transactions,
            created_at=condo.created_at,
            updated_at=condo.updated_at
        )
    
    async def update_condominium(
        self,
        condominium_id: str,
        data: CondominiumUpdate
    ) -> Optional[CondominiumDetail]:
        """
        Actualiza un condominio.
        """
        # Buscar condominio
        result = await self.db.execute(
            select(Condominium).where(Condominium.id == condominium_id)
        )
        condo = result.scalar_one_or_none()
        
        if not condo:
            return None
        
        # Actualizar campos
        if data.name is not None:
            condo.name = data.name
        
        if data.plan_type is not None:
            condo.plan_type = data.plan_type.upper()
        
        if data.is_active is not None:
            condo.is_active = data.is_active
        
        if data.default_monthly_fee is not None:
            condo.default_monthly_fee = data.default_monthly_fee
        
        condo.updated_at = datetime.utcnow()
        
        await self.db.flush()
        
        # Retornar detalles actualizados
        return await self.get_condominium(condominium_id)
    
    async def toggle_status(self, condominium_id: str) -> Optional[CondominiumDetail]:
        """
        Activa o desactiva un condominio.
        """
        result = await self.db.execute(
            select(Condominium).where(Condominium.id == condominium_id)
        )
        condo = result.scalar_one_or_none()
        
        if not condo:
            return None
        
        # Cambiar estado
        condo.is_active = not condo.is_active
        condo.updated_at = datetime.utcnow()
        
        await self.db.flush()
        
        return await self.get_condominium(condominium_id)


def get_super_admin_condominium_service(db: AsyncSession) -> SuperAdminCondominiumService:
    """Factory para el servicio de condominios."""
    return SuperAdminCondominiumService(db)
