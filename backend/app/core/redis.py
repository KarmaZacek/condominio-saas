"""
Configuración de Redis para cache y gestión de sesiones.
"""

from typing import Optional
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError

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
        """Establece conexión con Redis."""
        if self._pool is None:
            # Configuración optimizada para Railway
            self._pool = ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=10, # Reducimos conexiones para no saturar
                decode_responses=True,
                health_check_interval=10, # Chequeo más frecuente
                socket_connect_timeout=5,
                socket_keepalive=True,
                retry_on_timeout=True
            )
            self._client = redis.Redis(connection_pool=self._pool)
    
    async def disconnect(self):
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()
    
    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            raise RuntimeError("Redis no conectado. Llama a connect() primero.")
        return self._client

    # --- MÉTODO DE REINTENTO GENÉRICO ---
    async def _execute_with_retry(self, func, *args, **kwargs):
        """Ejecuta un comando de Redis con reintentos."""
        retries = 3
        for attempt in range(retries):
            try:
                return await func(*args, **kwargs)
            except (ConnectionError, TimeoutError):
                if attempt == retries - 1:
                    raise # Si es el último intento, lanza el error
                # Si falla, intenta reconectar forzadamente
                await self.disconnect()
                await self.connect()
    
    # --- MÉTODOS PÚBLICOS ENVUELTOS ---

    async def get(self, key: str) -> Optional[str]:
        return await self._execute_with_retry(self.client.get, key)
    
    async def set(self, key: str, value: str, expire_seconds: Optional[int] = None) -> bool:
        if expire_seconds:
            return await self._execute_with_retry(self.client.setex, key, expire_seconds, value)
        return await self._execute_with_retry(self.client.set, key, value)
    
    async def delete(self, key: str) -> int:
        return await self._execute_with_retry(self.client.delete, key)
    
    async def exists(self, key: str) -> bool:
        # Aquí fallaba antes
        result = await self._execute_with_retry(self.client.exists, key)
        return result > 0
    
    async def incr(self, key: str) -> int:
        return await self._execute_with_retry(self.client.incr, key)
    
    async def expire(self, key: str, seconds: int) -> bool:
        return await self._execute_with_retry(self.client.expire, key, seconds)
    
    async def ttl(self, key: str) -> int:
        return await self._execute_with_retry(self.client.ttl, key)
    
    # Métodos específicos para tokens
    async def blacklist_token(self, token: str, expire_seconds: int) -> bool:
        return await self.set(f"blacklist:{token}", "1", expire_seconds)
    
    async def is_token_blacklisted(self, token: str) -> bool:
        return await self.exists(f"blacklist:{token}")
    
    # Rate limiting
    async def check_rate_limit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        current = await self.incr(f"rate:{key}")
        if current == 1:
            await self.expire(f"rate:{key}", window_seconds)
        remaining = max(0, limit - current)
        return current <= limit, remaining


# Instancia global
redis_client = RedisClient()

async def get_redis() -> RedisClient:
    return redis_client
