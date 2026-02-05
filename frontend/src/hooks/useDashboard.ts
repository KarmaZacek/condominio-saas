/**
 * Hooks de React Query para Dashboard y Reportes
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../shared/services/api/client';
import { 
  DashboardSummary, 
  TransactionsByCategory,
  MonthlyTrend
} from '../types';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Keys para cache
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (period?: string) => [...dashboardKeys.all, 'summary', period] as const,
  byCategory: (period?: string) => [...dashboardKeys.all, 'by-category', period] as const,
  trends: (months?: number) => [...dashboardKeys.all, 'trends', months] as const,
};

export const reportKeys = {
  all: ['reports'] as const,
  monthly: (period: string) => [...reportKeys.all, 'monthly', period] as const,
};

// ============ Dashboard Queries ============

/**
 * Hook para obtener resumen del dashboard
 */
export function useDashboardSummary(period?: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(period),
    queryFn: async () => {
      const url = period 
        ? `/reports/dashboard?period=${period}`
        : '/reports/dashboard';
      const { data } = await api.get<DashboardSummary>(url);
      return data;
    },
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
  });
}

/**
 * Hook para obtener transacciones por categoría
 */
export function useTransactionsByCategory(period?: string) {
  return useQuery({
    queryKey: dashboardKeys.byCategory(period),
    queryFn: async () => {
      const url = period 
        ? `/reports/by-category?period=${period}`
        : '/reports/by-category';
      const { data } = await api.get<TransactionsByCategory>(url);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

/**
 * Hook para obtener tendencias mensuales
 */
export function useMonthlyTrends(months: number = 12) {
  return useQuery({
    queryKey: dashboardKeys.trends(months),
    queryFn: async () => {
      const { data } = await api.get<MonthlyTrend[]>(`/reports/trends?months=${months}`);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// ============ Report Export ============

interface ExportOptions {
  type: 'monthly' | 'annual' | 'unit-balance' | 'debtors';
  period?: string;
  unitId?: string;
  format?: 'xlsx' | 'pdf';
  year?: number;
}

/**
 * Hook para exportar reportes a Excel/PDF
 */
export function useExportReport() {
  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      let url = '/reports/export';
      const params = new URLSearchParams();
      
      params.append('type', options.type);
      if (options.period) params.append('period', options.period);
      if (options.unitId) params.append('unit_id', options.unitId);
      if (options.format) params.append('format', options.format);
      if (options.year) params.append('year', options.year.toString());
      
      // Obtener el archivo como blob
      const response = await api.get(`${url}?${params.toString()}`, {
        responseType: 'blob',
      });
      
      // Determinar nombre del archivo
      const contentDisposition = response.headers['content-disposition'];
      let filename = `reporte_${options.type}_${Date.now()}.xlsx`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }
      
      // Guardar archivo temporalmente
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      // Convertir blob a base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(response.data);
      
      const base64Data = await base64Promise;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return { fileUri, filename };
    },
  });
}

/**
 * Hook para compartir archivo exportado
 */
export function useShareReport() {
  return useMutation({
    mutationFn: async (fileUri: string) => {
      const canShare = await Sharing.isAvailableAsync();
      
      if (!canShare) {
        throw new Error('Compartir no está disponible en este dispositivo');
      }
      
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Exportar Reporte',
      });
      
      return true;
    },
  });
}

// ============ Helpers ============

/**
 * Obtener periodo actual en formato YYYY-MM
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Obtener lista de últimos N periodos
 */
export function getLastPeriods(count: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  
  return periods;
}

/**
 * Formatear periodo para mostrar (YYYY-MM -> "Enero 2024")
 */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}
