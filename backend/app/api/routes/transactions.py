"""
Rutas de transacciones.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import CategoryType, TransactionStatus, PaymentMethod, AuditLog, AuditAction, User
from app.services.audit_service import log_audit
from app.schemas.entities import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    TransactionListResponse, TransactionWithBalance
)
from app.services.transaction_service import TransactionService, get_transaction_service

# --- AQUÍ ESTÁ EL CAMBIO CLAVE ---
# Agregamos la importación desde 'app.api.deps'
from app.api.deps import get_current_active_user 

# Mantenemos tus imports de auth por si otras rutas los usan
from app.middleware.auth import (
    get_current_user, AuthenticatedUser, 
    require_role, require_permission
)

router = APIRouter(prefix="/transactions", tags=["Transacciones"])


# =====================================================
# ENDPOINT: Gastos del Condominio (para residentes)
# =====================================================
@router.get(
    "/condominium-expenses",
    response_model=TransactionListResponse,
    summary="Ver gastos del condominio"
)
async def list_condominium_expenses(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=100),
    category_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    fiscal_period: Optional[str] = Query(None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$'),
    search: Optional[str] = None,
    has_receipt: Optional[bool] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    is_advance: Optional[bool] = None,
    is_late: Optional[bool] = None,
):
    """
    Lista los gastos generales del condominio.
    """
    service = get_transaction_service(db)
    
    # ✅ CORRECCIÓN: Pasar condominium_id al servicio
    return await service.get_transactions(
        page=page,
        limit=limit,
        type=CategoryType.EXPENSE,
        category_id=category_id,
        unit_id=None,  # Gastos globales (sin unidad asignada)
        status=None,
        from_date=from_date,
        to_date=to_date,
        fiscal_period=fiscal_period,
        search=search,
        has_receipt=has_receipt,
        min_amount=None,
        max_amount=None,
        is_advance=is_advance,
        is_late=is_late,
        user_role=current_user.role,
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )


@router.get(
    "",
    response_model=TransactionListResponse,
    summary="Listar transacciones"
)
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=100),
    type: Optional[CategoryType] = None,
    category_id: Optional[str] = None,
    unit_id: Optional[str] = None,
    status: Optional[TransactionStatus] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    fiscal_period: Optional[str] = Query(None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$'),
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    search: Optional[str] = None,
    has_receipt: Optional[bool] = None,
    is_advance: Optional[bool] = None,
    is_late: Optional[bool] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista transacciones con filtros y paginación.
    """
    service = get_transaction_service(db)
    
    # Si es residente, solo ver su vivienda
    if current_user.role == "resident":
        unit_id = current_user.unit_id
    
    # ✅ CORRECCIÓN: Pasar condominium_id al servicio
    return await service.get_transactions(
        page=page,
        limit=limit,
        type=type,
        category_id=category_id,
        unit_id=unit_id,
        status=status,
        from_date=from_date,
        to_date=to_date,
        fiscal_period=fiscal_period,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search,
        has_receipt=has_receipt,
        is_advance=is_advance,
        is_late=is_late,
        user_id=current_user.id,
        user_role=current_user.role,
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )


