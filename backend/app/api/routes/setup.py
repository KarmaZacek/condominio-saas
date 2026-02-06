from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
# ... importaciones de auth y db ...

router = APIRouter()

@router.put("/setup/initial")
async def initial_setup(
    name: str = Form(...),
    monthly_fee: float = Form(...),
    total_units: int = Form(...), # Preguntar cuántas casas son
    logo: UploadFile = File(None), # Opcional
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. Obtener el condominio del usuario
    condo = db.query(Condominium).filter(Condominium.id == current_user.condominium_id).first()
    
    # 2. Actualizar datos básicos
    condo.name = name
    condo.default_monthly_fee = monthly_fee
    
    # 3. Manejar el Logo (Esto requiere Cloudinary o guardar en disco)
    if logo:
        # Aquí iría la lógica para subir la imagen y obtener la URL
        # condo.logo_url = url_de_cloudinary
        pass 

    # 4. Generar las unidades automáticamente (Magia SaaS ✨)
    # Si el condominio está vacío, creamos las casas del 1 al N
    if len(condo.units) == 0:
        for i in range(1, total_units + 1):
            new_unit = Unit(
                unit_number=str(i),
                monthly_fee=monthly_fee, # Usamos la cuota que definió
                condominium_id=condo.id,
                status="ACTIVE"
            )
            db.add(new_unit)

    # 5. Marcar como completado
    condo.is_setup_completed = True
    db.commit()
    
    return {"message": "Configuración exitosa", "condominium": condo}
