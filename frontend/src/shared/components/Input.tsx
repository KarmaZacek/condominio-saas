/**
 * Componente Input
 * Campo de texto reutilizable con validación
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  disabled = false,
  secureTextEntry,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const isPassword = secureTextEntry !== undefined;
  const shouldHideText = isPassword && !showPassword;
  
  const inputContainerStyles = [
    styles.inputContainer,
    isFocused && styles.inputContainerFocused,
    error && styles.inputContainerError,
    disabled && styles.inputContainerDisabled,
  ];
  
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>
          {label}
        </Text>
      )}
      
      <View style={inputContainerStyles}>
        {leftIcon && (
          <Feather
            name={leftIcon}
            size={20}
            color={error ? colors.error[500] : colors.gray[400]}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          ref={ref}
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || isPassword) && styles.inputWithRightIcon,
            disabled && styles.inputDisabled,
          ]}
          placeholderTextColor={colors.gray[400]}
          editable={!disabled}
          secureTextEntry={shouldHideText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIconButton}
          >
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.gray[400]}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
          >
            <Feather
              name={rightIcon}
              size={20}
              color={error ? colors.error[500] : colors.gray[400]}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={14} color={colors.error[500]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {hint && !error && (
        <Text style={styles.hintText}>{hint}</Text>
      )}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[700],
    marginBottom: spacing[1.5],
  },
  
  labelError: {
    color: colors.error[600],
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  
  inputContainerFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  
  inputContainerError: {
    borderColor: colors.error[500],
    backgroundColor: colors.error[50],
  },
  
  inputContainerDisabled: {
    backgroundColor: colors.gray[100],
  },
  
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: colors.gray[900],
  },
  
  inputWithLeftIcon: {
    paddingLeft: spacing[1],
  },
  
  inputWithRightIcon: {
    paddingRight: spacing[1],
  },
  
  inputDisabled: {
    color: colors.gray[500],
  },
  
  leftIcon: {
    marginLeft: spacing[3],
  },
  
  rightIconButton: {
    padding: spacing[3],
  },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1.5],
    gap: spacing[1],
  },
  
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error[600],
  },
  
  hintText: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginTop: spacing[1.5],
  },
});

export default Input;
