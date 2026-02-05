// src/shared/components/FilterPanel.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAllUnits } from '../../hooks/useUnits';
import { useCategories } from '../../hooks/useCategories';
import { useTransactionsStore } from '../../store/transactionsStore';
import { Button } from './Button';
import { Input } from './Input';
import { Badge } from './Badge';
import { Card } from './Card';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import type { TransactionType, TransactionStatus } from '../../types';

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
}

type DatePickerMode = 'start' | 'end' | null;

const STATUS_OPTIONS: { value: TransactionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'completed', label: 'Completado' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'cancelled', label: 'Cancelado' },
];

const QUICK_PERIODS = [
  { label: 'Este mes', getValue: () => getCurrentMonth() },
  { label: 'Mes pasado', getValue: () => getLastMonth() },
  { label: 'Últimos 3 meses', getValue: () => getLast3Months() },
  { label: 'Este año', getValue: () => getCurrentYear() },
];

function getCurrentMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

function getLastMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start, end };
}

function getLast3Months() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

function getCurrentYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { start, end };
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  visible,
  onClose,
  onApply,
}) => {
  const { data: units } = useAllUnits();
  const { data: incomeCategories } = useCategories('income');
  const { data: expenseCategories } = useCategories('expense');

  const {
    filters,
    setFilter,
    resetFilters,
  } = useTransactionsStore();

  // Local state for date picker
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode>(null);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(
    filters.date_from ? new Date(filters.date_from) : undefined
  );
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(
    filters.date_to ? new Date(filters.date_to) : undefined
  );

  // Sync local state with store
  useEffect(() => {
    setTempStartDate(filters.date_from ? new Date(filters.date_from) : undefined);
    setTempEndDate(filters.date_to ? new Date(filters.date_to) : undefined);
  }, [filters.date_from, filters.date_to]);

  const handleApply = useCallback(() => {
    // Apply date filters
    if (tempStartDate) {
      setFilter('date_from', tempStartDate.toISOString().split('T')[0]);
    }
    if (tempEndDate) {
      setFilter('date_to', tempEndDate.toISOString().split('T')[0]);
    }
    onApply();
    onClose();
  }, [tempStartDate, tempEndDate, setFilter, onApply, onClose]);

  const handleReset = useCallback(() => {
    resetFilters();
    setTempStartDate(undefined);
    setTempEndDate(undefined);
  }, [resetFilters]);

  const handleQuickPeriod = useCallback((period: { start: Date; end: Date }) => {
    setTempStartDate(period.start);
    setTempEndDate(period.end);
  }, []);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setDatePickerMode(null);
      return;
    }

    if (selectedDate) {
      if (datePickerMode === 'start') {
        setTempStartDate(selectedDate);
      } else if (datePickerMode === 'end') {
        setTempEndDate(selectedDate);
      }
    }
    setDatePickerMode(null);
  }, [datePickerMode]);

  const formatDate = (date?: Date) => {
    if (!date) return 'Seleccionar';
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const categories = filters.type === 'income' 
    ? incomeCategories 
    : filters.type === 'expense' 
    ? expenseCategories 
    : [...(incomeCategories || []), ...(expenseCategories || [])];

  const activeFiltersCount = [
    filters.type,
    filters.category_id,
    filters.unit_id,
    filters.status,
    filters.date_from,
    filters.date_to,
    filters.amount_min,
    filters.amount_max,
  ].filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Filtros</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Transaction Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Movimiento</Text>
            <View style={styles.chipContainer}>
              {[
                { value: '', label: 'Todos' },
                { value: 'income', label: 'Ingresos' },
                { value: 'expense', label: 'Egresos' },
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.chip,
                    filters.type === option.value && styles.chipActive,
                    option.value === 'income' && filters.type === 'income' && styles.chipIncome,
                    option.value === 'expense' && filters.type === 'expense' && styles.chipExpense,
                  ]}
                  onPress={() => setFilter('type', option.value as TransactionType | '')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.type === option.value && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado</Text>
            <View style={styles.chipContainer}>
              {STATUS_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.chip,
                    filters.status === option.value && styles.chipActive,
                  ]}
                  onPress={() => setFilter('status', option.value as TransactionStatus | '')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.status === option.value && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Período</Text>
            
            {/* Quick periods */}
            <View style={styles.quickPeriodsContainer}>
              {QUICK_PERIODS.map((period, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickPeriodChip}
                  onPress={() => handleQuickPeriod(period.getValue())}
                >
                  <Text style={styles.quickPeriodText}>{period.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date pickers */}
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setDatePickerMode('start')}
              >
                <Feather name="calendar" size={18} color={colors.gray[400]} />
                <View style={styles.datePickerText}>
                  <Text style={styles.dateLabel}>Desde</Text>
                  <Text style={styles.dateValue}>{formatDate(tempStartDate)}</Text>
                </View>
              </TouchableOpacity>

              <Feather name="arrow-right" size={18} color={colors.gray[300]} />

              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setDatePickerMode('end')}
              >
                <Feather name="calendar" size={18} color={colors.gray[400]} />
                <View style={styles.datePickerText}>
                  <Text style={styles.dateLabel}>Hasta</Text>
                  <Text style={styles.dateValue}>{formatDate(tempEndDate)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {(tempStartDate || tempEndDate) && (
              <TouchableOpacity
                style={styles.clearDates}
                onPress={() => {
                  setTempStartDate(undefined);
                  setTempEndDate(undefined);
                  setFilter('date_from', '');
                  setFilter('date_to', '');
                }}
              >
                <Feather name="x" size={14} color={colors.error.main} />
                <Text style={styles.clearDatesText}>Limpiar fechas</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Unit */}
          {units && units.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Unidad</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      !filters.unit_id && styles.chipActive,
                    ]}
                    onPress={() => setFilter('unit_id', '')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !filters.unit_id && styles.chipTextActive,
                      ]}
                    >
                      Todas
                    </Text>
                  </TouchableOpacity>
                  {units.map(unit => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[
                        styles.chip,
                        filters.unit_id === unit.id && styles.chipActive,
                      ]}
                      onPress={() => setFilter('unit_id', unit.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          filters.unit_id === unit.id && styles.chipTextActive,
                        ]}
                      >
                        {unit.unit_number}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Category */}
          {categories && categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      !filters.category_id && styles.chipActive,
                    ]}
                    onPress={() => setFilter('category_id', '')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !filters.category_id && styles.chipTextActive,
                      ]}
                    >
                      Todas
                    </Text>
                  </TouchableOpacity>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.chip,
                        filters.category_id === cat.id && styles.chipActive,
                      ]}
                      onPress={() => setFilter('category_id', cat.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          filters.category_id === cat.id && styles.chipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Amount Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rango de Monto</Text>
            <View style={styles.amountRow}>
              <Input
                placeholder="Mínimo"
                value={filters.amount_min?.toString() || ''}
                onChangeText={val => setFilter('amount_min', val ? parseFloat(val) : undefined)}
                keyboardType="decimal-pad"
                leftIcon={<Text style={styles.currencySymbol}>$</Text>}
                style={styles.amountInput}
              />
              <Text style={styles.amountSeparator}>a</Text>
              <Input
                placeholder="Máximo"
                value={filters.amount_max?.toString() || ''}
                onChangeText={val => setFilter('amount_max', val ? parseFloat(val) : undefined)}
                keyboardType="decimal-pad"
                leftIcon={<Text style={styles.currencySymbol}>$</Text>}
                style={styles.amountInput}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleApply}
          >
            Aplicar Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
        </View>

        {/* Date Picker Modal */}
        {datePickerMode && (
          <DateTimePicker
            value={
              datePickerMode === 'start'
                ? tempStartDate || new Date()
                : tempEndDate || new Date()
            }
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  closeButton: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  resetText: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  chipActive: {
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.main,
  },
  chipIncome: {
    backgroundColor: colors.success.light,
    borderColor: colors.success.main,
  },
  chipExpense: {
    backgroundColor: colors.error.light,
    borderColor: colors.error.main,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  chipTextActive: {
    color: colors.primary.dark,
  },
  quickPeriodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  quickPeriodChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.light,
  },
  quickPeriodText: {
    fontSize: fontSize.xs,
    color: colors.primary.dark,
    fontWeight: fontWeight.medium,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  datePicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  datePickerText: {
    flex: 1,
  },
  dateLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  dateValue: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  clearDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  clearDatesText: {
    fontSize: fontSize.xs,
    color: colors.error.main,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  amountInput: {
    flex: 1,
  },
  amountSeparator: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  currencySymbol: {
    fontSize: fontSize.base,
    color: colors.gray[500],
    fontWeight: fontWeight.medium,
  },
  footer: {
    padding: spacing[4],
    paddingBottom: spacing[6],
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
});

export default FilterPanel;
