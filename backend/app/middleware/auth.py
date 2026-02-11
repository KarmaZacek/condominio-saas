"""
Middleware de autenticación y autorización.
"""

from typing import Optional, List
import logging
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_token, TokenPayload
from app.core.redis import redis_client


# Logger para este módulo
logger = logging.getLogger(__name__)

security = HTTPBearer()


class AuthenticatedUser:
    """Usuario autenticado extraído del token."""
    
    def __init__(
        self,
        id: str,
        email: str,
        role: str,
        condominium_id: Optional[str] = None,  # ✅ AGREGADO
        unit_id: Optional[str] = None,
        permissions: List[str] = None
    ):
        self.id = id
        self.email = email
        self.role = role
        self.condominium_id = condominium_id  # ✅ AGREGADO
        self.unit_id = unit_id
        self.permissions = permissions or []
    
    def has_permission(self, permission: str) -> bool:
        """Verifica si tiene un permiso específico."""
        return permission in self.permissions
    
    def is_admin(self) -> bool:
        """Verifica si es administrador."""
        return self.role == "admin"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthenticatedUser:
    """
    Dependency para obtener el usuario actual autenticado.
    Valida el JWT y verifica que no esté en blacklist.
    
    IMPORTANTE: Si Redis falla, permite el acceso (fail-open) para mejor UX.
    Solo los tokens JWT inválidos son rechazados.
    """
    token = credentials.credentials
    
    # Verificar blacklist con manejo robusto de errores
    try:
        is_blacklisted = await redis_client.is_token_blacklisted(token)
        
        if is_blacklisted:
            logger.warning(f"Token revocado detectado para: {token[:20]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "TOKEN_REVOKED",
                    "message": "Token ha sido revocado"
                }
            )
    except HTTPException:
        # Re-lanzamos las excepciones HTTP (token revocado)
        raise
    except Exception as redis_error:
        # Si Redis falla completamente, permitimos el acceso (fail-open)
        # Esto evita que problemas de Redis bloqueen a usuarios válidos
        logger.error(f"⚠️ Error verificando blacklist en Redis: {redis_error}")
        logger.info("🔓 Permitiendo acceso (fail-open) debido a error de Redis")
        # Continuamos con la validación del JWT
    
    # Decodificar y validar token JWT
    try:
        payload = decode_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_TOKEN",
                    "message": "Token inválido o expirado"
                }
            )
        
        # Validar que el payload tenga los campos requeridos
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        
        if not all([user_id, email, role]):
            logger.error(f"Token con payload incompleto: {payload}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_TOKEN",
                    "message": "Token inválido o expirado"
                }
            )
        
        return AuthenticatedUser(
            id=user_id,
            email=email,
            role=role,
            condominium_id=payload.get("condominium_id"),  # ✅ AGREGADO
            unit_id=payload.get("unit_id"),
            permissions=payload.get("permissions", [])
        )
        
    except HTTPException:
        # Re-lanzamos las excepciones HTTP ya formateadas
        raise
    except Exception as e:
        # Cualquier otro error en la decodificación del token
        logger.error(f"❌ Error inesperado decodificando token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_TOKEN",
                "message": "Token inválido o expirado"
            }
        )


def require_role(*allowed_roles: str):
    """
    Dependency factory para requerir roles específicos.
    
    Uso:
        @router.get("/admin-only")
        async def admin_endpoint(user = Depends(require_role("admin"))):
            ...
    """
    async def role_checker(
        user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            logger.warning(
                f"Acceso denegado: usuario {user.email} con rol '{user.role}' "
                f"intentó acceder a endpoint que requiere: {allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "No tienes permisos para esta acción"
                }
            )
        return user
    
    return role_checker


def require_permission(permission: str):
    """
    Dependency factory para requerir permisos específicos.
    
    Uso:
        @router.post("/transactions")
        async def create_transaction(
            user = Depends(require_permission("write:transactions"))
        ):
            ...
    """
    async def permission_checker(
        user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if not user.has_permission(permission):
            logger.warning(
                f"Acceso denegado: usuario {user.email} sin permiso '{permission}'"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "No tienes permisos para esta acción"
                }
            )
        return user
    
    return permission_checker


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[AuthenticatedUser]:
    """
    Dependency para obtener usuario opcional.
    No lanza error si no hay token.
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
    except Exception as e:
        logger.error(f"Error obteniendo usuario opcional: {e}")
        return None


class RateLimiter:
    """
    Middleware de rate limiting con manejo robusto de errores.
    
    Si Redis falla, permite el tráfico (fail-open) para no bloquear usuarios.
    """
    
    def __init__(self, limit: int = 100, window: int = 60):
        self.limit = limit
        self.window = window
    
    async def __call__(self, request: Request):
        """
        Verifica rate limit por IP.
        Si Redis falla, permite el tráfico (fail-open).
        """
        try:
            # Obtener identificador (IP del cliente)
            client_ip = request.client.host if request.client else "unknown"
            
            # Verificar si Redis está disponible
            if not redis_client.is_available:
                logger.warning(
                    f"⚠️ Rate limiter: Redis no disponible, permitiendo tráfico "
                    f"desde {client_ip}"
                )
                return True
            
            # Verificar rate limit
            allowed, remaining = await redis_client.check_rate_limit(
                f"{client_ip}",
                self.limit,
                self.window
            )
            
            if not allowed:
                logger.warning(
                    f"🚫 Rate limit excedido para {client_ip} "
                    f"(límite: {self.limit}/{self.window}s)"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "RATE_LIMIT_EXCEEDED",
                        "message": "Demasiadas solicitudes. Intenta de nuevo más tarde.",
                        "retry_after": self.window
                    },
                    headers={
                        "Retry-After": str(self.window),
                        "X-RateLimit-Limit": str(self.limit),
                        "X-RateLimit-Remaining": "0"
                    }
                )
            
            # Agregar headers informativos
            request.state.rate_limit_remaining = remaining
            
            return True
            
        except HTTPException:
            # Re-lanzamos las excepciones HTTP (rate limit excedido)
            raise
        except Exception as e:
            # Si hay cualquier error en el rate limiting, permitimos el tráfico
            logger.error(f"❌ Error en rate limiter: {e}")
            logger.info("🔓 Permitiendo tráfico (fail-open) debido a error en rate limiter")
            return True


# Instancias predefinidas
rate_limiter = RateLimiter()
require_admin = require_role("admin")
require_admin_or_readonly = require_role("admin", "readonly")
