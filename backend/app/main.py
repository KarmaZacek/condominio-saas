"""
Aplicación principal FastAPI.
Sistema de Gestión de Condominios - Parques de Santa Cruz 9
"""

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI, Request, status, APIRouter, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.redis import redis_client
from app.api.routes import auth, transactions, units, categories, users, reports, audit, condominiums
from app.api.financial_status import router as financial_status_router
from app.middleware.auth import get_current_user, require_role, AuthenticatedUser
from app.services.automation import generate_monthly_fees_job
from zoneinfo import ZoneInfo  # <--- AGREGA ESTO

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configurar la zona horaria de México
mexico_tz = ZoneInfo("America/Mexico_City")

# Iniciamos el scheduler configurado
scheduler = AsyncIOScheduler(timezone=mexico_tz)

# ==========================================
# RUTAS DE ADMINISTRACIÓN (Trigger Manual)
# ==========================================
admin_router = APIRouter(prefix="/v1/admin", tags=["Administración"])

@admin_router.post("/trigger-monthly-fees")
async def trigger_fees_manually(
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Ejecuta manualmente la generación de cuotas y RETORNA EL RESULTADO REAL.
    """
    require_role(current_user, "admin")
    
    logger.info(f"Admin {current_user.email} ejecutó corte manual.")
    
    # Llamamos a la función y capturamos el resultado
    result = await generate_monthly_fees_job()
    
    # Si hubo error interno en la lógica
    if not result["success"]:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": result["message"]}
        )
    
    # Si fue exitoso (ya sea que creó cargos o que ya existían)
    return {
        "message": result["message"],
        "charges_created": result["count"]
    }

# ==========================================
# CICLO DE VIDA (LIFESPAN)
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestiona el ciclo de vida de la aplicación.
    Inicializa DB, Redis y Scheduler.
    """
    logger.info("🚀 Iniciando aplicación...")
    
    # --- 1. CREAR TABLAS DE BASE DE DATOS (NUEVO) ---
    try:
        logger.info("📊 Verificando estructuras de base de datos...")
        await init_db()
        logger.info("✅ Tablas creadas/verificadas correctamente")
    except Exception as e:
        logger.error(f"❌ Error crítico creando tablas: {e}")
        # No detenemos la app, pero es probable que falle si no hay tablas.
    
    # --- 2. Conectar Redis ---
    try:
        await redis_client.connect()
        logger.info("✅ Redis conectado")
    # ... (El resto de tu código sigue igual hacia abajo)
    except Exception as e:
        logger.error(f"❌ Error conectando a Redis: {e}")
    
    # 2. Iniciar Scheduler (Automatización)
    try:
        logger.info("⏰ Iniciando sistema de tareas programadas...")
        # Programar la tarea: Día 1 de cada mes a las 00:05 AM
        trigger = CronTrigger(day=1, hour=0, minute=5)
        
        scheduler.add_job(
            generate_monthly_fees_job, 
            trigger=trigger, 
            id="monthly_fees_job",
            replace_existing=True
        )
        scheduler.start()
        # logger.info("✅ Planificador iniciado")
        # scheduler.print_jobs()
    except Exception as e:
        logger.error(f"❌ Error iniciando Scheduler: {e}")
    
    yield
    
    # --- APAGADO ---
    logger.info("🔄 Cerrando conexiones...")
    
    # 3. Apagar Scheduler
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("🛑 Planificador detenido")
    except Exception as e:
        logger.warning(f"Error deteniendo Scheduler: {e}")

    # 4. Desconectar Redis y DB
    await redis_client.disconnect()
    await close_db()
    logger.info("👋 Aplicación cerrada")


# ==========================================
# CREACIÓN DE LA APP
# ==========================================
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    ## Sistema de Gestión de Condominios
    
    API REST para la administración financiera de condominios
    
    ### Funcionalidades principales:
    - **Autenticación**: JWT con refresh tokens
    - **Automatización**: Generación automática de cuotas mensuales
    - **Finanzas**: Control de ingresos, egresos y balances
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan, # ✅ Usamos el lifespan unificado
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Crear directorios si no existen
os.makedirs("app/static/logos", exist_ok=True)
os.makedirs("app/static/images", exist_ok=True)

# Montar ruta estática
app.mount("/static", StaticFiles(directory="app/static"), name="static")
# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # "*" significa: Permitir a TODOS (móvil, web, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Permitir todos los métodos (GET, POST, etc.)
    allow_headers=["*"],  # Permitir todos los encabezados
)

# ==========================================
# MANEJADORES DE ERRORES
# ==========================================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"][1:]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Error de validación en los datos enviados",
            "details": errors
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Error no controlado: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_ERROR",
            "message": "Error interno del servidor"
        }
    )

# ==========================================
# REGISTRO DE RUTAS
# ==========================================
app.include_router(auth.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(units.router, prefix="/v1")
app.include_router(condominiums.router, prefix="/v1/condominiums", tags=["condominiums"])
app.include_router(categories.router, prefix="/v1")
app.include_router(transactions.router, prefix="/v1")
app.include_router(reports.router, prefix="/v1")
app.include_router(audit.router, prefix="/v1")
app.include_router(financial_status_router, prefix="/v1")
app.include_router(admin_router) # ✅ Incluimos la ruta de administración manual

# Servir archivos estáticos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ==========================================
# ENDPOINTS SISTEMA
# ==========================================
@app.get("/health", tags=["Sistema"])
async def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "scheduler_running": scheduler.running
    }

@app.get("/", tags=["Sistema"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else "Documentación no disponible en producción"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
