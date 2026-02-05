"""
Rutas API para gestión de usuarios (solo admin)
"""
from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import hash_password
from app.middleware.auth import get_current_user, require_role, AuthenticatedUser
from app.models.models import User, Unit, Transaction, AuditLog, AuditAction, RefreshToken, BoardPosition
from app.schemas.entities import PaginatedResponse
from app.schemas.auth import UserResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

router = APIRouter(prefix="/users", tags=["Usuarios"])


# Schemas específicos para admin
class UserCreateAdmin(BaseModel):
    """Schema para crear usuario desde admin"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = None
    role: str = Field(default="resident", pattern="^(admin|resident|accountant)$")
    board_position: Optional[str] = Field(None, pattern="^(president|treasurer|secretary)$")
    unit_id: Optional[UUID] = None
    is_active: bool = True
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Debe contener al menos una mayúscula')
        if not re.search(r'[a-z]', v):
            raise ValueError('Debe contener al menos una minúscula')
        if not re.search(r'\d', v):
            raise ValueError('Debe contener al menos un número')
        return v


class UserUpdateAdmin(BaseModel):
    """Schema para actualizar usuario desde admin"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|resident|accountant)$")
    board_position: Optional[str] = Field(None, pattern="^(president|treasurer|secretary|)$")
    unit_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserDetailResponse(BaseModel):
    """Respuesta detallada de usuario para admin"""
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    role: str
    board_position: Optional[str]
    is_active: bool
    email_verified: bool
    unit_id: Optional[UUID]
    unit_number: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]
    failed_login_attempts: int
    locked_until: Optional[datetime]
    transaction_count: int = 0
    
    class Config:
        from_attributes = True


@router.get("", response_model=PaginatedResponse[UserDetailResponse])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[str] = Query(None, pattern="^(admin|resident|accountant)$"),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    unit_id: Optional[UUID] = None,
    has_unit: Optional[bool] = None,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todos los usuarios con filtros.
    Solo administradores.
    """
    query = select(User).options(selectinload(User.units))
    count_query = select(func.count(User.id))
    
    # Filtros
    filters = []
    
    if role:
        filters.append(User.role == role)
    
    if is_active is not None:
        filters.append(User.is_active == is_active)
    
    if unit_id:
        filters.append(User.unit_id == unit_id)
    
    if has_unit is not None:
        if has_unit:
            filters.append(User.unit_id.isnot(None))
        else:
            filters.append(User.unit_id.is_(None))
    
    if search:
        search_filter = or_(
            User.email.ilike(f"%{search}%"),
            User.full_name.ilike(f"%{search}%"),
            User.phone.ilike(f"%{search}%")
        )
        filters.append(search_filter)
    
    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))
    
    # Contar total
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0
    
    # Paginación y ordenamiento
    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Obtener conteos de transacciones
    user_ids = [u.id for u in users]
    tx_counts = {}
    if user_ids:
        tx_query = select(
            Transaction.created_by,
            func.count(Transaction.id)
        ).where(
            Transaction.created_by.in_(user_ids)
        ).group_by(Transaction.created_by)
        tx_result = await db.execute(tx_query)
        tx_counts = {row[0]: row[1] for row in tx_result}
    
    # Construir respuesta
    users_data = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role.value if hasattr(user.role, 'value') else user.role,
            "board_position": user.board_position.value if user.board_position else None,
            "is_active": user.is_active,
            "email_verified": user.email_verified,
            "unit_id": user.units[0].id if user.units else None,
            "unit_number": user.units[0].unit_number if user.units else None,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login": user.last_login,
            "failed_login_attempts": user.failed_login_attempts,
            "locked_until": user.locked_until,
            "transaction_count": tx_counts.get(user.id, 0)
        }
        users_data.append(UserDetailResponse(**user_dict))
    
    total_pages = (total_items + limit - 1) // limit
    
    return PaginatedResponse(
        data=users_data,
        pagination={
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene detalles de un usuario específico.
    Solo administradores.
    """
    result = await db.execute(
        select(User).options(selectinload(User.units)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Contar transacciones
    tx_count = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_by == user_id)
    )
    
    return UserDetailResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        board_position=user.board_position.value if user.board_position else None,
        is_active=user.is_active,
        email_verified=user.email_verified,
        unit_id=None,  # Usuario recién creado no tiene unidades
        unit_number=user.units[0].unit_number if user.units else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        transaction_count=tx_count.scalar() or 0
    )


