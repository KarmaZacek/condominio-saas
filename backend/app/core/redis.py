"""
Configuración de Redis para cache y gestión de sesiones.
Versión Optimizada: Retry Nativo y Backoff.
"""

from typing import Optional
import redis.asyncio as redis
from redis.asyncio.retry import Retry
from redis.backoff import ExponentialBackoff
from redis.exceptions import ConnectionError, TimeoutError, BusyLoadingError

from app.core.config import settings


class RedisClient:
    """Cliente Redis async singleton con reconexión robusta."""
    
    _instance: Optional["RedisClient"] = None
    _client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Establece conexión con Redis usando estrategia de reintento nativa."""
        if self._client is None:
            # Estrategia de reintento:
            # Intentar 3 veces, esperando exponencialmente (0.1s, 0.2s, 0.4s...)
            # Esto maneja el error 104 automáticamente.
            retry_strategy = Retry(ExponentialBackoff(cap=1, base=0.1), retries=3)
            
            self._client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                encoding="utf-8",
                # Configuración de red
                socket_timeout=5.0,           # Tiempo límite para leer/escribir
                socket_connect_timeout=5.0,   # Tiempo límite para conectar
                socket_keepalive=True,        # Mantener TCP vivo
                health_check_interval=30,     # Verificar conexión cada 30s
                # Inyectar estrategia de reintento
                retry=retry_strategy,
                retry_on_error=[ConnectionError, TimeoutError, BusyLoadingError]
            )
    
    async def disconnect(self):
        """Cierra conexión con Redis."""
        if self._client:
            await self._client.aclose() # aclose es el método async correcto en versiones nuevas
            self._client = None
    
    @property
    def client(self) -> redis.Redis:
        """Obtiene el cliente Redis."""
        if self._client is None:
            # Si se intenta usar sin conectar, lanzamos error (el middleware debería haber conectado)
            # O podríamos intentar autoconectar aquí, pero es mejor ser explícito.
            raise RuntimeError("Redis no conectado. Llama a connect() primero.")
        return self._client

    # --- MÉTODOS PÚBLICOS SIMPLIFICADOS ---
    # Ya no necesitamos try/except manuales, el cliente 'self.client' 
    # ya tiene la lógica de retry inyectada en su constructor.

    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)
    
    async def set(self, key: str, value: str, expire_seconds: Optional[int] = None) -> bool:
        if expire_seconds:
            return await self.client.setex(key, expire_seconds, value)
        return await self.client.set(key, value)
    
    async def delete(self, key: str) -> int:
        return await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        return await self.client.exists(key) > 0
    
    async def incr(self, key: str) -> int:
        return await self.client.incr(key)
    
    async def expire(self, key: str, seconds: int) -> bool:
        return await self.client.expire(key, seconds)
    
    async def ttl(self, key: str) -> int:
        return await self.client.ttl(key)
    
    # Métodos específicos para tokens
    async def blacklist_token(self, token: str, expire_seconds: int) -> bool:
        return await self.set(f"blacklist:{token}", "1", expire_seconds)
    
    async def is_token_blacklisted(self, token: str) -> bool:
        return await self.exists(f"blacklist:{token}")
    
    # Rate limiting
    async def check_rate_limit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        # Usamos pipeline para atomicidad y rendimiento
        async with self.client.pipeline(transaction=True) as pipe:
            pipe.incr(f"rate:{key}")
            pipe.expire(f"rate:{key}", window_seconds)
            result = await pipe.execute()
            
        current = result[0]
        remaining = max(0, limit - current)
        return current <= limit, remaining


# Instancia global
redis_client = RedisClient()

async def get_redis() -> RedisClient:
    """Dependency para obtener cliente Redis."""
    # Aseguramos conexión por si acaso (Lazy connect)
    if redis_client._client is None:
        await redis