@router.get(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Obtener transacción"
)
async def get_transaction(
    transaction_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene una transacción por su ID.
    """
    service = get_transaction_service(db)
    
    # ✅ CORRECCIÓN: Pasar condominium_id para verificar que pertenece al condominio
    transaction = await service.get_transaction(
        transaction_id, 
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "TRANSACTION_NOT_FOUND",
                "message": "Transacción no encontrada en tu condominio"
            }
        )
    
    # Verificar acceso para residentes
    if current_user.role == "resident":
        is_condominium_expense = transaction.type == CategoryType.EXPENSE and transaction.unit_id is None
        is_own_unit = str(transaction.unit_id or '') == str(current_user.unit_id or '')
        
        if not is_condominium_expense and not is_own_unit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "No tienes acceso a esta transacción"
                }
            )
    
    return service._to_response(transaction)


@router.post("", response_model=TransactionResponse)
async def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_active_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva transacción.
    """
    # Validación de rol
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, 
            detail="No tienes permisos de administrador"
        )

    service = get_transaction_service(db)
    
    try:
        # ✅ YA ESTÁ CORRECTO: Pasa condominium_id
        result = await service.create_transaction(
            data=data,
            created_by=current_user.id,
            condominium_id=current_user.condominium_id  # ✅ CRÍTICO
        )
        
        # Registrar auditoría
        await log_audit(
            db=db,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="transaction",  # ✅ AGREGADO
            entity_id=str(result.transaction.id),
            condominium_id=current_user.condominium_id,  # ✅ CRÍTICO
            new_values=result.transaction.__dict__,
            old_values=None
        )
        
        await db.commit()
        
        return result.transaction
    except ValueError as e:
        error_message = str(e)
        
        if "UNIT_NOT_FOUND" in error_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "UNIT_NOT_FOUND", "message": "Vivienda no encontrada"}
            )
        elif "CATEGORY_NOT_FOUND" in error_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "CATEGORY_NOT_FOUND", "message": "Categoría no encontrada"}
            )
        elif "DUPLICATE_PAYMENT" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "DUPLICATE_PAYMENT",
                    "message": "Ya existe un pago de mantenimiento para este mes"
                }
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "VALIDATION_ERROR", "message": error_message}
            )


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza una transacción existente.
    """
    # Validación de rol
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos de administrador"
        )

    service = get_transaction_service(db)
    
    # ✅ CORRECCIÓN: Verificar que la transacción pertenezca al condominio
    old_transaction = await service.get_transaction(
        transaction_id,
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )
    
    if not old_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "TRANSACTION_NOT_FOUND",
                "message": "Transacción no encontrada en tu condominio"
            }
        )
    
    try:
        result = await service.update_transaction(transaction_id, data)
        
        # Registrar auditoría
        await log_audit(
            db=db,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="transaction",  # ✅ AGREGADO
            entity_id=transaction_id,
            condominium_id=current_user.condominium_id,  # ✅ CRÍTICO
            old_values=old_transaction.__dict__,
            new_values=result.transaction.__dict__
        )
        
        await db.commit()
        
        return result.transaction
    except ValueError as e:
        error_message = str(e)
        
        if "TRANSACTION_NOT_FOUND" in error_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
            )
        elif "CANNOT_UPDATE_CONFIRMED" in error_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "CANNOT_UPDATE_CONFIRMED",
                    "message": "No se puede editar una transacción confirmada"
                }
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "VALIDATION_ERROR", "message": error_message}
            )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancela (marca como cancelada) una transacción.
    """
    # Validación de rol
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos de administrador"
        )

    service = get_transaction_service(db)
    
    # ✅ CORRECCIÓN: Verificar que la transacción pertenezca al condominio
    transaction = await service.get_transaction(
        transaction_id,
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "TRANSACTION_NOT_FOUND",
                "message": "Transacción no encontrada en tu condominio"
            }
        )
    
    try:
        await service.cancel_transaction(transaction_id)
        
        # Registrar auditoría
        await log_audit(
            db=db,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="transaction",  # ✅ AGREGADO
            entity_id=transaction_id,
            condominium_id=current_user.condominium_id,  # ✅ CRÍTICO
            old_values=transaction.__dict__,
            new_values=None
        )
        
        await db.commit()
    except ValueError as e:
        error_message = str(e)
        
        if "TRANSACTION_NOT_FOUND" in error_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
            )
        elif "ALREADY_CANCELLED" in error_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "ALREADY_CANCELLED", "message": "La transacción ya está cancelada"}
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "VALIDATION_ERROR", "message": error_message}
            )


@router.post("/{transaction_id}/upload-receipt")
async def upload_receipt(
    transaction_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sube un comprobante para una transacción.
    """
    # Validación de rol
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos de administrador"
        )
    
    # ✅ CORRECCIÓN: Verificar que la transacción pertenezca al condominio
    service = get_transaction_service(db)
    transaction = await service.get_transaction(
        transaction_id,
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "TRANSACTION_NOT_FOUND",
                "message": "Transacción no encontrada en tu condominio"
            }
        )
    
    # Validar tipo de archivo
    from app.core.config import settings
    
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.pdf']
    file_ext = file.filename.split('.')[-1].lower()
    
    if f'.{file_ext}' not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_FILE_TYPE",
                "message": "Solo se permiten archivos JPG, PNG o PDF"
            }
        )
    
    # Validar tamaño
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "FILE_TOO_LARGE",
                "message": f"El archivo excede el tamaño máximo de {settings.MAX_FILE_SIZE_MB}MB"
            }
        )
    
    import os
    import uuid
    from app.core.config import RECEIPTS_DIR
    
    file_ext = os.path.splitext(file.filename)[1] or '.jpg'
    unique_filename = f"{transaction_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    
    transaction_dir = os.path.join(RECEIPTS_DIR, transaction_id)
    os.makedirs(transaction_dir, exist_ok=True)
    
    file_path = os.path.join(transaction_dir, unique_filename)
    with open(file_path, 'wb') as f:
        f.write(content)
    
    receipt_url = f"/uploads/receipts/{transaction_id}/{unique_filename}"
    thumbnail_url = receipt_url
    
    try:
        result = await service.add_receipt(
            transaction_id=transaction_id,
            receipt_url=receipt_url,
            thumbnail_url=thumbnail_url
        )
        
        # Registrar auditoría
        audit = AuditLog(
            user_id=current_user.id,
            condominium_id=current_user.condominium_id,  # ✅ CRÍTICO
            action=AuditAction.UPDATE,
            entity_type="transaction",
            entity_id=transaction_id,
            old_values={"receipt_url": None},
            new_values={"receipt_url": receipt_url}
        )
        db.add(audit)
        await db.commit()
        
        return result.transaction
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
        )


@router.get(
    "/{transaction_id}/receipt",
    summary="Obtener comprobante"
)
async def get_receipt(
    transaction_id: str,
    thumbnail: bool = Query(False),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el comprobante de una transacción.
    """
    service = get_transaction_service(db)
    
    # ✅ CORRECCIÓN: Verificar que la transacción pertenezca al condominio
    transaction = await service.get_transaction(
        transaction_id,
        condominium_id=current_user.condominium_id  # ✅ CRÍTICO
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
        )
    
    # Permitir ver comprobantes de gastos del condominio O de su vivienda
    if current_user.role == "resident":
        is_condominium_expense = transaction.type == CategoryType.EXPENSE and transaction.unit_id is None
        is_own_unit = str(transaction.unit_id or '') == str(current_user.unit_id or '')
        
        if not is_condominium_expense and not is_own_unit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "No tienes acceso a este comprobante"}
            )
    
    url = transaction.receipt_thumbnail_url if thumbnail else transaction.receipt_url
    
    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "RECEIPT_NOT_FOUND", "message": "Esta transacción no tiene comprobante"}
        )
    
    return {"url": url, "expires_in": 3600}


