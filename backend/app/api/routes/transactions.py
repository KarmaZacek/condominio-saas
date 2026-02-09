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


async def log_audit(
    db: AsyncSession,
    user_id: str,
    action: AuditAction,
    entity_id: str,
    old_values: dict = None,
    new_values: dict = None
):
    """Helper para registrar auditoría de transacciones."""
    audit = AuditLog(
        user_id=user_id,
        action=action,
        entity_type="transaction",
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values
    )
    db.add(audit)


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
    
    # CORRECCIÓN: Eliminada la lógica que buscaba 'unit_id' (variable inexistente).
    # Para gastos de condominio, queremos ver gastos GENERALES, por lo que 
    # pasamos unit_id=None explícitamente al servicio.
    
    return await service.get_transactions(
        page=page,
        limit=limit,
        type=CategoryType.EXPENSE,
        category_id=category_id,
        unit_id=None, # ✅ IMPORTANTE: None para traer gastos globales (sin unidad asignada)
        status=None,  # Permitir ver todos los status (excepto cancelados por defecto en servicio)
        from_date=from_date,
        to_date=to_date,
        fiscal_period=fiscal_period,
        search=search,
        has_receipt=has_receipt,
        min_amount=None,
        max_amount=None,
        is_advance=is_advance,
        is_late=is_late,
        user_role=current_user.role
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
    is_advance: Optional[bool] = None, # Agregado para consistencia
    is_late: Optional[bool] = None,    # Agregado para consistencia
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
        user_role=current_user.role
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
    
    transaction = await service.get_transaction(transaction_id)
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "TRANSACTION_NOT_FOUND",
                "message": "Transacción no encontrada"
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
    # 1. CAMBIO: Usamos get_current_active_user para obtener el objeto completo con datos del condominio
    current_user: User = Depends(get_current_active_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva transacción.
    """
    # 2. VALIDACIÓN DE ROL: Como quitamos require_role, validamos aquí
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    service = get_transaction_service(db)
    
    try:
        # 3. LLAMADA AL SERVICIO: Pasamos el condominium_id explícitamente
        result = await service.create_transaction(
            data=data,
            created_by=current_user.id,
            condominium_id=current_user.condominium_id  # <--- ¡LA SOLUCIÓN ESTÁ AQUÍ! ✅
        )
        
        # Registrar auditoría
        await log_audit(
            db=db,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_id=result.transaction.id, # <-- CORREGIDO: Accedemos al objeto interno
            new_values={
                "type": data.type.value,
                "amount": str(data.amount),
                "description": data.description,
                "unit_id": str(data.unit_id) if data.unit_id else None,
                "category_id": str(data.category_id),
                "fiscal_period": data.fiscal_period,
                "condominium_id": str(current_user.condominium_id)
            }
        )
        await db.commit()
        
        return result.transaction  # Devolvemos solo la parte de la Transacción

    except ValueError as e:
        error_msg = str(e)
        if error_msg == "DUPLICATE_PAYMENT_SAME_PERIOD":
            raise HTTPException(
                status_code=400,
                detail="DUPLICATE_PAYMENT_SAME_PERIOD"
            )
        
        error_messages = {
            "CATEGORY_NOT_FOUND": "Categoría no encontrada",
            "CATEGORY_TYPE_MISMATCH": "El tipo de categoría no coincide",
            "UNIT_NOT_FOUND": "Vivienda no encontrada",
            "INCOME_REQUIRES_UNIT": "Los ingresos de cuotas requieren especificar una vivienda"
        }
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": error_msg,
                "message": error_messages.get(error_msg, f"Error de validación: {error_msg}")
            }
        )


@router.put(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Actualizar transacción"
)
async def update_transaction(
    transaction_id: str,
    data: TransactionUpdate,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza una transacción existente.
    """
    service = get_transaction_service(db)
    
    # Obtener valores anteriores para auditoría
    old_transaction = await service.get_transaction(transaction_id)
    if not old_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
        )
    
    old_values = {
        "amount": str(old_transaction.amount),
        "description": old_transaction.description,
        "status": old_transaction.status.value if old_transaction.status else None,
        "category_id": old_transaction.category_id,
        "unit_id": old_transaction.unit_id
    }
    
    try:
        result = await service.update_transaction(transaction_id, data)
        
        # Registrar auditoría
        new_values = {}
        if data.amount is not None:
            new_values["amount"] = str(data.amount)
        if data.description is not None:
            new_values["description"] = data.description
        if data.status is not None:
            new_values["status"] = data.status.value
        if data.category_id is not None:
            new_values["category_id"] = data.category_id
        
        if new_values:
            await log_audit(
                db=db,
                user_id=current_user.id,
                action=AuditAction.UPDATE,
                entity_id=transaction_id,
                old_values=old_values,
                new_values=new_values
            )
            await db.commit()
        
        return result.transaction  # Devolvemos solo la parte de la Transacción
    except ValueError as e:
        error = str(e)
        if error == "TRANSACTION_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": error, "message": "Error de validación"}
        )


