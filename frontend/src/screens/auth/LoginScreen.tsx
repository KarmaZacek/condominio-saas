import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const navigation = useNavigation<any>();
  
  const { login, isLoading, error: storeError, clearError } = useAuthStore();
  const displayError = localError || storeError;

  useEffect(() => {
    return () => {
      clearError();
    };
  }, []);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setLocalError('');
    if (storeError) clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setLocalError('');
    if (storeError) clearError();
  };

  const handleLogin = async () => {
    setLocalError('');
    clearError();
   
    if (!email || !password) {
      setLocalError('Por favor ingresa email y contraseña');
      return;
    }

    if (!email.includes('@')) {
      setLocalError('Por favor ingresa un email válido');
      return;
    }

    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err: any) {
      console.log('Login falló, error mostrado desde store');
    }
  };

  return (
    <View style={styles.container}>
      {/* Fondo superior con color */}
      <View style={styles.topBackground}>
        {/* Círculos decorativos */}
        <View style={[styles.decorCircle, styles.circle1]} />
        <View style={[styles.decorCircle, styles.circle2]} />
        <View style={[styles.decorCircle, styles.circle3]} />
      </View>
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header con logo */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../../assets/images/logo.jpg')}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.title}>Parques Santa Cruz 9</Text>
              <Text style={styles.subtitle}>Sistema de Gestión de Condominios</Text>
            </View>

            {/* Card del formulario */}
            <View style={styles.formCard}>
              <Text style={styles.welcomeText}>Bienvenido</Text>
              <Text style={styles.instructionText}>Ingresa tus credenciales para continuar</Text>
              
              {/* Error message */}
              {displayError ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              ) : null}
              
              {/* Email input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo electrónico</Text>
                <View style={[
                  styles.inputContainer,
                  emailFocused && styles.inputContainerFocused
                ]}>
                  <Feather 
                    name="mail" 
                    size={20} 
                    color={emailFocused ? '#1E3A5F' : '#9CA3AF'} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="tu@email.com"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>
              
              {/* Password input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contraseña</Text>
                <View style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputContainerFocused
                ]}>
                  <Feather 
                    name="lock" 
                    size={20} 
                    color={passwordFocused ? '#1E3A5F' : '#9CA3AF'} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={handlePasswordChange}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Feather 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Forgot password */}
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              {/* Login button */}
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Iniciar Sesión</Text>
                    <Feather name="arrow-right" size={20} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            {/* --- INICIO DEL COPYRIGHT --- */}
            <View style={styles.footer}>
                <Text style={{ fontSize: 12, color: '#666' }}>
                    © {new Date().getFullYear()} Parques de Santa Cruz 9
                </Text>
                <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                    Desarrollado por Edgar Ramírez Guzmán
                </Text>
                <Text style={styles.versionText}>Versión 1.0.0</Text>
            </View>
            {/* --- FIN DEL COPYRIGHT --- */}
            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  topBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
    backgroundColor: '#1E3A5F',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -50,
    right: -50,
  },
  circle2: {
    width: 150,
    height: 150,
    top: 100,
    left: -40,
  },
  circle3: {
    width: 100,
    height: 100,
    bottom: 30,
    right: 50,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 30,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'white',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    marginBottom: 18,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 6,
  },

  // Form Card
  formCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 26,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 22,
  },
  
  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  
  // Input
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputContainerFocused: {
    borderColor: '#1E3A5F',
    backgroundColor: '#F0F7FF',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    padding: 8,
  },
  
  // Forgot password
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 22,
    marginTop: -6,
  },
  forgotPasswordText: {
    color: '#1E3A5F',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Button
  button: {
    backgroundColor: '#1E3A5F',
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },

  // Footer
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 13,
  },
  versionText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
});
