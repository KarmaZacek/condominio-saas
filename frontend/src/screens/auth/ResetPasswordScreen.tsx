/**
 * Pantalla de Restablecer Contraseña
 * Flujo: Verificar Código OTP -> Definir Nueva Contraseña
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import api from '../../shared/services/api/client'; // Ajusta según tu estructura real si es diferente
import { toast } from '../../store/toastStore';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = route.params?.email || '';

  // Estados
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Refs para los inputs del código
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Timer para reenvío
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Manejar cambio en código
  const handleCodeChange = (value: string, index: number) => {
    // Si el usuario pega el código completo
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (i < 6) newCode[i] = char;
      });
      setCode(newCode);
      if (pastedCode.length === 6) {
        inputRefs.current[5]?.blur();
        verifyCode(newCode.join(''));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus siguiente input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Verificar automáticamente cuando se completa el código
    if (index === 5 && value) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  // Manejar backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Verificar código
  const verifyCode = async (fullCode: string) => {
    setIsVerifying(true);
    try {
      await api.post('/auth/verify-reset-code', {
        email,
        code: fullCode
      });
      setCodeVerified(true);
      toast.success('Código verificado');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail?.message || 'Código inválido o expirado';
      toast.error(errorMsg);
      // Limpiar código en error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  // Validar contraseña
  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasMinLength = password.length >= 8;
    return { hasUpperCase, hasNumber, hasMinLength, isValid: hasUpperCase && hasNumber && hasMinLength };
  };

  const passwordValidation = validatePassword(newPassword);

  // Reenviar código
  const handleResend = async () => {
    if (!canResend) return;

    try {
      await api.post('/auth/forgot-password', { email });
      setResendTimer(60);
      setCanResend(false);
      toast.success('Código reenviado');
    } catch (error) {
      toast.error('Error al reenviar código');
    }
  };

  // Restablecer contraseña
  const handleSubmit = async () => {
    if (!passwordValidation.isValid) {
      toast.error('La contraseña no cumple los requisitos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', {
        email,
        code: code.join(''),
        new_password: newPassword
      });

      toast.success('Contraseña actualizada correctamente');
      
      // Navegar al login
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }, 1500);

    } catch (error: any) {
      const errorMsg = error.response?.data?.detail?.message || 'Error al restablecer contraseña';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* Icono Central */}
          <View style={styles.iconWrapper}>
            <View style={[
              styles.iconCircle, 
              codeVerified && styles.iconCircleSuccess
            ]}>
              <Feather 
                name={codeVerified ? "check" : "shield"} 
                size={40} 
                color={codeVerified ? "#10B981" : "#4F46E5"} 
              />
            </View>
          </View>

          {/* Títulos */}
          <Text style={styles.title}>
            {codeVerified ? 'Crea tu nueva clave' : 'Verificación'}
          </Text>
          <Text style={styles.subtitle}>
            {codeVerified 
              ? 'Asegúrate de que sea segura y fácil de recordar para ti.'
              : `Ingresa el código de 6 dígitos que enviamos a\n${email}`
            }
          </Text>

          {!codeVerified ? (
            // === PASO 1: CÓDIGO ===
            <View style={styles.stepContainer}>
              <View style={styles.codeRow}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => inputRefs.current[index] = ref}
                    style={[
                      styles.codeSlot,
                      digit ? styles.codeSlotFilled : null,
                      isVerifying ? styles.codeSlotVerifying : null
                    ]}
                    value={digit}
                    onChangeText={(value) => handleCodeChange(value.replace(/[^0-9]/g, ''), index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!isVerifying}
                    cursorColor="#4F46E5"
                  />
                ))}
              </View>

              {isVerifying && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.loadingText}>Verificando...</Text>
                </View>
              )}

              <View style={styles.resendWrapper}>
                <Text style={styles.resendLabel}>¿No llegó el código?</Text>
                <TouchableOpacity 
                  onPress={handleResend}
                  disabled={!canResend}
                >
                  <Text style={[
                    styles.resendLink,
                    !canResend && styles.resendLinkDisabled
                  ]}>
                    {canResend ? 'Reenviar ahora' : `Reenviar en ${resendTimer}s`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // === PASO 2: NUEVA CONTRASEÑA ===
            <View style={styles.stepContainer}>
              {/* Nueva Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nueva Contraseña</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor="#9CA3AF"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Feather 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Checklist Validación */}
              <View style={styles.checklist}>
                <View style={styles.checkItem}>
                  <Feather 
                    name={passwordValidation.hasMinLength ? "check-circle" : "circle"} 
                    size={14} 
                    color={passwordValidation.hasMinLength ? "#10B981" : "#D1D5DB"} 
                  />
                  <Text style={[styles.checkText, passwordValidation.hasMinLength && styles.checkTextValid]}>
                    8 caracteres
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  <Feather 
                    name={passwordValidation.hasUpperCase ? "check-circle" : "circle"} 
                    size={14} 
                    color={passwordValidation.hasUpperCase ? "#10B981" : "#D1D5DB"} 
                  />
                  <Text style={[styles.checkText, passwordValidation.hasUpperCase && styles.checkTextValid]}>
                    1 Mayúscula
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  <Feather 
                    name={passwordValidation.hasNumber ? "check-circle" : "circle"} 
                    size={14} 
                    color={passwordValidation.hasNumber ? "#10B981" : "#D1D5DB"} 
                  />
                  <Text style={[styles.checkText, passwordValidation.hasNumber && styles.checkTextValid]}>
                    1 Número
                  </Text>
                </View>
              </View>

              {/* Confirmar Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmar Contraseña</Text>
                <View style={[
                  styles.inputWrapper,
                  confirmPassword.length > 0 && newPassword !== confirmPassword && styles.inputError
                ]}>
                  <Feather name="check-square" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Repite la contraseña"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <Text style={styles.errorText}>No coinciden</Text>
                )}
              </View>

              {/* Botón Final */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!passwordValidation.isValid || newPassword !== confirmPassword || isLoading) && 
                    styles.primaryButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!passwordValidation.isValid || newPassword !== confirmPassword || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>Restablecer Acceso</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Link volver */}
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkButtonText}>Cancelar y volver</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  
  // Header
  header: { alignItems: 'flex-start', marginBottom: 20 },
  backButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },

  // Icon & Titles
  iconWrapper: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  iconCircleSuccess: { backgroundColor: '#D1FAE5' },
  title: { fontSize: 26, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  // Step Container
  stepContainer: { width: '100%' },

  // Code Inputs
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  codeSlot: {
    width: 48, height: 56, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: 'white', fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#1F2937',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1,
  },
  codeSlotFilled: { borderColor: '#4F46E5', backgroundColor: '#F5F3FF' },
  codeSlotVerifying: { opacity: 0.5 },

  // Loading
  loadingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  loadingText: { color: '#4F46E5', fontSize: 14, fontWeight: '500' },

  // Resend
  resendWrapper: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  resendLabel: { fontSize: 14, color: '#6B7280' },
  resendLink: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
  resendLinkDisabled: { color: '#9CA3AF' },

  // Form Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 52, paddingHorizontal: 16,
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1F2937', height: '100%' },
  eyeBtn: { padding: 4 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 },

  // Checklist
  checklist: { 
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, 
    backgroundColor: '#F3F4F6', padding: 12, borderRadius: 12 
  },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  checkTextValid: { color: '#059669', fontWeight: '700' },

  // Buttons
  primaryButton: {
    backgroundColor: '#4F46E5', borderRadius: 14, height: 56,
    justifyContent: 'center', alignItems: 'center', marginTop: 16,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },

  linkButton: { marginTop: 24, alignItems: 'center' },
  linkButtonText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
});
