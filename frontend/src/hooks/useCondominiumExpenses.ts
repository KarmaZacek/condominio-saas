/**
 * Hook para obtener gastos del condominio
 * Usa el endpoint /transactions/condominium-expenses
 */
import { useQuery } from '@tanstack/react-query';
import api from '../shared/services/api/client';

export interface CondominiumExpensesFilters {
  page?: number;
  page_size?: number;
  category_id?: string;
  from_date?: string;
  to_date?: string;
  fiscal_period?: string;
  search?: string;
  has_receipt?: boolean;
}

/**
 * Hook para obtener los gastos generales del condominio
 * Disponible para todos los usuarios autenticados (incluyendo residentes)
 */
export function useCondominiumExpenses(filters: CondominiumExpensesFilters = {}) {
  return useQuery({
    queryKey: ['condominium-expenses', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.page_size) params.append('limit', filters.page_size.toString());
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.fiscal_period) params.append('fiscal_period', filters.fiscal_period);
      if (filters.search) params.append('search', filters.search);
      if (filters.has_receipt !== undefined) params.append('has_receipt', String(filters.has_receipt));
      
      const { data } = await api.get(`/transactions/condominium-expenses?${params.toString()}`);
      
      return {
        items: data.data || [],
        pagination: data.pagination,
        total: data.pagination?.total_items || 0,
        summary: data.summary || null,
      };
    },
    staleTime: 60 * 1000, // 1 minuto de cache
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook para obtener resumen de gastos del condominio del año actual
 */
export function useCondominiumExpensesSummary() {
  const currentYear = new Date().getFullYear();
  const startOfYear = `${currentYear}-01-01`;
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['condominium-expenses-summary', currentYear],
    queryFn: async () => {
      const { data } = await api.get(
        `/transactions/condominium-expenses?from_date=${startOfYear}&to_date=${today}&limit=1000`
      );
      
      const items = data.data || [];
      const totalExpenses = items.reduce(
        (sum: number, t: any) => sum + parseFloat(t.amount?.toString() || '0'), 
        0
      );
      
      // Agrupar por categoría
      const byCategory: Record<string, { name: string; total: number; count: number }> = {};
      items.forEach((t: any) => {
        const catId = t.category_id || 'sin-categoria';
        const catName = t.category_name || 'Sin categoría';
        if (!byCategory[catId]) {
          byCategory[catId] = { name: catName, total: 0, count: 0 };
        }
        byCategory[catId].total += parseFloat(t.amount?.toString() || '0');
        byCategory[catId].count += 1;
      });
      
      return {
        totalExpenses,
        transactionCount: items.length,
        byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      };
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}
