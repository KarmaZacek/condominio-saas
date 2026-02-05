/**
 * Pantalla de Lista de Usuarios - Diseño Admin Panel
 * Gestión de usuarios con filtros rápidos y búsqueda
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUsers, User } from '../../hooks/useUsers';
import { useDebounce } from '../../hooks/useDebounce';

type UsersStackParamList = {
  UsersList: undefined;
  UserForm: { userId?: string };
  UserDetail: { userId: string };
};

type NavigationProp = NativeStackNavigationProp<UsersStackParamList>;

// Configuración visual de roles
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: '#7C3AED', bg: '#F3E8FF' },        // Violeta
  resident: { label: 'Residente', color: '#059669', bg: '#D1FAE5' }, // Verde
  accountant: { label: 'Contador', color: '#2563EB', bg: '#DBEAFE' }, // Azul
  readonly: { label: 'Lectura', color: '#6B7280', bg: '#F3F4F6' },    // Gris
};

const FILTERS = [
  { id: null, label: 'Todos' },
  { id: 'resident', label: 'Residentes' },
  { id: 'admin', label: 'Admins' },
  { id: 'accountant', label: 'Contadores' },
];

export default function UsersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  
  // Búsqueda con debounce para no saturar la API
  const debouncedSearch = useDebounce(search, 400);
  
  const { data, isLoading, refetch, isFetching } = useUsers({
    search: debouncedSearch || undefined,
    role: roleFilter || undefined,
    limit: 50,
  });

  const users = data?.data || [];

  const handleAddUser = () => {
    navigation.navigate('UserForm', {});
  };

  const getInitials = (name: string) => name?.slice(0, 2).toUpperCase() || 'U';

  const renderUserItem = useCallback(({ item }: { item: User }) => {
    const roleStyle = ROLE_CONFIG[item.role] || ROLE_CONFIG.resident;
    const isLocked = item.locked_until && new Date(item.locked_until) > new Date();
    const isActive = item.is_active;

    return (
      <TouchableOpacity
        style={[styles.card, !isActive && styles.cardInactive]}
        onPress={() => navigation.navigate('UserDetail', { userId: item.id })}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, !isActive && styles.avatarInactive]}>
              <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
            </View>
          )}
          
          {/* Indicador de estado pequeño sobre el avatar */}
          {isLocked ? (
            <View style={styles.lockedIndicator}>
              <Feather name="lock" size={10} color="white" />
            </View>
          ) : (
            <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#9CA3AF' }]} />
          )}
        </View>
        
        {/* Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, !isActive && styles.textInactive]} numberOfLines={1}>
              {item.full_name}
            </Text>
            {/* Badge de Rol */}
            <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleText, { color: roleStyle.color }]}>
                {roleStyle.label}
              </Text>
            </View>
          </View>
          
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
          
          {/* Detalles extra (Teléfono o Estado texto) */}
          <View style={styles.metaRow}>
            {isLocked ? (
              <Text style={styles.statusTextLocked}>Bloqueado temporalmente</Text>
            ) : !isActive ? (
              <Text style={styles.statusTextInactive}>Cuenta inactiva</Text>
            ) : (
              <Text style={styles.userPhone}>{item.phone || 'Sin teléfono'}</Text>
            )}
          </View>
        </View>
        
        <Feather name="chevron-right" size={20} color="#D1D5DB" />
      </TouchableOpacity>
    );
  }, [navigation]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Buscador */}
      <View style={styles.searchBar}>
        <Feather name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, email..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filtros (Chips) */}
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.label}
            style={[
              styles.filterChip,
              roleFilter === filter.id && styles.filterChipActive
            ]}
            onPress={() => setRoleFilter(filter.id)}
          >
            <Text style={[
              styles.filterText,
              roleFilter === filter.id && styles.filterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Contador de resultados */}
      {!isLoading && (
        <Text style={styles.resultCount}>
          {users.length} usuario{users.length !== 1 ? 's' : ''} encontrado{users.length !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Usuarios</Text>
          <Text style={styles.subtitle}>Gestión de acceso</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
          <Feather name="user-plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {isLoading && !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando usuarios...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={users.length === 0 ? styles.listEmpty : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              colors={['#4F46E5']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No se encontraron usuarios</Text>
              <Text style={styles.emptySubtext}>
                Intenta ajustar los filtros de búsqueda
              </Text>
            </View>
          }
        />
      )}
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
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  addButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },

  // Header Filters
  headerContainer: { padding: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 12,
    paddingHorizontal: 12, height: 48,
    borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1F2937', height: '100%' },
  
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterTextActive: { color: 'white' },
  
  resultCount: { fontSize: 12, color: '#9CA3AF', marginBottom: 4, marginLeft: 4 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
  
  // User Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardInactive: { opacity: 0.8, backgroundColor: '#F9FAFB' },
  
  // Avatar
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatarImage: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  avatarInactive: { backgroundColor: '#E5E7EB' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#4F46E5' },
  
  // Status Dots
  statusDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: 'white',
  },
  lockedIndicator: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#EF4444', width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
  },

  // Info
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginRight: 8, flexShrink: 1 },
  textInactive: { color: '#6B7280' },
  
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  
  userEmail: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  userPhone: { fontSize: 12, color: '#9CA3AF' },
  statusTextLocked: { fontSize: 12, color: '#EF4444', fontWeight: '500' },
  statusTextInactive: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  // States
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280' },
  
  emptyState: { alignItems: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
});
