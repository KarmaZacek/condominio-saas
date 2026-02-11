"""
Schemas de Pydantic para entidades principales.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Generic, TypeVar
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.models.models import (
    UserRole, UnitStatus, CategoryType, 
    TransactionStatus, PaymentMethod
)


# ================== PAGINACIÓN (DEFINICIÓN ÚNICA) ==================

T = TypeVar('T')

class PaginationMeta(BaseModel):
    """Metadatos de paginación."""
    page: int
    limit: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    """Respuesta paginada genérica."""
    data: List[T]
    pagination: PaginationMeta


# ================== CONDOMINIOS (NUEVO PARA EVITAR BUCLE) ==================

class CondominiumResponse(BaseModel):
    """Respuesta ligera de condominio (sin usuarios anidados)."""
    id: str
    name: str
    address: Optional[str] = None
    logo_url: Optional[str] = None
    is_setup_completed: bool = False
    
    model_config = ConfigDict(from_attributes=True)


# ================== USUARIOS ==================

class UserBase(BaseModel):
    """Base para usuarios."""
    email: str
    full_name: str
    phone: Optional[str] = None


class UserCreate(UserBase):
    """Crear usuario (admin)."""
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.RESIDENT
    is_active: bool = True


class UserUpdate(BaseModel):
    """Actualizar usuario (admin)."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    unit_id: Optional[str] = None


class UserResponse(BaseModel):
    """Respuesta de usuario."""
    id: str
    email: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    email_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    
    # ✅ CORRECCIÓN CRÍTICA: Incluimos el Condominio pero usando el esquema simple
    # Esto rompe el bucle infinito User -> Condo -> Users
    condominium_id: str
    condominium: Optional[CondominiumResponse] = None
    
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """Lista de usuarios con paginación."""
    data: List[UserResponse]
    pagination: PaginationMeta


# ================== VIVIENDAS ==================

class UnitBase(BaseModel):
    """Base para viviendas."""
    unit_number: str = Field(..., min_length=1, max_length=10)
    building: Optional[str] = Field(None, max_length=50)
    floor: Optional[int] = Field(None, ge=0)
    area_m2: Optional[Decimal] = Field(None, gt=0)


class UnitCreate(UnitBase):
    """Crear vivienda."""
    status: UnitStatus = UnitStatus.VACANT
    monthly_fee: Decimal = Field(..., ge=0)
    owner_user_id: Optional[str] = None
    tenant_user_id: Optional[str] = None
    notes: Optional[str] = None


class UnitUpdate(BaseModel):
    """Actualizar vivienda."""
    unit_number: Optional[str] = Field(None, min_length=1, max_length=10)
    building: Optional[str] = Field(None, max_length=50)
    floor: Optional[int] = Field(None, ge=0)
    area_m2: Optional[Decimal] = Field(None, gt=0)
    status: Optional[UnitStatus] = None
    monthly_fee: Optional[Decimal] = Field(None, ge=0)
    owner_user_id: Optional[str] = None
    tenant_user_id: Optional[str] = None
    notes: Optional[str] = None


class UnitResponse(BaseModel):
    """Respuesta de vivienda."""
    id: str
    unit_number: str
    building: Optional[str] = None
    floor: Optional[int] = None
    area_m2: Optional[Decimal] = None
    status: UnitStatus
    monthly_fee: Decimal
    balance: Decimal
    notes: Optional[str] = None
    owner_user_id: Optional[str] = None
    owner_name: Optional[str] = None
    tenant_user_id: Optional[str] = None
    tenant_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UnitSummary(BaseModel):
    """Resumen de viviendas."""
    total_units: int
    occupied: int
    vacant: int
    maintenance: int
    total_debt: Decimal
    units_with_debt: int


class UnitListResponse(BaseModel):
    """Lista de viviendas con resumen."""
    data: List[UnitResponse]
    summary: UnitSummary
    pagination: PaginationMeta


# ================== CATEGORÍAS ==================

class CategoryBase(BaseModel):
    """Base para categorías."""
    name: str = Field(..., min_length=1, max_length=100)
    type: CategoryType
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    """Crear categoría."""
    color: str = Field("#6B7280", pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)