@router.delete(
    "/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar transacción"
)
async def delete_transaction(
    transaction_id: str,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina (cancela) una transacción.
    """
    service = get_transaction_service(db)
    
    try:
        await service.delete_transaction(transaction_id) # Se cambió cancel_transaction por delete_transaction según tu service
        
        await log_audit(
            db=db,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_id=transaction_id,
            new_values={"status": "cancelled"}
        )
        await db.commit()
        
    except ValueError as e:
        if str(e) == "TRANSACTION_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
            )
        raise

@router.patch("/{transaction_id}/cancel", response_model=TransactionResponse)
async def cancel_transaction(
    transaction_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancela una transacción existente.
    """
    # Solo administradores pueden cancelar (ajusta según tu regla de negocio)
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="No tienes permisos para cancelar transacciones"
        )

    service = get_transaction_service(db)
    return await service.cancel_transaction(transaction_id, str(current_user.id))

@router.post(
    "/{transaction_id}/receipt",
    response_model=TransactionResponse,
    summary="Subir comprobante"
)
async def upload_receipt(
    transaction_id: str,
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Sube un comprobante para una transacción.
    """
    from app.core.config import settings
    
    # Validar tipo de archivo
    if file.content_type not in settings.allowed_file_types_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_FILE_TYPE",
                "message": f"Tipo de archivo no permitido. Permitidos: {settings.ALLOWED_FILE_TYPES}"
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
    
    service = get_transaction_service(db)
    
    try:
        result = await service.add_receipt(
            transaction_id=transaction_id,
            receipt_url=receipt_url,
            thumbnail_url=thumbnail_url
        )
        
        # Registrar auditoría
        audit = AuditLog(
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="transaction",
            entity_id=transaction_id,
            old_values={"receipt_url": None},
            new_values={"receipt_url": receipt_url}
        )
        db.add(audit)
        await db.commit()
        
        return result.transaction  # Devolvemos solo la parte de la Transacción
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
    
    transaction = await service.get_transaction(transaction_id)
    
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
    from app.models.models import Transaction, Unit, User, Category, CategoryType, BoardPosition, UserRole
    
    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.unit),
            selectinload(Transaction.category),
            selectinload(Transaction.created_by_user)
        )
        .where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "TRANSACTION_NOT_FOUND", "message": "Transacción no encontrada"}
        )
    
    if transaction.type != CategoryType.INCOME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_TRANSACTION_TYPE", "message": "Solo se pueden generar recibos para pagos (ingresos)"}
        )
    
    if current_user.role == "resident":
        if not transaction.unit_id or str(transaction.unit_id) != str(current_user.unit_id or ''):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "No tienes acceso a este recibo"}
            )
    
    unit_number = transaction.unit.unit_number if transaction.unit else None
    
    resident_name = None
    if transaction.unit and transaction.unit.owner_user_id:
        owner_result = await db.execute(
            select(User).where(User.id == transaction.unit.owner_user_id)
        )
        owner = owner_result.scalar_one_or_none()
        if owner:
            resident_name = owner.full_name
    
    signer_name = None
    
    treasurer_result = await db.execute(
        select(User).where(User.board_position == BoardPosition.TREASURER, User.is_active == True)
    )
    treasurer = treasurer_result.scalar_one_or_none()
    
    if treasurer:
        signer_name = treasurer.full_name
    else:
        president_result = await db.execute(
            select(User).where(User.board_position == BoardPosition.PRESIDENT, User.is_active == True)
        )
        president = president_result.scalar_one_or_none()
        
        if president:
            signer_name = president.full_name
        else:
            admin_result = await db.execute(
                select(User).where(User.role == UserRole.ADMIN, User.is_active == True)
            )
            admin = admin_result.scalar_one_or_none()
            if admin:
                signer_name = admin.full_name
    
    treasurer_name = signer_name
    
    folio = generate_folio(transaction.id, transaction.transaction_date)
    
    pdf_buffer = generate_receipt_pdf(
        transaction_id=transaction.id,
        folio=folio,
        transaction_date=transaction.transaction_date,
        amount=transaction.amount,
        description=transaction.description,
        category_name=transaction.category.name if transaction.category else "Sin categoría",
        payment_method=transaction.payment_method.value if transaction.payment_method else None,
        reference_number=transaction.reference_number,
        unit_number=unit_number,
        resident_name=resident_name,
        treasurer_name=treasurer_name,
        notes=transaction.notes
    )
    
    filename = f"recibo_{folio}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
