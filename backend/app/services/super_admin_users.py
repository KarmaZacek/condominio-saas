"""
Servicio de gestión de usuarios para Super Admin.
Permite administrar usuarios de todos los condominios.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
import secrets
import string

from app.core.database import get_db
from app.models.user import User
from app.models.condominium import Condominium
from app.models.unit import Unit
from app.core.exceptions import NotFoundException
from app.core.security import get_password_hash


class SuperAdminUserService:
    """Servicio para gestión de usuarios cross-tenant."""
    
    async def list_users(
        self,
        search: Optional[str] = None,
        condominium_id: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        limit: int = 50,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Lista usuarios de todos los condominios con filtros.
        
        Args:
            search: Búsqueda por nombre o email
            condominium_id: Filtrar por condominio
            role: Filtrar por rol (ADMIN, RESIDENT, ACCOUNTANT, etc.)
            is_active: Filtrar por estado activo
            page: Número de página (1-indexed)
            limit: Resultados por página (max 100)
            sort_by: Campo para ordenar (created_at, full_name, email, last_login)
            sort_order: Orden (asc/desc)
        
        Returns:
            Dict con usuarios y metadata de paginación
        """
        async with get_db() as db:
            # Query base con joins
            query = (
                select(
                    User,
                    Condominium.name.label("condominium_name"),
                    Unit.unit_number.label("unit_number")
                )
                .outerjoin(Condominium, User.condominium_id == Condominium.id)
                .outerjoin(Unit, User.unit_id == Unit.id)
                .where(User.role != "super_admin")  # Excluir super admins
            )
            
            # Aplicar filtros
            if search:
                search_filter = f"%{search}%"
                query = query.where(
                    or_(
                        User.full_name.ilike(search_filter),
                        User.email.ilike(search_filter)
                    )
                )
            
            if condominium_id:
                query = query.where(User.condominium_id == condominium_id)
            
            if role:
                query = query.where(User.role == role.upper())
            
            if is_active is not None:
                query = query.where(User.is_active == is_active)
            
            # Contar total
            count_query = select(func.count()).select_from(
                query.alias()
            )
            total = await db.scalar(count_query)
            
            # Ordenamiento
            sort_column = {
                "created_at": User.created_at,
                "full_name": User.full_name,
                "email": User.email,
                "last_login": User.last_login
            }.get(sort_by, User.created_at)
            
            if sort_order.lower() == "asc":
                query = query.order_by(asc(sort_column))
            else:
                query = query.order_by(desc(sort_column))
            
            # Paginación
            limit = min(limit, 100)
            offset = (page - 1) * limit
            query = query.limit(limit).offset(offset)
            
            # Ejecutar query
            result = await db.execute(query)
            rows = result.all()
            
            # Formatear resultados
            users = []
            for row in rows:
                user = row[0]
                condo_name = row[1]
                unit_number = row[2]
                
                users.append({
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                    "is_active": user.is_active,
                    "email_verified": user.email_verified,
                    "condominium_id": str(user.condominium_id) if user.condominium_id else None,
                    "condominium_name": condo_name,
                    "unit_id": str(user.unit_id) if user.unit_id else None,
                    "unit_number": unit_number,
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "created_at": user.created_at.isoformat()
                })
            
            total_pages = (total + limit - 1) // limit if total > 0 else 0
            
            return {
                "data": users,
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": total_pages
            }
    
    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """
        Obtiene detalles completos de un usuario.
        
        Args:
            user_id: ID del usuario
            
        Returns:
            Dict con información completa del usuario
            
        Raises:
            NotFoundException: Si el usuario no existe
        """
        async with get_db() as db:
            query = (
                select(
                    User,
                    Condominium.name.label("condominium_name"),
                    Unit.unit_number.label("unit_number")
                )
                .outerjoin(Condominium, User.condominium_id == Condominium.id)
                .outerjoin(Unit, User.unit_id == Unit.id)
                .where(User.id == user_id)
            )
            
            result = await db.execute(query)
            row = result.first()
            
            if not row:
                raise NotFoundException("Usuario no encontrado")
            
            user = row[0]
            condo_name = row[1]
            unit_number = row[2]
            
            return {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "phone": user.phone,
                "role": user.role,
                "board_position": user.board_position,
                "is_active": user.is_active,
                "email_verified": user.email_verified,
                "avatar_url": user.avatar_url,
                "condominium_id": str(user.condominium_id) if user.condominium_id else None,
                "condominium_name": condo_name,
                "unit_id": str(user.unit_id) if user.unit_id else None,
                "unit_number": unit_number,
                "failed_login_attempts": user.failed_login_attempts,
                "locked_until": user.locked_until.isoformat() if user.locked_until else None,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "created_at": user.created_at.isoformat(),
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            }
    
    async def toggle_user_status(self, user_id: str) -> Dict[str, Any]:
        """
        Activa o desactiva un usuario.
        
        Args:
            user_id: ID del usuario
            
        Returns:
            Dict con información actualizada del usuario
            
        Raises:
            NotFoundException: Si el usuario no existe
        """
        async with get_db() as db:
            # Buscar usuario
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise NotFoundException("Usuario no encontrado")
            
            # No permitir desactivar super admins
            if user.role == "super_admin":
                raise ValueError("No se puede desactivar un Super Admin")
            
            # Toggle estado
            user.is_active = not user.is_active
            user.updated_at = datetime.now(timezone.utc)
            
            await db.commit()
            await db.refresh(user)
            
            # Retornar detalles actualizados
            return await self.get_user(user_id)
    
    async def reset_password(self, user_id: str) -> Dict[str, Any]:
        """
        Genera una nueva contraseña temporal para un usuario.
        
        Args:
            user_id: ID del usuario
            
        Returns:
            Dict con nueva contraseña temporal
            
        Raises:
            NotFoundException: Si el usuario no existe
        """
        async with get_db() as db:
            # Buscar usuario
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise NotFoundException("Usuario no encontrado")
            
            # No permitir reset de super admins
            if user.role == "super_admin":
                raise ValueError("No se puede resetear la contraseña de un Super Admin")
            
            # Generar contraseña temporal (12 caracteres alfanuméricos)
            alphabet = string.ascii_letters + string.digits
            temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))
            
            # Actualizar contraseña
            user.password_hash = get_password_hash(temp_password)
            user.updated_at = datetime.now(timezone.utc)
            user.failed_login_attempts = 0
            user.locked_until = None
            
            await db.commit()
            
            return {
                "user_id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "temporary_password": temp_password,
                "message": "Contraseña reseteada exitosamente. El usuario debe cambiarla en su próximo login."
            }