class CategoryUpdate(BaseModel):
    """Actualizar categoría."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    """Respuesta de categoría."""
    id: str
    name: str
    type: CategoryType
    description: Optional[str] = None
    color: str
    icon: Optional[str] = None
    is_active: bool
    is_system: bool
    transaction_count: int = 0
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CategoriesGrouped(BaseModel):
    """Categorías agrupadas por tipo."""
    income: List[CategoryResponse]
    expense: List[CategoryResponse]


# ================== TRANSACCIONES ==================

class TransactionBase(BaseModel):
    """Base para transacciones."""
    type: CategoryType
    amount: Decimal = Field(..., gt=0)
    category_id: str
    description: str = Field(..., min_length=1, max_length=500)
    transaction_date: date


class TransactionCreate(TransactionBase):
    """Crear transacción."""
    unit_id: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    fiscal_period: Optional[str] = Field(
        None, 
        pattern=r'^\d{4}-(0[1-9]|1[0-2])$',
        description="Período al que aplica el pago (YYYY-MM)"
    )
    
    @field_validator('unit_id')
    @classmethod
    def validate_unit_for_income(cls, v, info):
        return v


class TransactionUpdate(BaseModel):
    """Actualizar transacción."""
    amount: Optional[Decimal] = Field(None, gt=0)
    category_id: Optional[str] = None
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    transaction_date: Optional[date] = None
    unit_id: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    status: Optional[TransactionStatus] = None


class TransactionResponse(BaseModel):
    """Respuesta de transacción."""
    id: str
    type: CategoryType
    amount: Decimal
    description: str
    transaction_date: date
    status: TransactionStatus
    category_id: str
    category_name: str
    category_color: str
    unit_id: Optional[str] = None
    unit_number: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    reference_number: Optional[str] = None
    receipt_url: Optional[str] = None
    receipt_thumbnail_url: Optional[str] = None
    notes: Optional[str] = None
    fiscal_period: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime
    is_advance_payment: bool = False
    is_late_payment: bool = False

    model_config = ConfigDict(from_attributes=True)


class TransactionSummary(BaseModel):
    """Resumen de transacciones."""
    total_income: Decimal = Field(default=0)
    total_expense: Decimal = Field(default=0)
    net_balance: Decimal = Field(default=0)
    transaction_count: int = Field(default=0)
    
    # Campos para desglose de pagos
    advance_payment_count: int = Field(default=0)
    advance_payment_amount: Decimal = Field(default=0)
    late_payment_count: int = Field(default=0)
    late_payment_amount: Decimal = Field(default=0)


class TransactionListResponse(BaseModel):
    """Lista de transacciones con resumen."""
    data: List[TransactionResponse]
    summary: TransactionSummary
    pagination: PaginationMeta  # Usa la definición única del inicio


class TransactionWithBalance(BaseModel):
    """Transacción con respuesta de balance."""
    transaction: TransactionResponse
    unit_new_balance: Optional[Decimal] = None


# ================== REPORTES ==================

class CategoryBreakdown(BaseModel):
    """Desglose por categoría."""
    category_id: str
    category_name: str
    category_color: str
    amount: Decimal
    percentage: Decimal
    transaction_count: int


class MonthlyReportResponse(BaseModel):
    """Reporte mensual."""
    fiscal_period: str
    period_name: str
    summary: dict
    income_by_category: List[CategoryBreakdown]
    expense_by_category: List[CategoryBreakdown]
    transactions: List[TransactionResponse]
    units_status: dict
    comparison: dict


class DashboardResponse(BaseModel):
    """Datos para dashboard."""
    current_period: str
    balance: dict
    income: dict
    expenses: dict
    collection: dict
    recent_transactions: List[TransactionResponse]
    alerts: List[dict]


# ================== ESTADO DE CUENTA VIVIENDA ==================

class UnitBalance(BaseModel):
    """Estado de cuenta de vivienda."""
    unit_id: str
    unit_number: str
    current_balance: Decimal
    total_charges: Decimal
    total_payments: Decimal
    transactions: List[TransactionResponse]
    monthly_breakdown: List[dict]
