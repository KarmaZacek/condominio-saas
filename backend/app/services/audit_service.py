from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import AuditLog, AuditAction
from typing import Any, Dict
import uuid

async def log_audit(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: AuditAction,
    entity_id: uuid.UUID,
    new_values: Dict[str, Any] = None,
    old_values: Dict[str, Any] = None
):
    """
    Registra una acción en el log de auditoría.
    """
    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_id=entity_id,
        entity_type="TRANSACTION", # O puedes hacerlo dinámico si lo necesitas
        details={
            "new": new_values or {},
            "old": old_values or {}
        }
    )
    
    db.add(audit_entry)
    # No hacemos commit aquí, dejamos que la transacción principal lo haga
    # para que sea atómico (todo o nada).
