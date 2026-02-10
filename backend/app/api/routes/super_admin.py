from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.models import Condominium, User, UserRole, BoardPosition
from app.core.security import hash_password as get_password_hash
# Define una clave secreta simple para proteger este endpoint por ahora
SUPER_ADMIN_KEY = "tu_clave_secreta_super_segura_123" 

router = APIRouter(prefix="/super-admin", tags=["Super Admin"])

# Esquema para recibir los datos
class NewTenantRequest(BaseModel):
    condo_name: str
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str
    plan_type: str = "PRO" # FREE, PRO, ENTERPRISE

@router.post("/onboard-condominium")
async def onboard_new_condominium(
    data: NewTenantRequest,
    x_super_admin_key: str = Header(..., alias="X-Super-Admin-Key"), # Header de seguridad
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo Condominio y su primer Usuario Administrador.
    Requiere header 'X-Super-Admin-Key'.
    """
    # 1. Verificar seguridad
    if x_super_admin_key != SUPER_ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Credenciales de Super Admin inválidas")

    # 2. Verificar si el email ya existe globalmente
    existing_user = await db.execute(select(User).where(User.email == data.admin_email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Este email ya está registrado en el sistema")

    try:
        # 3. Crear el Condominio (Vacio, is_setup_completed=False)
        new_condo_id = uuid4()
        new_condo = Condominium(
            id=new_condo_id,
            name=data.condo_name,
            plan_type=data.plan_type,
            is_active=True,
            is_setup_completed=False # Importante: Para que la App le muestre el Wizard
        )
        db.add(new_condo)

        # 4. Crear el Usuario Administrador
        new_user = User(
            id=uuid4(),
            email=data.admin_email,
            password_hash=get_password_hash(data.admin_password),
            full_name=data.admin_full_name,
            role=UserRole.ADMIN,
            board_position=BoardPosition.PRESIDENT, # Por defecto Presidente
            condominium_id=new_condo_id,
            is_active=True,
            email_verified=True # Como es contrato manual, lo marcamos verificado
        )
        db.add(new_user)

        await db.commit()

        return {
            "message": "Condominio y Administrador creados exitosamente",
            "condominium_id": str(new_condo_id),
            "admin_email": data.admin_email,
            "next_step": "El usuario debe iniciar sesión en la App para completar el Wizard."
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando tenant: {str(e)}")
