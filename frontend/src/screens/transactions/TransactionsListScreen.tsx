/**
 * Pantalla de Lista de Movimientos - Diseño Neo-Bank
 * Adaptada para Residentes (Tarjeta expandida) vs Admin (Carrusel)
 */

import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatDateShort, formatFiscalPeriod, getFiscalPeriods, getCurrentFiscalPeriod } from '../../utils/formatters';

type FilterType = 'all' | 'income' | 'expense';

// --- Helpers para Fechas (Versión Segura sin Timezones) ---
const getMonthDateRange = (period: string) => {
  if (!period) return { from: undefined, to: undefined };
  const [year, month] = period.split('-');
  
  // Obtenemos el último día del mes usando JS puro solo para saber si es 28, 30 o 31
  // (El día 0 del mes siguiente es el último día del mes actual)
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  
  // Construcción manual del string para evitar desfases de zona horaria (UTC)
  // Aseguramos que el día de inicio sea siempre el 01
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${lastDay}`
  };
};

// Componente de Fila
const TransactionRow = React.memo(({ item, onPress }: { item: any, onPress: (t: any) => void }) => {
  const amount = parseFloat(item.amount?.toString() || '0');
  const isIncome = item.type === 'income';
  const isLate = item.is_late_payment;
  const isAdvance = item.is_advance_payment;

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={[styles.iconBox, isIncome ? styles.iconIncome : styles.iconExpense]}>
        <Feather name={isIncome ? "arrow-down-left" : "arrow-up-right"} size={18} color={isIncome ? "#059669" : "#DC2626"} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.categoryName} numberOfLines={1}>{item.category_name || 'General'}</Text>
          <Text style={[styles.amount, isIncome ? styles.textIncome : styles.textExpense]}>
            {isIncome ? '+' : '-'}{formatCurrency(amount)}
          </Text>
        </View>
        <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDateShort(item.transaction_date)}</Text>
          <View style={{flexDirection:'row', gap:4, alignItems: 'center'}}>
            {item.unit_number && (
              <View style={styles.unitBadge}>
                <Feather name="home" size={10} color="#6B7280" />
                <Text style={styles.unitText}>{item.unit_number}</Text>
              </View>
            )}
            {isLate && (
              <View style={styles.lateBadge}>
                <Text style={styles.lateText}>Atrasado</Text>
              </View>
            )}
            {isAdvance && (
              <View style={styles.advanceBadge}>
                <Text style={styles.advanceText}>Adelantado</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function TransactionsListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuthStore();
  
  // Detectar si es residente
  const isResident = user?.role === 'resident';

  // Filtros
  const [typeFilter, setTypeFilter] = useState<FilterType>((route.params?.filterType as FilterType) || 'all');
  const [periodFilter, setPeriodFilter] = useState<string>(getCurrentFiscalPeriod());
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'normal' | 'late' | 'advance'>('normal');

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const fiscalPeriods = useMemo(() => getFiscalPeriods(12, 1), []);
  const { data: categories } = useCategories(typeFilter === 'all' ? undefined : typeFilter);

  const queryParams = useMemo(() => {
    const { from, to } = getMonthDateRange(periodFilter);
    return {
      page: 1,
      limit: 100,
      type: typeFilter === 'all' ? undefined : typeFilter,
      from_date: from,
      to_date: to,
      category_id: categoryFilter || undefined,
      is_late: filterMode === 'late' ? true : undefined,
      is_advance: filterMode === 'advance' ? true : undefined,
    };
  }, [typeFilter, periodFilter, categoryFilter, filterMode]);

  const { data, isLoading, refetch, isFetching } = useTransactions(queryParams);

  // Extracción de datos
  const summaryRaw = data?.summary || (data as any)?.data?.summary;
  
  const summary = useMemo(() => {
    const raw = summaryRaw || {};
    const totalIncome = parseFloat(raw.total_income || 0);
    const advanceAmount = parseFloat(raw.advance_payment_amount || 0);
    const lateAmount = parseFloat(raw.late_payment_amount || 0);
    
    const normalAmount = filterMode === 'normal' 
      ? Math.max(0, totalIncome - advanceAmount - lateAmount)
      : 0;

    return {
      total_income: totalIncome,
      total_expense: parseFloat(raw.total_expense || 0),
      net_balance: parseFloat(raw.net_balance || 0),
      advance_payment_amount: advanceAmount,
      late_payment_amount: lateAmount,
      normal_payment_amount: normalAmount,
      late_payment_count: raw.late_payment_count || 0,
      advance_payment_count: raw.advance_payment_count || 0,
    };
  }, [summaryRaw, filterMode]);

  const transactionsList = data?.items || (data as any)?.data || [];

  const clearFilters = () => {
    setTypeFilter('all');
    setPeriodFilter('');
    setCategoryFilter('');
    setFilterMode('normal');
  };

  const handleAddTransaction = () => {
    navigation.navigate('TransactionForm'); 
  };

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      
      {/* ✅ LÓGICA DE VISUALIZACIÓN DIFERENCIADA 
        - Residente: Tarjeta Única Expandida (Width 100%)
        - Admin: Carrusel de Tarjetas (ScrollView Horizontal)
      */}
      {isResident ? (
        <View style={styles.singleCardContainer}>
          <View style={[styles.card, styles.cardExpanded]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="check-circle" size={20} color="#10B981" />
              </View>
              <Text style={styles.cardLabel}>Total de Mis Pagos</Text>
            </View>
            <Text style={styles.cardValueLarge}>{formatCurrency(summary.total_income)}</Text>
          </View>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsScroll}>
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow]}>
              <View style={[styles.cardIcon, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="arrow-down-left" size={18} color="#10B981" />
              </View>
              <Text style={styles.cardLabel}>Ingresos</Text>
            </View>
            <Text style={styles.cardValue}>{formatCurrency(summary.total_income)}</Text>
          </View>

          <View style={styles.card}>
            <View style={[styles.cardHeaderRow]}>
              <View style={[styles.cardIcon, { backgroundColor: '#FEF2F2' }]}>
                <Feather name="arrow-up-right" size={18} color="#EF4444" />
              </View>
              <Text style={styles.cardLabel}>Gastos</Text>
            </View>
            <Text style={styles.cardValue}>{formatCurrency(summary.total_expense)}</Text>
          </View>

          <View style={styles.card}>
            <View style={[styles.cardHeaderRow]}>
              <View style={[styles.cardIcon, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="dollar-sign" size={18} color="#4F46E5" />
              </View>
              <Text style={styles.cardLabel}>Balance</Text>
            </View>
            <Text style={[styles.cardValue, { color: summary.net_balance >= 0 ? '#4F46E5' : '#EF4444' }]}>
              {formatCurrency(summary.net_balance)}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Desglose de Cobranza (Visible para todos) */}
      {(typeFilter !== 'expense' && filterMode === 'normal') && (
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownTitle}>
            {isResident ? 'Desglose de mis pagos' : 'Desglose de Ingresos'}
          </Text>
          <View style={styles.breakdownRow}>
            <View style={styles.miniStat}>
              <View style={styles.miniHeader}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.miniLabel}>Al Corriente</Text>
              </View>
              <Text style={styles.miniValue}>{formatCurrency(summary.normal_payment_amount)}</Text>
            </View>
            <View style={styles.vDivider} />
            <TouchableOpacity 
              style={[styles.miniStat, filterMode === 'late' && styles.miniStatActive]}
              onPress={() => setFilterMode('late')}
            >
              <View style={styles.miniHeader}>
                <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.miniLabel, filterMode === 'late' && styles.textActive]}>Atrasados</Text>
              </View>
              <Text style={styles.miniValue}>{formatCurrency(summary.late_payment_amount)}</Text>
            </TouchableOpacity>
            <View style={styles.vDivider} />
            <TouchableOpacity 
              style={[styles.miniStat, filterMode === 'advance' && styles.miniStatActive]}
              onPress={() => setFilterMode('advance')}
            >
              <View style={styles.miniHeader}>
                <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.miniLabel, filterMode === 'advance' && styles.textActive]}>Adelantados</Text>
              </View>
              <Text style={styles.miniValue}>{formatCurrency(summary.advance_payment_amount)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Banner de Filtro Activo */}
      {filterMode !== 'normal' && (
        <TouchableOpacity style={styles.activeFilterBanner} onPress={() => setFilterMode('normal')}>
          <Text style={styles.activeFilterText}>
            Filtrando solo: {filterMode === 'late' ? 'Pagos Atrasados' : 'Pagos Adelantados'}
          </Text>
          <Feather name="x" size={16} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>{isResident ? 'Historial de Pagos' : 'Movimientos'}</Text>
          <Text style={styles.headerSubtitle}>
            {periodFilter ? formatFiscalPeriod(periodFilter) : 'Histórico General'}
          </Text>
        </View>
        <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
          <Feather name="refresh-cw" size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          
          {!isResident && (
            <View style={styles.pillGroup}>
              <TouchableOpacity onPress={() => setTypeFilter('all')} style={[styles.pill, typeFilter === 'all' && styles.pillActive]}>
                <Text style={[styles.pillText, typeFilter === 'all' && styles.pillTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTypeFilter('income')} style={[styles.pill, typeFilter === 'income' && styles.pillActive]}>
                <Text style={[styles.pillText, typeFilter === 'income' && styles.pillTextActive]}>Ingresos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTypeFilter('expense')} style={[styles.pill, typeFilter === 'expense' && styles.pillActive]}>
                <Text style={[styles.pillText, typeFilter === 'expense' && styles.pillTextActive]}>Gastos</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[styles.filterChip, !!periodFilter && styles.filterChipActive]} onPress={() => setShowPeriodModal(true)}>
            <Text style={[styles.filterChipText, !!periodFilter && styles.filterChipTextActive]}>
              {periodFilter ? formatFiscalPeriod(periodFilter) : 'Periodo'}
            </Text>
            <Feather name="chevron-down" size={14} color={periodFilter ? 'white' : '#6B7280'} />
          </TouchableOpacity>

          {!isResident && (
            <TouchableOpacity style={[styles.filterChip, !!categoryFilter && styles.filterChipActive]} onPress={() => setShowCategoryModal(true)}>
              <Text style={[styles.filterChipText, !!categoryFilter && styles.filterChipTextActive]}>
                Categoría
              </Text>
              <Feather name="chevron-down" size={14} color={categoryFilter ? 'white' : '#6B7280'} />
            </TouchableOpacity>
          )}

        </ScrollView>
      </View>

      {/* Lista */}
      <FlatList
        data={transactionsList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow item={item} onPress={(t) => navigation.navigate('TransactionDetail', { transactionId: t.id })} />}
        ListHeaderComponent={renderSummary}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} colors={['#4F46E5']} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Feather name="list" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Sin movimientos</Text>
              <Text style={styles.emptySubtitle}>No hay transacciones con los filtros actuales</Text>
            </View>
          ) : <ActivityIndicator style={{ marginTop: 20 }} color="#4F46E5" />
        }
      />

      {!isResident && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={handleAddTransaction}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Modales */}
      <Modal visible={showPeriodModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPeriodModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar por Periodo</Text>
            <TouchableOpacity onPress={() => setShowPeriodModal(false)}><Feather name="x" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView>
            <TouchableOpacity style={[styles.modalOption, !periodFilter && styles.modalOptionSelected]} onPress={() => { setPeriodFilter(''); setShowPeriodModal(false); }}>
              <Text style={[styles.modalOptionText, !periodFilter && styles.modalOptionTextSelected]}>Histórico Completo</Text>
              {!periodFilter && <Feather name="check" size={18} color="#4F46E5" />}
            </TouchableOpacity>
            {fiscalPeriods.map(p => (
              <TouchableOpacity key={p} style={[styles.modalOption, periodFilter === p && styles.modalOptionSelected]} onPress={() => { setPeriodFilter(p); setShowPeriodModal(false); }}>
                <Text style={[styles.modalOptionText, periodFilter === p && styles.modalOptionTextSelected]}>{formatFiscalPeriod(p)}</Text>
                {periodFilter === p && <Feather name="check" size={18} color="#4F46E5" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showCategoryModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar por Categoría</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}><Feather name="x" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView>
            <TouchableOpacity style={[styles.modalOption, !categoryFilter && styles.modalOptionSelected]} onPress={() => { setCategoryFilter(''); setShowCategoryModal(false); }}>
              <Text style={[styles.modalOptionText, !categoryFilter && styles.modalOptionTextSelected]}>Todas</Text>
              {!categoryFilter && <Feather name="check" size={18} color="#4F46E5" />}
            </TouchableOpacity>
            {categories?.map((c: any) => (
              <TouchableOpacity key={c.id} style={[styles.modalOption, categoryFilter === c.id && styles.modalOptionSelected]} onPress={() => { setCategoryFilter(c.id); setShowCategoryModal(false); }}>
                <Text style={[styles.modalOptionText, categoryFilter === c.id && styles.modalOptionTextSelected]}>{c.name}</Text>
                {categoryFilter === c.id && <Feather name="check" size={18} color="#4F46E5" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitleBox: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280' },
  clearBtn: { padding: 8, marginRight: -8 },
  
  // Summary Layouts
  summaryContainer: { marginBottom: 16 },
  
  // Estilo ADMIN (Carrusel)
  cardsScroll: { paddingHorizontal: 16, gap: 12, paddingVertical: 16 },
  
  // Estilo RESIDENTE (Tarjeta Única Expandida)
  singleCardContainer: { paddingHorizontal: 16, paddingVertical: 16 },
  cardExpanded: { width: '100%', height: 120, justifyContent: 'center', paddingHorizontal: 24 },
  cardValueLarge: { fontSize: 35, fontWeight: '800', color: '#1F2937', marginTop: 5, textAlign: 'center' },

  // Tarjeta Base
  card: { 
    backgroundColor: 'white', borderRadius: 20, padding: 16, minWidth: 150, 
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    justifyContent: 'space-between', height: 100
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  cardValue: { fontSize: 20, fontWeight: '800', color: '#1F2937' },

  // Breakdown
  breakdownContainer: { marginHorizontal: 16, backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  breakdownTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vDivider: { width: 1, height: 30, backgroundColor: '#F3F4F6', alignSelf: 'center' },
  miniStat: { alignItems: 'center', padding: 4, flex: 1 },
  miniStatActive: { backgroundColor: '#F3F4F6', borderRadius: 8 },
  miniHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  miniLabel: { fontSize: 11, color: '#6B7280' },
  textActive: { fontWeight: '700', color: '#4F46E5' },
  miniValue: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  
  activeFilterBanner: { marginHorizontal: 16, backgroundColor: '#4F46E5', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeFilterText: { color: 'white', fontWeight: '600', fontSize: 13 },

  // Filters
  filterRow: { paddingBottom: 12, backgroundColor: 'white' },
  pillGroup: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 20, padding: 2, marginRight: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
  pillActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  pillText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  pillTextActive: { color: '#111827', fontWeight: '600' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterChipText: { fontSize: 13, color: '#6B7280' },
  filterChipTextActive: { color: 'white', fontWeight: '600' },

  // List
  list: { paddingBottom: 80 },
  row: { flexDirection: 'row', padding: 16, backgroundColor: 'white', marginHorizontal: 16, marginBottom: 8, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconIncome: { backgroundColor: '#ECFDF5' },
  iconExpense: { backgroundColor: '#FEF2F2' },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  amount: { fontSize: 14, fontWeight: '700' },
  textIncome: { color: '#059669' },
  textExpense: { color: '#DC2626' },
  description: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: '#9CA3AF' },
  unitBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  unitText: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  lateBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  lateText: { fontSize: 9, color: '#DC2626', fontWeight: '700' },
  advanceBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  advanceText: { fontSize: 9, color: '#4F46E5', fontWeight: '700' },

  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  modalOptionSelected: { backgroundColor: '#F5F3FF' },
  modalOptionText: { fontSize: 16, color: '#374151' },
  modalOptionTextSelected: { color: '#4F46E5', fontWeight: '600' },
  
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
