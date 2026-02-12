"""
Rutas de auditoría.
"""

from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, desc, and_, text, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import AuditLog, User
from app.middleware.auth import get_current_user, AuthenticatedUser, require_role


router = APIRouter(prefix="/audit", tags=["Auditoría"])


# Schemas
class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str]
    user_name: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[str]
    old_values: Optional[dict]
    new_values: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    data: List[AuditLogResponse]
    total: int
    page: int
    limit: int
    total_pages: int


@router.get(
    "",
    response_model=AuditLogListResponse,
    summary="Listar logs de auditoría"
)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista logs de auditoría con filtros.
    
    **Solo administradores**
    """
    # Usar SQL raw para evitar problemas con el enum
    offset = (page - 1) * limit
    
    # Construir filtros
    where_clauses = []
    params = {"limit": limit, "offset": offset}
    
    # ✅ CRÍTICO: Filtro por condominio (Multi-tenancy)
    where_clauses.append("al.condominium_id = :condominium_id")
    params["condominium_id"] = str(current_user.condominium_id)
    
    if user_id:
        where_clauses.append("al.user_id = :user_id")
        params["user_id"] = user_id
    
    if action:
        where_clauses.append("al.action::text = :action")
        params["action"] = action
    
    if entity_type:
        where_clauses.append("al.entity_type = :entity_type")
        params["entity_type"] = entity_type
    
    if entity_id:
        where_clauses.append("al.entity_id = :entity_id")
        params["entity_id"] = entity_id
    
    if from_date:
        where_clauses.append("al.created_at::date >= :from_date")
        params["from_date"] = from_date
    
    if to_date:
        where_clauses.append("al.created_at::date <= :to_date")
        params["to_date"] = to_date
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # Contar total
    count_sql = text(f"SELECT COUNT(*) FROM audit_logs al WHERE {where_sql}")
    count_result = await db.execute(count_sql, params)
    total = count_result.scalar() or 0
    
    # Obtener registros con JOIN a users
    query_sql = text(f"""
        SELECT 
            al.id::text,
            al.user_id::text,
            u.full_name as user_name,
            al.action::text as action,
            al.entity_type,
            al.entity_id::text,
            al.old_values,
            al.new_values,
            al.ip_address,
            al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE {where_sql}
        ORDER BY al.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    
    result = await db.execute(query_sql, params)
    rows = result.fetchall()
    
    # Convertir a response
    data = []
    for row in rows:
        data.append(AuditLogResponse(
            id=row[0],
            user_id=row[1],
            user_name=row[2] or "Sistema",
            action=row[3],
            entity_type=row[4],
            entity_id=row[5],
            old_values=row[6],
            new_values=row[7],
            ip_address=row[8],
            created_at=row[9]
        ))
    
    total_pages = (total + limit - 1) // limit if total > 0 else 1
    
    return AuditLogListResponse(
        data=data,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.get(
    "/summary",
    summary="Resumen de auditoría"
)
async def get_audit_summary(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene resumen estadístico de auditoría.
    
    **Solo administradores**
    """
    where_clauses = []
    params = {}
    
    # ✅ CRÍTICO: Filtro por condominio (Multi-tenancy)
    where_clauses.append("condominium_id = :condominium_id")
    params["condominium_id"] = str(current_user.condominium_id)
    
    if from_date:
        where_clauses.append("created_at::date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        where_clauses.append("created_at::date <= :to_date")
        params["to_date"] = to_date
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # Total de acciones
    total_sql = text(f"SELECT COUNT(*) FROM audit_logs WHERE {where_sql}")
    total_result = await db.execute(total_sql, params)
    total_actions = total_result.scalar() or 0
    
    # Acciones por tipo
    actions_sql = text(f"""
        SELECT action::text, COUNT(*) 
        FROM audit_logs 
        WHERE {where_sql}
        GROUP BY action
    """)
    actions_result = await db.execute(actions_sql, params)
    actions_by_type = {row[0]: row[1] for row in actions_result.fetchall()}
    
    # Acciones por entidad
    entity_sql = text(f"""
        SELECT entity_type, COUNT(*) 
        FROM audit_logs 
        WHERE {where_sql}
        GROUP BY entity_type
    """)
    entity_result = await db.execute(entity_sql, params)
    actions_by_entity = {row[0]: row[1] for row in entity_result.fetchall()}
    
    # Usuarios más activos
    users_sql = text(f"""
        SELECT u.id::text, u.full_name, COUNT(al.id) as action_count
        FROM audit_logs al
        JOIN users u ON al.user_id = u.id
        WHERE {where_sql.replace('condominium_id', 'al.condominium_id') if where_clauses else '1=1'}
        GROUP BY u.id, u.full_name
        ORDER BY action_count DESC
        LIMIT 10
    """)
    users_result = await db.execute(users_sql, params)
    most_active_users = [
        {"id": row[0], "name": row[1], "actions": row[2]}
        for row in users_result.fetchall()
    ]
    
    return {
        "total_actions": total_actions,
        "actions_by_type": actions_by_type,
        "actions_by_entity": actions_by_entity,
        "most_active_users": most_active_users
    }


@router.get(
    "/entity/{entity_type}/{entity_id}",
    response_model=List[AuditLogResponse],
    summary="Historial de una entidad"
)
async def get_entity_history(
    entity_type: str,
    entity_id: str,
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el historial completo de cambios de una entidad específica.
    
    **Solo administradores**
    """
    query_sql = text("""
        SELECT 
            al.id::text,
            al.user_id::text,
            u.full_name as user_name,
            al.action::text as action,
            al.entity_type,
            al.entity_id::text,
            al.old_values,
            al.new_values,
            al.ip_address,
            al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.entity_type = :entity_type 
          AND al.entity_id = :entity_id
          AND al.condominium_id = :condominium_id
        ORDER BY al.created_at DESC
    """)
    
    result = await db.execute(query_sql, {
        "entity_type": entity_type, 
        "entity_id": entity_id,
        "condominium_id": str(current_user.condominium_id)
    })
    rows = result.fetchall()
    
    return [
        AuditLogResponse(
            id=row[0],
            user_id=row[1],
            user_name=row[2] or "Sistema",
            action=row[3],
            entity_type=row[4],
            entity_id=row[5],
            old_values=row[6],
            new_values=row[7],
            ip_address=row[8],
            created_at=row[9]
        )
        for row in rows
    ]
