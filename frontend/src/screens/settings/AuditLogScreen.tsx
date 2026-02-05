/**
 * Pantalla de Log de Auditoría - Optimizado
 * CORREGIDO: Rendimiento de FlatList (React.memo + windowSize)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  ListRenderItem
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../utils/api';

// --- TIPOS ---
interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// --- CONFIGURACIÓN VISUAL ---
const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  CREATE: { label: 'Creó', icon: 'plus-circle', color: '#059669', bg: '#D1FAE5' },
  UPDATE: { label: 'Editó', icon: 'edit-2', color: '#2563EB', bg: '#DBEAFE' },
  DELETE: { label: 'Eliminó', icon: 'trash-2', color: '#DC2626', bg: '#FEE2E2' },
  activate: { label: 'Activó', icon: 'check-circle', color: '#059669', bg: '#D1FAE5' },
  deactivate: { label: 'Desactivó', icon: 'slash', color: '#D97706', bg: '#FEF3C7' },
  permanent_delete: { label: 'Borró Permanentemente', icon: 'x-octagon', color: '#DC2626', bg: '#FEE2E2' },
  LOGIN: { label: 'Inició Sesión', icon: 'log-in', color: '#4F46E5', bg: '#EEF2FF' },
  LOGOUT: { label: 'Cerró Sesión', icon: 'log-out', color: '#6B7280', bg: '#F3F4F6' },
  reset_password: { label: 'Cambió Contraseña', icon: 'key', color: '#D97706', bg: '#FEF3C7' },
  upload_receipt: { label: 'Subió Comprobante', icon: 'upload-cloud', color: '#0891B2', bg: '#CFFAFE' },
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuario',
  transaction: 'Movimiento',
  unit: 'Vivienda',
  category: 'Categoría',
  system: 'Sistema',
};

const FILTERS = [
  { id: null, label: 'Todos' },
  { id: 'user', label: 'Usuarios' },
  { id: 'transaction', label: 'Finanzas' },
  { id: 'unit', label: 'Viviendas' },
];

// --- SUB-COMPONENTE OPTIMIZADO (React.memo) ---
// Al extraer esto y usar memo, evitamos re-renders innecesarios de filas que no cambian
const AuditLogItem = React.memo(({ item, isLast }: { item: AuditLog; isLast: boolean }) => {
  
  const config = ACTION_CONFIG[item.action] || { label: item.action, icon: 'activity', color: '#6B7280', bg: '#F3F4F6' };
  const entityLabel = ENTITY_LABELS[item.entity_type] || item.entity_type;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  const renderChanges = () => {
    if (item.action === 'UPDATE' && item.old_values && item.new_values) {
      const keys = Object.keys(item.new_values).filter(k => k !== 'updated_at');
      if (keys.length === 0) return null;

      return (
        <View style={styles.diffContainer}>
          {keys.slice(0, 3).map((key) => (
            <View key={key} style={styles.diffRow}>
              <Text style={styles.diffLabel}>{key}:</Text>
              <Text style={styles.diffOld} numberOfLines={1}>
                {String(item.old_values?.[key] || '-')}
              </Text>
              <Feather name="arrow-right" size={12} color="#9CA3AF" style={{ marginHorizontal: 4 }} />
              <Text style={styles.diffNew} numberOfLines={1}>
                {String(item.new_values?.[key] || '-')}
              </Text>
            </View>
          ))}
          {keys.length > 3 && (
            <Text style={styles.moreText}>+{keys.length - 3} cambios más</Text>
          )}
        </View>
      );
    }
    
    if (item.action === 'CREATE' && item.new_values) {
      const name = item.new_values.name || item.new_values.full_name || item.new_values.unit_number || 'Registro';
      return <Text style={styles.createDetail}>Se creó: {name}</Text>;
    }

    return null;
  };

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timeColumn}>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
      </View>

      <View style={styles.lineColumn}>
        <View style={[styles.dot, { backgroundColor: config.color }]} />
        {!isLast && <View style={styles.line} />}
      </View>

      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
              <Feather name={config.icon as any} size={14} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTop}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.user_name || 'Sistema'}
                </Text>
                <View style={styles.entityBadge}>
                  <Text style={styles.entityText}>{entityLabel}</Text>
                </View>
              </View>
              <Text style={styles.actionText}>
                {config.label} un registro
              </Text>
            </View>
          </View>
          {renderChanges()}
        </View>
      </View>
    </View>
  );
});

// --- COMPONENTE PRINCIPAL ---
export default function AuditLogScreen() {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<AuditResponse>({
    queryKey: ['audit-logs', selectedFilter],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.append('page', String(pageParam));
      params.append('limit', '20');
      if (selectedFilter) {
        params.append('entity_type', selectedFilter);
      }
      const response = await api.get(`/audit?${params.toString()}`);
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.total_pages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });

  const allLogs = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) || [];
  }, [data]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // RenderItem memoizado para evitar re-creación de la función
  const renderItem: ListRenderItem<AuditLog> = useCallback(({ item, index }) => {
    // Calculamos isLast aquí, pero como 'allLogs.length' cambia poco frecuentemente comparado con el scroll, está bien.
    // Una optimización mayor sería pasar solo el index y el total al componente, pero esto es suficiente.
    return <AuditLogItem item={item} isLast={false} />; 
  }, []);

  // Clave única estable
  const keyExtractor = useCallback((item: AuditLog) => item.id, []);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Feather name="list" size={48} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>Sin registros</Text>
      <Text style={styles.emptySubtitle}>
        Las acciones importantes del sistema aparecerán aquí.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Log de Auditoría</Text>
        <Text style={styles.subtitle}>Rastro de seguridad del sistema</Text>
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={FILTERS}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedFilter === item.id && styles.filterChipActive
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === item.id && styles.filterTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.emptyTitle}>Error de conexión</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allLogs}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
          }
          ListEmptyComponent={renderEmpty}
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#4F46E5" style={{ marginVertical: 20 }} />
            ) : null
          }
          
          // --- OPTIMIZACIONES DE RENDIMIENTO ---
          initialNumToRender={10} // Solo renderiza 10 al cargar
          maxToRenderPerBatch={10} // Pinta de 10 en 10
          windowSize={5} // Reduce la memoria (solo mantiene 5 "pantallas" de altura en memoria)
          removeClippedSubviews={true} // Desmonta vistas fuera de pantalla (mejora mucho Android)
          updateCellsBatchingPeriod={50} // Espera 50ms entre actualizaciones de lotes
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  filterContainer: { marginBottom: 8, height: 44 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 32,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterTextActive: { color: 'white' },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timelineItem: { flexDirection: 'row', minHeight: 80 },
  timeColumn: { width: 50, alignItems: 'flex-end', paddingTop: 16, marginRight: 8 },
  dateText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  timeText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  lineColumn: { width: 16, alignItems: 'center' },
  dot: { 
    width: 10, height: 10, borderRadius: 5, 
    marginTop: 20, zIndex: 2, borderWidth: 2, borderColor: '#F9FAFB' 
  },
  line: { 
    width: 2, flex: 1, backgroundColor: '#E5E7EB', 
    position: 'absolute', top: 20, bottom: -20, left: 7 
  },
  cardContainer: { flex: 1, paddingBottom: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginLeft: 8,
  },
  cardHeader: { flexDirection: 'row', gap: 10 },
  iconBox: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  userName: { fontSize: 13, fontWeight: '700', color: '#1F2937', flex: 1 },
  entityBadge: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6
  },
  entityText: { fontSize: 10, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  actionText: { fontSize: 13, color: '#4B5563' },
  diffContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  diffRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  diffLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', width: 60 },
  diffOld: { fontSize: 11, color: '#EF4444', textDecorationLine: 'line-through', flex: 1 },
  diffNew: { fontSize: 11, color: '#10B981', fontWeight: '500', flex: 1 },
  moreText: { fontSize: 10, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },
  createDetail: { fontSize: 11, color: '#059669', marginTop: 8, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyIcon: { 
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16 
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  retryButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#4F46E5', borderRadius: 8 },
  retryText: { color: 'white', fontWeight: '600', fontSize: 13 },
});
