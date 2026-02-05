/**
 * Store de autenticación con Zustand
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setTokens, clearTokens, getAccessToken } from '../shared/services/api/client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'resident' | 'readonly';
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  unit_id?: string;
  created_at: string;
  last_login?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
 
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<boolean>;
}

/**
 * Extrae el mensaje de error del backend
 * Maneja múltiples formatos:
 * 1. { detail: { error: "CODE", message: "texto" } } - Errores de autenticación
 * 2. { detail: "texto" } - Errores simples
 * 3. { error: "VALIDATION_ERROR", message: "texto", details: [...] } - Validación
 * 4. { detail: [{ loc: [...], msg: "texto" }] } - Validación Pydantic
 */
const extractErrorMessage = (error: any, defaultMessage: string = 'Error desconocido'): string => {
  // Si no hay respuesta del servidor, es error de conexión
  if (!error?.response) {
    if (error?.message?.includes('Network')) {
      return 'Error de conexión. Verifica tu internet.';
    }
    return defaultMessage;
  }

  const data = error?.response?.data;

  if (!data) {
    return defaultMessage;
  }

  // Formato 3: Error de validación { error: "VALIDATION_ERROR", message: "...", details: [...] }
  if (data.error === 'VALIDATION_ERROR') {
    // Si hay detalles, extraer el mensaje del primer campo con error
    if (data.details && data.details.length > 0) {
      const firstError = data.details[0];
      const fieldName = firstError.field;
      
      // Mensajes amigables para campos comunes
      const fieldMessages: Record<string, string> = {
        'email': 'El correo electrónico no es válido',
        'password': 'La contraseña no cumple los requisitos',
      };
      
      return fieldMessages[fieldName] || firstError.message || data.message;
    }
    return data.message || 'Error en los datos ingresados';
  }

  // Formato 1 y 2: { detail: ... }
  const detail = data.detail;

  if (!detail) {
    // Puede tener message directamente en data
    if (data.message) {
      return data.message;
    }
    return defaultMessage;
  }

  // Si detail es string, devolverlo directamente
  if (typeof detail === 'string') {
    return detail;
  }

  // Si detail es array (validación Pydantic)
  if (Array.isArray(detail)) {
    const firstError = detail[0];
    if (firstError?.msg) {
      return firstError.msg;
    }
    return 'Error en los datos ingresados';
  }

  // Si detail tiene message, usarlo directamente
  if (detail.message) {
    return detail.message;
  }

  // Si detail es objeto con error (código), mapear a mensaje amigable
  if (detail.error) {
    const errorMessages: Record<string, string> = {
      'INVALID_CREDENTIALS': 'Correo o contraseña incorrectos',
      'ACCOUNT_INACTIVE': 'Tu cuenta está inactiva. Contacta al administrador para activarla.',
      'ACCOUNT_LOCKED': 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.',
      'EMAIL_EXISTS': 'Este correo ya está registrado',
      'INVALID_TOKEN': 'Sesión inválida o expirada',
      'TOKEN_REVOKED': 'Tu sesión ha sido cerrada',
      'INVALID_REFRESH_TOKEN': 'Sesión expirada. Inicia sesión nuevamente.',
      'FORBIDDEN': 'No tienes permisos para esta acción',
      'USER_NOT_FOUND': 'Usuario no encontrado',
      'INVALID_PASSWORD': 'La contraseña actual es incorrecta',
    };
    return errorMessages[detail.error] || detail.error;
  }

  return defaultMessage;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
     
      login: async (credentials: LoginCredentials) => {
        console.log('🔐 Iniciando login...');
        set({ isLoading: true, error: null });
       
        try {
          const response = await api.post('/auth/login', credentials);
          console.log('✅ Respuesta del servidor:', JSON.stringify(response.data, null, 2));
         
          const { access_token, refresh_token, user } = response.data;
         
          console.log('💾 Guardando tokens...');
          await setTokens(access_token, refresh_token);
         
          console.log('👤 Usuario:', user);
          console.log('🔄 Actualizando estado...');
         
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
         
          console.log('✅ Estado actualizado, isAuthenticated: true');
        } catch (error: any) {
          console.log('❌ Error en login:', error?.response?.data || error.message);
          const message = extractErrorMessage(error, 'Error al iniciar sesión');
          set({ error: message, isLoading: false });
          throw error;
        }
      },
     
      logout: async () => {
        console.log('🚪 Cerrando sesión...');
        set({ isLoading: true });
       
        try {
          await api.post('/auth/logout', {});
        } catch {
          // Ignorar errores al cerrar sesión
        } finally {
          await clearTokens();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          console.log('✅ Sesión cerrada');
        }
      },
     
      clearError: () => set({ error: null }),
     
      checkAuth: async () => {
        console.log('🔍 Verificando autenticación...');
        const token = await getAccessToken();
       
        if (!token) {
          console.log('❌ No hay token');
          set({ isAuthenticated: false, user: null });
          return false;
        }
       
        try {
          console.log('📡 Consultando /auth/me...');
          const response = await api.get('/auth/me');
          console.log('✅ Usuario autenticado:', response.data);
          set({ user: response.data, isAuthenticated: true });
          return true;
        } catch (error: any) {
          console.log('❌ Token inválido:', extractErrorMessage(error));
          await clearTokens();
          set({ isAuthenticated: false, user: null });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === 'admin');
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
