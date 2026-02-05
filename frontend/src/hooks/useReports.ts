/**
 * Hook para Reportes y Dashboard
 */
import { useQuery } from '@tanstack/react-query';
import api from '../shared/services/api/client';

export const reportKeys = {
  all: ['reports'] as const,
  dashboard: () => [...reportKeys.all, 'dashboard'] as const,
  monthly: (year: number, month: number) => [...reportKeys.all, 'monthly', year, month] as const,
  accountStatement: (unitId?: string) => [...reportKeys.all, 'account-statement', unitId] as const,
};

/**
 * Hook para obtener datos del dashboard
 */
export function useDashboardReport() {
  return useQuery({
    queryKey: reportKeys.dashboard(),
    queryFn: async () => {
      const { data } = await api.get('/reports/dashboard');
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

/**
 * Hook para obtener reporte mensual
 */
export function useMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: reportKeys.monthly(year, month),
    queryFn: async () => {
      const { data } = await api.get(`/reports/monthly/${year}/${month}`);
      return data;
    },
    enabled: !!year && !!month,
  });
}

/**
 * Hook para obtener estado de cuenta
 */
export function useAccountStatement(unitId?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: reportKeys.accountStatement(unitId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unitId) params.append('unit_id', unitId);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const { data } = await api.get(`/reports/account-statement?${params.toString()}`);
      return data;
    },
    enabled: !!unitId,
  });
}

/**
 * Funciones de exportación
 */
export const exportReports = {
  monthlyExcel: (year: number, month: number) => 
    `/reports/export/monthly/${year}/${month}`,
  accountStatementExcel: (unitId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return `/reports/export/account-statement/${unitId}?${params.toString()}`;
  },
  debtorsExcel: () => '/reports/export/debtors',
};
