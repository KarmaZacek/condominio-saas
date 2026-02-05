import React, { useCallback, useState, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useUnit, useDeleteUnit } from '../../hooks/useUnits';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency, formatDate, formatDateShort, formatFiscalPeriod } from '../../utils/formatters';

type UnitsStackParamList = {
  UnitsList: undefined;
  UnitDetail: { id: string };
  UnitForm: { unit?: any } | undefined;
};

type RouteProps = RouteProp<UnitsStackParamList, 'UnitDetail'>;

export default function UnitDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  // Ocultar el header nativo para evitar duplicados
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Queries
  const { data: unit, isLoading, isError, refetch, isFetching } = useUnit(id);
  const deleteMutation = useDeleteUnit();
  
  const { 
    data: transactionsData, 
    isLoading: loadingTransactions,
    refetch: refetchTransactions 
  } = useTransactions({ unit_id: id, page_size: 50 });

  const transactions = transactionsData?.items || [];
  const recentTransactions = transactions.slice(0, 5);

  const onRefresh = useCallback(() => {
    refetch();
    refetchTransactions();
  }, [refetch, refetchTransactions]);

  // Cálculos financieros
  const totalPagos = transactions
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount?.toString() || '0'), 0);
  
  const totalCargos = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount?.toString() || '0'), 0);

  // Configuración de estado
  const getBalanceStatus = (balance: number) => {
    if (balance < -1) return { label: 'Con Adeudo', color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle' };
    if (balance > 1) return { label: 'Saldo a Favor', color: '#10B981', bg: '#D1FAE5', icon: 'check-circle' };
    return { label: 'Al Corriente', color: '#059669', bg: '#ECFDF5', icon: 'check' };
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Vivienda',
      `¿Estás seguro de eliminar la vivienda ${unit?.unit_number}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la vivienda');
            }
          }
        },
      ]
    );
  };

  // Contacto
  const handleContact = (type: 'phone' | 'whatsapp' | 'email') => {
    if (!unit) return;
    if (type === 'phone' && unit.owner_phone) Linking.openURL(`tel:${unit.owner_phone}`);
    if (type === 'email' && unit.owner_email) Linking.openURL(`mailto:${unit.owner_email}`);
    if (type === 'whatsapp' && unit.owner_phone) {
      const cleanPhone = unit.owner_phone.replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`;
      Linking.openURL(`whatsapp://send?phone=${phoneWithCountry}`);
    }
  };

  const handleQuickPayment = () => {
    navigation.navigate('Transactions', {
      screen: 'TransactionForm',
      params: { type: 'income', unitId: id }
    });
  };

  const getOwnerName = (unit: any) => unit?.owner_name || unit?.notes || 'Sin propietario asignado';

  // Renderizado de Item de Transacción (Reutilizable)
  const renderTransactionItem = (t: any) => {
    const isIncome = t.type === 'income';
    return (
      <View key={t.id} style={styles.transactionItem}>
        {/* Icono */}
        <View style={[styles.tIcon, { backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2' }]}>
          <Feather 
            name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} 
            size={18} 
            color={isIncome ? '#10B981' : '#EF4444'} 
          />
        </View>
        
        {/* Contenido Central */}
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <Text style={styles.tDesc} numberOfLines={1}>{t.category_name || t.description}</Text>
          
          {/* ✅ CORRECCIÓN: Mostramos Periodo y Fecha */}
          <View style={styles.tMetaRow}>
            {t.fiscal_period && (
              <View style={styles.tPeriodBadge}>
                <Feather name="calendar" size={10} color="#6366F1" style={{ marginRight: 4 }} />
                <Text style={styles.tPeriodText}>{formatFiscalPeriod(t.fiscal_period)}</Text>
              </View>
            )}
            <Text style={styles.tDate}>{formatDateShort(t.transaction_date)}</Text>
          </View>
        </View>

        {/* Monto */}
        <Text style={[styles.tAmount, { color: isIncome ? '#10B981' : '#EF4444' }]}>
          {isIncome ? '+ ' : '- '}{formatCurrency(t.amount)}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !unit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Feather name="alert-triangle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>No se encontró la vivienda</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const balance = parseFloat(unit.balance?.toString() || '0');
  const monthlyFee = parseFloat(unit.monthly_fee?.toString() || '0');
  const status = getBalanceStatus(balance);
  const hasContact = unit.owner_phone || unit.owner_email;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header Nav Personalizado */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Detalle de Vivienda</Text>
        <TouchableOpacity onPress={() => navigation.navigate('UnitForm', { unit })} style={styles.editButton}>
          <Feather name="edit-2" size={20} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} colors={['#6366F1']} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        
        {/* === TARJETA DIGITAL (HERO) === */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Vivienda</Text>
              <Text style={styles.heroUnitNumber}>{unit.unit_number}</Text>
              {unit.building && <Text style={styles.heroBuilding}>Torre {unit.building}</Text>}
            </View>
            <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Feather name={status.icon as any} size={14} color="white" />
              <Text style={styles.statusPillText}>{status.label}</Text>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.heroLabel}>Balance Total</Text>
              <Text style={styles.heroBalance}>
                {balance < 0 ? '- ' : ''}{formatCurrency(Math.abs(balance))}
              </Text>
            </View>
            <View style={styles.unitIconContainer}>
              <Feather name="home" size={24} color="white" />
            </View>
          </View>
        </View>

        {/* === TITULAR & CONTACTO === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titular</Text>
          <View style={styles.ownerCard}>
            <View style={styles.ownerInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getOwnerName(unit).substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerName}>{getOwnerName(unit)}</Text>
                <Text style={styles.ownerRole}>Propietario</Text>
              </View>
            </View>

            {hasContact && (
              <View style={styles.contactRow}>
                {unit.owner_phone && (
                  <>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('phone')}>
                      <Feather name="phone" size={20} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('whatsapp')}>
                      <Feather name="message-circle" size={20} color="#10B981" />
                    </TouchableOpacity>
                  </>
                )}
                {unit.owner_email && (
                  <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('email')}>
                    <Feather name="mail" size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* === RESUMEN FINANCIERO === */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="calendar" size={18} color="#6366F1" />
            <Text style={styles.statLabel}>Cuota</Text>
            <Text style={styles.statValue}>{formatCurrency(monthlyFee)}</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="arrow-down-left" size={18} color="#10B981" />
            <Text style={styles.statLabel}>Pagado</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{formatCurrency(totalPagos)}</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="arrow-up-right" size={18} color="#EF4444" />
            <Text style={styles.statLabel}>Cargos</Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{formatCurrency(totalCargos)}</Text>
          </View>
        </View>

        {/* === ACCIÓN RÁPIDA === */}
        <TouchableOpacity style={styles.quickPayButton} onPress={handleQuickPayment}>
          <View style={styles.quickPayIcon}>
            <Feather name="plus" size={24} color="white" />
          </View>
          <View>
            <Text style={styles.quickPayTitle}>Registrar Pago</Text>
            <Text style={styles.quickPaySubtitle}>Agregar ingreso manual</Text>
          </View>
          <Feather name="chevron-right" size={24} color="#6366F1" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* === HISTORIAL === */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos Movimientos</Text>
          <TouchableOpacity onPress={() => setShowAllTransactions(true)}>
            <Text style={styles.seeAllText}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((t: any) => renderTransactionItem(t))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>Sin movimientos recientes</Text>
            </View>
          )}
        </View>

        {/* === INFORMACIÓN ADICIONAL === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado</Text>
              <Text style={styles.detailValue}>
                {unit.status === 'occupied' ? 'Ocupada' : unit.status === 'vacant' ? 'Vacante' : 'Mantenimiento'}
              </Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Piso</Text>
              <Text style={styles.detailValue}>{unit.floor || '-'}</Text>
            </View>
            {unit.notes && (
              <>
                <View style={styles.detailDivider} />
                <View style={{ paddingVertical: 12 }}>
                  <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Notas</Text>
                  <Text style={styles.detailNote}>{unit.notes}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* BOTÓN ELIMINAR */}
        <TouchableOpacity style={styles.deleteLink} onPress={handleDelete}>
          <Feather name="trash-2" size={16} color="#EF4444" />
          <Text style={styles.deleteLinkText}>Eliminar Vivienda</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* MODAL: HISTORIAL COMPLETO */}
      <Modal
        visible={showAllTransactions}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllTransactions(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Historial Completo</Text>
            <TouchableOpacity onPress={() => setShowAllTransactions(false)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={transactions}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => renderTransactionItem(item)}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, color: '#1F2937' },
  retryButton: { marginTop: 16, backgroundColor: '#EEF2FF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#6366F1', fontWeight: '600' },

  // Nav
  navHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  backButton: { padding: 8 },
  navTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  editButton: { padding: 8, backgroundColor: '#EEF2FF', borderRadius: 8 },

  // Hero Card (Tarjeta Digital)
  heroCard: {
    backgroundColor: '#6366F1', // Índigo moderno
    margin: 20, borderRadius: 24, padding: 24,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    minHeight: 180, justifyContent: 'space-between'
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  heroUnitNumber: { fontSize: 32, fontWeight: '800', color: 'white' },
  heroBuilding: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  statusPillText: { color: 'white', fontSize: 12, fontWeight: '600' },
  
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroBalance: { fontSize: 28, fontWeight: '700', color: 'white' },
  unitIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  
  // Owner Card
  ownerCard: { 
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1
  },
  ownerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#6366F1' },
  ownerName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  ownerRole: { fontSize: 13, color: '#6B7280' },
  contactRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  contactBtn: { 
    flex: 1, height: 44, borderRadius: 12, backgroundColor: '#F9FAFB', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' 
  },

  // Stats Grid
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  statCard: { 
    flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1, gap: 4
  },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: '#1F2937' },

  // Quick Action
  quickPayButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 20, marginBottom: 24,
    padding: 16, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2
  },
  quickPayIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  quickPayTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  quickPaySubtitle: { fontSize: 13, color: '#6B7280' },

  // Transactions
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  seeAllText: { color: '#6366F1', fontWeight: '600', fontSize: 14 },
  transactionsList: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 20, padding: 8, marginBottom: 24 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  tIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tDesc: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  tMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 },
  tPeriodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tPeriodText: { fontSize: 11, color: '#6366F1', fontWeight: '600' },
  tDate: { fontSize: 11, color: '#9CA3AF' },
  tAmount: { fontSize: 14, fontWeight: '700' },
  emptyState: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', marginTop: 8 },

  // Details
  detailsCard: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  detailDivider: { height: 1, backgroundColor: '#F3F4F6' },
  detailNote: { fontSize: 14, color: '#374151', lineHeight: 20 },

  // Delete
  deleteLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40, padding: 16 },
  deleteLinkText: { color: '#EF4444', fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
});
