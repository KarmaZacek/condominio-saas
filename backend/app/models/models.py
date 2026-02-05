"""
Modelos de base de datos SQLAlchemy.
"""
import uuid
import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import (
    Column,  # <--- ¡ESTO ES LO QUE FALTA!
    String, Text, Boolean, Integer, DateTime, Date,
    Numeric, ForeignKey, Enum, JSON, Index, CheckConstraint,
    func
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

class Condominium(Base):
    __tablename__ = "condominiums"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    plan_type = Column(String, default="basic") # free, pro, enterprise
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones (Un condominio tiene muchos...)
    users = relationship("User", back_populates="condominium", cascade="all, delete-orphan")
    units = relationship("Unit", back_populates="condominium", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="condominium", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="condominium", cascade="all, delete-orphan")

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    RESIDENT = "resident"
    ACCOUNTANT = "accountant"

class BoardPosition(str, enum.Enum):
    PRESIDENT = "president"
    TREASURER = "treasurer"
    SECRETARY = "secretary"

class UnitStatus(str, enum.Enum):
    OCCUPIED = "occupied"
    VACANT = "vacant"
    MAINTENANCE = "maintenance"


class CategoryType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    TRANSFER = "transfer"
    CARD = "card"
    CHECK = "check"
    OTHER = "other"


class AuditAction(str, enum.Enum):
    """Acciones de auditoría."""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    EXPORT = "EXPORT"
    PERMANENT_DELETE = "permanent_delete"
    ACTIVATE = "activate"
    CANCEL = "cancel"
    UNLOCK = "unlock"
    UPLOAD_RECEIPT = "upload_receipt"
    RESET_PASSWORD = "reset_password"


# Modelos
class User(Base):
    """Modelo de usuarios."""
    
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        default=UserRole.RESIDENT
    )
    board_position: Mapped[Optional[BoardPosition]] = mapped_column(
        Enum(BoardPosition),
        nullable=True,
        default=None
    )
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    # Vivienda asignada al usuario (para residentes)
    unit_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("units.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    # --- NUEVO: Vínculo al Condominio ---
    condominium_id = Column(UUID(as_uuid=True), ForeignKey("condominiums.id"), nullable=False)
    condominium = relationship("Condominium", back_populates="users")
    # Relaciones
    units: Mapped[List["Unit"]] = relationship(
        "Unit",
        back_populates="owner",
        foreign_keys="Unit.owner_user_id"
    )
    transactions_created: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="created_by_user"
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user"
    )
    reset_codes: Mapped[list["PasswordResetCode"]] = relationship(
        "PasswordResetCode", back_populates="user", cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<User {self.email}>"


class Unit(Base):
    """Modelo de viviendas/departamentos."""
    
    __tablename__ = "units"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    owner_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    tenant_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )  # Arrendatario

    unit_number: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    building: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    floor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    area_m2: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[UnitStatus] = mapped_column(
        Enum(UnitStatus),
        default=UnitStatus.OCCUPIED,
        index=True
    )
    monthly_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    # --- NUEVO: Vínculo al Condominio ---
    condominium_id = Column(UUID(as_uuid=True), ForeignKey("condominiums.id"), nullable=False)
    condominium = relationship("Condominium", back_populates="units")
    # Relaciones
    owner: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="units",
        foreign_keys=[owner_user_id]
    )
    tenant: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[tenant_user_id]
    )
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="unit"
    )
    
    __table_args__ = (
        CheckConstraint("area_m2 IS NULL OR area_m2 > 0", name="positive_area"),
        CheckConstraint("floor IS NULL OR floor >= 0", name="valid_floor"),
        CheckConstraint("monthly_fee >= 0", name="valid_monthly_fee"),
        Index("idx_units_balance_debt", "balance", postgresql_where=balance < 0),
    )
    
    def __repr__(self):
        return f"<Unit {self.unit_number}>"


