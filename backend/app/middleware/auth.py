"""
Middleware de autenticación y autorización.
"""

from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_token, TokenPayload
from app.core.redis import redis_client


security = HTTPBearer()


class AuthenticatedUser:
    """Usuario autenticado extraído del token."""
    
    def __init__(
        self,
        id: str,
        email: str,
        role: str,
        unit_id: Optional[str] = None,
        permissions: List[str] = None
    ):
        self.id = id
        self.email = email
        self.role = role
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
    """
    token = credentials.credentials
    
    # Verificar blacklist
    if await redis_client.is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "TOKEN_REVOKED",
                "message": "Token ha sido revocado"
            }
        )
    
    # Decodificar token
    payload = decode_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_TOKEN",
                "message": "Token inválido o expirado"
            }
        )
    
    return AuthenticatedUser(
        id=payload.get("sub"),
        email=payload.get("email"),
        role=payload.get("role"),
        unit_id=payload.get("unit_id"),
        permissions=payload.get("permissions", [])
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


class RateLimiter:
    """
    Middleware de rate limiting.
    """
    
    def __init__(self, limit: int = 100, window: int = 60):
        self.limit = limit
        self.window = window
    
    async def __call__(self, request: Request):
        # Obtener identificador (IP o user_id si autenticado)
        client_ip = request.client.host
        
        # Verificar rate limit
        allowed, remaining = await redis_client.check_rate_limit(
            f"{client_ip}",
            self.limit,
            self.window
        )
        
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "RATE_LIMIT_EXCEEDED",
                    "message": "Demasiadas solicitudes. Intenta de nuevo más tarde.",
                    "retry_after": self.window
                },
                headers={
                    "Retry-After": str(self.window),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        return True


# Instancias predefinidas
rate_limiter = RateLimiter()
require_admin = require_role("admin")
require_admin_or_readonly = require_role("admin", "readonly")
