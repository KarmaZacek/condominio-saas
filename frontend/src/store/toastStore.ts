/**
 * Store global para Toast/Notificaciones
 */
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  hideToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  
  showToast: (type, message, duration = 3000) => {
    const id = Date.now().toString();
    const toast: Toast = { id, type, message, duration };
    
    set((state) => ({
      toasts: [...state.toasts, toast],
    }));
    
    // Auto-hide después de duration
    if (duration > 0) {
      setTimeout(() => {
        get().hideToast(id);
      }, duration);
    }
  },
  
  hideToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  clearAll: () => {
    set({ toasts: [] });
  },
}));

// Helper functions para uso más simple
export const toast = {
  success: (message: string, duration?: number) => 
    useToastStore.getState().showToast('success', message, duration),
  error: (message: string, duration?: number) => 
    useToastStore.getState().showToast('error', message, duration ?? 4000),
  warning: (message: string, duration?: number) => 
    useToastStore.getState().showToast('warning', message, duration),
  info: (message: string, duration?: number) => 
    useToastStore.getState().showToast('info', message, duration),
};
