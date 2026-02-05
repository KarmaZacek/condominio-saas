import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useCreateUnit, useUpdateUnit } from '../../hooks/useUnits';
import { useUsers } from '../../hooks/useUsers';
import { toast } from '../../store/toastStore';

type UnitsStackParamList = {
  UnitsList: undefined;
  UnitDetail: { id: string };
  UnitForm: { unit?: any } | undefined;
};

type RouteProps = RouteProp<UnitsStackParamList, 'UnitForm'>;

// Configuración visual de estados
const STATUS_OPTIONS = [
  { value: 'occupied', label: 'Ocupada', icon: 'user-check', color: '#10B981', bg: '#ECFDF5' }, // Verde
  { value: 'vacant', label: 'Vacante', icon: 'home', color: '#6366F1', bg: '#EEF2FF' },      // Azul
  { value: 'maintenance', label: 'Mant.', icon: 'tool', color: '#F59E0B', bg: '#FFFBEB' },    // Naranja
];

export default function UnitFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const existingUnit = route.params?.unit;
  const isEditing = !!existingUnit;

  // Form state
  const [unitNumber, setUnitNumber] = useState(existingUnit?.unit_number || '');
  const [building, setBuilding] = useState(existingUnit?.building || '');
  const [floor, setFloor] = useState(existingUnit?.floor?.toString() || '');
  const [monthlyFee, setMonthlyFee] = useState(
    existingUnit?.monthly_fee ? parseFloat(existingUnit.monthly_fee).toString() : '1500'
  );
  const [notes, setNotes] = useState(existingUnit?.notes || '');
  const [status, setStatus] = useState(existingUnit?.status || 'occupied');
  
  // Selectores de Personas
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');

  // Cargar usuarios
  const { data: usersData, isLoading: loadingUsers } = useUsers({ 
    limit: 100,
    is_active: true 
  });

  // Filtrado de usuarios
  const availableUsers = (usersData?.data || []).filter((user: any) => 
    user.role === 'resident' || user.role === 'admin'
  );

  const getFilteredUsers = (search: string, excludeId?: string) => {
    return availableUsers
      .filter((user: any) => user.id !== excludeId)
      .filter((user: any) =>
        user.full_name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
  };

  // Cargar datos existentes
  useEffect(() => {
    if (usersData?.data) {
      if (existingUnit?.owner_user_id) {
        const owner = usersData.data.find((u: any) => u.id === existingUnit.owner_user_id);
        if (owner) setSelectedOwner(owner);
      }
      if (existingUnit?.tenant_user_id) {
        const tenant = usersData.data.find((u: any) => u.id === existingUnit.tenant_user_id);
        if (tenant) setSelectedTenant(tenant);
      }
    }
  }, [existingUnit, usersData]);

  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    if (!unitNumber.trim()) {
      Alert.alert('Falta información', 'Ingresa el número de vivienda');
      return;
    }
    if (!monthlyFee || parseFloat(monthlyFee) <= 0) {
      Alert.alert('Falta información', 'Ingresa una cuota mensual válida');
      return;
    }

    const unitData = {
      unit_number: unitNumber.trim(),
      building: building.trim() || null,
      floor: floor ? parseInt(floor) : null,
      monthly_fee: parseFloat(monthlyFee),
      notes: notes.trim() || null,
      status,
      owner_user_id: selectedOwner?.id || null,
      tenant_user_id: selectedTenant?.id || null,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: existingUnit.id, ...unitData });
        toast.success('Vivienda actualizada');
      } else {
        await createMutation.mutateAsync(unitData);
        toast.success('Vivienda creada');
      }
      navigation.goBack();
    } catch (error: any) {
      const errorDetail = error?.response?.data?.detail;
      const errorMessage = typeof errorDetail === 'object' 
        ? errorDetail.message 
        : errorDetail || 'No se pudo guardar';
      Alert.alert('Error', errorMessage);
    }
  };

  // Renderizado de tarjeta de usuario seleccionado
  const renderUserCard = (user: any, onClear: () => void, placeholder: string, onPress: () => void, iconColor: string) => {
    if (!user) {
      return (
        <TouchableOpacity style={styles.emptyUserCard} onPress={onPress}>
          <View style={[styles.emptyUserIcon, { backgroundColor: iconColor + '20' }]}>
            <Feather name="user-plus" size={24} color={iconColor} />
          </View>
          <Text style={styles.emptyUserText}>{placeholder}</Text>
          <Feather name="chevron-right" size={20} color="#D1D5DB" />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.userCard}>
        <View style={[styles.userAvatar, { backgroundColor: iconColor + '20' }]}>
          <Feather name="user" size={24} color={iconColor} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.full_name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={[styles.roleTag, { backgroundColor: user.role === 'admin' ? '#FEF2F2' : '#F0FDF4' }]}>
            <Text style={[styles.roleTagText, { color: user.role === 'admin' ? '#DC2626' : '#16A34A' }]}>
              {user.role === 'admin' ? 'Administrador' : 'Residente'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.removeUserBtn} onPress={onClear}>
          <Feather name="x" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* === CUOTA MENSUAL (HERO) === */}
          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>Cuota Mensual</Text>
            <View style={styles.heroInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.heroInput}
                value={monthlyFee}
                onChangeText={setMonthlyFee}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="#D1D5DB"
              />
            </View>
          </View>

          {/* === DETALLES DE UBICACIÓN === */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Número de Vivienda *</Text>
              <TextInput
                style={styles.input}
                value={unitNumber}
                onChangeText={setUnitNumber}
                placeholder="Ej: 101, 202A"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Edificio / Torre</Text>
                <TextInput
                  style={styles.input}
                  value={building}
                  onChangeText={setBuilding}
                  placeholder="Ej: Torre A"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Piso</Text>
                <TextInput
                  style={styles.input}
                  value={floor}
                  onChangeText={setFloor}
                  placeholder="Ej: 1"
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>

          {/* === ESTADO === */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado Actual</Text>
            <View style={styles.statusContainer}>
              {STATUS_OPTIONS.map((option) => {
                const isActive = status === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusCard,
                      isActive && { backgroundColor: option.bg, borderColor: option.color }
                    ]}
                    onPress={() => setStatus(option.value)}
                  >
                    <Feather 
                      name={option.icon as any} 
                      size={20} 
                      color={isActive ? option.color : '#9CA3AF'} 
                    />
                    <Text style={[
                      styles.statusLabel,
                      isActive && { color: option.color, fontWeight: '700' }
                    ]}>{option.label}</Text>
                    {isActive && (
                      <View style={[styles.activeDot, { backgroundColor: option.color }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* === PERSONAS === */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Asignaciones</Text>
            
            <Text style={styles.label}>Propietario</Text>
            {renderUserCard(
              selectedOwner, 
              () => setSelectedOwner(null), 
              "Asignar Propietario", 
              () => setShowOwnerModal(true),
              "#4F46E5" // Índigo
            )}

            <View style={{ height: 16 }} />

            <Text style={styles.label}>Arrendatario / Inquilino</Text>
            {renderUserCard(
              selectedTenant, 
              () => setSelectedTenant(null), 
              "Asignar Inquilino (Opcional)", 
              () => setShowTenantModal(true),
              "#10B981" // Verde
            )}
          </View>

          {/* === NOTAS === */}
          <View style={styles.section}>
            <Text style={styles.label}>Notas internas</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Información adicional visible solo para administradores..."
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, isPending && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name={isEditing ? "save" : "plus-circle"} size={20} color="white" />
                <Text style={styles.submitText}>
                  {isEditing ? 'Guardar Cambios' : 'Registrar Vivienda'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* --- MODALES REUTILIZABLES --- */}
      {[
        { 
          visible: showOwnerModal, 
          close: () => setShowOwnerModal(false), 
          search: ownerSearch, 
          setSearch: setOwnerSearch, 
          title: "Seleccionar Propietario",
          color: "#4F46E5",
          data: getFilteredUsers(ownerSearch),
          onSelect: (u: any) => { setSelectedOwner(u); setShowOwnerModal(false); setOwnerSearch(''); }
        },
        { 
          visible: showTenantModal, 
          close: () => setShowTenantModal(false), 
          search: tenantSearch, 
          setSearch: setTenantSearch, 
          title: "Seleccionar Inquilino",
          color: "#10B981",
          data: getFilteredUsers(tenantSearch, selectedOwner?.id),
          onSelect: (u: any) => { setSelectedTenant(u); setShowTenantModal(false); setTenantSearch(''); }
        }
      ].map((modalProps, idx) => (
        <Modal
          key={idx}
          visible={modalProps.visible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={modalProps.close}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalProps.title}</Text>
              <TouchableOpacity onPress={modalProps.close} style={styles.closeBtn}>
                <Feather name="x" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Feather name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar usuario..."
                value={modalProps.search}
                onChangeText={modalProps.setSearch}
                autoFocus={false}
              />
            </View>

            <FlatList
              data={modalProps.data}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No se encontraron usuarios</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalUserItem}
                  onPress={() => modalProps.onSelect(item)}
                >
                  <View style={[styles.modalAvatar, { backgroundColor: modalProps.color + '20' }]}>
                    <Text style={[styles.modalInitials, { color: modalProps.color }]}>
                      {item.full_name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalUserName}>{item.full_name}</Text>
                    <Text style={styles.modalUserEmail}>{item.email}</Text>
                  </View>
                  <Feather name="plus" size={20} color={modalProps.color} />
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, padding: 20 },
  
  // Hero Section (Dinero)
  heroSection: { alignItems: 'center', marginBottom: 32, marginTop: 10 },
  heroLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500', marginBottom: 8 },
  heroInputContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 32, fontWeight: '600', color: '#9CA3AF', marginRight: 4 },
  heroInput: { fontSize: 48, fontWeight: '800', color: '#1F2937', minWidth: 120, textAlign: 'center' },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  
  // Inputs
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6 },
  inputGroup: { marginBottom: 12 },
  input: {
    backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, fontSize: 16, color: '#1F2937'
  },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  textArea: {
    backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, fontSize: 16, color: '#1F2937', minHeight: 100, textAlignVertical: 'top'
  },

  // Status Cards
  statusContainer: { flexDirection: 'row', gap: 10 },
  statusCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 8,
    backgroundColor: 'white', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    position: 'relative', overflow: 'hidden'
  },
  statusLabel: { fontSize: 12, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  activeDot: { 
    position: 'absolute', top: 8, right: 8, 
    width: 6, height: 6, borderRadius: 3 
  },

  // User Cards
  emptyUserCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
    gap: 12
  },
  emptyUserIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyUserText: { flex: 1, color: '#6B7280', fontSize: 15, fontWeight: '500' },
  
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    gap: 12
  },
  userAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  userEmail: { fontSize: 13, color: '#6B7280' },
  roleTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  roleTagText: { fontSize: 10, fontWeight: '700' },
  removeUserBtn: { padding: 8 },

  // Footer
  footer: {
    padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6'
  },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4F46E5', borderRadius: 16, padding: 16, gap: 8,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
  },
  disabledButton: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', margin: 16, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 16 },
  modalUserItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  modalAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalInitials: { fontWeight: '700' },
  modalUserName: { fontWeight: '600', color: '#1F2937' },
  modalUserEmail: { fontSize: 12, color: '#6B7280' },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: '#9CA3AF' }
});
