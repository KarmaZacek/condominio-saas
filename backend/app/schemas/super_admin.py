"""
Schemas de Pydantic para Super Admin.
"""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


# ============================================================
# DASHBOARD SCHEMAS
# ============================================================

class CondominiumStats(BaseModel):
    """Estadísticas de un condominio."""
    id: str
    name: str
    plan_type: str
    is_active: bool
    total_users: int
    total_admins: int
    total_residents: int
    total_units: int
    occupied_units: int
    total_transactions: int
    total_income: Decimal
    total_expenses: Decimal
    last_activity: Optional[datetime]
    created_at: datetime


class PlanDistribution(BaseModel):
    """Distribución de condominios por plan."""
    plan_type: str
    count: int
    percentage: float


class UserRoleDistribution(BaseModel):
    """Distribución de usuarios por rol."""
    role: str
    count: int
    percentage: float


class RecentActivity(BaseModel):
    """Actividad reciente en el sistema."""
    user_id: str
    user_email: str
    user_name: str
    condominium_id: str
    condominium_name: str
    action: str
    timestamp: datetime


class SystemMetrics(BaseModel):
    """Métricas generales del sistema."""
    total_condominiums: int
    active_condominiums: int
    inactive_condominiums: int
    total_users: int
    total_admins: int
    total_residents: int
    total_units: int
    total_transactions_this_month: int
    total_income_this_month: Decimal
    total_expenses_this_month: Decimal


class DashboardResponse(BaseModel):
    """Respuesta completa del dashboard."""
    metrics: SystemMetrics
    plan_distribution: List[PlanDistribution]
    user_distribution: List[UserRoleDistribution]
    top_condominiums: List[CondominiumStats]
    recent_activity: List[RecentActivity]


# ============================================================
# CONDOMINIUM MANAGEMENT SCHEMAS
# ============================================================

class CondominiumListItem(BaseModel):
    """Item de condominio en lista."""
    id: str
    name: str
    slug: Optional[str]
    plan_type: str
    is_active: bool
    is_setup_completed: bool
    total_users: int
    total_units: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class CondominiumListResponse(BaseModel):
    """Respuesta de lista de condominios."""
    data: List[CondominiumListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class CondominiumDetail(BaseModel):
    """Detalle completo de condominio."""
    id: str
    name: str
    slug: Optional[str]
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    plan_type: str
    is_active: bool
    is_setup_completed: bool
    logo_url: Optional[str]
    default_monthly_fee: Optional[Decimal]
    total_users: int
    total_units: int
    total_transactions: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class CondominiumUpdate(BaseModel):
    """Schema para actualizar condominio."""
    name: Optional[str] = None
    plan_type: Optional[str] = None
    is_active: Optional[bool] = None
    default_monthly_fee: Optional[Decimal] = None


# ============================================================
# USER MANAGEMENT SCHEMAS
# ============================================================

class SuperAdminUserListItem(BaseModel):
    """Item de usuario en lista (vista super admin)."""
    id: str
    email: str
    full_name: str
    role: str
    condominium_id: Optional[str]
    condominium_name: Optional[str]
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class SuperAdminUserListResponse(BaseModel):
    """Respuesta de lista de usuarios."""
    data: List[SuperAdminUserListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class UserPasswordReset(BaseModel):
    """Schema para resetear contraseña de usuario."""
    new_password: str = Field(..., min_length=8, max_length=100)


# ============================================================
# AUDIT LOG SCHEMAS
# ============================================================

class GlobalAuditLogItem(BaseModel):
    """Item de log de auditoría global."""
    id: str
    user_id: Optional[str]
    user_email: Optional[str]
    user_name: Optional[str]
    condominium_id: Optional[str]
    condominium_name: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class GlobalAuditLogResponse(BaseModel):
    """Respuesta de logs de auditoría globales."""
    data: List[GlobalAuditLogItem]
    total: int
    page: int
    limit: int
    total_pages: int
