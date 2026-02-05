/**
 * Pantalla de Gastos del Condominio
 * Muestra gastos generales con filtro por defecto al mes actual y Detalle Modal
 * CORREGIDO: Modal de comprobante a pantalla completa (Full Screen)
 */

import React, { useState, useCallback, useMemo } from 'react';
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
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useCondominiumExpenses } from '../../hooks/useCondominiumExpenses';
import { useCategories } from '../../hooks/useCategories';
import { useAuthStore } from '../../store/authStore';
import { 
  formatCurrency, 
  formatDateShort, 
  formatDate,
  formatFiscalPeriod, 
  getFiscalPeriods,
  getCurrentFiscalPeriod 
} from '../../utils/formatters';
import api from '../../shared/services/api/client';

// Categoría interna para generar deuda (no es gasto real de dinero)
const VIRTUAL_CATEGORY_NAME = 'Emisión de Cuota';

interface ExpenseItem {
  id: string;
  amount: number;
  description: string;
  category_name: string;
  category_id: string;
  transaction_date: string;
  fiscal_period: string;
  receipt_url?: string;
  receipt_thumbnail_url?: string;
  notes?: string;
}

// Componente de fila de gasto
const ExpenseRow = React.memo(({ 
  item, 
  onPress, 
  onViewReceipt 
}: { 
  item: ExpenseItem; 
  onPress: (item: ExpenseItem) => void;
  onViewReceipt: (item: ExpenseItem) => void;
}) => {
  const amount = parseFloat(item.amount?.toString() || '0');
  const hasReceipt = !!item.receipt_url;

  return (
    <TouchableOpacity 
      style={styles.expenseItem} 
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        <View style={styles.expenseIcon}>
          <Feather name="shopping-bag" size={18} color="#EF4444" />
        </View>
      </View>
      
      <View style={styles.expenseContent}>
        <Text style={styles.expenseCategory} numberOfLines={1}>
          {item.category_name || 'General'}
        </Text>
        <Text style={styles.expenseDescription} numberOfLines={1}>
          {item.description || 'Sin descripción'}
        </Text>
        <Text style={styles.expenseDate}>
          {formatDateShort(item.transaction_date)}
        </Text>
      </View>
      
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>
          {formatCurrency(amount)}
        </Text>
        {hasReceipt && (
          <TouchableOpacity 
            style={styles.receiptBadge}
            onPress={(e) => {
              e.stopPropagation();
              onViewReceipt(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="paperclip" size={12} color="#4F46E5" />
            <Text style={styles.receiptText}>Ver</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function CondominiumExpensesScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((state) => state.token); 

  // Configuración
  const [periodFilter, setPeriodFilter] = useState<string>(getCurrentFiscalPeriod());
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
  // Modales UI
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Estados de visualización
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<ExpenseItem | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseItem | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const fiscalPeriods = useMemo(() => getFiscalPeriods(12, 1), []);

  // Query API
  const queryFilters = useMemo(() => ({
    page: 1,
    page_size: 100,
    fiscal_period: periodFilter || undefined,
    category_id: categoryFilter || undefined,
  }), [periodFilter, categoryFilter]);

  const { data, isLoading, isError, refetch, isFetching } = useCondominiumExpenses(queryFilters);
  const { data: expenseCategories } = useCategories('expense');

  // Filtro de exclusión: Eliminamos "Emisión de Cuota" de la lista visual
  const filteredExpenses = useMemo(() => {
    const items = data?.items || [];
    return items.filter((item: ExpenseItem) => item.category_name !== VIRTUAL_CATEGORY_NAME);
  }, [data]);

  // Resumen real: Calculado sobre la lista filtrada
  const summary = useMemo(() => {
    const total = filteredExpenses.reduce((sum: number, t: any) => sum + parseFloat(t.amount?.toString() || '0'), 0);
    const withReceipt = filteredExpenses.filter((t: any) => t.receipt_url).length;
    return { total, count: filteredExpenses.length, withReceipt };
  }, [filteredExpenses]);

  // Filtrar categorías para el modal
  const visibleCategories = useMemo(() => {
    return expenseCategories?.filter((c: any) => c.name !== VIRTUAL_CATEGORY_NAME) || [];
  }, [expenseCategories]);

  const selectedCategory = visibleCategories.find((c: any) => c.id === categoryFilter);

  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handlePressExpense = (item: ExpenseItem) => {
    setSelectedExpenseDetail(item);
  };

  const getImageUrl = (path: string) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    
    let baseUrl = api.defaults.baseURL || '';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    baseUrl = baseUrl.replace(/\/v1$/, '').replace(/\/api$/, '').replace(/\/api\/v1$/, '');

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}/${cleanPath}`;
  };

  const handleViewReceipt = useCallback((item: ExpenseItem) => {
    if (!item.receipt_url) return;
    const fullUrl = getImageUrl(item.receipt_url);
    setReceiptImageUrl(fullUrl);
    setSelectedReceipt(item);
    setLoadingReceipt(true);
  }, []);

  const clearFilters = () => {
    setPeriodFilter('');
    setCategoryFilter('');
  };

  // Render Resumen
  const renderSummary = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>
            Total Gastos {periodFilter ? `(${formatFiscalPeriod(periodFilter)})` : '(Histórico)'}
          </Text>
          <Text style={styles.summaryAmount}>{formatCurrency(summary.total)}</Text>
        </View>
        <View style={styles.summaryIconBox}>
          <Feather name="trending-down" size={24} color="#EF4444" />
        </View>
      </View>
      <View style={styles.summaryFooter}>
        <View style={styles.summaryBadge}>
          <Feather name="list" size={12} color="#6B7280" />
          <Text style={styles.summaryBadgeText}>{summary.count} movimientos</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Feather name="file-text" size={12} color="#6B7280" />
          <Text style={styles.summaryBadgeText}>{summary.withReceipt} comprobantes</Text>
        </View>
      </View>
    </View>
  );

  // Render Filtros
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
        <TouchableOpacity style={[styles.filterChip, periodFilter ? styles.filterChipActive : null]} onPress={() => setShowPeriodModal(true)}>
          <Feather name="calendar" size={14} color={periodFilter ? '#4F46E5' : '#6B7280'} />
          <Text style={[styles.filterText, periodFilter ? styles.filterTextActive : null]}>
            {periodFilter ? formatFiscalPeriod(periodFilter) : 'Todos los periodos'}
          </Text>
          <Feather name="chevron-down" size={14} color={periodFilter ? '#4F46E5' : '#6B7280'} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.filterChip, categoryFilter ? styles.filterChipActive : null]} onPress={() => setShowCategoryModal(true)}>
          <Feather name="tag" size={14} color={categoryFilter ? '#4F46E5' : '#6B7280'} />
          <Text style={[styles.filterText, categoryFilter ? styles.filterTextActive : null]}>
            {selectedCategory?.name || 'Categoría'}
          </Text>
          <Feather name="chevron-down" size={14} color={categoryFilter ? '#4F46E5' : '#6B7280'} />
        </TouchableOpacity>

        {(periodFilter || categoryFilter) && (
          <TouchableOpacity style={styles.clearChip} onPress={clearFilters}>
            <Feather name="x" size={14} color="#EF4444" />
            <Text style={styles.clearText}>Ver todo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={{flex: 1, alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Gastos del Condominio</Text>
          <Text style={styles.headerSubtitle}>Transparencia Financiera</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {renderFilters()}

      <FlatList
        data={filteredExpenses}
        renderItem={({ item }) => (
          <ExpenseRow 
            item={item} 
            onPress={handlePressExpense} 
            onViewReceipt={handleViewReceipt}
          />
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSummary}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} colors={['#4F46E5']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Sin gastos registrados</Text>
            <Text style={styles.emptyText}>
              {periodFilter ? `No hay gastos reales en ${formatFiscalPeriod(periodFilter)}` : 'El historial de gastos está vacío'}
            </Text>
          </View>
        }
      />

      {/* Modales de Filtros */}
      <Modal visible={showPeriodModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPeriodModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Período</Text>
            <TouchableOpacity onPress={() => setShowPeriodModal(false)}><Feather name="x" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <TouchableOpacity style={styles.modalOption} onPress={() => { setPeriodFilter(''); setShowPeriodModal(false); }}>
              <Text style={[styles.modalOptionText, !periodFilter && styles.textSelected]}>Todos los periodos</Text>
              {!periodFilter && <Feather name="check" size={20} color="#4F46E5" />}
            </TouchableOpacity>
            {fiscalPeriods.map(period => (
              <TouchableOpacity key={period} style={styles.modalOption} onPress={() => { setPeriodFilter(period); setShowPeriodModal(false); }}>
                <Text style={[styles.modalOptionText, periodFilter === period && styles.textSelected]}>{formatFiscalPeriod(period)}</Text>
                {periodFilter === period && <Feather name="check" size={20} color="#4F46E5" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showCategoryModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCategoryModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar por Categoría</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}><Feather name="x" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <TouchableOpacity style={styles.modalOption} onPress={() => { setCategoryFilter(''); setShowCategoryModal(false); }}>
              <Text style={[styles.modalOptionText, !categoryFilter && styles.textSelected]}>Todas las categorías</Text>
              {!categoryFilter && <Feather name="check" size={20} color="#4F46E5" />}
            </TouchableOpacity>
            {visibleCategories.map((cat: any) => (
              <TouchableOpacity key={cat.id} style={styles.modalOption} onPress={() => { setCategoryFilter(cat.id); setShowCategoryModal(false); }}>
                <Text style={[styles.modalOptionText, categoryFilter === cat.id && styles.textSelected]}>{cat.name}</Text>
                {categoryFilter === cat.id && <Feather name="check" size={20} color="#4F46E5" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal DETALLE (Información) */}
      <Modal visible={!!selectedExpenseDetail} transparent animationType="fade" onRequestClose={() => setSelectedExpenseDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            {selectedExpenseDetail && (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailIcon}>
                    <Feather name="shopping-bag" size={24} color="#EF4444" />
                  </View>
                  <TouchableOpacity onPress={() => setSelectedExpenseDetail(null)} style={styles.closeButton}>
                    <Feather name="x" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailAmount}>{formatCurrency(parseFloat(selectedExpenseDetail.amount?.toString() || '0'))}</Text>
                  <Text style={styles.detailCategory}>{selectedExpenseDetail.category_name || 'Sin Categoría'}</Text>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Concepto</Text>
                    <Text style={styles.detailValue}>{selectedExpenseDetail.description}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedExpenseDetail.transaction_date)}</Text>
                  </View>
                  {selectedExpenseDetail.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notas</Text>
                      <Text style={styles.detailValue}>{selectedExpenseDetail.notes}</Text>
                    </View>
                  )}
                  {selectedExpenseDetail.receipt_url && (
                    <TouchableOpacity style={styles.viewReceiptButton} onPress={() => handleViewReceipt(selectedExpenseDetail)}>
                      <Feather name="image" size={20} color="white" />
                      <Text style={styles.viewReceiptText}>Ver Comprobante</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ==========================================================
          MODAL DE IMAGEN A PANTALLA COMPLETA (FULL SCREEN)
         ========================================================== */}
      <Modal 
        visible={!!selectedReceipt} 
        transparent 
        animationType="fade" 
        statusBarTranslucent={true} // Oculta barra de estado tras el modal
        onRequestClose={() => { setSelectedReceipt(null); setReceiptImageUrl(null); }}
      >
        <View style={styles.modalBackdrop}>
          {/* Botón Cerrar Flotante */}
          <TouchableOpacity 
            style={styles.modalClose} 
            onPress={() => { setSelectedReceipt(null); setReceiptImageUrl(null); }}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
          >
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>

          {/* Loader Centrado */}
          {loadingReceipt && (
            <ActivityIndicator size="large" color="#4F46E5" style={{ position: 'absolute', zIndex: 10 }} />
          )}

          {/* Imagen Full Screen */}
          {receiptImageUrl ? (
            <Image 
              source={{ 
                uri: receiptImageUrl,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
              }} 
              style={styles.fullImage} 
              resizeMode="contain"
              onLoadStart={() => setLoadingReceipt(true)}
              onLoadEnd={() => setLoadingReceipt(false)}
              onError={(e) => {
                setLoadingReceipt(false);
                console.log('Error cargando imagen:', e.nativeEvent.error);
              }}
            />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Feather name="image" size={48} color="#6B7280" />
              <Text style={{ color: '#9CA3AF', marginTop: 10 }}>Imagen no disponible</Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280' },
  filtersContainer: { backgroundColor: 'white', paddingBottom: 12 },
  filtersScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  filterText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#4F46E5' },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FEF2F2' },
  clearText: { fontSize: 13, color: '#EF4444', fontWeight: '500' },
  summaryCard: { margin: 16, padding: 16, backgroundColor: 'white', borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: '800', color: '#EF4444' },
  summaryIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  summaryFooter: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  summaryBadgeText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  list: { paddingBottom: 24 },
  expenseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  iconWrapper: { marginRight: 12 },
  expenseIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  expenseContent: { flex: 1, marginRight: 8 },
  expenseCategory: { fontSize: 12, color: '#6B7280', marginBottom: 2, fontWeight: '500', textTransform: 'uppercase' },
  expenseDescription: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  expenseDate: { fontSize: 12, color: '#9CA3AF' },
  expenseRight: { alignItems: 'flex-end', gap: 6 },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  receiptBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  receiptText: { fontSize: 11, color: '#4F46E5', fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalScroll: { padding: 16 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOptionText: { fontSize: 16, color: '#374151' },
  textSelected: { color: '#4F46E5', fontWeight: '600' },
  detailCard: { backgroundColor: 'white', borderRadius: 24, width: '100%', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  detailIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  closeButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  detailContent: { alignItems: 'center' },
  detailAmount: { fontSize: 32, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  detailCategory: { fontSize: 14, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  detailDivider: { width: '100%', height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  detailRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  detailLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#374151', fontWeight: '600', flex: 1, textAlign: 'right' },
  viewReceiptButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4F46E5', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, marginTop: 12, gap: 8, width: '100%' },
  viewReceiptText: { color: 'white', fontWeight: '700', fontSize: 14 },
  
  // ====================
  // ESTILOS MODAL FULL SCREEN
  // ====================
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: '#000', // Fondo negro total
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalClose: { 
    position: 'absolute', 
    top: 50, // Ajuste para SafeArea superior
    right: 20, 
    zIndex: 20,
    backgroundColor: 'rgba(50,50,50,0.6)', // Círculo semitransparente
    padding: 8,
    borderRadius: 20
  },
  fullImage: { 
    width: '100%', 
    height: '100%' 
  },
});
