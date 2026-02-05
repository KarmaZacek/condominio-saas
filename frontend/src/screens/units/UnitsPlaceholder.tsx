import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// --- DATOS DE PRUEBA ENRIQUECIDOS ---
const MOCK_UNITS = [
  { id: '1', unit_number: '101', owner_name: 'Juan Pérez', balance: 0, status: 'occupied', building: 'A', floor: 1 },
  { id: '2', unit_number: '102', owner_name: 'María García', balance: -3500, status: 'occupied', building: 'A', floor: 1 },
  { id: '3', unit_number: '201', owner_name: 'Carlos López', balance: 1500, status: 'vacant', building: 'A', floor: 2 },
  { id: '4', unit_number: 'PH-01', owner_name: 'Ana Martínez', balance: 0, status: 'occupied', building: 'B', floor: 10 },
  { id: '5', unit_number: '305', owner_name: 'Roberto Sánchez', balance: -15000, status: 'occupied', building: 'B', floor: 3 },
  { id: '6', unit_number: '104', owner_name: 'Sin Asignar', balance: 0, status: 'maintenance', building: 'C', floor: 1 },
];

type FilterType = 'all' | 'debt' | 'occupied' | 'vacant';

export default function UnitsPlaceholder() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // --- LÓGICA LOCAL (Simulando Backend) ---
  
  // 1. Filtrado
  const filteredData = useMemo(() => {
    return MOCK_UNITS.filter((unit) => {
      // Filtro de Texto
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        unit.unit_number.toLowerCase().includes(query) ||
        unit.owner_name.toLowerCase().includes(query) ||
        unit.building.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // Filtro de Categoría
      if (activeFilter === 'debt') return unit.balance < -1;
      if (activeFilter === 'occupied') return unit.status === 'occupied';
      if (activeFilter === 'vacant') return unit.status === 'vacant';

      return true;
    });
  }, [searchQuery, activeFilter]);

  // 2. Estadísticas (Calculadas sobre TODOS los datos, no solo los filtrados)
  const stats = useMemo(() => {
    const total = MOCK_UNITS.length;
    const debtCount = MOCK_UNITS.filter(u => u.balance < -1).length;
    const totalDebt = MOCK_UNITS.reduce((acc, curr) => acc + (curr.balance < 0 ? curr.balance : 0), 0);
    return { total, debtCount, totalDebt };
  }, []);

  // --- HELPERS VISUALES ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Math.abs(amount));
  };

  const getStatusInfo = (status: string, balance: number) => {
    if (balance < -1) return { color: '#EF4444', bg: '#FEE2E2', label: 'Adeudo' }; // Rojo
    if (status === 'occupied') return { color: '#10B981', bg: '#ECFDF5', label: 'Ocupada' }; // Verde
    if (status === 'vacant') return { color: '#6366F1', bg: '#EEF2FF', label: 'Vacante' }; // Azul
    return { color: '#F59E0B', bg: '#FFFBEB', label: 'Mant.' }; // Naranja
  };

  // --- COMPONENTES DE UI ---

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Tarjetas de Resumen */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#EEF2FF' }]}>
            <Feather name="home" size={16} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
          </View>
          <View>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.debtCount}</Text>
            <Text style={styles.statLabel}>Morosos</Text>
          </View>
        </View>

        <View style={[styles.statCard, { flex: 1.5 }]}> 
          <View style={[styles.statIcon, { backgroundColor: '#FFF7ED' }]}>
            <Feather name="dollar-sign" size={16} color="#D97706" />
          </View>
          <View>
            <Text style={[styles.statValue, { color: '#D97706', fontSize: 13 }]}>
              {formatCurrency(stats.totalDebt)}
            </Text>
            <Text style={styles.statLabel}>Deuda Total</Text>
          </View>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchBar}>
        <Feather name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar (Demo)..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros Chips */}
      <View style={styles.filtersRow}>
        {[
          { id: 'all', label: 'Todas' },
          { id: 'debt', label: 'Con Deuda' },
          { id: 'occupied', label: 'Ocupadas' },
          { id: 'vacant', label: 'Vacantes' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              activeFilter === filter.id && styles.filterChipActive
            ]}
            onPress={() => setActiveFilter(filter.id as FilterType)}
          >
            <Text style={[
              styles.filterText,
              activeFilter === filter.id && styles.filterTextActive
            ]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: typeof MOCK_UNITS[0] }) => {
    const statusInfo = getStatusInfo(item.status, item.balance);
    const hasDebt = item.balance < -1;

    return (
      <TouchableOpacity 
        style={[styles.card, hasDebt && styles.cardDebt]} 
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.unitBadge, { backgroundColor: hasDebt ? '#FEF2F2' : '#EEF2FF' }]}>
            <Text style={[styles.unitNumber, { color: hasDebt ? '#EF4444' : '#4F46E5' }]}>
              {item.unit_number}
            </Text>
          </View>
          <View style={styles.unitInfo}>
            <Text style={styles.ownerName} numberOfLines={1}>{item.owner_name}</Text>
            <Text style={styles.buildingInfo}>
              Torre {item.building} • Piso {item.floor}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          {hasDebt ? (
            <View style={styles.debtContainer}>
              <Text style={styles.debtLabel}>Adeudo</Text>
              <Text style={styles.debtAmount}>{formatCurrency(item.balance)}</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          )}
          <Feather name="chevron-right" size={16} color="#D1D5DB" style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Top Bar (Simulada) */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Viviendas (Demo)</Text>
        <TouchableOpacity style={styles.addButton}>
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  // Top Bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  addButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },

  // Header
  headerContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  
  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'white', padding: 10, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', paddingHorizontal: 12, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1F2937', height: '100%' },

  // Filters
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#F3F4F6'
  },
  filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: 'white' },

  // List Item
  list: { paddingBottom: 20 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', marginHorizontal: 20, marginBottom: 10,
    padding: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1
  },
  cardDebt: { borderWidth: 1, borderColor: '#FEE2E2' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  unitBadge: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  unitNumber: { fontSize: 16, fontWeight: '800' },
  unitInfo: { flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  buildingInfo: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  
  cardRight: { flexDirection: 'row', alignItems: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  
  debtContainer: { alignItems: 'flex-end' },
  debtLabel: { fontSize: 10, color: '#EF4444', fontWeight: '600', textTransform: 'uppercase' },
  debtAmount: { fontSize: 14, color: '#EF4444', fontWeight: '700' },
});
