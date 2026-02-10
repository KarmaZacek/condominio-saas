import uuid
import os
import shutil
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import Condominium, User, Unit
from app.api.deps import get_current_active_user

router = APIRouter()

# Definir directorio de logos
LOGOS_DIR = "app/static/logos"
os.makedirs(LOGOS_DIR, exist_ok=True)

@router.get("/setup/status")
async def get_setup_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    print(f"👀 Verificando status para usuario: {current_user.email}")
    
    try:
        if not current_user.condominium_id:
            return {"is_setup_completed": False, "condominium": None}
        
        result = await db.execute(select(Condominium).filter(Condominium.id == current_user.condominium_id))
        condo = result.scalars().first()
        
        if not condo:
            return {"is_setup_completed": False, "condominium": None}

        print(f"✅ Status encontrado en BD: {condo.is_setup_completed}")
        
        condo_data = {
            "id": str(condo.id),
            "name": condo.name,
            "logo_url": condo.logo_url
        }

        return {
            "is_setup_completed": condo.is_setup_completed, 
            "condominium": condo_data
        }
    except Exception as e:
        print(f"❌ Error en status: {e}")
        return {"is_setup_completed": False, "condominium": None}


@router.post("/setup/initial", response_model=Any)
async def initial_setup(
    # Recibimos campos individuales con Form(...)
    name: str = Form(..., min_length=3),
    address: str = Form(..., min_length=5),
    default_monthly_fee: float = Form(..., gt=0),
    total_units: int = Form(..., gt=0, le=500),
    # Recibimos el archivo opcionalmente
    logo: Optional[UploadFile] = File(None),
    
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # ✅ CORREGIDO: Usamos la variable 'name' directamente, no 'setup_data.name'
    print(f"🚀 Iniciando Setup para: {name}")
    
    try:
        # A. Validar Usuario
        if not current_user.condominium_id:
            raise HTTPException(status_code=400, detail="El usuario no tiene un condominio asignado.")

        # B. Buscar Condominio
        result = await db.execute(select(Condominium).filter(Condominium.id == current_user.condominium_id))
        condo = result.scalars().first()
        
        if not condo:
            raise HTTPException(status_code=404, detail="Condominio no encontrado.")
            
        if condo.is_setup_completed:
            return {"message": "Configuración ya realizada previamente", "condominium": condo}

        # C. Manejo del Logo (Si se envió)
        logo_url = None
        if logo:
            try:
                file_ext = os.path.splitext(logo.filename)[1] or ".jpg"
                filename = f"{condo.id}_{uuid.uuid4().hex[:8]}{file_ext}"
                file_path = os.path.join(LOGOS_DIR, filename)
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(logo.file, buffer)
                
                # Generar URL relativa (para que funcione en local y prod)
                # Asegúrate de que en main.py tengas app.mount("/static", ...)
                logo_url = f"/static/logos/{filename}"
                
                print(f"🖼️ Logo guardado en: {file_path}")
            except Exception as e:
                print(f"⚠️ Error guardando logo: {e}")

        # D. Actualizar Datos del Condominio
        print("📝 Actualizando datos básicos...")
        condo.name = name
        condo.address = address
        condo.default_monthly_fee = default_monthly_fee
        if logo_url:
            condo.logo_url = logo_url
        
        # E. Generar Unidades
        # ✅ CORREGIDO: Usamos 'total_units' directamente
        print(f"🏗️ Generando {total_units} unidades...")
        
        result_units = await db.execute(select(Unit).filter(Unit.condominium_id == condo.id))
        existing_units = result_units.scalars().all()
        
        if not existing_units:
            new_units = []
            # ✅ CORREGIDO: Usamos 'total_units' en el rango
            for i in range(1, total_units + 1):
                new_id = uuid.uuid4()
                unit = Unit(
                    id=new_id,
                    unit_number=str(i),
                    # ✅ CORREGIDO: Usamos 'default_monthly_fee' directamente
                    monthly_fee=default_monthly_fee,
                    condominium_id=condo.id,
                    status="VACANT",
                    balance=0
                )
                new_units.append(unit)
            
            db.add_all(new_units)
            print("✅ Unidades preparadas")
        else:
            print("ℹ️ Las unidades ya existían.")
        
        # F. Finalizar
        condo.is_setup_completed = True
        
        await db.commit()
        await db.refresh(condo)
        
        return {
            "message": "¡Configuración exitosa!",
            "condominium": {
                "id": str(condo.id),
                "name": condo.name,
                "address": condo.address,
                "logo_url": condo.logo_url,
                "is_setup_completed": True
            }
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ ERROR CRÍTICO EN SETUP: {str(e)}")
        await db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
