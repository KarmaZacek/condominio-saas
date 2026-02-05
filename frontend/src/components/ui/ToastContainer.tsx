/**
 * Componente Toast Global
 * Muestra notificaciones elegantes no intrusivas
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useToastStore, ToastType } from '../../store/toastStore';

const { width } = Dimensions.get('window');

interface ToastItemProps {
  id: string;
  type: ToastType;
  message: string;
  onHide: (id: string) => void;
}

const toastConfig: Record<ToastType, { 
  icon: keyof typeof Feather.glyphMap; 
  backgroundColor: string; 
  iconColor: string;
  borderColor: string;
}> = {
  success: {
    icon: 'check-circle',
    backgroundColor: '#ECFDF5',
    iconColor: '#10B981',
    borderColor: '#A7F3D0',
  },
  error: {
    icon: 'x-circle',
    backgroundColor: '#FEF2F2',
    iconColor: '#EF4444',
    borderColor: '#FECACA',
  },
  warning: {
    icon: 'alert-triangle',
    backgroundColor: '#FFFBEB',
    iconColor: '#F59E0B',
    borderColor: '#FDE68A',
  },
  info: {
    icon: 'info',
    backgroundColor: '#EFF6FF',
    iconColor: '#3B82F6',
    borderColor: '#BFDBFE',
  },
};

const ToastItem: React.FC<ToastItemProps> = ({ id, type, message, onHide }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = toastConfig[type];

  useEffect(() => {
    // Animación de entrada
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleHide = () => {
    // Animación de salida
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '20' }]}>
          <Feather name={config.icon} size={20} color={config.iconColor} />
        </View>
        <Text style={styles.toastMessage} numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity onPress={handleHide} style={styles.closeButton}>
          <Feather name="x" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const ToastContainer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { toasts, hideToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 10 }]}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onHide={hideToast}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toastItem: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
});

export default ToastContainer;
