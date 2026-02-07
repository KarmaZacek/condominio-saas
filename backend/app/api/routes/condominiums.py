from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.models import Condominium, User, Unit
from app.api.deps import get_current_active_user

router = APIRouter()

# --- 1. ESQUEMA DE DATOS (Lo que esperamos recibir de la App) ---
class CondoSetupRequest(BaseModel):
    name: str = Field(..., min_length=3)
    address: str | None = None
    # Aceptamos float o int, Pydantic lo convertirá
    default_monthly_fee: float = Field(..., gt=0) 
    total_units: int = Field(..., gt=0, le=500)

@router.get("/setup/status")
async def get_setup_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    print(f"👀 Verificando status para usuario: {current_user.email}") # Log de depuración
    
    try:
        # 1. Si el usuario no tiene condominio asignado
        if not current_user.condominium_id:
            print("ℹ️ Usuario sin condominio_id")
            return {"is_setup_completed": False, "condominium": None}
        
        # 2. Buscar condominio
        condo = db.query(Condominium).filter(Condominium.id == current_user.condominium_id).first()
        
        if not condo:
            print("⚠️ Condominio ID existe en usuario pero no en tabla Condominiums")
            return {"is_setup_completed": False, "condominium": None}

        # 3. Extracción segura de datos (usando getattr por si la columna no existe)
        is_completed = getattr(condo, "is_setup_completed", False)
        condo_name = getattr(condo, "name", "Condominio")
        condo_id = str(condo.id)

        print(f"✅ Status encontrado: {is_completed}")

        return {
            "is_setup_completed": is_completed, 
            "condominium": {
                "id": condo_id,
                "name": condo_name
            }
        }

    except Exception as e:
        # Imprimir el error real en Railway para que lo leamos
        import traceback
        traceback.print_exc()
        print(f"❌ CRASH REAL: {e}")
        
        # En lugar de dar error 500, devolvemos False para dejar pasar al usuario al Home
        # (Es mejor que entre al Dashboard a que se quede bloqueado)
        return {"is_setup_completed": False, "condominium": None}

# --- 2. EL ENDPOINT MAGICO (/setup/initial) ---
@router.post("/setup/initial", response_model=Any)
async def initial_setup(
    setup_data: CondoSetupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    print(f"🚀 Iniciando Setup para: {setup_data.name}")
    print(f"👤 Usuario: {current_user.email} (CondoID: {current_user.condominium_id})")

    try:
        # A. Validar Usuario
        if not current_user.condominium_id:
            raise HTTPException(status_code=400, detail="El usuario no tiene un condominio asignado.")

        # B. Buscar Condominio (Usamos select para async si tu db es async, o query si es sync)
        # Como tu proyecto parece usar AsyncSession (por el error anterior), usaremos sintaxis compatible
        from sqlalchemy import select
        
        result = await db.execute(select(Condominium).filter(Condominium.id == current_user.condominium_id))
        condo = result.scalars().first()
        
        if not condo:
            raise HTTPException(status_code=404, detail="Condominio no encontrado.")
            
        if condo.is_setup_completed:
            print("⚠️ El condominio ya estaba configurado")
            # No devolvemos error 400 para ser idempotentes (si reintenta, que pase)
            return {"message": "Configuración ya realizada previamente", "condominium": condo}

        # C. Actualizar Datos
        print("📝 Actualizando datos básicos...")
        condo.name = setup_data.name
        condo.address = setup_data.address
        condo.default_monthly_fee = setup_data.default_monthly_fee
        
        # D. Generar Unidades
        print(f"🏗️ Generando {setup_data.total_units} unidades...")
        
        # Verificar si existen
        result_units = await db.execute(select(Unit).filter(Unit.condominium_id == condo.id))
        existing_units = result_units.scalars().all()
        
        if not existing_units:
            new_units = []
            for i in range(1, setup_data.total_units + 1):
                unit = Unit(
                    unit_number=str(i),
                    monthly_fee=setup_data.default_monthly_fee,
                    condominium_id=condo.id,
                    status="ACTIVE"
                )
                db.add(unit) # En AsyncSession se usa db.add igual
            
            print("✅ Unidades añadidas a la sesión")
        else:
            print("ℹ️ Las unidades ya existían, saltando creación.")
        
        # E. Finalizar
        condo.is_setup_completed = True
        
        await db.commit() # ¡IMPORTANTE: await para async!
        await db.refresh(condo)
        
        print("🎉 Setup completado con éxito")
        
        return {
            "message": "¡Configuración exitosa!",
            "condominium": {
                "id": str(condo.id),
                "name": condo.name,
                "is_setup_completed": True
            }
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ ERROR CRÍTICO EN SETUP: {str(e)}")
        # Importante: hacer rollback si falla
        await db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
