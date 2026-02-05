/**
 * Pantalla de Detalle de Usuario
 * Ver información, activar/desactivar, desbloquear, resetear contraseña, eliminar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  useUser, 
  useDeleteUser, 
  useUnlockUser, 
  useResetUserPassword,
  useActivateUser,
  useDeleteUserPermanent 
} from '../../hooks/useUsers';
import { toast } from '../../store/toastStore';
import { formatDate } from '../../utils/formatters';

type RouteParams = {
  UserDetail: { userId: string };
};

type UsersStackParamList = {
  UsersList: undefined;
  UserForm: { userId?: string };
  UserDetail: { userId: string };
};

type NavigationProp = NativeStackNavigationProp<UsersStackParamList>;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  resident: 'Residente',
  accountant: 'Contador',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: '#FEE2E2', text: '#DC2626' },
  resident: { bg: '#DBEAFE', text: '#2563EB' },
  accountant: { bg: '#D1FAE5', text: '#059669' },
};

export default function UserDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'UserDetail'>>();
  const { userId } = route.params;

  const { data: user, isLoading, refetch } = useUser(userId);
  const deleteUser = useDeleteUser();
  const activateUser = useActivateUser();
  const deleteUserPermanent = useDeleteUserPermanent();
  const unlockUser = useUnlockUser();
  const resetPassword = useResetUserPassword();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const isLocked = user?.locked_until && new Date(user.locked_until) > new Date();
  const roleStyle = ROLE_COLORS[user?.role || 'resident'];
  const hasTransactions = (user?.transaction_count || 0) > 0;

  // Desactivar usuario (soft delete)
  const handleDeactivate = () => {
    Alert.alert(
      'Desactivar Usuario',
      `¿Estás seguro de desactivar a "${user?.full_name}"?\n\nEl usuario no podrá iniciar sesión hasta que lo reactives.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser.mutateAsync(userId);
              toast.success('Usuario desactivado');
              refetch();
            } catch (error: any) {
              const message = error.response?.data?.detail || 'Error al desactivar usuario';
              toast.error(message);
            }
          },
        },
      ]
    );
  };

  // Activar usuario
  const handleActivate = async () => {
    try {
      await activateUser.mutateAsync(userId);
      toast.success('Usuario activado correctamente');
      refetch();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Error al activar usuario';
      toast.error(message);
    }
  };

  // Eliminar permanentemente
  const handleDeletePermanent = () => {
    if (hasTransactions) {
      Alert.alert(
        'No se puede eliminar',
        `El usuario tiene ${user?.transaction_count} transacciones asociadas.\n\nPara mantener la integridad de los registros, solo puedes desactivar este usuario.`,
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      '⚠️ Eliminar Permanentemente',
      `¿Estás COMPLETAMENTE seguro de eliminar a "${user?.full_name}" de forma permanente?\n\n⛔ Esta acción NO se puede deshacer.\n⛔ Todos los datos del usuario serán eliminados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Eliminar',
          style: 'destructive',
          onPress: () => {
            // Segunda confirmación
            Alert.alert(
              'Última confirmación',
              'Esta es tu última oportunidad. ¿Eliminar permanentemente?',
              [
                { text: 'No, cancelar', style: 'cancel' },
                {
                  text: 'Eliminar',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteUserPermanent.mutateAsync(userId);
                      toast.success('Usuario eliminado permanentemente');
                      navigation.goBack();
                    } catch (error: any) {
                      const detail = error.response?.data?.detail;
                      const message = typeof detail === 'string' ? detail : 'Error al eliminar usuario';
                      toast.error(message);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleUnlock = async () => {
    try {
      await unlockUser.mutateAsync(userId);
      toast.success('Usuario desbloqueado');
      refetch();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Error al desbloquear usuario';
      toast.error(message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('La contraseña debe contener al menos una mayúscula');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error('La contraseña debe contener al menos una minúscula');
      return;
    }
    if (!/\d/.test(newPassword)) {
      toast.error('La contraseña debe contener al menos un número');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setResettingPassword(true);
    try {
      await resetPassword.mutateAsync({ userId, newPassword });
      toast.success('Contraseña actualizada');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Error al resetear contraseña';
      toast.error(message);
    } finally {
      setResettingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Feather name="user-x" size={48} color="#D1D5DB" />
          <Text style={styles.errorText}>Usuario no encontrado</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
            <Text style={styles.backLinkText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Usuario</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('UserForm', { userId })}
        >
          <Feather name="edit-2" size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, !user.is_active && styles.avatarInactive]}>
                <Text style={styles.avatarText}>
                  {user.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isLocked && (
              <View style={styles.lockedOverlay}>
                <Feather name="lock" size={24} color="white" />
              </View>
            )}
          </View>

          <Text style={[styles.userName, !user.is_active && styles.inactiveText]}>
            {user.full_name}
          </Text>

          <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
            <Text style={[styles.roleText, { color: roleStyle.text }]}>
              {ROLE_LABELS[user.role]}
            </Text>
          </View>

          {/* Status badges */}
          <View style={styles.statusRow}>
            {!user.is_active && (
              <View style={styles.statusBadge}>
                <Feather name="x-circle" size={14} color="#6B7280" />
                <Text style={styles.statusBadgeText}>Inactivo</Text>
              </View>
            )}
            {isLocked && (
              <View style={[styles.statusBadge, styles.lockedBadge]}>
                <Feather name="lock" size={14} color="#DC2626" />
                <Text style={[styles.statusBadgeText, styles.lockedText]}>Bloqueado</Text>
              </View>
            )}
            {user.email_verified && (
              <View style={[styles.statusBadge, styles.verifiedBadge]}>
                <Feather name="check-circle" size={14} color="#10B981" />
                <Text style={[styles.statusBadgeText, styles.verifiedText]}>Verificado</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Contacto</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="mail" size={18} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="phone" size={18} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={styles.infoValue}>{user.phone || 'No registrado'}</Text>
            </View>
          </View>
        </View>

        {/* Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="calendar" size={18} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Fecha de registro</Text>
              <Text style={styles.infoValue}>{formatDate(user.created_at)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="clock" size={18} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Último acceso</Text>
              <Text style={styles.infoValue}>
                {user.last_login ? formatDate(user.last_login) : 'Nunca'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="file-text" size={18} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Transacciones registradas</Text>
              <Text style={styles.infoValue}>{user.transaction_count || 0}</Text>
            </View>
          </View>

          {user.failed_login_attempts > 0 && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather name="alert-triangle" size={18} color="#F59E0B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Intentos fallidos</Text>
                <Text style={[styles.infoValue, { color: '#F59E0B' }]}>
                  {user.failed_login_attempts}
                </Text>
              </View>
            </View>
          )}

          {isLocked && user.locked_until && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather name="lock" size={18} color="#DC2626" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Bloqueado hasta</Text>
                <Text style={[styles.infoValue, { color: '#DC2626' }]}>
                  {formatDate(user.locked_until)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones</Text>

          {/* Activar/Desactivar según estado */}
          {!user.is_active ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleActivate}
              disabled={activateUser.isPending}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="user-check" size={20} color="#10B981" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: '#10B981' }]}>Activar Usuario</Text>
                <Text style={styles.actionDesc}>Permitir que el usuario inicie sesión</Text>
              </View>
              {activateUser.isPending ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDeactivate}
              disabled={deleteUser.isPending}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="user-x" size={20} color="#D97706" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Desactivar Usuario</Text>
                <Text style={styles.actionDesc}>Impedir acceso temporalmente</Text>
              </View>
              {deleteUser.isPending ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          )}

          {/* Desbloquear si está bloqueado */}
          {isLocked && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleUnlock}
              disabled={unlockUser.isPending}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Feather name="unlock" size={20} color="#2563EB" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Desbloquear Cuenta</Text>
                <Text style={styles.actionDesc}>Quitar bloqueo por intentos fallidos</Text>
              </View>
              {unlockUser.isPending ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          )}

          {/* Resetear contraseña */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowPasswordModal(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F3E8FF' }]}>
              <Feather name="key" size={20} color="#7C3AED" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Resetear Contraseña</Text>
              <Text style={styles.actionDesc}>Asignar una nueva contraseña</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Eliminar permanentemente */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDeletePermanent}
            disabled={deleteUserPermanent.isPending}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="trash-2" size={20} color="#DC2626" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: '#DC2626' }]}>
                Eliminar Permanentemente
              </Text>
              <Text style={styles.actionDesc}>
                {hasTransactions 
                  ? `No disponible (${user.transaction_count} transacciones)`
                  : 'Esta acción no se puede deshacer'
                }
              </Text>
            </View>
            {deleteUserPermanent.isPending ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Feather 
                name={hasTransactions ? "alert-circle" : "chevron-right"} 
                size={20} 
                color={hasTransactions ? "#DC2626" : "#9CA3AF"} 
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Password Reset Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nueva Contraseña</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Feather name="x" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Requisitos de contraseña:</Text>
              <Text style={styles.requirementItem}>• Mínimo 8 caracteres</Text>
              <Text style={styles.requirementItem}>• Al menos una mayúscula</Text>
              <Text style={styles.requirementItem}>• Al menos una minúscula</Text>
              <Text style={styles.requirementItem}>• Al menos un número</Text>
            </View>

            <Text style={styles.modalLabel}>Nueva contraseña</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Ingresa la nueva contraseña"
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Confirmar contraseña</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite la contraseña"
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              style={[styles.modalButton, resettingPassword && styles.modalButtonDisabled]}
              onPress={handleResetPassword}
              disabled={resettingPassword}
            >
              {resettingPassword ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalButtonText}>Guardar Contraseña</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  backLink: {
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInactive: {
    backgroundColor: '#9CA3AF',
  },
  avatarText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  inactiveText: {
    color: '#9CA3AF',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  lockedBadge: {
    backgroundColor: '#FEE2E2',
  },
  lockedText: {
    color: '#DC2626',
  },
  verifiedBadge: {
    backgroundColor: '#ECFDF5',
  },
  verifiedText: {
    color: '#10B981',
  },

  // Sections
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    marginTop: 2,
  },

  // Actions
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  actionDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalContent: {
    padding: 16,
  },
  passwordRequirements: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 6,
  },
  requirementItem: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#1F2937',
  },
  modalButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