@router.get(
    "/{transaction_id}/receipt/pdf",
    summary="Generar recibo de pago PDF"
)
async def generate_receipt_pdf(
    transaction_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Genera un recibo de pago en formato PDF para una transacción.
    """
    from fastapi.responses import StreamingResponse
    from app.services.receipt_service import generate_receipt_pdf, generate_folio
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.models import Transaction, Unit, User, Category, CategoryType, BoardPosition, UserRole, Condominium
    
    # ✅ CORRECCIÓN: Filtrar por condominium_id al recuperar transacción
    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.unit),
            selectinload(Transaction.category),
            selectinload(Transaction.created_by_user)
        )
        .where(Transaction.id == transaction_id)
        .where(Transaction.condominium_id == current_user.condominium_id)  # ✅ CRÍTICO
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada en tu condominio"}
        )
    
    if transaction.type != CategoryType.INCOME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_TRANSACTION_TYPE", "message": "Solo se pueden generar recibos para pagos (ingresos)"}
        )
    
    # Verificación de seguridad para residentes
    if current_user.role == "resident":
        if not transaction.unit_id or str(transaction.unit_id) != str(current_user.unit_id or ''):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "No tienes acceso a este recibo"}
            )
    
    # Recuperar Datos del Condominio
    condominium_data = {}
    if transaction.condominium_id:
        condo_result = await db.execute(select(Condominium).where(Condominium.id == transaction.condominium_id))
        condo = condo_result.scalar_one_or_none()
        if condo:
            condominium_data = {
                "name": condo.name,
                "address": condo.address or "Dirección no registrada",
                "logo_url": condo.logo_url
            }
    
    # Datos complementarios (Residente, Tesorero, etc.)
    unit_number = transaction.unit.unit_number if transaction.unit else None
    
    resident_name = None
    if transaction.unit and transaction.unit.owner_user_id:
        owner_result = await db.execute(select(User).where(User.id == transaction.unit.owner_user_id))
        owner = owner_result.scalar_one_or_none()
        if owner:
            resident_name = owner.full_name
    
    signer_name = None
    treasurer_result = await db.execute(
        select(User)
        .where(User.board_position == BoardPosition.TREASURER)
        .where(User.condominium_id == current_user.condominium_id)  # ✅ Filtrar por condominio
        .where(User.is_active == True)
    )
    treasurer = treasurer_result.scalar_one_or_none()
    
    if treasurer:
        signer_name = treasurer.full_name
    else:
        # Fallback a Presidente o Admin
        president_result = await db.execute(
            select(User)
            .where(User.board_position == BoardPosition.PRESIDENT)
            .where(User.condominium_id == current_user.condominium_id)  # ✅ Filtrar por condominio
            .where(User.is_active == True)
        )
        president = president_result.scalar_one_or_none()
        if president:
            signer_name = president.full_name
        else:
            admin_result = await db.execute(
                select(User)
                .where(User.role == UserRole.ADMIN)
                .where(User.condominium_id == current_user.condominium_id)  # ✅ Filtrar por condominio
                .where(User.is_active == True)
            )
            admin = admin_result.scalar_one_or_none()
            if admin:
                signer_name = admin.full_name
    
    # Generar el PDF usando los datos dinámicos
    folio = generate_folio(transaction.id, transaction.transaction_date)
    
    pdf_buffer = generate_receipt_pdf(
        transaction_id=str(transaction.id),
        folio=folio,
        transaction_date=transaction.transaction_date,
        amount=transaction.amount,
        description=transaction.description,
        category_name=transaction.category.name if transaction.category else "Sin categoría",
        payment_method=transaction.payment_method.value if transaction.payment_method else None,
        condominium_data=condominium_data,
        reference_number=transaction.reference_number,
        unit_number=unit_number,
        resident_name=resident_name,
        treasurer_name=signer_name,
        notes=transaction.notes
    )
    
    filename = f"recibo_{folio}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
