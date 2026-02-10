import uuid
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.models import Condominium, User, Unit
from app.api.deps import get_current_active_user
from app.core.config import settings

router = APIRouter()
LOGOS_DIR = "app/static/logos"
os.makedirs(LOGOS_DIR, exist_ok=True)

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
    print(f"👀 Verificando status para usuario: {current_user.email}")
    
    try:
        # 1. Validar si el usuario tiene condominio
        if not current_user.condominium_id:
            return {"is_setup_completed": False, "condominium": None}
        
        # 2. Buscar condominio (VERSIÓN ASYNC CORREGIDA) 🚑
        # Antes fallaba aquí con db.query(...)
        result = await db.execute(select(Condominium).filter(Condominium.id == current_user.condominium_id))
        condo = result.scalars().first()
        
        if not condo:
            print("⚠️ Condominio ID en usuario, pero no en tabla Condominiums")
            return {"is_setup_completed": False, "condominium": None}

        # 3. Extraer datos de forma segura
        # Usamos getattr por si la columna no existe en migraciones viejas
        is_completed = getattr(condo, "is_setup_completed", False)
        
        # IMPORTANTE: Convertir UUID a string para que no falle el JSON
        condo_data = {
            "id": str(condo.id),
            "name": condo.name, 
            "logo_url": condo.logo_url # Agregamos esto por si sirve
        }

        print(f"✅ Status encontrado en BD: {is_completed}")

        return {
            "is_setup_completed": is_completed, 
            "condominium": condo_data
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ CRASH REAL EN STATUS: {e}")
        # Si falla, devolvemos False por seguridad
        return {"is_setup_completed": False, "condominium": None}

# --- 2. EL ENDPOINT MAGICO (/setup/initial) ---
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
        # C. Manejo del Logo (Si se envió)
        logo_url = None
        if logo:
            try:
                # Generar nombre único: condoID_random.ext
                file_ext = os.path.splitext(logo.filename)[1] or ".jpg"
                filename = f"{condo.id}_{uuid.uuid4().hex[:8]}{file_ext}"
                file_path = os.path.join(LOGOS_DIR, filename)
                
                # Guardar archivo
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(logo.file, buffer)
                
                # Generar URL pública (asumiendo que sirves estáticos en /static)
                # Ojo: En producción esto debería ser la URL completa o ruta relativa
                logo_url = f"http://100.64.0.3:8080/static/logos/{filename}" # Ajusta el dominio según tu entorno
                # O mejor, guarda ruta relativa:
                # logo_url = f"/static/logos/{filename}"
                
                print(f"🖼️ Logo guardado en: {file_path}")
            except Exception as e:
                print(f"⚠️ Error guardando logo: {e}")
                # No detenemos el proceso si falla el logo, pero loggeamos 

        # D. Actualizar Datos
        print("📝 Actualizando datos básicos...")
        condo.name = setup_data.name
        condo.address = setup_data.address
        condo.default_monthly_fee = setup_data.default_monthly_fee
        if logo_url:
            condo.logo_url = logo_url      

        # E. Generar Unidades
        print(f"🏗️ Generando {setup_data.total_units} unidades...")
        
        # Verificar si existen
        result_units = await db.execute(select(Unit).filter(Unit.condominium_id == condo.id))
        existing_units = result_units.scalars().all()
        
        if not existing_units:
            new_units = []
            for i in range(1, setup_data.total_units + 1):
                new_id = uuid.uuid4()
                unit = Unit(
                    id=new_id,
                    unit_number=str(i),
                    monthly_fee=setup_data.default_monthly_fee,
                    condominium_id=condo.id,
                    status="VACANT",
                    balance=0
                )
                new_units.append(unit) # 2. Agregamos a la lista (NO a la db todavía)
            # 3. Insertamos las 70 casas de una sola vez fuera del bucle
            db.add_all(new_units)
            print("✅ Unidades preparadas con IDs generados en Python")
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
                "address": condo.address,
                "logo_url": condo.logo_url,
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
