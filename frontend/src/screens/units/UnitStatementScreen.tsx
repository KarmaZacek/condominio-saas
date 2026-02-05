/**
 * Pantalla de Estado de Cuenta de Vivienda
 * Diseño estilo Extracto Bancario Digital (Corrección de Header Duplicado)
 */
import React, { useState, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUnit } from '../../hooks/useUnits';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency, formatDateShort, formatFiscalPeriod, getFiscalPeriods } from '../../utils/formatters';
import { toast } from '../../store/toastStore';

type Props = NativeStackScreenProps<any, 'UnitStatement'>;

export default function UnitStatementScreen({ route, navigation }: Props) {
  const { unitId, unitNumber } = route.params;
  
  // 🛠️ CORRECCIÓN: Ocultar el header nativo para evitar duplicados
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  
  // Generar últimos 24 periodos para el filtro
  const fiscalPeriods = useMemo(() => ['all', ...getFiscalPeriods(24, 0)], []);
  
  const { data: unit, isLoading: loadingUnit, refetch: refetchUnit } = useUnit(unitId);
  const { 
    data: transactionsData, 
    isLoading: loadingTransactions,
    refetch: refetchTransactions,
    isFetching
  } = useTransactions({ 
    unit_id: unitId, 
    page_size: 100,
    fiscal_period: selectedPeriod === 'all' ? undefined : selectedPeriod
  });

  const transactions = transactionsData?.items || [];
  
  // Ordenar cronológicamente para calcular saldo corrido
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a: any, b: any) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
  }, [transactions]);

  // Calcular saldo corrido
  const transactionsWithBalance = useMemo(() => {
    let runningBalance = 0;
    // Nota: Para un saldo corrido exacto con paginación o filtros, lo ideal es que el backend lo envíe.
    // Aquí hacemos una aproximación visual basada en los datos cargados.
    
    return sortedTransactions.map((t: any) => {
      const amount = parseFloat(t.amount?.toString() || '0');
      if (t.type === 'income') {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      return { ...t, runningBalance };
    }).reverse(); // Invertir para mostrar el más reciente arriba
  }, [sortedTransactions]);

  const totals = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach((t: any) => {
      const amount = parseFloat(t.amount?.toString() || '0');
      if (t.type === 'income') totalIncome += amount;
      else totalExpense += amount;
    });
    
    return { income: totalIncome, expense: totalExpense };
  }, [transactions]);

  const currentBalance = parseFloat(unit?.balance?.toString() || '0');

  const onRefresh = () => {
    refetchUnit();
    refetchTransactions();
  };

  const handleShare = async () => {
    try {
      let message = `📋 ESTADO DE CUENTA - CASA ${unitNumber}\n`;
      message += `📅 Periodo: ${selectedPeriod === 'all' ? 'Histórico completo' : formatFiscalPeriod(selectedPeriod)}\n\n`;
      message += `💰 Saldo Final: ${formatCurrency(currentBalance)}\n`;
      message += `📥 Total Abonos: ${formatCurrency(totals.income)}\n`;
      message += `📤 Total Cargos: ${formatCurrency(totals.expense)}\n\n`;
      message += `--- DETALLE ---\n`;
      
      transactionsWithBalance.slice(0, 15).forEach((t: any) => {
        const amount = parseFloat(t.amount?.toString() || '0');
        const sign = t.type === 'income' ? '+' : '-';
        message += `${formatDateShort(t.transaction_date)} | ${t.category?.name || 'General'}\n`;
        message += `${sign}${formatCurrency(amount)} (Saldo: ${formatCurrency(t.runningBalance)})\n\n`;
      });
      
      await Share.share({ message, title: `Estado de Cuenta ${unitNumber}` });
    } catch (error) {
      toast.error('Error al compartir');
    }
  };

  const isLoading = loadingUnit || loadingTransactions;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header Personalizado (Ahora será el único visible) */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Estado de Cuenta</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Feather name="share" size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Filtro de Períodos (Horizontal Scroll) */}
      <View style={styles.filterContainer}>
        <FlatList
          data={fiscalPeriods}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          renderItem={({ item }) => {
            const isActive = selectedPeriod === item;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedPeriod(item)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {item === 'all' ? 'Histórico' : formatFiscalPeriod(item)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Resumen del Periodo Seleccionado */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Saldo al corte</Text>
            <Text style={[
              styles.summaryValueBig, 
              { color: currentBalance >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              {formatCurrency(currentBalance)}
            </Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.statMini}>
              <Feather name="arrow-down-left" size={12} color="#10B981" />
              <Text style={styles.statMiniValue}>{formatCurrency(totals.income)}</Text>
            </View>
            <View style={styles.statMini}>
              <Feather name="arrow-up-right" size={12} color="#EF4444" />
              <Text style={styles.statMiniValue}>{formatCurrency(totals.expense)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Lista de Movimientos */}
      <FlatList
        data={transactionsWithBalance}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading && !isFetching} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
        ListHeaderComponent={
          <Text style={styles.listHeaderTitle}>Movimientos ({transactions.length})</Text>
        }
        renderItem={({ item: transaction }) => {
          const amount = parseFloat(transaction.amount?.toString() || '0');
          const isIncome = transaction.type === 'income';
          
          return (
            <View style={styles.transactionItem}>
              {/* Fecha y Línea de tiempo */}
              <View style={styles.dateColumn}>
                <Text style={styles.dayText}>
                  {new Date(transaction.transaction_date).getDate()}
                </Text>
                <Text style={styles.monthText}>
                  {new Date(transaction.transaction_date).toLocaleString('es-MX', { month: 'short' })}
                </Text>
              </View>

              {/* Icono */}
              <View style={[styles.iconCircle, { backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2' }]}>
                <Feather 
                  name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} 
                  size={16} 
                  color={isIncome ? '#10B981' : '#EF4444'} 
                />
              </View>

              {/* Detalles */}
              <View style={styles.detailsColumn}>
                <Text style={styles.descText} numberOfLines={1}>
                  {transaction.category?.name || transaction.description}
                </Text>
                <Text style={styles.subText} numberOfLines={1}>
                  {transaction.description || 'Sin nota'}
                </Text>
              </View>

              {/* Montos */}
              <View style={styles.amountColumn}>
                <Text style={[styles.amountText, { color: isIncome ? '#10B981' : '#1F2937' }]}>
                  {isIncome ? '+' : '-'}{formatCurrency(amount)}
                </Text>
                <Text style={styles.runningBalanceText}>
                  Saldo: {formatCurrency(transaction.runningBalance)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>Sin movimientos en este periodo</Text>
            </View>
          ) : (
            <View style={{ padding: 40 }}>
               <ActivityIndicator color="#4F46E5" />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  // Header
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  backButton: { padding: 8 },
  navTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  shareButton: { padding: 8, backgroundColor: '#EEF2FF', borderRadius: 8 },

  // Filters
  filterContainer: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB'
  },
  filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: 'white' },

  // Summary Card
  summaryCard: {
    backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValueBig: { fontSize: 24, fontWeight: '800' },
  summaryStats: { alignItems: 'flex-end', gap: 4 },
  statMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statMiniValue: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // List
  listContent: { paddingBottom: 40 },
  listHeaderTitle: { 
    fontSize: 14, fontWeight: '600', color: '#6B7280', 
    marginLeft: 16, marginTop: 16, marginBottom: 8 
  },
  
  // Transaction Item (Estilo Extracto)
  transactionItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  dateColumn: { alignItems: 'center', width: 40, marginRight: 12 },
  dayText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  monthText: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' },
  
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  
  detailsColumn: { flex: 1, marginRight: 8 },
  descText: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  subText: { fontSize: 12, color: '#9CA3AF' },
  
  amountColumn: { alignItems: 'flex-end' },
  amountText: { fontSize: 14, fontWeight: '700' },
  runningBalanceText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Empty State
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
});
