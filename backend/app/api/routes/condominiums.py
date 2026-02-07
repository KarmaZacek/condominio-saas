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
    try:
        # 1. Validar si el usuario tiene condominio ID
        if not current_user.condominium_id:
            return {"is_setup_completed": False, "condominium": None}
        
        # 2. Buscar el condominio en la BD
        condo = db.query(Condominium).filter(Condominium.id == current_user.condominium_id).first()
        
        if not condo:
            return {"is_setup_completed": False, "condominium": None}

        # 3. Retornar respuesta (CONVIRTIENDO EL UUID A STRING)
        return {
            "is_setup_completed": condo.is_setup_completed, 
            "condominium": {
                "id": str(condo.id),    # <--- ¡ESTA ES LA CLAVE! Agregar str()
                "name": condo.name
            }
        }
    except Exception as e:
        print(f"❌ CRASH en get_setup_status: {e}") # Esto saldrá en los logs de Railway
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

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
