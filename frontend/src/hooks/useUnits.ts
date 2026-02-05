/**
 * Hooks de React Query para Unidades (Viviendas)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../shared/services/api/client';
import type { Unit } from '../types';

// Keys para cache
export const unitKeys = {
  all: ['units'] as const,
  lists: () => [...unitKeys.all, 'list'] as const,
  list: (filters?: any) => [...unitKeys.lists(), filters] as const,
  details: () => [...unitKeys.all, 'detail'] as const,
  detail: (id: string) => [...unitKeys.details(), id] as const,
  balance: (id: string) => [...unitKeys.all, 'balance', id] as const,
};

/**
 * Hook para obtener todas las unidades (para selectores)
 */
export function useAllUnits() {
  return useQuery({
    queryKey: [...unitKeys.lists(), 'all'],
    queryFn: async () => {
      const { data } = await api.get('/units?limit=100');
      // El backend devuelve { data: [...], pagination: {...}, summary: {...} }
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para obtener lista de unidades con filtros
 */
export function useUnits(filters?: { search?: string; has_debt?: boolean; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: unitKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.has_debt !== undefined) params.append('has_debt', String(filters.has_debt));
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.page_size) params.append('limit', filters.page_size.toString());
      
      const { data } = await api.get(`/units?${params.toString()}`);
      return {
        items: data.data || [],
        summary: data.summary,
        pagination: data.pagination,
      };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook para obtener una unidad por ID
 */
export function useUnit(id: string) {
  return useQuery({
    queryKey: unitKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/units/${id}`);
      return data as Unit;
    },
    enabled: !!id,
  });
}

/**
 * Hook para obtener estado de cuenta de una unidad
 */
export function useUnitBalanceStatement(id: string) {
  return useQuery({
    queryKey: unitKeys.balance(id),
    queryFn: async () => {
      const { data } = await api.get(`/units/${id}/balance`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Hook para crear unidad
 */
export function useCreateUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (unit: any) => {
      const { data } = await api.post('/units', unit);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
    },
  });
}

/**
 * Hook para actualizar unidad
 */
export function useUpdateUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...unit }: { id: string } & any) => {
      const { data } = await api.put(`/units/${id}`, unit);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unitKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook para eliminar unidad
 */
export function useDeleteUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/units/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
    },
  });
}

/**
 * Hook para unidades con deuda
 */
export function useDebtorUnits() {
  return useQuery({
    queryKey: [...unitKeys.lists(), 'debtors'],
    queryFn: async () => {
      const { data } = await api.get('/units?has_debt=true&limit=100');
      return data.data || [];
    },
    staleTime: 30 * 1000,
  });
}
