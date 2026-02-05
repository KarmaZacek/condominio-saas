/**
 * Pantalla de Estado Financiero - Diseño Premium Neo-Bank
 * Muestra el balance contable con remanentes y desglose detallado.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  StatusBar,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useFinancialStatus } from '../../hooks/useFinancialStatus';
import { formatCurrency, formatFiscalPeriod, getFiscalPeriods, getCurrentFiscalPeriod } from '../../utils/formatters';

const { width } = Dimensions.get('window');

// --- HELPERS DE AGRUPACIÓN (Locales y Seguros) ---

const groupAdvancesByUnit = (items: any[]) => {
  if (!items || !Array.isArray(items)) return {};
  const grouped: Record<string, { total: number; advances: any[] }> = {};
  
  items.forEach(item => {
    const unit = item.unit_number ? String(item.unit_number) : 'Sin Asignar';
    if (!grouped[unit]) {
      grouped[unit] = { total: 0, advances: [] };
    }
    const amount = parseFloat(item.amount?.toString() || '0');
    grouped[unit].total += amount;
    grouped[unit].advances.push(item);
  });
  return grouped;
};

const groupLatePaymentsByUnit = (items: any[]) => {
  if (!items || !Array.isArray(items)) return {};
  const grouped: Record<string, { total: number; payments: any[] }> = {};
  
  items.forEach(item => {
    const unit = item.unit_number ? String(item.unit_number) : 'Sin Asignar';
    if (!grouped[unit]) {
      grouped[unit] = { total: 0, payments: [] };
    }
    const amount = parseFloat(item.amount?.toString() || '0');
    grouped[unit].total += amount;
    grouped[unit].payments.push(item);
  });
  return grouped;
};

// --- COMPONENTE PRINCIPAL ---

export default function FinancialStatusScreen() {
  const navigation = useNavigation();
  
  // Estado
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentFiscalPeriod());
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('breakdown');

  // Estados para Modales de Detalle
  const [showAdvanceDetail, setShowAdvanceDetail] = useState(false);
  const [showLateDetail, setShowLateDetail] = useState(false);
  
  const availablePeriods = useMemo(() => getFiscalPeriods(12, 6), []);
  
  const { 
    data: financialStatus, 
    isLoading, 
    refetch,
    isRefetching 
  } = useFinancialStatus(selectedPeriod);
  
  // Procesamiento de datos
  const advancesByUnit = useMemo(() => {
    if (!financialStatus?.advance_reserve_detail) return {};
    return groupAdvancesByUnit(financialStatus.advance_reserve_detail);
  }, [financialStatus]);
  
  const latePaymentsByUnit = useMemo(() => {
    if (!financialStatus?.late_payments_received) return {};
    return groupLatePaymentsByUnit(financialStatus.late_payments_received);
  }, [financialStatus]);

  const hasAdvances = Object.keys(advancesByUnit).length > 0;
  const hasLatePayments = Object.keys(latePaymentsByUnit).length > 0;
  
  const toggleSection = useCallback((section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  }, []);

  // --- RENDERS ---

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Feather name="arrow-left" size={24} color="#1F2937" />
      </TouchableOpacity>
      
      <View style={styles.headerTitleBox}>
        <Text style={styles.headerTitle}>Estado Financiero</Text>
        <TouchableOpacity 
          style={styles.periodPill}
          onPress={() => setShowPeriodPicker(true)}
          activeOpacity={0.7}
        >
          <Feather name="calendar" size={14} color="#4F46E5" />
          <Text style={styles.periodText}>{formatFiscalPeriod(selectedPeriod)}</Text>
          <Feather name="chevron-down" size={14} color="#4F46E5" />
        </TouchableOpacity>
      </View>
      
      <View style={{ width: 40 }} />
    </View>
  );

  // === HERO CARD (Estilo Neo-Bank Oscuro) ===
  const renderBalanceCard = () => {
    if (!financialStatus) return null;
    const { totals } = financialStatus;
    
    return (
      <View style={styles.heroCard}>
        {/* Cabecera Principal */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>SALDO DISPONIBLE REAL</Text>
          <View style={[styles.trendBadge, { backgroundColor: totals.available_balance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
            <Feather 
              name={totals.available_balance >= 0 ? "trending-up" : "trending-down"} 
              size={20}
              color="white" 
            />
          </View>
        </View>

        <Text style={styles.heroBalance}>
          {formatCurrency(totals.available_balance)}
        </Text>
        
        <Text style={styles.heroSubtext}>
          Cierre estimado de {financialStatus.period_label}
        </Text>
        
        {/* Tabla de Cálculo Contable (Estilo Glassmorphism) */}
        <View style={styles.mathContainer}>
          
          {/* 1. Saldo Inicial */}
          <View style={styles.mathRow}>
            <View style={styles.mathLabelBox}>
              <View style={[styles.mathIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Feather name="corner-down-right" size={12} color="white" />
              </View>
              <Text style={styles.mathLabel}>Saldo Inicial (R)</Text>
            </View>
            <Text style={styles.mathValue}>{formatCurrency(totals.initial_balance)}</Text>
          </View>

          {/* 2. Ingresos del Mes */}
          <View style={styles.mathRow}>
            <View style={styles.mathLabelBox}>
              <View style={[styles.mathIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <Feather name="plus" size={12} color="#4ADE80" />
              </View>
              <Text style={styles.mathLabel}>Ingresos del Mes</Text>
            </View>
            <Text style={[styles.mathValue, { color: '#4ADE80' }]}>
              + {formatCurrency(totals.total_income_cash)}
            </Text>
          </View>

          {/* 3. Gastos del Mes */}
          <View style={styles.mathRow}>
            <View style={styles.mathLabelBox}>
              <View style={[styles.mathIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Feather name="minus" size={12} color="#F87171" />
              </View>
              <Text style={styles.mathLabel}>Gastos del Mes</Text>
            </View>
            <Text style={[styles.mathValue, { color: '#F87171' }]}>
              - {formatCurrency(totals.total_expenses)}
            </Text>
          </View>

          <View style={styles.mathDivider} />

          {/* 4. Saldo Final en Caja */}
          <View style={styles.mathRow}>
            <Text style={[styles.mathLabel, { fontWeight: '700', color: 'white' }]}>Saldo en Caja</Text>
            <Text style={[styles.mathValue, { fontWeight: '700', color: 'white' }]}>
              {formatCurrency(totals.final_balance)}
            </Text>
          </View>
          
          {/* 5. Reserva */}
          {totals.advance_reserve > 0 && (
            <View style={[styles.mathRow, { marginTop: 4 }]}>
              <View style={styles.mathLabelBox}>
                <Feather name="lock" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={[styles.mathLabel, { fontSize: 14, fontStyle: 'italic', opacity: 0.7 }]}>
                  Menos Adelantos
                </Text>
              </View>
              <Text style={[styles.mathValue, { fontSize: 14, color: '#FCD34D', opacity: 0.9 }]}>
                - {formatCurrency(totals.advance_reserve)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderIncomeBreakdown = () => {
    if (!financialStatus) return null;
    const { income_breakdown } = financialStatus;
    const isOpen = expandedSection === 'breakdown';

    const items = [
      {
        label: 'Cuotas del Mes',
        desc: 'Pagos corrientes',
        amount: income_breakdown.normal_fees,
        color: '#10B981',
        bg: '#ECFDF5',
        icon: 'check',
        action: null
      },
      {
        label: 'Recuperación',
        desc: 'Deuda anterior cobrada',
        amount: income_breakdown.late_fees_received,
        color: '#F59E0B',
        bg: '#FFFBEB',
        icon: 'clock',
        action: hasLatePayments ? () => setShowLateDetail(true) : null
      },
      {
        label: 'Adelantos Recibidos',
        desc: 'Para meses futuros',
        amount: income_breakdown.advances_received,
        color: '#6366F1',
        bg: '#EEF2FF',
        icon: 'layers',
        action: hasAdvances ? () => setShowAdvanceDetail(true) : null
      }
    ];

    return (
      <View style={styles.sectionCard}>
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('breakdown')}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Feather name="pie-chart" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.sectionTitle}>Composición de Ingresos</Text>
          </View>
          <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.sectionBody}>
            {items.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.rowItem}
                onPress={item.action || undefined}
                disabled={!item.action}
                activeOpacity={0.6}
              >
                <View style={[styles.rowIcon, { backgroundColor: item.bg }]}>
                  <Feather name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowDesc}>{item.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
                  {item.action && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Text style={styles.actionText}>Ver detalle</Text>
                      <Feather name="chevron-right" size={12} color="#6366F1" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderAdvanceReserve = () => {
    if (!financialStatus || financialStatus.advance_reserve_summary.length === 0) return null;
    const isOpen = expandedSection === 'reserve';

    return (
      <View style={styles.sectionCard}>
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('reserve')}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Feather name="lock" size={20} color="#D97706" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Reserva de Adelantos</Text>
              <Text style={styles.sectionSubtitle}>
                {formatCurrency(financialStatus.totals.advance_reserve)} retenidos
              </Text>
            </View>
          </View>
          <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.sectionBody}>
            <Text style={styles.bodyIntro}>
              Dinero cobrado pero que pertenece a meses futuros. No debe gastarse en este periodo.
            </Text>
            
            {financialStatus.advance_reserve_summary.map((item, idx) => (
              <View key={idx} style={styles.reserveRow}>
                <View style={styles.reserveDateBadge}>
                  <Text style={styles.reserveDateText}>{item.fiscal_period_label}</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '100%' }]} /> 
                  </View>
                </View>
                <Text style={styles.reserveAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
            
            {hasAdvances && (
              <TouchableOpacity 
                style={styles.viewDetailsBtn}
                onPress={() => setShowAdvanceDetail(true)}
              >
                <Text style={styles.viewDetailsText}>Ver desglose por vivienda</Text>
                <Feather name="arrow-right" size={16} color="#4F46E5" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // --- MODAL DE DETALLE ---
  const renderDetailModal = (
    visible: boolean, 
    onClose: () => void, 
    title: string, 
    data: any, 
    type: 'advance' | 'late'
  ) => {
    const unitKeys = Object.keys(data || {});
    
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeCircle}>
              <Feather name="x" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={unitKeys}
            keyExtractor={key => key}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            renderItem={({ item: unitNumber }) => {
              const unitData = data[unitNumber];
              if (!unitData) return null;

              const itemsList = type === 'advance' 
                ? (unitData.advances || [])
                : (unitData.payments || []);
              
              return (
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <View style={styles.unitBadge}>
                      <Feather name="home" size={14} color="#4F46E5" />
                      <Text style={styles.unitBadgeText}>{unitNumber}</Text>
                    </View>
                    <Text style={styles.detailCardTotal}>{formatCurrency(unitData.total)}</Text>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  {itemsList.map((detail: any, idx: number) => {
                    let periodLabel = 'Periodo Desconocido';
                    if (type === 'advance') {
                      periodLabel = detail.fiscal_period_label || detail.fiscal_period || 'N/A';
                    } else {
                      periodLabel = detail.fiscal_period 
                        ? formatFiscalPeriod(detail.fiscal_period) 
                        : 'Sin Periodo';
                    }

                    return (
                      <View key={idx} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{periodLabel}</Text>
                        <Text style={styles.detailAmount}>{formatCurrency(detail.amount)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Feather name="inbox" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>No hay registros para este periodo</Text>
              </View>
            }
          />
        </View>
      </Modal>
    );
  };

  // --- MODAL SELECTOR PERIODO ---
  const renderPeriodPicker = () => (
    <Modal visible={showPeriodPicker} animationType="fade" transparent onRequestClose={() => setShowPeriodPicker(false)}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Seleccionar Período</Text>
            <TouchableOpacity onPress={() => setShowPeriodPicker(false)}>
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {availablePeriods.map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.pickerOption, period === selectedPeriod && styles.pickerOptionSelected]}
                onPress={() => {
                  setSelectedPeriod(period);
                  setShowPeriodPicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, period === selectedPeriod && styles.pickerTextSelected]}>
                  {formatFiscalPeriod(period)}
                </Text>
                {period === selectedPeriod && <Feather name="check" size={20} color="#4F46E5" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      {renderHeader()}
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#4F46E5']} />}
      >
        {renderBalanceCard()}
        {renderIncomeBreakdown()}
        {renderAdvanceReserve()}
        
        <View style={styles.infoCard}>
          <Feather name="info" size={18} color="#6366F1" />
          <Text style={styles.infoText}>
            El saldo disponible real arrastra el remanente histórico y garantiza que los adelantos no se gasten antes de tiempo.
          </Text>
        </View>
      </ScrollView>
      
      {renderPeriodPicker()}
      
      {renderDetailModal(
        showAdvanceDetail, 
        () => setShowAdvanceDetail(false), 
        `Desglose de Adelantos (${formatFiscalPeriod(selectedPeriod)})`, 
        advancesByUnit, 
        'advance'
      )}
      
      {renderDetailModal(
        showLateDetail, 
        () => setShowLateDetail(false), 
        `Recuperación de Cartera (${formatFiscalPeriod(selectedPeriod)})`, 
        latePaymentsByUnit, 
        'late'
      )}
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#F9FAFB' 
  },
  backButton: { 
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', 
    justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 
  },
  headerTitleBox: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  periodPill: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8, 
    borderRadius: 24, marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  periodText: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },

  // === HERO CARD (NEO-BANK STYLE) ===
  heroCard: {
    backgroundColor: '#1b255f', // Índigo Oscuro
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  trendBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  
  heroBalance: { 
    fontSize: 40, 
    fontWeight: '800', 
    color: 'white', 
    letterSpacing: -1,
    marginBottom: 4
  },
  heroSubtext: { 
    color: 'rgba(255,255,255,0.6)', 
    fontSize: 13, 
    marginBottom: 24, 
    fontStyle: 'italic' 
  },

  // Math Table inside Hero
  mathContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  mathRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  mathLabelBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mathIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mathLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  mathValue: { fontSize: 15, fontWeight: '700', color: 'white' },
  mathDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },

  // Section Cards
  sectionCard: {
    backgroundColor: 'white', marginHorizontal: 20, marginBottom: 16, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  sectionHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 16 
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 },
  bodyIntro: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  
  // Rows
  rowItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  rowDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  actionText: { fontSize: 11, color: '#6366F1', fontWeight: '600' },

  // Reserve specifics
  reserveRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  reserveDateBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, width: 85, alignItems: 'center' },
  reserveDateText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, flex: 1, marginHorizontal: 12 },
  progressBarFill: { height: 8, backgroundColor: '#F59E0B', borderRadius: 4 },
  reserveAmount: { fontSize: 14, fontWeight: '700', color: '#1F2937', minWidth: 70, textAlign: 'right' },
  
  viewDetailsBtn: { 
    marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, backgroundColor: '#F5F3FF', borderRadius: 12 
  },
  viewDetailsText: { fontSize: 13, color: '#4F46E5', fontWeight: '700' },

  // Info
  infoCard: { 
    margin: 20, padding: 16, backgroundColor: '#EEF2FF', borderRadius: 16, 
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: '#C7D2FE'
  },
  infoText: { flex: 1, fontSize: 13, color: '#4338CA', lineHeight: 20 },

  // Detail Modal
  modalContainer: { flex: 1, backgroundColor: '#F3F4F6' },
  modalHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' 
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  
  detailCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  detailCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  unitBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  unitBadgeText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  detailCardTotal: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailAmount: { fontSize: 13, fontWeight: '600', color: '#374151' },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, color: '#9CA3AF', fontSize: 16 },

  // Picker Modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerContainer: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerTitle: { fontSize: 18, fontWeight: '700' },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  pickerOptionSelected: { backgroundColor: '#EEF2FF' },
  pickerOptionText: { fontSize: 16, color: '#374151' },
  pickerTextSelected: { color: '#4F46E5', fontWeight: '700' },
});
