/**
 * Hooks de React Query para Transacciones
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../shared/services/api/client';
import type { Transaction, TransactionFilters, TransactionCreate } from '../types';

// Keys para cache
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: any) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  summary: (period?: string) => [...transactionKeys.all, 'summary', period] as const,
};

/**
 * Hook para obtener lista de transacciones con filtros
 */
export function useTransactions(filters: TransactionFilters & { is_advance?: boolean; is_late?: boolean }) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.type) params.append('type', filters.type);
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.fiscal_period) params.append('fiscal_period', filters.fiscal_period);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.page_size) params.append('limit', filters.page_size.toString());
      
      // ✅ Agregamos los filtros nuevos para desglose
      if (filters.is_advance !== undefined) params.append('is_advance', String(filters.is_advance));
      if (filters.is_late !== undefined) params.append('is_late', String(filters.is_late));
      
      const { data } = await api.get(`/transactions?${params.toString()}`);
      
      // ✅ CORRECCIÓN CLAVE: Pasamos el 'summary' que envía el backend
      return {
        items: data.data || [],
        summary: data.summary || {
          total_income: 0,
          total_expense: 0,
          net_balance: 0,
          transaction_count: 0,
          advance_payment_count: 0,
          advance_payment_amount: 0,
          late_payment_count: 0,
          late_payment_amount: 0
        },
        pagination: data.pagination,
        total: data.pagination?.total_items || 0,
      };
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData, // Mantiene datos mientras recarga
  });
}

/**
 * Hook para obtener una transacción por ID
 */
export function useTransaction(id?: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id || ''),
    queryFn: async () => {
      const { data } = await api.get(`/transactions/${id}`);
      return data as Transaction;
    },
    enabled: !!id,
  });
}

/**
 * Hook para crear transacción
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transaction: TransactionCreate) => {
      const { data } = await api.post<Transaction>('/transactions', transaction);
      return data;
    },
    onSuccess: (data) => {
      // Invalidar listas
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      // Invalidar resúmenes
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      // Si tiene unidad, invalidar balance de unidad
      if (data.unit_id) {
        queryClient.invalidateQueries({ queryKey: ['units', 'detail', data.unit_id] });
        queryClient.invalidateQueries({ queryKey: ['units', 'balance', data.unit_id] });
      }
    },
  });
}

/**
 * Hook para actualizar transacción
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...transaction }: { id: string } & Partial<TransactionCreate>) => {
      const { data } = await api.patch(`/transactions/${id}`, transaction);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
    },
  });
}

/**
 * Hook para eliminar transacción
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
    },
  });
}

/**
 * Hook para resumen de transacciones (Endpoint específico de resumen)
 */
export function useTransactionsSummary(period?: string) {
  return useQuery({
    queryKey: transactionKeys.summary(period),
    queryFn: async () => {
      const url = period 
        ? `/transactions/summary?fiscal_period=${period}`
        : '/transactions/summary';
      const { data } = await api.get(url);
      return data;
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}

/**
 * Hook para cancelar transacción
 */
export function useCancelTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/transactions/${id}/cancel`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
    },
  });
}
