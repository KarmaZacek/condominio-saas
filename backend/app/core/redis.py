"""
Configuración de Redis para cache y gestión de sesiones.
"""

from typing import Optional
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from app.core.config import settings


class RedisClient:
    """Cliente Redis async singleton."""
    
    _instance: Optional["RedisClient"] = None
    _pool: Optional[ConnectionPool] = None
    _client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Establece conexión con Redis con parámetros de resiliencia."""
        if self._pool is None:
            self._pool = ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20,
                decode_responses=True,
                # --- AJUSTES PARA RAILWAY / NUBE ---
                # Verifica la salud de la conexión si ha estado inactiva por 30s
                health_check_interval=30, 
                # Tiempo máximo para conectar
                socket_connect_timeout=5,
                # Mantener el socket vivo a nivel TCP
                socket_keepalive=True,
                # Reintentar si hay timeout
                retry_on_timeout=True
            )
            self._client = redis.Redis(connection_pool=self._pool)
    
    async def disconnect(self):
        """Cierra conexión con Redis."""
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()
    
    @property
    def client(self) -> redis.Redis:
        """Obtiene el cliente Redis."""
        if self._client is None:
            # Intento de reconexión automática si el cliente es nulo
            raise RuntimeError("Redis no conectado. Llama a connect() primero.")
        return self._client
    
    # Métodos de utilidad
    async def get(self, key: str) -> Optional[str]:
        """Obtiene valor por clave."""
        return await self.client.get(key)
    
    async def set(
        self, 
        key: str, 
        value: str, 
        expire_seconds: Optional[int] = None
    ) -> bool:
        """Establece valor con expiración opcional."""
        if expire_seconds:
            return await self.client.setex(key, expire_seconds, value)
        return await self.client.set(key, value)
    
    async def delete(self, key: str) -> int:
        """Elimina una clave."""
        return await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Verifica si existe una clave."""
        return await self.client.exists(key) > 0
    
    async def incr(self, key: str) -> int:
        """Incrementa contador."""
        return await self.client.incr(key)
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Establece expiración en clave existente."""
        return await self.client.expire(key, seconds)
    
    async def ttl(self, key: str) -> int:
        """Obtiene tiempo restante de vida."""
        return await self.client.ttl(key)
    
    # Métodos específicos para tokens
    async def blacklist_token(self, token: str, expire_seconds: int) -> bool:
        """Agrega token a lista negra (logout)."""
        return await self.set(f"blacklist:{token}", "1", expire_seconds)
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """Verifica si token está en lista negra."""
        # El health check automático aquí evitará el error 104
        return await self.exists(f"blacklist:{token}")
    
    # Rate limiting
    async def check_rate_limit(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> tuple[bool, int]:
        """
        Verifica rate limit.
        Retorna (permitido, intentos restantes).
        """
        current = await self.incr(f"rate:{key}")
        
        if current == 1:
            await self.expire(f"rate:{key}", window_seconds)
        
        remaining = max(0, limit - current)
        return current <= limit, remaining


# Instancia global
redis_client = RedisClient()


async def get_redis() -> RedisClient:
    """Dependency para obtener cliente Redis."""
    return redis_client
