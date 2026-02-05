import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useUnits } from '../../hooks/useUnits';
import { formatCurrency } from '../../utils/formatters';
import type { Unit } from '../../types';

type UnitsStackParamList = {
  UnitsList: undefined;
  UnitDetail: { id: string };
  UnitForm: { unit?: Unit } | undefined;
};

type NavigationProp = NativeStackNavigationProp<UnitsStackParamList, 'UnitsList'>;

type FilterType = 'all' | 'debt' | 'occupied' | 'vacant';

export default function UnitsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [filters] = useState({ page: 1, page_size: 100 }); 
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const { data, isLoading, isError, refetch, isFetching } = useUnits(filters);

  const handleAddUnit = () => {
    navigation.navigate('UnitForm');
  };

  const handleUnitPress = (unit: Unit) => {
    navigation.navigate('UnitDetail', { id: unit.id });
  };

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Filtrado Lógico (Cliente)
  const filteredUnits = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((unit: Unit) => {
      // 1. Filtro de Texto (Búsqueda)
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        unit.unit_number.toLowerCase().includes(query) ||
        (unit.owner_name && unit.owner_name.toLowerCase().includes(query)) ||
        (unit.building && unit.building.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 2. Filtro de Categoría (Chips)
      const balance = parseFloat(unit.balance?.toString() || '0');
      
      if (activeFilter === 'debt') return balance < -1; // Con deuda
      if (activeFilter === 'occupied') return unit.status === 'occupied';
      if (activeFilter === 'vacant') return unit.status === 'vacant';

      return true; // 'all'
    });
  }, [data?.items, searchQuery, activeFilter]);

  const getStatusColor = (status: string, balance: number) => {
    if (balance < -1) return { color: '#EF4444', bg: '#FEE2E2', label: 'Adeudo' };
    if (status === 'occupied') return { color: '#10B981', bg: '#ECFDF5', label: 'Ocupada' };
    if (status === 'vacant') return { color: '#6366F1', bg: '#EEF2FF', label: 'Vacante' };
    return { color: '#F59E0B', bg: '#FFFBEB', label: 'Mant.' };
  };

  // ✅ CORRECCIÓN AQUÍ: Usamos useMemo en lugar de una función normal.
  // Esto evita que el Header se desmonte y pierda el foco del TextInput al escribir.
  const headerComponent = useMemo(() => {
    const summary = data?.summary;
    const totalDebt = parseFloat(summary?.total_debt?.toString() || '0');

    return (
      <View style={styles.headerContainer}>
        {/* Estadísticas Rápidas */}
        {summary && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="home" size={16} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.statValue}>{summary.total_units}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
              </View>
              <View>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>
                  {summary.units_with_debt}
                </Text>
                <Text style={styles.statLabel}>Morosos</Text>
              </View>
            </View>

            <View style={[styles.statCard, { flex: 1.5 }]}> 
              <View style={[styles.statIcon, { backgroundColor: '#FFF7ED' }]}>
                <Feather name="dollar-sign" size={16} color="#D97706" />
              </View>
              <View>
                <Text style={[styles.statValue, { color: '#D97706', fontSize: 13 }]}>
                  {formatCurrency(Math.abs(totalDebt))}
                </Text>
                <Text style={styles.statLabel}>Deuda Total</Text>
              </View>
            </View>
          </View>
        )}

        {/* Buscador */}
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por número o nombre..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros (Chips) */}
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
  }, [data?.summary, searchQuery, activeFilter]); // Dependencias para actualizar si cambian datos

  const renderItem = ({ item }: { item: Unit }) => {
    const balance = parseFloat(item.balance?.toString() || '0');
    const statusInfo = getStatusColor(item.status || 'occupied', balance);
    const hasDebt = balance < -1;

    return (
      <TouchableOpacity 
        style={[styles.card, hasDebt && styles.cardDebt]} 
        onPress={() => handleUnitPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.unitBadge, { backgroundColor: hasDebt ? '#FEF2F2' : '#EEF2FF' }]}>
            <Text style={[styles.unitNumber, { color: hasDebt ? '#EF4444' : '#4F46E5' }]}>
              {item.unit_number}
            </Text>
          </View>
          <View style={styles.unitInfo}>
            <Text style={styles.ownerName} numberOfLines={1}>
              {item.owner_name || 'Sin propietario'}
            </Text>
            <Text style={styles.buildingInfo}>
              {item.building ? `Torre ${item.building}` : ''}
              {item.building && item.floor ? ' • ' : ''}
              {item.floor ? `Piso ${item.floor}` : ''}
              {!item.building && !item.floor ? 'Sin ubicación' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          {hasDebt ? (
            <View style={styles.debtContainer}>
              <Text style={styles.debtLabel}>Adeudo</Text>
              <Text style={styles.debtAmount}>{formatCurrency(Math.abs(balance))}</Text>
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

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando viviendas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Viviendas</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddUnit}>
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredUnits}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        // ✅ Pasamos el componente memorizado
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No se encontraron viviendas</Text>
            <Text style={styles.emptySubtitle}>Intenta ajustar los filtros o agrega una nueva</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl 
            refreshing={isFetching && !isLoading} 
            onRefresh={onRefresh}
            colors={['#4F46E5']}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  addButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },

  // Header Container
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

  // States
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