class Category(Base):
    """Modelo de categorías de ingresos/gastos."""
    
    __tablename__ = "categories"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[CategoryType] = mapped_column(
        Enum(CategoryType),
        index=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_common_expense: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    # --- NUEVO: Vínculo al Condominio ---
    condominium_id = Column(UUID(as_uuid=True), ForeignKey("condominiums.id"), nullable=False)
    condominium = relationship("Condominium", back_populates="categories")
    # Relaciones
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="category"
    )
        
    __table_args__ = (
        Index("idx_categories_active", "is_active", postgresql_where=is_active == True),
    )
    
    def __repr__(self):
        return f"<Category {self.name} ({self.type.value})>"


class Transaction(Base):
    """Modelo de transacciones (ingresos y gastos)."""
    
    __tablename__ = "transactions"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    unit_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("units.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    category_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        index=True
    )
    created_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True
    )
    type: Mapped[CategoryType] = mapped_column(
        Enum(CategoryType),
        index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str] = mapped_column(String(500))
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    receipt_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    receipt_thumbnail_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus),
        default=TransactionStatus.CONFIRMED,
        index=True
    )
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_method: Mapped[Optional[PaymentMethod]] = mapped_column(
        Enum(PaymentMethod),
        nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fiscal_period: Mapped[Optional[str]] = mapped_column(String(7), index=True)
    is_advance_payment: Mapped[bool] = mapped_column(
        Boolean, 
        default=False,
        index=True,
        comment="Indica si el pago es adelantado (corresponde a un mes futuro)"
    )
    is_late_payment: Mapped[bool] = mapped_column(
        Boolean, 
        default=False,
        index=True,
        comment="Indica si el pago es atrasado (corresponde a un mes anterior)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    condominium_id = Column(UUID(as_uuid=True), ForeignKey("condominiums.id"), nullable=False)
    condominium = relationship("Condominium", back_populates="transactions")

    # Relaciones
    unit: Mapped[Optional["Unit"]] = relationship(
        "Unit",
        back_populates="transactions"
    )
    category: Mapped["Category"] = relationship(
        "Category",
        back_populates="transactions"
    )
    created_by_user: Mapped["User"] = relationship(
        "User",
        back_populates="transactions_created"
    )
    
    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
        Index(
            "idx_transactions_monthly_report",
            "fiscal_period", "type", "status"
        ),
    )
    
    def __repr__(self):
        return f"<Transaction {self.id[:8]} - {self.type.value} ${self.amount}>"


class RefreshToken(Base):
    """Modelo de tokens de refresh."""
    
    __tablename__ = "refresh_tokens"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    device_info: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    # Relaciones
    user: Mapped["User"] = relationship(
        "User",
        back_populates="refresh_tokens"
    )
    
    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="valid_expiry"),
        Index(
            "idx_refresh_tokens_expiry",
            "expires_at",
            postgresql_where=is_revoked == False
        ),
    )
    
    def __repr__(self):
        return f"<RefreshToken {self.id[:8]} - User {self.user_id[:8]}>"

class PasswordResetCode(Base):
    """Modelo para códigos de recuperación de contraseña."""
    __tablename__ = "password_reset_codes"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    code: Mapped[str] = mapped_column(String(6), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    # Relación
    user: Mapped["User"] = relationship("User", back_populates="reset_codes")


class AuditLog(Base):
    """Modelo de logs de auditoría."""
    
    __tablename__ = "audit_logs"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction, values_callable=lambda x: [e.value for e in x]), index=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        nullable=True
    )
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )
    
    # Relaciones
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="audit_logs"
    )
    
    __table_args__ = (
        Index("idx_audit_logs_entity", "entity_type", "entity_id"),
    )
    
    def __repr__(self):
        return f"<AuditLog {self.action.value} {self.entity_type}>"


class MonthlyReport(Base):
    """Modelo de reportes mensuales (caché)."""
    
    __tablename__ = "monthly_reports"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    fiscal_period: Mapped[str] = mapped_column(String(7), unique=True, index=True)
    total_income: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_expense: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    net_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    income_by_category: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    expense_by_category: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    units_with_debt: Mapped[int] = mapped_column(Integer, default=0)
    total_debt: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    generated_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True
    )
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    def __repr__(self):
        return f"<MonthlyReport {self.fiscal_period}>"
