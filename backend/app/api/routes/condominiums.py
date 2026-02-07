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
    name: str = Field(..., min_length=3, description="Nombre del condominio")
    address: str | None = None
    default_monthly_fee: float = Field(..., gt=0, description="Cuota de mantenimiento base")
    total_units: int = Field(..., gt=0, le=500, description="Cantidad total de viviendas")

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
    """
    Configura el condominio por primera vez:
    - Asigna nombre y cuota.
    - Genera automáticamente todas las viviendas (Unidades).
    - Marca el setup como completado.
    """
    
    # A. Buscar el condominio del usuario logueado
    if not current_user.condominium_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene un condominio asignado.")

    condo = db.query(Condominium).filter(Condominium.id == current_user.condominium_id).first()
    
    if not condo:
        raise HTTPException(status_code=404, detail="Condominio no encontrado.")
        
    if condo.is_setup_completed:
        raise HTTPException(status_code=400, detail="Este condominio ya fue configurado anteriormente.")

    # B. Actualizar datos del condominio
    condo.name = setup_data.name
    condo.address = setup_data.address
    condo.default_monthly_fee = setup_data.default_monthly_fee
    
    # C. Generación Automática de Unidades (Casas)
    # Verificamos si ya existen para no duplicar por error
    existing_count = db.query(Unit).filter(Unit.condominium_id == condo.id).count()
    
    if existing_count == 0:
        new_units = []
        # Creamos desde la casa "1" hasta la "N"
        for i in range(1, setup_data.total_units + 1):
            unit = Unit(
                unit_number=str(i),
                monthly_fee=setup_data.default_monthly_fee,
                condominium_id=condo.id,
                status="ACTIVE"
            )
            new_units.append(unit)
        
        db.add_all(new_units)
    
    # D. Marcar como completado y guardar
    condo.is_setup_completed = True
    
    try:
        db.commit()
        db.refresh(condo)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar configuración: {str(e)}")

    return {
        "message": "¡Configuración exitosa!",
        "condominium": {
            "id": condo.id,
            "name": condo.name,
            "units_created": setup_data.total_units,
            "is_setup_completed": True
        }
    }
