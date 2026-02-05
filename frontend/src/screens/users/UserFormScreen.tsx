/**
 * Pantalla de Formulario de Usuario - Diseño Moderno
 * Creación y Edición con selectores visuales y validación en tiempo real
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useUser, useCreateUser, useUpdateUser } from '../../hooks/useUsers';
import { toast } from '../../store/toastStore';

type RouteParams = {
  UserForm: { userId?: string };
};

const ROLES = [
  { value: 'resident', label: 'Residente', icon: 'user', color: '#059669', bg: '#D1FAE5', desc: 'Acceso básico a su vivienda' },
  { value: 'admin', label: 'Administrador', icon: 'shield', color: '#7C3AED', bg: '#F3E8FF', desc: 'Control total del sistema' },
  { value: 'accountant', label: 'Contador', icon: 'briefcase', color: '#2563EB', bg: '#DBEAFE', desc: 'Acceso a reportes financieros' },
];

const BOARD_POSITIONS = [
  { value: '', label: 'Sin Cargo', icon: 'minus' },
  { value: 'president', label: 'Presidente', icon: 'award' },
  { value: 'treasurer', label: 'Tesorero', icon: 'dollar-sign' },
  { value: 'secretary', label: 'Secretario', icon: 'file-text' },
];

export default function UserFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'UserForm'>>();
  const userId = route.params?.userId;
  const isEditing = !!userId;

  const { data: user, isLoading: loadingUser } = useUser(userId || '');
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'resident',
    board_position: '',
    is_active: true,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Cargar datos al editar
  useEffect(() => {
    if (user && isEditing) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        confirmPassword: '',
        role: user.role || 'resident',
        board_position: user.board_position || '',
        is_active: user.is_active,
      });
    }
  }, [user, isEditing]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) newErrors.full_name = 'Nombre requerido';
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!isEditing) {
      if (!formData.password) {
        newErrors.password = 'Contraseña requerida';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Mínimo 8 caracteres';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Por favor corrige los errores');
      return;
    }

    try {
      if (isEditing) {
        await updateUser.mutateAsync({
          id: userId!,
          data: {
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || undefined,
            role: formData.role,
            board_position: formData.board_position || undefined,
            is_active: formData.is_active,
          },
        });
        toast.success('Usuario actualizado');
      } else {
        await createUser.mutateAsync({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone || undefined,
          password: formData.password,
          role: formData.role,
          board_position: formData.board_position || undefined,
        });
        toast.success('Usuario creado con éxito');
      }
      navigation.goBack();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Error al guardar usuario';
      Alert.alert('Error', message);
    }
  };

  const isSubmitting = createUser.isPending || updateUser.isPending;

  // Renderizadores de requisitos de contraseña
  const renderPasswordRequirement = (condition: boolean, text: string) => (
    <View style={styles.reqRow}>
      <Feather 
        name={condition ? 'check-circle' : 'circle'} 
        size={14} 
        color={condition ? '#10B981' : '#9CA3AF'} 
      />
      <Text style={[styles.reqText, condition && styles.reqTextValid]}>{text}</Text>
    </View>
  );

  if (isEditing && loadingUser) {
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* SECCIÓN 1: IDENTIDAD */}
          <Text style={styles.sectionTitle}>Identidad</Text>
          <View style={styles.card}>
            {/* Nombre */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre Completo</Text>
              <TextInput
                style={[styles.input, errors.full_name && styles.inputError]}
                value={formData.full_name}
                onChangeText={(t) => setFormData({ ...formData, full_name: t })}
                placeholder="Ej. Juan Pérez"
                placeholderTextColor="#9CA3AF"
              />
              {errors.full_name && <Text style={styles.errorText}>{errors.full_name}</Text>}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Teléfono */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Teléfono (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                placeholder="Ej. 33 1234 5678"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* SECCIÓN 2: SEGURIDAD (Solo creación) */}
          {!isEditing && (
            <>
              <Text style={styles.sectionTitle}>Seguridad</Text>
              <View style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={[styles.passwordContainer, errors.password && styles.inputError]}>
                    <TextInput
                      style={styles.passwordInput}
                      value={formData.password}
                      onChangeText={(t) => setFormData({ ...formData, password: t })}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Requisitos visuales */}
                  <View style={styles.requirementsBox}>
                    {renderPasswordRequirement(formData.password.length >= 8, 'Mínimo 8 caracteres')}
                    {renderPasswordRequirement(/[A-Z]/.test(formData.password), 'Una mayúscula')}
                    {renderPasswordRequirement(/[0-9]/.test(formData.password), 'Un número')}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmar Contraseña</Text>
                  <TextInput
                    style={[styles.input, errors.confirmPassword && styles.inputError]}
                    value={formData.confirmPassword}
                    onChangeText={(t) => setFormData({ ...formData, confirmPassword: t })}
                    placeholder="Repite la contraseña"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                  />
                  {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                </View>
              </View>
            </>
          )}

          {/* SECCIÓN 3: PERMISOS */}
          <Text style={styles.sectionTitle}>Roles y Permisos</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Rol en el Sistema</Text>
            <View style={styles.rolesGrid}>
              {ROLES.map((role) => {
                const isSelected = formData.role === role.value;
                return (
                  <TouchableOpacity
                    key={role.value}
                    style={[styles.roleCard, isSelected && { borderColor: role.color, backgroundColor: role.bg }]}
                    onPress={() => setFormData({ ...formData, role: role.value })}
                  >
                    <Feather 
                      name={role.icon as any} 
                      size={24} 
                      color={isSelected ? role.color : '#9CA3AF'} 
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={[styles.roleLabel, isSelected && { color: role.color }]}>{role.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helperText}>
              {ROLES.find(r => r.value === formData.role)?.desc}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.label}>Cargo (Mesa Directiva)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardScroll}>
              {BOARD_POSITIONS.map((pos) => {
                const isSelected = formData.board_position === pos.value;
                return (
                  <TouchableOpacity
                    key={pos.value}
                    style={[styles.boardChip, isSelected && styles.boardChipSelected]}
                    onPress={() => setFormData({ ...formData, board_position: pos.value })}
                  >
                    <Feather 
                      name={pos.icon as any} 
                      size={16} 
                      color={isSelected ? 'white' : '#6B7280'} 
                    />
                    <Text style={[styles.boardLabel, isSelected && styles.boardLabelSelected]}>
                      {pos.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* SECCIÓN 4: ESTADO (Solo edición) */}
          {isEditing && (
            <>
              <Text style={styles.sectionTitle}>Estado de la Cuenta</Text>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <View style={[styles.statusIcon, { backgroundColor: formData.is_active ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Feather 
                        name={formData.is_active ? "check" : "x"} 
                        size={20} 
                        color={formData.is_active ? "#059669" : "#DC2626"} 
                      />
                    </View>
                    <View>
                      <Text style={styles.switchLabel}>
                        {formData.is_active ? 'Usuario Activo' : 'Usuario Inactivo'}
                      </Text>
                      <Text style={styles.switchDesc}>
                        {formData.is_active ? 'Puede iniciar sesión' : 'Acceso bloqueado'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setFormData({...formData, is_active: !formData.is_active})}
                    style={[styles.toggleBtn, formData.is_active ? styles.toggleOn : styles.toggleOff]}
                  >
                    <View style={[styles.toggleCircle, formData.is_active && styles.toggleCircleOn]} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER FLOTANTE */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Feather name="save" size={20} color="white" />
              <Text style={styles.submitText}>
                {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },

  content: { padding: 16 },
  
  // Sections
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // Inputs
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 },

  // Password
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  passwordInput: { flex: 1, padding: 14, fontSize: 16, color: '#1F2937' },
  eyeBtn: { padding: 14 },
  requirementsBox: { marginTop: 8, gap: 4 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: 12, color: '#9CA3AF' },
  reqTextValid: { color: '#10B981', fontWeight: '500' },

  // Roles Grid
  rolesGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  roleCard: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  helperText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontStyle: 'italic', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },

  // Board Positions
  boardScroll: { gap: 8, paddingBottom: 4 },
  boardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  boardChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  boardLabel: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  boardLabelSelected: { color: 'white' },

  // Status Switch
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  switchDesc: { fontSize: 12, color: '#6B7280' },
  
  // Custom Toggle
  toggleBtn: { width: 50, height: 28, borderRadius: 14, padding: 2 },
  toggleOn: { backgroundColor: '#4F46E5' },
  toggleOff: { backgroundColor: '#E5E7EB' },
  toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'white' },
  toggleCircleOn: { alignSelf: 'flex-end' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    paddingBottom: 32, // For iPhone home bar
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
