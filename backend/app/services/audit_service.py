from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import AuditLog, AuditAction
from typing import Any, Dict, Optional
import uuid

async def log_audit(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: AuditAction,
    entity_type: str,  # ✅ Ahora es dinámico
    entity_id: uuid.UUID,
    condominium_id: uuid.UUID,  # ✅ CRÍTICO: Agregado para multi-tenancy
    new_values: Dict[str, Any] = None,
    old_values: Dict[str, Any] = None,
    ip_address: Optional[str] = None,  # ✅ Opcional pero recomendado
    user_agent: Optional[str] = None   # ✅ Opcional pero recomendado
):
    """
    Registra una acción en el log de auditoría.
    
    Args:
        db: Sesión de base de datos
        user_id: ID del usuario que realiza la acción
        action: Tipo de acción (CREATE, UPDATE, DELETE, etc.)
        entity_type: Tipo de entidad (TRANSACTION, UNIT, CATEGORY, etc.)
        entity_id: ID de la entidad afectada
        condominium_id: ID del condominio (REQUERIDO para multi-tenancy)
        new_values: Valores nuevos después de la acción
        old_values: Valores anteriores antes de la acción
        ip_address: Dirección IP del cliente
        user_agent: User agent del navegador/cliente
    """
    audit_entry = AuditLog(
        user_id=str(user_id),
        condominium_id=str(condominium_id),  # ✅ CRÍTICO
        action=action,
        entity_type=entity_type,  # ✅ Ahora dinámico
        entity_id=str(entity_id),
        new_values=new_values,  # ✅ Campo correcto
        old_values=old_values,  # ✅ Campo correcto
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(audit_entry)
    # No hacemos commit aquí, dejamos que la transacción principal lo haga
    # para que sea atómico (todo o nada).
