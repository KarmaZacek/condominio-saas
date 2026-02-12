"""
Rutas de autenticación.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.auth import (
    UserRegister, UserLogin, LoginResponse, TokenResponse,
    TokenRefresh, PasswordChange, PasswordReset, PasswordResetConfirm,
    ProfileUpdate, UserResponse, LogoutRequest,
    PasswordResetRequest, PasswordResetVerify, PasswordResetWithCode
)
from app.services.auth_service import AuthService, get_auth_service
from app.services.password_reset_service import get_password_reset_service
from app.middleware.auth import get_current_user, AuthenticatedUser


router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo usuario"
)
async def register(
    data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra un nuevo usuario.
    
    - Los usuarios nuevos requieren activación por un administrador
    - El email debe ser único
    - La contraseña debe tener al menos 8 caracteres, una mayúscula y un número
    """
    service = get_auth_service(db)
    
    try:
        user = await service.register(data)
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            phone=user.phone,
            is_active=user.is_active,
            created_at=user.created_at
        )
    except ValueError as e:
        error = str(e)
        
        if error == "EMAIL_EXISTS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "EMAIL_EXISTS",
                    "message": "Este correo ya está registrado"
                }
            )
        elif error == "INVALID_INVITATION_CODE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "INVALID_INVITATION_CODE",
                    "message": "Código de invitación inválido o ya utilizado"
                }
            )
        elif error == "INVITATION_CODE_EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "INVITATION_CODE_EXPIRED",
                    "message": "El código de invitación ha expirado"
                }
            )
        elif error == "INVITATION_EMAIL_MISMATCH":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "INVITATION_EMAIL_MISMATCH",
                    "message": "Este código de invitación es para otro email"
                }
            )
        raise


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Iniciar sesión"
)
async def login(
    data: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Autentica un usuario y devuelve tokens JWT.
    
    - Access token expira en 15 minutos
    - Refresh token expira en 7 días
    - Después de 5 intentos fallidos, la cuenta se bloquea por 15 minutos
    """
    service = get_auth_service(db)
    
    try:
        return await service.login(
            data,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
    except ValueError as e:
        error = str(e)
        if error == "INVALID_CREDENTIALS":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_CREDENTIALS",
                    "message": "Correo o contraseña incorrectos"
                }
            )
        elif error == "ACCOUNT_INACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "ACCOUNT_INACTIVE",
                    "message": "Tu cuenta está pendiente de activación"
                }
            )
        elif error.startswith("ACCOUNT_LOCKED"):
            # Extraer minutos restantes si vienen en el error (formato: ACCOUNT_LOCKED:15)
            parts = error.split(":")
            minutes_remaining = int(parts[1]) if len(parts) > 1 else 15
            
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "error": "ACCOUNT_LOCKED",
                    "message": f"Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo en {minutes_remaining} minutos.",
                    "minutes_remaining": minutes_remaining,
                    "temporary": True
                }
            )
        raise


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar access token"
)
async def refresh_token(
    data: TokenRefresh,
    db: AsyncSession = Depends(get_db)
):
    """
    Renueva el access token usando el refresh token.
    """
    service = get_auth_service(db)
    
    try:
        return await service.refresh_access_token(data.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_REFRESH_TOKEN",
                "message": "Token inválido o expirado"
            }
        )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Cerrar sesión"
)
async def logout(
    data: LogoutRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cierra la sesión revocando el refresh token.
    
    - Si `all_devices` es true, revoca todos los tokens del usuario
    """
    service = get_auth_service(db)
    
    await service.logout(
        user_id=current_user.id,
        refresh_token=data.refresh_token,
        all_devices=data.all_devices
    )
    
    return {"message": "Sesión cerrada correctamente"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Obtener perfil actual"
)
async def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el perfil del usuario autenticado.
    """
    service = get_auth_service(db)
    user = await service.get_user_by_id(current_user.id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "USER_NOT_FOUND"}
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        phone=user.phone,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        unit_id=user.unit_id,
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Actualizar perfil"
)
async def update_me(
    data: ProfileUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza el perfil del usuario autenticado.
    """
    service = get_auth_service(db)
    
    user = await service.update_profile(
        user_id=current_user.id,
        full_name=data.full_name,
        phone=data.phone
    )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        phone=user.phone,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.put(
    "/me/password",
    status_code=status.HTTP_200_OK,
    summary="Cambiar contraseña"
)
async def change_password(
    data: PasswordChange,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cambia la contraseña del usuario autenticado.
    
    - Requiere la contraseña actual
    - Revoca todos los refresh tokens existentes
    """
    service = get_auth_service(db)
    
    try:
        await service.update_password(
            user_id=current_user.id,
            current_password=data.current_password,
            new_password=data.new_password
        )
        return {"message": "Contraseña actualizada correctamente"}
    except ValueError as e:
        if str(e) == "INVALID_PASSWORD":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "INVALID_PASSWORD",
                    "message": "La contraseña actual es incorrecta"
                }
            )
        raise


# ==================== RECUPERACIÓN DE CONTRASEÑA ====================

@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Solicitar código de recuperación"
)
async def forgot_password(
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Solicita un código de 6 dígitos para restablecer la contraseña.
    
    - El código se envía al email (o se muestra en logs si no hay SMTP)
    - El código expira en 15 minutos
    - Máximo 3 solicitudes por hora
    - Por seguridad, siempre retorna éxito
    """
    service = get_password_reset_service(db)
    result = await service.request_reset(data.email)
    return result


@router.post(
    "/verify-reset-code",
    status_code=status.HTTP_200_OK,
    summary="Verificar código de recuperación"
)
async def verify_reset_code(
    data: PasswordResetVerify,
    db: AsyncSession = Depends(get_db)
):
    """
    Verifica si un código de recuperación es válido.
    
    - Útil para validar el código antes de mostrar el formulario de nueva contraseña
    """
    service = get_password_reset_service(db)
    user_id = await service.verify_code(data.email, data.code)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_CODE",
                "message": "Código inválido o expirado"
            }
        )
    
    return {"valid": True, "message": "Código válido"}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Restablecer contraseña con código"
)
async def reset_password(
    data: PasswordResetWithCode,
    db: AsyncSession = Depends(get_db)
):
    """
    Restablece la contraseña usando el código de 6 dígitos.
    
    - El código debe ser válido y no expirado
    - Máximo 5 intentos por código
    - La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número
    """
    service = get_password_reset_service(db)
    result = await service.reset_password(
        email=data.email,
        code=data.code,
        new_password=data.new_password
    )
    
    if not result.get("success"):
        error = result.get("error", "UNKNOWN_ERROR")
        messages = {
            "INVALID_CODE": "Código inválido",
            "CODE_EXPIRED": "El código ha expirado",
            "MAX_ATTEMPTS_EXCEEDED": "Demasiados intentos fallidos"
        }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": error,
                "message": messages.get(error, "Error al restablecer contraseña")
            }
        )
    
    return {"message": "Contraseña restablecida correctamente"}