@router.post("", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreateAdmin,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo usuario.
    Solo administradores.
    """
    # Verificar email único
    existing = await db.execute(
        select(User).where(func.lower(User.email) == data.email.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )
    
    # Verificar unidad si se especifica
    unit = None
    if data.unit_id:
        unit_result = await db.execute(
            select(Unit).where(Unit.id == data.unit_id)
        )
        unit = unit_result.scalar_one_or_none()
        if not unit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unidad no encontrada"
            )
    
    # Crear usuario
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=data.role,
        board_position=BoardPosition(data.board_position) if data.board_position else None,
        is_active=data.is_active,
        email_verified=True  # Admin crea usuarios verificados
    )
    
    db.add(user)
    
    # Registrar en auditoría
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.CREATE,
        entity_type="user",
        entity_id=user.id,
        new_values={
            "email": user.email,
            "full_name": user.full_name,
            "role": data.role,
            "unit_id": str(data.unit_id) if data.unit_id else None
        }
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(user)
    
    return UserDetailResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        board_position=user.board_position.value if user.board_position else None,
        is_active=user.is_active,
        email_verified=user.email_verified,
        unit_id=None,  # Usuario recién creado no tiene unidades
        unit_number=unit.unit_number if unit else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        transaction_count=0
    )


@router.put("/{user_id}", response_model=UserDetailResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdateAdmin,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza un usuario existente.
    Solo administradores.
    """
    result = await db.execute(
        select(User).options(selectinload(User.units)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # No permitir que un admin se desactive a sí mismo
    if user_id == current_user.id and data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta"
        )
    
    # No permitir que un admin cambie su propio rol
    if user_id == current_user.id and data.role and data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes cambiar tu propio rol"
        )
    
    # Guardar valores anteriores para auditoría
    old_values = {
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "is_active": user.is_active,
        "unit_id": str(user.units[0].id) if user.units else None,
        "board_position": user.board_position.value if user.board_position else None
    }
    
    # Verificar email único si se está cambiando
    if data.email and data.email.lower() != user.email.lower():
        existing = await db.execute(
            select(User).where(
                and_(
                    func.lower(User.email) == data.email.lower(),
                    User.id != user_id
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado"
            )
    
    # Verificar unidad si se especifica
    unit = user.unit
    if data.unit_id is not None:
        if data.unit_id:
            unit_result = await db.execute(
                select(Unit).where(Unit.id == data.unit_id)
            )
            unit = unit_result.scalar_one_or_none()
            if not unit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unidad no encontrada"
                )
        else:
            unit = None
    
    # Actualizar campos
    update_data = data.model_dump(exclude_unset=True)
    new_values = {}
    
    for field, value in update_data.items():
        if field == "email" and value:
            value = value.lower()
        setattr(user, field, value)
        new_values[field] = str(value) if isinstance(value, UUID) else value
    
    # Registrar en auditoría
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.UPDATE,
        entity_type="user",
        entity_id=user.id,
        old_values=old_values,
        new_values=new_values
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(user)
    
    # Contar transacciones
    tx_count = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_by == user_id)
    )
    
    return UserDetailResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        board_position=user.board_position.value if user.board_position else None,
        is_active=user.is_active,
        email_verified=user.email_verified,
        unit_id=None,  # Usuario recién creado no tiene unidades
        unit_number=unit.unit_number if unit else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        transaction_count=tx_count.scalar() or 0
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Desactiva un usuario (soft delete).
    Solo administradores.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propia cuenta"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Soft delete
    user.is_active = False
    
    # Revocar todos los tokens
    await db.execute(
        RefreshToken.__table__.update()
        .where(RefreshToken.user_id == user_id)
        .values(is_revoked=True)
    )
    
    # Registrar en auditoría
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.DELETE,
        entity_type="user",
        entity_id=user.id,
        old_values={"is_active": True},
        new_values={"is_active": False}
    )
    db.add(audit)
    
    await db.commit()


