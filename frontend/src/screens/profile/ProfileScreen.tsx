/**
 * Pantalla de Perfil - Diseño Premium Completo
 * Incluye: Datos, Seguridad, ADMIN, Preferencias, Legales y Soporte
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActionSheetIOS,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import api from '../../utils/api';

// Tipos
interface ProfileData {
  full_name: string;
  phone: string;
}

interface PasswordData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function ProfileScreen() {
  const { user, logout, checkAuth } = useAuthStore();
  const navigation = useNavigation<any>();
  
  // Modales
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Estados Edición
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Estados Password
  const [passwordData, setPasswordData] = useState<PasswordData>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Configuración
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // --- LÓGICA DE AVATAR ---
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requiere acceso a la galería.');
      return false;
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
    } else {
      if (!(await requestPermissions())) return;
    }

    const result = useCamera 
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', { uri, name: filename, type } as any);

      await api.post('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await checkAuth(); // Recargar usuario
      toast.success('Foto actualizada');
    } catch (error) {
      toast.error('Error al subir foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangeAvatar = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Tomar foto', 'Galería'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) pickImage(true); if (idx === 2) pickImage(false); }
      );
    } else {
      Alert.alert('Cambiar Foto', 'Selecciona una opción', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cámara', onPress: () => pickImage(true) },
        { text: 'Galería', onPress: () => pickImage(false) },
      ]);
    }
  };

  // --- LOGICA DE PERFIL ---
  const handleSaveProfile = async () => {
    if (!profileData.full_name.trim()) return Alert.alert('Error', 'Nombre requerido');
    setSavingProfile(true);
    try {
      await api.put('/auth/me', {
        full_name: profileData.full_name.trim(),
        phone: profileData.phone.trim() || null,
      });
      await checkAuth();
      setShowEditModal(false);
      toast.success('Perfil actualizado');
    } catch (error) {
      toast.error('Error al actualizar');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.current_password || !passwordData.new_password) return Alert.alert('Error', 'Campos requeridos');
    if (passwordData.new_password !== passwordData.confirm_password) return Alert.alert('Error', 'Las contraseñas no coinciden');
    
    setSavingPassword(true);
    try {
      await api.put('/auth/me/password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      setShowPasswordModal(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Contraseña actualizada');
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Error al cambiar contraseña';
      Alert.alert('Error', msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSupport = () => {
    Linking.openURL('mailto:soporte@tuapp.com?subject=Ayuda con la App');
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  // Helpers
  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
  const roleLabel = user?.role === 'admin' ? 'Administrador' : 'Residente';
  const roleColor = user?.role === 'admin' ? '#4F46E5' : '#10B981';
  const roleBg = user?.role === 'admin' ? '#EEF2FF' : '#D1FAE5';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER PERFIL */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {uploadingAvatar ? (
              <ActivityIndicator color="#4F46E5" style={styles.avatarLoader} />
            ) : (
              <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.8}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: roleColor }]}>
                    <Text style={styles.avatarInitials}>{getInitials(user?.full_name || 'U')}</Text>
                  </View>
                )}
                <View style={styles.editIconBadge}>
                  <Feather name="camera" size={14} color="white" />
                </View>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          
          <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* SECCIÓN: MI CUENTA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mi Cuenta</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setProfileData({ full_name: user?.full_name || '', phone: user?.phone || '' });
              setShowEditModal(true);
            }}>
              <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="user" size={20} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Datos Personales</Text>
                <Text style={styles.menuValue}>{user?.phone || 'Sin teléfono'}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => setShowPasswordModal(true)}>
              <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                <Feather name="lock" size={20} color="#EF4444" />
              </View>
              <Text style={styles.menuLabel}>Seguridad</Text>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SECCIÓN: ADMINISTRACIÓN (SOLO ADMIN) */}
        {user?.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Administración</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Users')}>
                <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                  <Feather name="users" size={20} color="#0284C7" />
                </View>
                <Text style={styles.menuLabel}>Gestionar Usuarios</Text>
                <Feather name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>
              
              <View style={styles.divider} />
              
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Categories')}>
                <View style={[styles.iconBox, { backgroundColor: '#FDF4FF' }]}>
                  <Feather name="tag" size={20} color="#C026D3" />
                </View>
                <Text style={styles.menuLabel}>Categorías</Text>
                <Feather name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AuditLog')}>
                <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
                  <Feather name="activity" size={20} color="#7C3AED" />
                </View>
                <Text style={styles.menuLabel}>Auditoría (Logs)</Text>
                <Feather name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SECCIÓN: PREFERENCIAS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferencias</Text>
          <View style={styles.card}>
            <View style={styles.menuItem}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="bell" size={20} color="#D97706" />
              </View>
              <Text style={styles.menuLabel}>Notificaciones Push</Text>
              <Switch 
                value={notificationsEnabled} 
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
                thumbColor={notificationsEnabled ? '#4F46E5' : '#9CA3AF'}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.menuItem}>
              <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="mail" size={20} color="#10B981" />
              </View>
              <Text style={styles.menuLabel}>Correos Electrónicos</Text>
              <Switch 
                value={emailNotifications} 
                onValueChange={setEmailNotifications}
                trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
                thumbColor={emailNotifications ? '#4F46E5' : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* SECCIÓN: LEGALES Y SOPORTE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información y Soporte</Text>
          <View style={styles.card}>
            
            {/* Preguntas Frecuentes */}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('HelpCenter')}>
              <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                <Feather name="help-circle" size={20} color="#0284C7" />
              </View>
              <Text style={styles.menuLabel}>Preguntas Frecuentes</Text>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>
            
            <View style={styles.divider} />

            {/* Política de Privacidad */}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PrivacyPolicy')}>
              <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
                <Feather name="shield" size={20} color="#9333EA" />
              </View>
              <Text style={styles.menuLabel}>Política de Privacidad</Text>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>
            
            <View style={styles.divider} />

            {/* Términos */}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TermsAndConditions')}>
              <View style={[styles.iconBox, { backgroundColor: '#F3F4F6' }]}>
                <Feather name="file-text" size={20} color="#4B5563" />
              </View>
              <Text style={styles.menuLabel}>Términos y Condiciones</Text>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Contacto Directo */}
            <TouchableOpacity style={styles.menuItem} onPress={handleSupport}>
              <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="message-circle" size={20} color="#059669" />
              </View>
              <Text style={styles.menuLabel}>Contactar Soporte</Text>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Acerca de */}
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Acerca de', 'Versión 1.0.0 (Build 45)')}>
              <View style={[styles.iconBox, { backgroundColor: '#F9FAFB' }]}>
                <Feather name="info" size={20} color="#6B7280" />
              </View>
              <Text style={styles.menuLabel}>Acerca de la App</Text>
              <Feather name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>Versión 1.0.0</Text>

      </ScrollView>

      {/* --- MODAL EDITAR PERFIL --- */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Perfil</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre Completo</Text>
              <TextInput 
                style={styles.input} 
                value={profileData.full_name}
                onChangeText={(t) => setProfileData({...profileData, full_name: t})}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput 
                style={styles.input} 
                value={profileData.phone}
                onChangeText={(t) => setProfileData({...profileData, phone: t})}
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Guardar Cambios</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL PASSWORD --- */}
      <Modal visible={showPasswordModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seguridad</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña Actual</Text>
              <View style={styles.passContainer}>
                <TextInput 
                  style={styles.passInput} 
                  secureTextEntry={!showCurrentPassword}
                  value={passwordData.current_password}
                  onChangeText={(t) => setPasswordData({...passwordData, current_password: t})}
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeBtn}>
                  <Feather name={showCurrentPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nueva Contraseña</Text>
              <View style={styles.passContainer}>
                <TextInput 
                  style={styles.passInput} 
                  secureTextEntry={!showNewPassword}
                  value={passwordData.new_password}
                  onChangeText={(t) => setPasswordData({...passwordData, new_password: t})}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                  <Feather name={showNewPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
              <TextInput 
                style={styles.input} 
                secureTextEntry
                value={passwordData.confirm_password}
                onChangeText={(t) => setPasswordData({...passwordData, confirm_password: t})}
              />
            </View>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Actualizar Contraseña</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { paddingBottom: 40 },
  
  // Header
  header: { alignItems: 'center', paddingVertical: 32, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: 'white' },
  avatarLoader: { width: 96, height: 96, justifyContent: 'center' },
  editIconBadge: { 
    position: 'absolute', bottom: 0, right: 0, 
    backgroundColor: '#111827', width: 32, height: 32, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' 
  },
  userName: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  userEmail: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  // Section
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  
  // Card Menu
  card: { backgroundColor: 'white', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '500', color: '#1F2937' },
  menuValue: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 68 },

  // Footer
  logoutButton: { marginTop: 40, alignSelf: 'center' },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  versionText: { textAlign: 'center', marginTop: 16, color: '#D1D5DB', fontSize: 12 },

  // Modals
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  closeBtn: { padding: 4 },
  modalContent: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, color: '#1F2937' },
  saveButton: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  saveText: { color: 'white', fontWeight: '700', fontSize: 16 },
  
  // Password Input
  passContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12 },
  passInput: { flex: 1, padding: 14, fontSize: 16, color: '#1F2937' },
  eyeBtn: { padding: 14 },
});
