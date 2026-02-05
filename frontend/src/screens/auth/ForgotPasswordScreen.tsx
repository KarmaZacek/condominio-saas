/**
 * Pantalla de Olvidé mi Contraseña - Diseño Neo-Bank
 * Paso 1 del flujo de recuperación
 */

import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import api from '../../shared/services/api/client';
import { toast } from '../../store/toastStore';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async () => {
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      toast.error('Ingresa tu correo electrónico');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      toast.error('Ingresa un correo válido');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { 
        email: cleanEmail 
      });
      
      setIsSuccess(true);
      toast.success('Código enviado correctamente');
      
      // Si hay código de desarrollo (para pruebas), mostrarlo
      if (response.data._dev_code) {
        console.log('🔑 Código DEV:', response.data._dev_code);
      }
      
      // Navegar a la pantalla de ingreso de código tras breve pausa
      setTimeout(() => {
        navigation.navigate('ResetPassword', { email: cleanEmail });
        setIsSuccess(false); // Resetear estado por si vuelve
        setIsLoading(false);
      }, 1500);
      
    } catch (error: any) {
      // Por seguridad, no indicamos si el correo no existe, 
      // pero simulamos éxito para evitar enumeración de usuarios.
      setIsSuccess(true);
      toast.success('Si el correo existe, recibirás un código');
      
      setTimeout(() => {
        navigation.navigate('ResetPassword', { email: cleanEmail });
        setIsSuccess(false);
        setIsLoading(false);
      }, 1500);
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
          {/* Header con botón atrás */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* Icono Central */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, isSuccess && styles.iconCircleSuccess]}>
              <Feather 
                name={isSuccess ? "check" : "lock"} 
                size={40} 
                color={isSuccess ? "#10B981" : "#4F46E5"} 
              />
            </View>
          </View>

          {/* Textos */}
          <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
          <Text style={styles.subtitle}>
            No te preocupes. Ingresa tu correo electrónico y te enviaremos un código de recuperación.
          </Text>

          {/* Formulario */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={[
                styles.inputContainer, 
                email.length > 0 && validateEmail(email) && styles.inputValid
              ]}>
                <Feather name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#D1D5DB"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading && !isSuccess}
                />
                {email.length > 0 && validateEmail(email) && (
                  <Feather name="check-circle" size={20} color="#10B981" />
                )}
              </View>
            </View>

            {/* Botón de Acción */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!email.trim() || isLoading || isSuccess) && styles.submitButtonDisabled,
                isSuccess && styles.submitButtonSuccess
              ]}
              onPress={handleSubmit}
              disabled={!email.trim() || isLoading || isSuccess}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : isSuccess ? (
                <>
                  <Feather name="check" size={20} color="white" />
                  <Text style={styles.submitText}>Enviado</Text>
                </>
              ) : (
                <>
                  <Text style={styles.submitText}>Enviar código</Text>
                  <Feather name="arrow-right" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Información Adicional */}
          <View style={styles.infoBox}>
            <Feather name="info" size={18} color="#4F46E5" />
            <Text style={styles.infoText}>
              El código expira en 15 minutos. Si no lo recibes en tu bandeja principal, revisa la carpeta de spam.
            </Text>
          </View>

          {/* Volver al Login */}
          <TouchableOpacity 
            style={styles.backToLogin}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  
  // Header
  header: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Icon Central
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircleSuccess: {
    backgroundColor: '#D1FAE5',
  },

  // Títulos
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // Formulario
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 56,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  inputValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1F2937',
  },

  // Botón
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    height: 56,
    gap: 10,
    marginTop: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  submitButtonSuccess: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 20,
  },

  // Link Login
  backToLogin: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backToLoginText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
});
