/**
 * Hooks de React Query para Estado Financiero
 * Manejo de cuotas normales, atrasadas y adelantadas
 */
import { useQuery } from '@tanstack/react-query';
import api from '../shared/services/api/client';

// ==================== TIPOS ====================

export interface IncomeBreakdown {
  normal_fees: number;
  normal_fees_count: number;
  late_fees_received: number;
  late_fees_count: number;
  advances_applied: number;
  advances_applied_count: number;
  advances_received: number;
  advances_received_count: number;
}

export interface FinancialTotals {
  initial_balance: number;
  total_income_cash: number;
  total_expenses: number;
  net_period_flow: number;
  final_balance: number;
  advance_reserve: number;
  available_balance: number;
}

export interface AdvanceReserveDetail {
  fiscal_period: string;
  fiscal_period_label: string;
  amount: number;
  units_count: number;
}

export interface UnitAdvanceDetail {
  unit_id: string;
  unit_number: string;
  owner_name: string | null;
  fiscal_period: string;
  fiscal_period_label: string;
  amount: number;
  transaction_date: string;
  description: string;
}

export interface LatePaymentDetail {
  unit_id: string;
  unit_number: string;
  owner_name: string | null;
  original_period: string;
  original_period_label: string;
  amount: number;
  received_date: string;
  description: string;
}

export interface FinancialStatusResponse {
  period: string;
  period_label: string;
  income_breakdown: IncomeBreakdown;
  totals: FinancialTotals;
  advance_reserve_summary: AdvanceReserveDetail[];
  advance_reserve_detail: UnitAdvanceDetail[];
  late_payments_received: LatePaymentDetail[];
}

export interface FinancialHistoryItem {
  period: string;
  period_label: string;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  advances_received: number;
  available_income: number;
}

export interface FinancialHistoryResponse {
  months_count: number;
  history: FinancialHistoryItem[];
}

// ==================== QUERY KEYS ====================

export const financialStatusKeys = {
  all: ['financial-status'] as const,
  status: (period?: string) => [...financialStatusKeys.all, 'status', period] as const,
  history: (months: number) => [...financialStatusKeys.all, 'history', months] as const,
};

// ==================== HOOKS ====================

/**
 * Hook para obtener el estado financiero de un período
 */
export function useFinancialStatus(period?: string) {
  return useQuery({
    queryKey: financialStatusKeys.status(period),
    queryFn: async () => {
      const params = period ? `?period=${period}` : '';
      const { data } = await api.get<FinancialStatusResponse>(`/reports/financial-status${params}`);
      return data;
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}

/**
 * Hook para obtener el historial de estado financiero
 */
export function useFinancialStatusHistory(months: number = 6) {
  return useQuery({
    queryKey: financialStatusKeys.history(months),
    queryFn: async () => {
      const { data } = await api.get<FinancialHistoryResponse>(
        `/reports/financial-status/history?months=${months}`
      );
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// ==================== HELPERS ====================

/**
 * Calcula el porcentaje de un valor respecto al total
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Agrupa adelantos por vivienda
 */
export function groupAdvancesByUnit(advances: UnitAdvanceDetail[]): Record<string, {
  unit_number: string;
  owner_name: string | null;
  total_amount: number;
  periods: Array<{ fiscal_period: string; fiscal_period_label: string; amount: number }>;
}> {
  return advances.reduce((acc, advance) => {
    const key = advance.unit_id;
    if (!acc[key]) {
      acc[key] = {
        unit_number: advance.unit_number,
        owner_name: advance.owner_name,
        total_amount: 0,
        periods: [],
      };
    }
    acc[key].total_amount += advance.amount;
    acc[key].periods.push({
      fiscal_period: advance.fiscal_period,
      fiscal_period_label: advance.fiscal_period_label,
      amount: advance.amount,
    });
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Agrupa pagos atrasados por vivienda
 */
export function groupLatePaymentsByUnit(payments: LatePaymentDetail[]): Record<string, {
  unit_number: string;
  owner_name: string | null;
  total_amount: number;
  periods: Array<{ original_period: string; original_period_label: string; amount: number; received_date: string }>;
}> {
  return payments.reduce((acc, payment) => {
    const key = payment.unit_id;
    if (!acc[key]) {
      acc[key] = {
        unit_number: payment.unit_number,
        owner_name: payment.owner_name,
        total_amount: 0,
        periods: [],
      };
    }
    acc[key].total_amount += payment.amount;
    acc[key].periods.push({
      original_period: payment.original_period,
      original_period_label: payment.original_period_label,
      amount: payment.amount,
      received_date: payment.received_date,
    });
    return acc;
  }, {} as Record<string, any>);
}
