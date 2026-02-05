import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// =====================================================================
// 🌍 CORRECCIÓN DE URL (MODO PRODUCCIÓN)
// =====================================================================

// Tu URL de Railway (¡La importante!):
const PROD_URL = 'https://web-production-58dbc.up.railway.app/v1';

// Tu URL local (para cuando programes en tu PC):
// Cambia esto por tu IP local si lo necesitas (ej. 192.168.1.x)
const LOCAL_URL = 'http://192.168.100.7:8000/v1';

// Lógica: Si es la App instalada (Producción) usa Railway. Si es desarrollo, usa Local.
const API_BASE_URL = __DEV__ ? LOCAL_URL : PROD_URL;

console.log('🔌 Conectado a:', API_BASE_URL);

// =====================================================================
// ... (El resto del archivo déjalo igual: const ACCESS_TOKEN_KEY...)

// Claves de almacenamiento
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Crear instancia de Axios
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ... (El resto del archivo sigue igual: isRefreshing, interceptors, etc.)

// Variable para evitar múltiples refresh simultáneos
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Callback para manejar logout (será configurado por el authStore)
let onLogoutCallback: (() => void) | null = null;

export function setLogoutCallback(callback: () => void) {
  onLogoutCallback = callback;
}

/**
 * Suscribe una petición para reintentar cuando el token se renueve
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Notifica a todos los suscriptores que el token se renovó
 */
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Obtiene el access token almacenado
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Obtiene el refresh token almacenado
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Almacena los tokens
 */
export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

/**
 * Elimina los tokens
 */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

/**
 * Verifica si el token ha expirado
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Considerar expirado si quedan menos de 60 segundos
    return payload.exp * 1000 < Date.now() + 60000;
  } catch {
    return true;
  }
}

/**
 * Renueva el access token
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  
  const { access_token, refresh_token: newRefreshToken } = response.data;
  await setTokens(access_token, newRefreshToken || refreshToken);
  
  return access_token;
}

// Interceptor de request: agregar token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // No agregar token a rutas públicas
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password'];
    if (publicRoutes.some((route) => config.url?.includes(route))) {
      return config;
    }
    
    let token = await getAccessToken();
    
    // Si el token está por expirar, renovarlo
    if (token && isTokenExpired(token)) {
      try {
        token = await refreshAccessToken();
      } catch {
        // El interceptor de response manejará el error
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de response: manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Si es error 401 y no es un retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      if (isRefreshing) {
        // Esperar a que termine el refresh en curso
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      isRefreshing = true;
      
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onTokenRefreshed(newToken);
        
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        // Limpiar tokens y llamar callback de logout
        await clearTokens();
        if (onLogoutCallback) {
          onLogoutCallback();
        }
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

// Tipos para respuestas de API
export interface ApiError {
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