@router.post("/{user_id}/unlock", response_model=UserDetailResponse)
async def unlock_user(
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Desbloquea una cuenta de usuario bloqueada.
    Solo administradores.
    """
    result = await db.execute(
        select(User).options(selectinload(User.units)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    user.failed_login_attempts = 0
    user.locked_until = None
    
    # Registrar en auditoría
    audit = AuditLog(
        user_id=current_user.id,
        action="unlock",
        entity_type="user",
        entity_id=user.id,
        new_values={"action": "account_unlocked"}
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(user)
    
    tx_count = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_by == user_id)
    )
    
    return UserDetailResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        board_position=user.board_position.value if user.board_position else None,
        is_active=user.is_active,
        email_verified=user.email_verified,
        unit_id=None,  # Usuario recién creado no tiene unidades
        unit_number=user.units[0].unit_number if user.units else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        transaction_count=tx_count.scalar() or 0
    )


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    new_password: str = Query(..., min_length=8),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Restablece la contraseña de un usuario.
    Solo administradores.
    """
    # Validar contraseña
    if not re.search(r'[A-Z]', new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe contener al menos una mayúscula"
        )
    if not re.search(r'[a-z]', new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe contener al menos una minúscula"
        )
    if not re.search(r'\d', new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe contener al menos un número"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    user.password_hash = hash_password(new_password)
    
    # Revocar todos los tokens
    await db.execute(
        RefreshToken.__table__.update()
        .where(RefreshToken.user_id == user_id)
        .values(is_revoked=True)
    )
    
    # Registrar en auditoría
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.RESET_PASSWORD,
        entity_type="user",
        entity_id=user.id,
        new_values={"action": "password_reset_by_admin"}
    )
    db.add(audit)
    
    await db.commit()
    
    return {"message": "Contraseña restablecida exitosamente"}


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el registro de actividad de un usuario.
    Solo administradores.
    """
    # Verificar que el usuario existe
    user_exists = await db.execute(
        select(User.id).where(User.id == user_id)
    )
    if not user_exists.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Obtener actividad
    query = select(AuditLog).where(
        AuditLog.user_id == user_id
    ).order_by(AuditLog.created_at.desc())
    
    count_query = select(func.count(AuditLog.id)).where(
        AuditLog.user_id == user_id
    )
    
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0
    
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    activities = result.scalars().all()
    
    total_pages = (total_items + limit - 1) // limit
    
    return {
        "data": [
            {
                "id": str(a.id),
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": str(a.entity_id) if a.entity_id else None,
                "old_values": a.old_values,
                "new_values": a.new_values,
                "ip_address": a.ip_address,
                "user_agent": a.user_agent,
                "created_at": a.created_at.isoformat()
            }
            for a in activities
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@router.post("/{user_id}/activate", response_model=UserDetailResponse)
async def activate_user(
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Reactiva un usuario desactivado.
    Solo administradores.
    """
    result = await db.execute(
        select(User).options(selectinload(User.units)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya está activo"
        )
    
    # Reactivar usuario
    user.is_active = True
    user.failed_login_attempts = 0
    user.locked_until = None
    
    # Registrar en auditoría
    audit = AuditLog(
        user_id=current_user.id,
        action="activate",
        entity_type="user",
        entity_id=user.id,
        old_values={"is_active": False},
        new_values={"is_active": True}
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(user)
    
    tx_count = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_by == user_id)
    )
    
    return UserDetailResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        board_position=user.board_position.value if user.board_position else None,
        is_active=user.is_active,
        email_verified=user.email_verified,
        unit_id=user.unit_id,
        unit_number=user.units[0].unit_number if user.units else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        transaction_count=tx_count.scalar() or 0
    )


@router.delete("/{user_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_permanent(
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina permanentemente un usuario.
    Solo administradores.
    ADVERTENCIA: Esta acción no se puede deshacer.
    """
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propia cuenta"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar si tiene transacciones asociadas
    tx_count = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_by == user_id)
    )
    transaction_count = tx_count.scalar() or 0
    
    if transaction_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede eliminar permanentemente. El usuario tiene {transaction_count} transacciones asociadas. Desactívalo en su lugar."
        )
    
    # Guardar datos para auditoría antes de eliminar
    user_data = {
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, 'value') else user.role
    }
    
    # Eliminar tokens de refresh
    await db.execute(
        RefreshToken.__table__.delete().where(RefreshToken.user_id == user_id)
    )
    
    # Eliminar registros de auditoría del usuario (opcional, o mantenerlos)
    # await db.execute(
    #     AuditLog.__table__.delete().where(AuditLog.user_id == user_id)
    # )
    
    # Registrar la eliminación en auditoría (antes de eliminar el usuario)
    audit = AuditLog(
        user_id=current_user.id,
        action="permanent_delete",
        entity_type="user",
        entity_id=user_id,
        old_values=user_data,
        new_values={"deleted": True}
    )
    db.add(audit)
    
    # Eliminar el usuario
    await db.delete(user)
    await db.commit()
