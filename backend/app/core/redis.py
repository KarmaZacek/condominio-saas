"""
Configuración de Redis para cache y gestión de sesiones.
"""

from typing import Optional, Any
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError, RedisError
import asyncio
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Cliente Redis async singleton con reintentos robustos y fail-safe."""
    
    _instance: Optional["RedisClient"] = None
    _pool: Optional[ConnectionPool] = None
    _client: Optional[redis.Redis] = None
    _is_available: bool = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Establece conexión con Redis."""
        try:
            # Si ya existe un pool, aseguramos que esté limpio antes de crear otro
            if self._pool:
                await self.disconnect()

            self._pool = ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20,  # Aumentado para Railway
                decode_responses=True,
                health_check_interval=30,  # Más tiempo entre health checks
                socket_connect_timeout=10,  # Timeout más generoso
                socket_keepalive=True,
                socket_keepalive_options={
                    1: 1,   # TCP_KEEPIDLE - tiempo antes del primer keepalive
                    2: 1,   # TCP_KEEPINTVL - intervalo entre keepalives
                    3: 3    # TCP_KEEPCNT - número de keepalives antes de fallar
                },
                retry_on_timeout=True,
                retry_on_error=[ConnectionError, TimeoutError],
            )
            self._client = redis.Redis(connection_pool=self._pool)
            
            # Verificar conexión con ping
            await self._client.ping()
            self._is_available = True
            logger.info("✅ Redis conectado correctamente")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis no disponible en startup: {e}")
            self._is_available = False
            # No lanzamos error, permitimos que la app siga sin Redis
    
    async def disconnect(self):
        """Cierra conexión y limpia referencias."""
        try:
            if self._client:
                await self._client.close()
            if self._pool:
                await self._pool.disconnect()
        except Exception as e:
            logger.warning(f"⚠️ Error al desconectar Redis: {e}")
        finally:
            self._client = None
            self._pool = None
            self._is_available = False
    
    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            raise RuntimeError("Redis no conectado.")
        return self._client
    
    @property
    def is_available(self) -> bool:
        """Indica si Redis está disponible para operaciones."""
        return self._is_available

    # --- NÚCLEO DE REINTENTOS CON FAIL-SAFE ---
    async def _exec(
        self, 
        method_name: str, 
        *args, 
        fail_safe: bool = True, 
        **kwargs
    ) -> Any:
        """
        Ejecuta un comando de Redis con reintentos automáticos.
        
        Args:
            method_name: Nombre del método de Redis a ejecutar
            fail_safe: Si es True, retorna None en caso de fallo en lugar de lanzar excepción
            *args, **kwargs: Argumentos para el método
            
        Returns:
            Resultado del comando Redis o None si falla en modo fail_safe
        """
        retries = 3
        last_error = None
        
        for attempt in range(retries):
            try:
                # 1. Autoconexión si está desconectado
                if self._client is None:
                    await self.connect()
                
                # 2. Obtener el método del cliente ACTUAL (dinámico)
                method = getattr(self.client, method_name)
                
                # 3. Ejecutar comando
                result = await method(*args, **kwargs)
                
                # Si llegamos aquí, marcamos Redis como disponible
                if not self._is_available:
                    logger.info("✅ Redis reconectado exitosamente")
                    self._is_available = True
                    
                return result
                
            except (ConnectionError, TimeoutError, RuntimeError, RedisError) as e:
                last_error = e
                self._is_available = False
                
                logger.warning(
                    f"⚠️ Redis error en '{method_name}' (intento {attempt+1}/{retries}): {e}"
                )
                
                # 4. Forzar reconexión total antes del siguiente intento
                try:
                    await self.disconnect()
                    # Backoff exponencial: 0.5s, 1s, 1.5s
                    await asyncio.sleep(0.5 * (attempt + 1))
                    await self.connect()
                except Exception as conn_err:
                    logger.error(f"❌ Error reconectando Redis: {conn_err}")
        
        # Después de todos los reintentos
        if fail_safe:
            logger.warning(
                f"⚠️ Redis '{method_name}' falló tras {retries} intentos. "
                f"Modo fail-safe activado (retornando None)"
            )
            return None
        
        logger.error(f"❌ Redis '{method_name}' falló definitivamente tras {retries} intentos")
        raise last_error

    # --- WRAPPERS BÁSICOS (Todos usan _exec con fail-safe) ---

    async def get(self, key: str, fail_safe: bool = True) -> Optional[str]:
        """Obtiene un valor de Redis."""
        return await self._exec('get', key, fail_safe=fail_safe)
    
    async def set(
        self, 
        key: str, 
        value: str, 
        expire_seconds: Optional[int] = None,
        fail_safe: bool = True
    ) -> bool:
        """
        Guarda un valor en Redis.
        
        Returns:
            True si se guardó exitosamente, False en caso contrario
        """
        if expire_seconds:
            result = await self._exec('setex', key, expire_seconds, value, fail_safe=fail_safe)
        else:
            result = await self._exec('set', key, value, fail_safe=fail_safe)
        return result is not None and result
    
    async def delete(self, key: str, fail_safe: bool = True) -> int:
        """Elimina una o más claves."""
        result = await self._exec('delete', key, fail_safe=fail_safe)
        return result if result is not None else 0
    
    async def exists(self, key: str, fail_safe: bool = True) -> bool:
        """
        Verifica si una clave existe.
        
        IMPORTANTE: En modo fail-safe, si Redis falla retorna False (seguro).
        """
        result = await self._exec('exists', key, fail_safe=fail_safe)
        if result is None:
            # Si Redis falló y estamos en fail-safe, asumimos que NO existe
            return False
        return result > 0
    
    async def incr(self, key: str, fail_safe: bool = True) -> int:
        """Incrementa un contador."""
        result = await self._exec('incr', key, fail_safe=fail_safe)
        return result if result is not None else 0
    
    async def expire(self, key: str, seconds: int, fail_safe: bool = True) -> bool:
        """Establece expiración en una clave."""
        result = await self._exec('expire', key, seconds, fail_safe=fail_safe)
        return result is not None and result
    
    async def ttl(self, key: str, fail_safe: bool = True) -> int:
        """Obtiene el tiempo de vida restante de una clave."""
        result = await self._exec('ttl', key, fail_safe=fail_safe)
        return result if result is not None else -1

    # --- MÉTODOS DE NEGOCIO ---
    
    async def blacklist_token(self, token: str, expire_seconds: int) -> bool:
        """
        Añade un token a la blacklist.
        
        Returns:
            True si se añadió exitosamente, False si Redis falló
        """
        result = await self.set(f"blacklist:{token}", "1", expire_seconds, fail_safe=True)
        if not result:
            logger.warning("⚠️ No se pudo añadir token a blacklist (Redis no disponible)")
        return result
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """
        Verifica si un token está en blacklist.
        
        IMPORTANTE: Si Redis no está disponible, retorna False (FAIL-OPEN)
        Esto permite que los usuarios sigan usando la app aunque Redis esté caído.
        La seguridad se mantiene porque el JWT sigue siendo validado.
        """
        if not self._is_available:
            logger.warning("⚠️ Redis no disponible - permitiendo token (fail-open)")
            return False
            
        result = await self.exists(f"blacklist:{token}", fail_safe=True)
        return result
    
    async def check_rate_limit(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> tuple[bool, int]:
        """
        Verifica rate limiting.
        
        Returns:
            (permitido, requests_restantes)
            
        IMPORTANTE: Si Redis falla, permite el tráfico (fail-open).
        """
        try:
            if not self._is_available:
                logger.debug("⚠️ Redis no disponible - permitiendo tráfico (rate limit)")
                return True, limit
                
            current = await self.incr(f"rate:{key}", fail_safe=True)
            
            if current is None:
                # Redis falló, permitir tráfico
                logger.warning("⚠️ Rate limit falló - permitiendo tráfico (fail-open)")
                return True, limit
                
            # Si es la primera request, establecer expiración
            if current == 1:
                await self.expire(f"rate:{key}", window_seconds, fail_safe=True)
                
            remaining = max(0, limit - current)
            is_allowed = current <= limit
            
            return is_allowed, remaining
            
        except Exception as e:
            logger.error(f"❌ Error inesperado en rate limit: {e}")
            # Fail-open: permitimos el tráfico si hay error
            return True, limit
    
    async def cache_get(self, key: str) -> Optional[str]:
        """Obtiene un valor del cache."""
        return await self.get(f"cache:{key}", fail_safe=True)
    
    async def cache_set(
        self, 
        key: str, 
        value: str, 
        expire_seconds: int = 300
    ) -> bool:
        """Guarda un valor en cache con expiración por defecto de 5 minutos."""
        return await self.set(f"cache:{key}", value, expire_seconds, fail_safe=True)
    
    async def cache_delete(self, key: str) -> bool:
        """Elimina un valor del cache."""
        result = await self.delete(f"cache:{key}", fail_safe=True)
        return result > 0


# Instancia global singleton
redis_client = RedisClient()


async def get_redis() -> RedisClient:
    """Dependency para FastAPI."""
    return redis_client
