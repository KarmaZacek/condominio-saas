"""
Configuración de Redis para cache y gestión de sesiones.
"""

from typing import Optional, Any
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError

from app.core.config import settings


class RedisClient:
    """Cliente Redis async singleton con reintentos robustos."""
    
    _instance: Optional["RedisClient"] = None
    _pool: Optional[ConnectionPool] = None
    _client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Establece conexión con Redis."""
        # Si ya existe un pool, aseguramos que esté limpio antes de crear otro
        if self._pool:
            await self.disconnect()

        self._pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=10, 
            decode_responses=True,
            # Ajustes para Railway
            health_check_interval=10, 
            socket_connect_timeout=5,
            socket_keepalive=True,
            retry_on_timeout=True
        )
        self._client = redis.Redis(connection_pool=self._pool)
    
    async def disconnect(self):
        """Cierra conexión y limpia referencias."""
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()
        self._client = None
        self._pool = None
    
    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            raise RuntimeError("Redis no conectado.")
        return self._client

    # --- NÚCLEO DE REINTENTOS ---
    async def _exec(self, method_name: str, *args, **kwargs) -> Any:
        """
        Ejecuta un comando buscando el método dinámicamente en el cliente actual.
        Si falla, reconecta y vuelve a buscar el método en el NUEVO cliente.
        """
        retries = 3
        last_error = None
        
        for attempt in range(retries):
            try:
                # 1. Autoconexión si está desconectado
                if self._client is None:
                    await self.connect()
                
                # 2. Obtener el método del cliente ACTUAL (Dinámico)
                # Esto asegura que si reconectamos, usamos el nuevo objeto
                method = getattr(self.client, method_name)
                
                # 3. Ejecutar
                return await method(*args, **kwargs)
                
            except (ConnectionError, TimeoutError, RuntimeError) as e:
                last_error = e
                print(f"⚠️ Redis error en '{method_name}': {e}. Reintentando ({attempt+1}/{retries})...")
                
                # 4. Forzar reconexión total antes del siguiente intento
                try:
                    await self.disconnect()
                    await self.connect()
                except Exception as conn_err:
                    print(f"❌ Error reconectando Redis: {conn_err}")
        
        print(f"❌ Redis falló definitivamente tras {retries} intentos.")
        raise last_error

    # --- WRAPPERS (Todos usan _exec) ---

    async def get(self, key: str) -> Optional[str]:
        return await self._exec('get', key)
    
    async def set(self, key: str, value: str, expire_seconds: Optional[int] = None) -> bool:
        if expire_seconds:
            return await self._exec('setex', key, expire_seconds, value)
        return await self._exec('set', key, value)
    
    async def delete(self, key: str) -> int:
        return await self._exec('delete', key)
    
    async def exists(self, key: str) -> bool:
        result = await self._exec('exists', key)
        return result > 0
    
    async def incr(self, key: str) -> int:
        return await self._exec('incr', key)
    
    async def expire(self, key: str, seconds: int) -> bool:
        return await self._exec('expire', key, seconds)
    
    async def ttl(self, key: str) -> int:
        return await self._exec('ttl', key)
    
    # Métodos de negocio
    async def blacklist_token(self, token: str, expire_seconds: int) -> bool:
        return await self.set(f"blacklist:{token}", "1", expire_seconds)
    
    async def is_token_blacklisted(self, token: str) -> bool:
        return await self.exists(f"blacklist:{token}")
    
    async def check_rate_limit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        # Para rate limit usamos lógica directa con _exec individual
        try:
            current = await self.incr(f"rate:{key}")
            if current == 1:
                await self.expire(f"rate:{key}", window_seconds)
            remaining = max(0, limit - current)
            return current <= limit, remaining
        except Exception:
            # Si falla el rate limit, permitimos el tráfico para no bloquear al usuario (Fail-open)
            return True, 1


# Instancia global
redis_client = RedisClient()


async def get_redis() -> RedisClient:
    return redis_client
