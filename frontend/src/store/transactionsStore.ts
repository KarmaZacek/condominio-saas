/**
 * Store de transacciones con Zustand
 * Maneja filtros y estado de UI para transacciones
 */

import { create } from 'zustand';
import { CategoryType, TransactionStatus, TransactionFilters } from '../types';

interface TransactionsState {
  // Filtros activos
  filters: TransactionFilters;
  
  // UI State
  selectedTransactionId: string | null;
  isFilterPanelOpen: boolean;
  
  // Acciones
  setFilter: <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => void;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  clearFilters: () => void;
  selectTransaction: (id: string | null) => void;
  toggleFilterPanel: () => void;
}

const defaultFilters: TransactionFilters = {
  type: undefined,
  category_id: undefined,
  unit_id: undefined,
  status: undefined,
  date_from: undefined,
  date_to: undefined,
  fiscal_period: undefined,
  amount_min: undefined,
  amount_max: undefined,
  search: undefined,
  page: 1,
  page_size: 20,
};

export const useTransactionsStore = create<TransactionsState>()((set) => ({
  // Estado inicial
  filters: { ...defaultFilters },
  selectedTransactionId: null,
  isFilterPanelOpen: false,
  
  // Acciones
  setFilter: (key, value) => set((state) => ({
    filters: {
      ...state.filters,
      [key]: value,
      page: key !== 'page' ? 1 : (value as number), // Reset page cuando cambia filtro
    }
  })),
  
  setFilters: (newFilters) => set((state) => ({
    filters: {
      ...state.filters,
      ...newFilters,
      page: 1, // Reset page
    }
  })),
  
  clearFilters: () => set({ 
    filters: { ...defaultFilters } 
  }),
  
  selectTransaction: (id) => set({ 
    selectedTransactionId: id 
  }),
  
  toggleFilterPanel: () => set((state) => ({ 
    isFilterPanelOpen: !state.isFilterPanelOpen 
  })),
}));

// Selectores
export const useTransactionFilters = () => useTransactionsStore((state) => state.filters);
export const useSelectedTransaction = () => useTransactionsStore((state) => state.selectedTransactionId);
export const useIsFilterPanelOpen = () => useTransactionsStore((state) => state.isFilterPanelOpen);
