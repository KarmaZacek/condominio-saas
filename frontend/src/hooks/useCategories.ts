/**
 * Hooks de React Query para Categorías
 * CORREGIDO: Límite aumentado a 1000 para cargar todas las categorías
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../shared/services/api/client';
import type { Category, CategoryType } from '../types';

// Keys para cache
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (type?: CategoryType) => [...categoryKeys.lists(), type] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

/**
 * Hook para obtener lista de categorías
 */
export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: categoryKeys.list(type),
    queryFn: async () => {
      // ✅ CORRECCIÓN: Solicitamos 1000 items para traer todo el catálogo
      const url = type 
        ? `/categories?type=${type}&limit=1000`
        : '/categories?limit=1000';
      const { data } = await api.get(url);
      // El backend devuelve { data: [...], pagination: {...} }
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para obtener una categoría por ID
 */
export function useCategory(id: string) {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/categories/${id}`);
      return data as Category;
    },
    enabled: !!id,
  });
}

/**
 * Hook para crear una categoría
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (category: { name: string; type: CategoryType; description?: string }) => {
      const { data } = await api.post('/categories', category);
      return data;
    },
    onSuccess: () => {
      // Invalidar todas las listas de categorías para recargar
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

/**
 * Hook para actualizar una categoría
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...category }: { id: string; name?: string; description?: string }) => {
      const { data } = await api.put(`/categories/${id}`, category);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook para eliminar una categoría
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}
