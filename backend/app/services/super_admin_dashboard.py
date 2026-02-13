"""
Servicio de Dashboard para Super Admin.
Maneja toda la lógica de métricas y estadísticas globales.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_, extract
from datetime import datetime, date
from decimal import Decimal
from typing import List

from app.models.models import (
    Condominium, User, Unit, Transaction, AuditLog,
    UserRole, CategoryType, TransactionStatus
)
from app.schemas.super_admin import (
    SystemMetrics, PlanDistribution, UserRoleDistribution,
    RecentActivity, CondominiumStats, DashboardResponse
)


class SuperAdminDashboardService:
    """Servicio para dashboard de Super Admin."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_dashboard_data(self) -> DashboardResponse:
        """
        Obtiene todos los datos del dashboard.
        Ejecuta múltiples queries en paralelo para mejor performance.
        """
        # Obtener métricas generales
        metrics = await self._get_system_metrics()
        
        # Obtener distribuciones
        plan_dist = await self._get_plan_distribution()
        user_dist = await self._get_user_distribution()
        
        # Top condominios (por usuarios o actividad)
        top_condos = await self._get_top_condominiums(limit=5)
        
        # Actividad reciente
        recent = await self._get_recent_activity(limit=10)
        
        return DashboardResponse(
            metrics=metrics,
            plan_distribution=plan_dist,
            user_distribution=user_dist,
            top_condominiums=top_condos,
            recent_activity=recent
        )
    
    async def _get_system_metrics(self) -> SystemMetrics:
        """Obtiene métricas generales del sistema."""
        
        # Total de condominios
        condo_result = await self.db.execute(
            select(
                func.count(Condominium.id).label('total'),
                func.count(Condominium.id).filter(Condominium.is_active == True).label('active'),
                func.count(Condominium.id).filter(Condominium.is_active == False).label('inactive')
            )
        )
        condo_stats = condo_result.one()
        
        # Total de usuarios por rol (excluyendo super admins)
        user_result = await self.db.execute(
            select(
                func.count(User.id).label('total'),
                func.count(User.id).filter(User.role == UserRole.ADMIN).label('admins'),
                func.count(User.id).filter(User.role == UserRole.RESIDENT).label('residents')
            ).where(User.condominium_id.isnot(None))
        )
        user_stats = user_result.one()
        
        # Total de unidades
        unit_result = await self.db.execute(
            select(func.count(Unit.id))
        )
        total_units = unit_result.scalar() or 0
        
        # Transacciones del mes actual
        current_month = date.today().replace(day=1)
        
        trans_result = await self.db.execute(
            select(
                func.count(Transaction.id).label('count'),
                func.coalesce(
                    func.sum(Transaction.amount).filter(Transaction.type == CategoryType.INCOME),
                    0
                ).label('income'),
                func.coalesce(
                    func.sum(Transaction.amount).filter(Transaction.type == CategoryType.EXPENSE),
                    0
                ).label('expenses')
            ).where(
                and_(
                    Transaction.transaction_date >= current_month,
                    Transaction.status == TransactionStatus.CONFIRMED
                )
            )
        )
        trans_stats = trans_result.one()
        
        return SystemMetrics(
            total_condominiums=condo_stats.total or 0,
            active_condominiums=condo_stats.active or 0,
            inactive_condominiums=condo_stats.inactive or 0,
            total_users=user_stats.total or 0,
            total_admins=user_stats.admins or 0,
            total_residents=user_stats.residents or 0,
            total_units=total_units,
            total_transactions_this_month=trans_stats.count or 0,
            total_income_this_month=Decimal(trans_stats.income or 0),
            total_expenses_this_month=Decimal(trans_stats.expenses or 0)
        )
    
    async def _get_plan_distribution(self) -> List[PlanDistribution]:
        """Obtiene distribución de condominios por plan."""
        
        result = await self.db.execute(
            select(
                Condominium.plan_type,
                func.count(Condominium.id).label('count')
            ).group_by(Condominium.plan_type)
        )
        
        rows = result.all()
        total = sum(row.count for row in rows)
        
        if total == 0:
            return []
        
        return [
            PlanDistribution(
                plan_type=row.plan_type,
                count=row.count,
                percentage=round((row.count / total) * 100, 2)
            )
            for row in rows
        ]
    
    async def _get_user_distribution(self) -> List[UserRoleDistribution]:
        """Obtiene distribución de usuarios por rol."""
        
        result = await self.db.execute(
            select(
                User.role,
                func.count(User.id).label('count')
            )
            .where(User.condominium_id.isnot(None))  # Excluir super admins
            .group_by(User.role)
        )
        
        rows = result.all()
        total = sum(row.count for row in rows)
        
        if total == 0:
            return []
        
        return [
            UserRoleDistribution(
                role=row.role.value,
                count=row.count,
                percentage=round((row.count / total) * 100, 2)
            )
            for row in rows
        ]
    
    async def _get_top_condominiums(self, limit: int = 5) -> List[CondominiumStats]:
        """Obtiene top condominios por cantidad de usuarios."""
        
        # Query compleja con múltiples agregaciones
        result = await self.db.execute(
            select(
                Condominium.id,
                Condominium.name,
                Condominium.plan_type,
                Condominium.is_active,
                Condominium.created_at,
                func.count(func.distinct(User.id)).label('total_users'),
                func.count(func.distinct(User.id)).filter(User.role == UserRole.ADMIN).label('total_admins'),
                func.count(func.distinct(User.id)).filter(User.role == UserRole.RESIDENT).label('total_residents'),
                func.count(func.distinct(Unit.id)).label('total_units'),
                func.count(func.distinct(Unit.id)).filter(Unit.status == 'OCCUPIED').label('occupied_units'),
                func.count(func.distinct(Transaction.id)).label('total_transactions'),
                func.coalesce(
                    func.sum(Transaction.amount).filter(Transaction.type == CategoryType.INCOME),
                    0
                ).label('total_income'),
                func.coalesce(
                    func.sum(Transaction.amount).filter(Transaction.type == CategoryType.EXPENSE),
                    0
                ).label('total_expenses'),
                func.max(User.last_login).label('last_activity')
            )
            .outerjoin(User, Condominium.id == User.condominium_id)
            .outerjoin(Unit, Condominium.id == Unit.condominium_id)
            .outerjoin(Transaction, Condominium.id == Transaction.condominium_id)
            .group_by(Condominium.id)
            .order_by(desc('total_users'))
            .limit(limit)
        )
        
        rows = result.all()
        
        return [
            CondominiumStats(
                id=str(row.id),
                name=row.name,
                plan_type=row.plan_type,
                is_active=row.is_active,
                total_users=row.total_users or 0,
                total_admins=row.total_admins or 0,
                total_residents=row.total_residents or 0,
                total_units=row.total_units or 0,
                occupied_units=row.occupied_units or 0,
                total_transactions=row.total_transactions or 0,
                total_income=Decimal(row.total_income or 0),
                total_expenses=Decimal(row.total_expenses or 0),
                last_activity=row.last_activity,
                created_at=row.created_at
            )
            for row in rows
        ]
    
    async def _get_recent_activity(self, limit: int = 10) -> List[RecentActivity]:
        """Obtiene actividad reciente (últimos logins)."""
        
        result = await self.db.execute(
            select(
                User.id,
                User.email,
                User.full_name,
                User.condominium_id,
                Condominium.name.label('condominium_name'),
                User.last_login
            )
            .join(Condominium, User.condominium_id == Condominium.id)
            .where(User.last_login.isnot(None))
            .where(User.condominium_id.isnot(None))  # Excluir super admins
            .order_by(desc(User.last_login))
            .limit(limit)
        )
        
        rows = result.all()
        
        return [
            RecentActivity(
                user_id=str(row.id),
                user_email=row.email,
                user_name=row.full_name,
                condominium_id=str(row.condominium_id),
                condominium_name=row.condominium_name,
                action="login",
                timestamp=row.last_login
            )
            for row in rows
        ]


def get_super_admin_dashboard_service(db: AsyncSession) -> SuperAdminDashboardService:
    """Factory para el servicio de dashboard."""
    return SuperAdminDashboardService(db)
