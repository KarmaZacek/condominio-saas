"""
Sistema de invitaciones para registro de usuarios multi-tenancy.
"""

# ============================================================
# PARTE 1: AGREGAR AL MODELO models.py
# ============================================================
"""
Agregar este modelo a app/models/models.py:

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid

class InvitationCode(Base):
    \"\"\"Códigos de invitación para registro de usuarios.\"\"\"
    
    __tablename__ = "invitation_codes"
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4())
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    condominium_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("condominiums.id", ondelete="CASCADE"),
        index=True
    )
    unit_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("units.id", ondelete="CASCADE"),
        nullable=True
    )
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="RESIDENT")
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    # Relaciones
    condominium: Mapped["Condominium"] = relationship("Condominium")
    unit: Mapped[Optional["Unit"]] = relationship("Unit")
    created_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by]
    )
    used_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[used_by_user_id]
    )
"""

# ============================================================
# PARTE 2: SCHEMAS (app/schemas/invitations.py)
# ============================================================

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class InvitationCreate(BaseModel):
    """Schema para crear código de invitación."""
    unit_id: Optional[str] = None
    email: Optional[EmailStr] = None  # Si se especifica, solo ese email puede usar el código
    role: str = "RESIDENT"
    expires_in_days: int = Field(default=7, ge=1, le=30)

class InvitationResponse(BaseModel):
    """Schema de respuesta de invitación."""
    id: str
    code: str
    condominium_id: str
    unit_id: Optional[str]
    unit_number: Optional[str]
    email: Optional[str]
    role: str
    is_used: bool
    expires_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class InvitationListResponse(BaseModel):
    """Schema de lista de invitaciones."""
    data: list[InvitationResponse]
    total: int
    page: int
    limit: int


# ============================================================
# PARTE 3: ENDPOINT DE INVITACIONES (app/api/routes/invitations.py)
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import timedelta
import secrets
import string

from app.core.database import get_db
from app.middleware.auth import get_current_user, AuthenticatedUser, require_role
from app.models.models import InvitationCode, Unit


router = APIRouter(prefix="/invitations", tags=["Invitaciones"])


def generate_invitation_code(length: int = 8) -> str:
    """Genera un código aleatorio de invitación."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.post(
    "",
    response_model=InvitationResponse,
    summary="Crear código de invitación",
    status_code=status.HTTP_201_CREATED
)
async def create_invitation(
    data: InvitationCreate,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un código de invitación para registrar nuevos usuarios.
    
    **Solo administradores**
    """
    # Validar unidad si se especificó
    unit_number = None
    if data.unit_id:
        unit_result = await db.execute(
            select(Unit)
            .where(Unit.id == data.unit_id)
            .where(Unit.condominium_id == current_user.condominium_id)
        )
        unit = unit_result.scalar_one_or_none()
        
        if not unit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unidad no encontrada en tu condominio"
            )
        unit_number = unit.unit_number
    
    # Generar código único
    code = generate_invitation_code()
    
    # Verificar que no exista (muy improbable pero seguro)
    while True:
        existing = await db.execute(
            select(InvitationCode).where(InvitationCode.code == code)
        )
        if not existing.scalar_one_or_none():
            break
        code = generate_invitation_code()
    
    # Calcular expiración
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
    
    # Crear invitación
    invitation = InvitationCode(
        code=code,
        condominium_id=current_user.condominium_id,
        unit_id=data.unit_id,
        email=data.email.lower() if data.email else None,
        role=data.role,
        expires_at=expires_at,
        created_by=current_user.id
    )
    
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    
    return InvitationResponse(
        id=invitation.id,
        code=invitation.code,
        condominium_id=invitation.condominium_id,
        unit_id=invitation.unit_id,
        unit_number=unit_number,
        email=invitation.email,
        role=invitation.role,
        is_used=invitation.is_used,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at
    )


@router.get(
    "",
    response_model=InvitationListResponse,
    summary="Listar invitaciones"
)
async def list_invitations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    include_used: bool = Query(False),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista códigos de invitación del condominio.
    
    **Solo administradores**
    """
    filters = [InvitationCode.condominium_id == current_user.condominium_id]
    
    if not include_used:
        filters.append(InvitationCode.is_used == False)
    
    # Contar total
    count_result = await db.execute(
        select(func.count(InvitationCode.id)).where(and_(*filters))
    )
    total = count_result.scalar() or 0
    
    # Obtener invitaciones
    offset = (page - 1) * limit
    result = await db.execute(
        select(InvitationCode)
        .where(and_(*filters))
        .order_by(InvitationCode.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    invitations = result.scalars().all()
    
    # Obtener números de unidad
    unit_ids = [inv.unit_id for inv in invitations if inv.unit_id]
    unit_numbers = {}
    if unit_ids:
        units_result = await db.execute(
            select(Unit.id, Unit.unit_number).where(Unit.id.in_(unit_ids))
        )
        unit_numbers = {str(row[0]): row[1] for row in units_result}
    
    return InvitationListResponse(
        data=[
            InvitationResponse(
                id=inv.id,
                code=inv.code,
                condominium_id=inv.condominium_id,
                unit_id=inv.unit_id,
                unit_number=unit_numbers.get(inv.unit_id),
                email=inv.email,
                role=inv.role,
                is_used=inv.is_used,
                expires_at=inv.expires_at,
                created_at=inv.created_at
            )
            for inv in invitations
        ],
        total=total,
        page=page,
        limit=limit
    )


@router.delete(
    "/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar invitación"
)
async def delete_invitation(
    invitation_id: str,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina un código de invitación no utilizado.
    
    **Solo administradores**
    """
    result = await db.execute(
        select(InvitationCode)
        .where(InvitationCode.id == invitation_id)
        .where(InvitationCode.condominium_id == current_user.condominium_id)
    )
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitación no encontrada"
        )
    
    if invitation.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una invitación ya utilizada"
        )
    
    await db.delete(invitation)
    await db.commit()


# ============================================================
# PARTE 4: REGISTRAR ROUTER EN main.py
# ============================================================
"""
En app/main.py, agregar:

from app.api.routes import invitations

app.include_router(invitations.router, prefix="/v1")
"""
