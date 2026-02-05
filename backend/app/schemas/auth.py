"""
Schemas de Pydantic para autenticación.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class UserRegister(BaseModel):
    """Schema para registro de usuario."""
    
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    unit_number: Optional[str] = Field(None, max_length=10)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not re.search(r'[0-9]', v):
            raise ValueError('La contraseña debe contener al menos un número')
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is not None:
            # Formato mexicano: 10 dígitos
            cleaned = re.sub(r'[^\d]', '', v)
            if len(cleaned) != 10:
                raise ValueError('El teléfono debe tener 10 dígitos')
        return v


class UserLogin(BaseModel):
    """Schema para login."""
    
    email: EmailStr
    password: str
    device_info: Optional[dict] = None


class TokenResponse(BaseModel):
    """Schema de respuesta con tokens."""
    
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    """Schema para refresh de token."""
    
    refresh_token: str


class UserResponse(BaseModel):
    """Schema de respuesta de usuario."""
    
    id: str
    email: str
    full_name: str
    role: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    unit_id: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Schema de respuesta completa de login."""
    
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserResponse


class PasswordChange(BaseModel):
    """Schema para cambio de contraseña."""
    
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not re.search(r'[0-9]', v):
            raise ValueError('La contraseña debe contener al menos un número')
        return v


class PasswordReset(BaseModel):
    """Schema para reset de contraseña."""
    
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema para confirmar reset de contraseña."""
    
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not re.search(r'[0-9]', v):
            raise ValueError('La contraseña debe contener al menos un número')
        return v


class ProfileUpdate(BaseModel):
    """Schema para actualización de perfil."""
    
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is not None:
            cleaned = re.sub(r'[^\d]', '', v)
            if len(cleaned) != 10:
                raise ValueError('El teléfono debe tener 10 dígitos')
        return v


class LogoutRequest(BaseModel):
    """Schema para logout."""
    
    refresh_token: Optional[str] = None
    all_devices: bool = False

class PasswordResetRequest(BaseModel):
    """Schema para solicitar código de recuperación."""
    email: EmailStr
class PasswordResetVerify(BaseModel):
    """Schema para verificar código de recuperación."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$')
class PasswordResetWithCode(BaseModel):
    """Schema para restablecer contraseña con código."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$')
    new_password: str = Field(..., min_length=8, max_length=100)
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not re.search(r'[0-9]', v):
            raise ValueError('La contraseña debe contener al menos un número')
        return v

