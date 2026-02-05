import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const mockTransactions = [
  { id: '1', type: 'income', description: 'Cuota mensual - Casa 101', amount: 1500, date: '2024-12-15' },
  { id: '2', type: 'expense', description: 'Mantenimiento jardines', amount: 2500, date: '2024-12-14' },
  { id: '3', type: 'income', description: 'Cuota mensual - Casa 102', amount: 1500, date: '2024-12-13' },
  { id: '4', type: 'expense', description: 'Pago de luz áreas comunes', amount: 1800, date: '2024-12-12' },
  { id: '5', type: 'income', description: 'Cuota mensual - Casa 103', amount: 1500, date: '2024-12-11' },
];

export default function TransactionsPlaceholder() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const renderItem = ({ item }: { item: typeof mockTransactions[0] }) => (
    <TouchableOpacity style={styles.item}>
      <View style={[styles.iconContainer, item.type === 'income' ? styles.incomeIcon : styles.expenseIcon]}>
        <Feather 
          name={item.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'} 
          size={20} 
          color={item.type === 'income' ? '#10B981' : '#EF4444'} 
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <Text style={styles.itemDate}>{item.date}</Text>
      </View>
      <Text style={[styles.itemAmount, item.type === 'income' ? styles.incomeText : styles.expenseText]}>
        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Movimientos</Text>
        <TouchableOpacity style={styles.addButton}>
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Ingresos</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>$4,500.00</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Gastos</Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>$4,300.00</Text>
        </View>
      </View>

      <FlatList
        data={mockTransactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  addButton: { 
    backgroundColor: '#4F46E5', 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#E5E7EB' },
  summaryLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: 'bold' },
  list: { padding: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incomeIcon: { backgroundColor: '#D1FAE5' },
  expenseIcon: { backgroundColor: '#FEE2E2' },
  itemContent: { flex: 1 },
  itemDescription: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  itemDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: '600' },
  incomeText: { color: '#10B981' },
  expenseText: { color: '#EF4444' },
});
