import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useUnit, useUnitBalanceStatement } from '../../hooks/useUnits';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency, formatDateShort, formatFiscalPeriod, getCurrentFiscalPeriod } from '../../utils/formatters';

// Configuración del administrador
const ADMIN_CONTACT = {
  phone: '33-3389-2597',
  email: 'edyese@msn.com',
  name: 'Edgar Ramírez',
};

export default function ResidentDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const currentPeriod = getCurrentFiscalPeriod();
  
  // 1. Queries
  const {
    data: unitData,
    isLoading: loadingUnit,
    refetch: refetchUnit,
    isFetching: fetchingUnit,
  } = useUnit(user?.unit_id || '');

  const {
    data: balanceData,
    isLoading: loadingBalance,
    refetch: refetchBalance,
    isFetching: fetchingBalance,
  } = useUnitBalanceStatement(user?.unit_id || '');

  const {
    data: transactionsData,
    isLoading: loadingTransactions,
    refetch: refetchTransactions,
    isFetching: fetchingTransactions,
  } = useTransactions({
    unit_id: user?.unit_id,
    type: 'income',
    page: 1,
    page_size: 10,
  });

  const isLoading = loadingUnit || loadingBalance || loadingTransactions;
  const isFetching = fetchingUnit || fetchingBalance || fetchingTransactions;

  const onRefresh = useCallback(() => {
    refetchUnit();
    refetchBalance();
    refetchTransactions();
  }, [refetchUnit, refetchBalance, refetchTransactions]);

  // 2. Cálculos Memoizados (useMemo para rendimiento)
  const dashboardState = useMemo(() => {
    const unit = unitData;
    const balance = unit?.balance ? parseFloat(unit.balance.toString()) : 0;
    const monthlyFee = unit?.monthly_fee ? parseFloat(unit.monthly_fee.toString()) : 0;
    const isUpToDate = balance >= -1; // Tolerancia de 1 peso por redondeos

    // Próximo Pago
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);
    const isAfterDueDate = now > dueDate;
    
    // Si ya pasó el día 10 y estamos al corriente, mostramos el sig mes.
    // Si tenemos deuda, mostramos el mes actual + deuda.
    let nextPeriod = currentPeriod;
    let nextAmount = monthlyFee;

    if (isUpToDate && isAfterDueDate) {
       // Calcular siguiente mes
       const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
       nextPeriod = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    } else {
       // Mes actual (o vencido)
       nextAmount = monthlyFee + (balance < 0 ? Math.abs(balance) : 0);
    }

    return {
      unit,
      balance,
      monthlyFee,
      isUpToDate,
      nextPeriod,
      nextAmount,
      dueDate: isAfterDueDate && isUpToDate 
        ? new Date(now.getFullYear(), now.getMonth() + 1, 10) 
        : dueDate
    };
  }, [unitData, currentPeriod]);

  // Funciones de contacto
  const handleContact = (method: 'phone' | 'email' | 'whatsapp') => {
    const cleanPhone = ADMIN_CONTACT.phone.replace(/-/g, '');
    if (method === 'phone') Linking.openURL(`tel:${cleanPhone}`);
    if (method === 'email') Linking.openURL(`mailto:${ADMIN_CONTACT.email}?subject=Casa ${unitData?.unit_number}`);
    if (method === 'whatsapp') Linking.openURL(`whatsapp://send?phone=52${cleanPhone}&text=Hola, soy de la Casa ${unitData?.unit_number}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  // Sin unidad asignada
  if (!user?.unit_id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noUnitContainer}>
          <View style={styles.iconCircle}>
            <Feather name="home" size={40} color="#9CA3AF" />
          </View>
          <Text style={styles.noUnitTitle}>Sin vivienda asignada</Text>
          <Text style={styles.noUnitText}>Contacta al administrador para vincular tu cuenta.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => handleContact('whatsapp')}>
            <Text style={styles.primaryBtnText}>Contactar Soporte</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { isUpToDate, balance, nextAmount, nextPeriod, dueDate } = dashboardState;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.full_name?.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>Casa {unitData?.unit_number}</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
          <Feather name="settings" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} colors={['#4F46E5']} />}
      >
        
        {/* === HERO CARD (ESTADO DE CUENTA) === */}
        <View style={[styles.heroCard, isUpToDate ? styles.heroGreen : styles.heroRed]}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Estado de Cuenta</Text>
            <View style={styles.statusPill}>
              <Feather name={isUpToDate ? "check-circle" : "alert-circle"} size={14} color={isUpToDate ? "#059669" : "#DC2626"} />
              <Text style={[styles.statusText, isUpToDate ? styles.textGreen : styles.textRed]}>
                {isUpToDate ? 'Al Corriente' : 'Pago Pendiente'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroBalance}>
            {isUpToDate && balance >= 0 ? formatCurrency(balance) : `- ${formatCurrency(Math.abs(balance))}`}
          </Text>
          <Text style={styles.heroLabel}>
            {isUpToDate ? 'Saldo a favor' : 'Adeudo Total'}
          </Text>

          <View style={styles.divider} />

          {/* Info Próximo Pago */}
          <View style={styles.paymentRow}>
            <View>
              <Text style={styles.paymentLabel}>Próximo Pago ({formatFiscalPeriod(nextPeriod)})</Text>
              <Text style={styles.paymentDate}>Vence: {dueDate.getDate()} de {dueDate.toLocaleString('es-MX', { month: 'long' })}</Text>
            </View>
            <Text style={styles.paymentAmount}>{formatCurrency(nextAmount)}</Text>
          </View>

          {/* Botón de Acción Principal */}
          {!isUpToDate && (
             <TouchableOpacity style={styles.payButton} onPress={() => handleContact('whatsapp')}>
                <Feather name="message-circle" size={18} color="#DC2626" />
                <Text style={styles.payButtonText}>Reportar Pago</Text>
             </TouchableOpacity>
          )}
          {isUpToDate && (
            <TouchableOpacity style={styles.statementButton} onPress={() => {
              // @ts-ignore - Navegación al RootStack desde Tab Navigator
              navigation.getParent()?.navigate('UnitStatement', { 
                unitId: user.unit_id, 
                unitNumber: unitData.unit_number 
              });
            }}>
              <Text style={styles.statementButtonText}>Ver Estado de Cuenta</Text>
              <Feather name="chevron-right" size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* === MIS PAGOS RECIENTES === */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos Pagos</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions', { screen: 'TransactionsList' })}>
            <Text style={styles.seeAllText}>Ver Historial</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {transactionsData?.items && transactionsData.items.length > 0 ? (
            transactionsData.items.slice(0, 5).map((t: any) => {
              const isAdvance = t.is_advance_payment;
              const isLate = t.is_late_payment;
              
              return (
                <TouchableOpacity 
                  key={t.id} 
                  style={styles.transactionRow}
                  onPress={() => navigation.navigate('Transactions', { screen: 'TransactionDetail', params: { transactionId: t.id } })}
                >
                  <View style={styles.transactionIcon}>
                    <Feather name="check" size={18} color="#10B981" />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>{formatFiscalPeriod(t.fiscal_period)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.transactionDate}>{formatDateShort(t.transaction_date)}</Text>
                      {(isAdvance || isLate) && (
                        <View style={[styles.tinyBadge, isAdvance ? styles.bgOrange : styles.bgRed]}>
                          <Text style={[styles.tinyBadgeText, isAdvance ? styles.textOrange : styles.textRed]}>
                            {isAdvance ? 'Adelantado' : 'Atrasado'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.transactionAmount}>+ {formatCurrency(t.amount)}</Text>
                    {t.receipt_url && <Feather name="file-text" size={12} color="#6366F1" style={{ marginTop: 2 }} />}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No hay pagos recientes</Text>
            </View>
          )}
        </View>

        {/* === DATOS DE MI VIVIENDA === */}
        <Text style={styles.sectionTitle}>Mi Vivienda</Text>
        <View style={styles.unitCard}>
          <View style={styles.unitRow}>
             <Text style={styles.unitLabel}>Propietario</Text>
             <Text style={styles.unitValue}>{user?.full_name}</Text>
          </View>
          <View style={styles.unitDivider} />
          <View style={styles.unitRow}>
             <Text style={styles.unitLabel}>Cuota Mensual</Text>
             <Text style={styles.unitValue}>{formatCurrency(dashboardState.monthlyFee)}</Text>
          </View>
        </View>

        {/* === CONTACTO === */}
        <Text style={styles.sectionTitle}>Contacto Administración</Text>
        <View style={styles.contactContainer}>
            <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('phone')}>
              <View style={[styles.contactIcon, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="phone" size={24} color="#4F46E5" />
              </View>
              <Text style={styles.contactText}>Llamar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('whatsapp')}>
              <View style={[styles.contactIcon, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="message-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.contactText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('email')}>
              <View style={[styles.contactIcon, { backgroundColor: '#F3F4F6' }]}>
                <Feather name="mail" size={24} color="#374151" />
              </View>
              <Text style={styles.contactText}>Email</Text>
            </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280' },
  profileButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'white', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },

  // Hero Card (Dynamic)
  heroCard: {
    marginHorizontal: 20, borderRadius: 24, padding: 24,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  heroGreen: { backgroundColor: '#059669', shadowColor: '#059669' }, // Verde Esmeralda
  heroRed: { backgroundColor: '#DC2626', shadowColor: '#DC2626' },   // Rojo Intenso
  
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' },
  statusPill: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  textGreen: { color: '#059669' },
  textRed: { color: '#DC2626' },

  heroBalance: { fontSize: 40, fontWeight: '800', color: 'white', letterSpacing: -1 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 16 },
  
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 },
  
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  paymentLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  paymentDate: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  paymentAmount: { color: 'white', fontSize: 18, fontWeight: '700' },

  // Buttons inside Hero
  payButton: { 
    backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, borderRadius: 14, gap: 8 
  },
  payButtonText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  
  statementButton: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 14
  },
  statementButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  seeAllText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },

  // Transactions List
  transactionsList: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 20, padding: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, marginBottom: 24 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  transactionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  transactionDate: { fontSize: 12, color: '#9CA3AF' },
  transactionAmount: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  tinyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 0 },
  tinyBadgeText: { fontSize: 10, fontWeight: '700' },
  bgOrange: { backgroundColor: '#FFF7ED' },
  bgRed: { backgroundColor: '#FEF2F2' },
  textOrange: { color: '#C2410C' },
  textRed: { color: '#DC2626' },
  emptyState: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', marginTop: 8 },

  // Unit Card
  unitCard: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, marginBottom: 24 },
  unitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  unitLabel: { color: '#6B7280', fontSize: 14 },
  unitValue: { color: '#1F2937', fontWeight: '600', fontSize: 14 },
  unitDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  // Contact
  contactContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 40 },
  contactBtn: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 16, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  contactIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  contactText: { fontWeight: '600', color: '#374151', fontSize: 13 },

  // No Unit State
  noUnitContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  noUnitTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  noUnitText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 32 },
  primaryBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16 },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
