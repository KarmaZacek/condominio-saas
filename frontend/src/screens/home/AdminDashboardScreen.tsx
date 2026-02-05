import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTransactions } from '../../hooks/useTransactions';
import { useUnits } from '../../hooks/useUnits';
import { useFinancialStatus } from '../../hooks/useFinancialStatus'; // ✅ IMPORTANTE: Nuevo Hook
import { formatCurrency, formatDateShort, getCurrentFiscalPeriod, formatFiscalPeriod } from '../../utils/formatters';

// Función para obtener rango de fechas del mes (para la lista de movimientos)
function getCurrentMonthDates() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    firstDay: formatDate(firstDay),
    lastDay: formatDate(lastDay)
  };
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const currentPeriod = getCurrentFiscalPeriod();
  
  const { firstDay, lastDay } = useMemo(() => getCurrentMonthDates(), []);

  // 1. Obtener Totales Financieros (Con Remanente Histórico)
  // Usamos el hook especializado que ya calcula el saldo inicial + flujo del mes
  const { 
    data: financialData,
    isLoading: loadingFinancials,
    refetch: refetchFinancials
  } = useFinancialStatus(currentPeriod);

  // 2. Obtener Lista de Movimientos Recientes (Solo para mostrar la lista)
  const { 
    data: transactionsData, 
    isLoading: loadingTransactions,
    refetch: refetchTransactions 
  } = useTransactions({ 
    page: 1, 
    page_size: 5, 
    from_date: firstDay,
    to_date: lastDay
  });

  // 3. Obtener Estado de Viviendas
  const { 
    data: unitsData, 
    isLoading: loadingUnits,
    refetch: refetchUnits 
  } = useUnits({ page: 1, page_size: 100 });

  const isLoading = loadingFinancials || loadingTransactions || loadingUnits;

  const onRefresh = useCallback(() => {
    refetchFinancials();
    refetchTransactions();
    refetchUnits();
  }, [refetchFinancials, refetchTransactions, refetchUnits]);

  // Datos procesados para la vista
  const financials = useMemo(() => {
    if (!financialData?.totals) {
      return {
        balance: 0,
        income: 0,
        expense: 0,
        availableBalance: 0,
        advanceReserve: 0,
        hasAdvances: false
      };
    }

    const t = financialData.totals;
    
    return {
      // Usamos 'available_balance' que es: (Inicial + Ingresos - Gastos - Reserva)
      balance: t.available_balance || 0,
      income: t.total_income_cash || 0,
      expense: t.total_expenses || 0,
      // Datos extra para desglose si se requiere
      availableBalance: t.available_balance || 0,
      advanceReserve: t.advance_reserve || 0,
      hasAdvances: (t.advance_reserve || 0) > 0
    };
  }, [financialData]);

  // Datos de viviendas
  const unitsSummary = unitsData?.summary || { total_units: 0, units_with_debt: 0 };
  const totalDebt = parseFloat(unitsData?.summary?.total_debt?.toString() || '0');

  // Acciones Rápidas
  const handleQuickAction = (action: string) => {
    const routes: Record<string, any> = {
      income: { screen: 'TransactionForm', params: { type: 'income' } },
      expense: { screen: 'TransactionForm', params: { type: 'expense' } },
      units: undefined,
      transactions: undefined
    };

    if (action === 'units') navigation.navigate('Units');
    else if (action === 'transactions') navigation.navigate('Transactions');
    else navigation.navigate('Transactions', routes[action]);
  };

  if (isLoading && !financialData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.full_name?.split(' ')[0]}</Text>
          <Text style={styles.dateLabel}>Resumen de {formatFiscalPeriod(currentPeriod)}</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
          <Feather name="settings" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={['#4F46E5']} />}
      >
        
        {/* === TARJETA FINANCIERA (Datos Reales con Remanente) === */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Saldo Disponible Real</Text>
            <View style={[styles.trendBadge, { backgroundColor: financials.balance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
              <Feather 
                name={financials.balance >= 0 ? "trending-up" : "trending-down"} 
                size={24}
                color="white" 
              />
            </View>
          </View>
          
          <Text style={styles.heroBalance}>
            {formatCurrency(financials.balance)}
          </Text>

          {/* Aviso de reserva si existe */}
          {financials.hasAdvances && (
            <Text style={styles.heroSubtext}>
              (Excluye {formatCurrency(financials.advanceReserve)} de cuotas adelantadas)
            </Text>
          )}

          {/* Resumen Ingreso vs Gasto del Mes */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIconUp}>
                <Feather name="arrow-down-left" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Ingresos Mes</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(financials.income)}</Text>
              </View>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIconDown}>
                <Feather name="arrow-up-right" size={20} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Gastos Mes</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(financials.expense)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* === ACCIONES RÁPIDAS === */}
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleQuickAction('income')}>
            <View style={[styles.actionIcon, { backgroundColor: '#ECFDF5' }]}>
              <Feather name="plus" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Ingreso</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleQuickAction('expense')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
              <Feather name="minus" size={24} color="#EF4444" />
            </View>
            <Text style={styles.actionText}>Gasto</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleQuickAction('units')}>
            <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
              <Feather name="home" size={24} color="#4F46E5" />
            </View>
            <Text style={styles.actionText}>Casas</Text>
          </TouchableOpacity>
        </View>

        {/* === ESTADO DE VIVIENDAS === */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Estado de Viviendas</Text>
          {totalDebt < 0 && (
             <Text style={styles.debtWarning}>Deuda: {formatCurrency(Math.abs(totalDebt))}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.unitsCard} 
          onPress={() => handleQuickAction('units')}
          activeOpacity={0.9}
        >
          <View style={styles.unitsProgressRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.unitNumberBig}>{unitsSummary.total_units - unitsSummary.units_with_debt}</Text>
              <Text style={styles.unitLabel}>Al Corriente</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#F3F4F6', height: '80%' }} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.unitNumberBig, { color: '#EF4444' }]}>{unitsSummary.units_with_debt}</Text>
              <Text style={styles.unitLabel}>Con Adeudo</Text>
            </View>
          </View>
          
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${((unitsSummary.total_units - unitsSummary.units_with_debt) / (unitsSummary.total_units || 1)) * 100}%` }
              ]} 
            />
          </View>
        </TouchableOpacity>

        {/* === ÚLTIMOS MOVIMIENTOS === */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos Movimientos</Text>
          <TouchableOpacity onPress={() => handleQuickAction('transactions')}>
            <Text style={styles.seeAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {transactionsData?.items && transactionsData.items.length > 0 ? (
            transactionsData.items.map((t: any) => {
              const isIncome = t.type === 'income';
              const isAdvance = t.is_advance_payment;
              const isLate = t.is_late_payment;
              
              return (
                <TouchableOpacity 
                  key={t.id} 
                  style={styles.transactionRow}
                  onPress={() => navigation.navigate('TransactionDetail', { transactionId: t.id })}
                >
                  <View style={[styles.transactionIcon, { backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Feather 
                      name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} 
                      size={18} 
                      color={isIncome ? '#10B981' : '#EF4444'} 
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>
                      {t.category_name || t.description}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.transactionDate}>{formatDateShort(t.transaction_date)}</Text>
                      {(isAdvance || isLate) && (
                        <View style={[styles.tinyBadge, { backgroundColor: isAdvance ? '#FEF3C7' : '#FEE2E2' }]}>
                          <Text style={[styles.tinyBadgeText, { color: isAdvance ? '#B45309' : '#DC2626' }]}>
                            {isAdvance ? 'Adelantado' : 'Atrasado'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.transactionAmount, { color: isIncome ? '#10B981' : '#EF4444' }]}>
                    {isIncome ? '+ ' : '- '}{formatCurrency(t.amount)}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>Sin movimientos este mes</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827' },
  dateLabel: { fontSize: 14, color: '#6B7280', textTransform: 'capitalize', marginTop: 2 },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#1E1B4B', // Color tema oscuro
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heroTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  trendBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }, 
  heroBalance: { 
    fontSize: 38, 
    fontWeight: '800', 
    color: 'white', 
    letterSpacing: -1,
    marginBottom: 4
  },
  heroSubtext: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13,
    marginBottom: 20,
    fontStyle: 'italic',
  },

  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  verticalDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  heroStatIconUp: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center' },
  heroStatIconDown: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.2)', alignItems: 'center', justifyContent: 'center' },
  
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' }, 
  heroStatValue: { color: 'white', fontSize: 16, fontWeight: '700', marginTop: 2 },

  // Sections
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginHorizontal: 20, marginBottom: 12 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginHorizontal: 20, 
    marginTop: 24, 
    marginBottom: 12 
  },
  seeAllText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
  debtWarning: { color: '#EF4444', fontSize: 12, fontWeight: '700', backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  // Quick Actions
  quickActionsContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  actionBtn: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 20, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionText: { fontWeight: '600', color: '#374151', fontSize: 13 },

  // Units Card
  unitsCard: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  unitsProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  unitNumberBig: { fontSize: 24, fontWeight: '800', color: '#10B981' },
  unitLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },

  // Transactions List
  transactionsList: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 24, padding: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  transactionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  transactionDate: { fontSize: 12, color: '#9CA3AF' },
  transactionAmount: { fontSize: 15, fontWeight: '700' },
  tinyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  tinyBadgeText: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyText: { color: '#9CA3AF', marginTop: 8, fontSize: 14 },
});
