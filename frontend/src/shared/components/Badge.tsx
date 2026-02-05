/**
 * Componente Badge
 * Etiquetas para estados y categorías
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  style?: ViewStyle;
}

const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  dot = false,
  style,
}) => {
  return (
    <View style={[styles.base, styles[variant], styles[size], style]}>
      {dot && <View style={[styles.dot, styles[`dot_${variant}`]]} />}
      <Text style={[styles.text, styles[`text_${variant}`], styles[`text_${size}`]]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
  },
  
  // Tamaños
  sm: {
    paddingVertical: spacing[0.5],
    paddingHorizontal: spacing[2],
  },
  md: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2.5],
  },
  
  // Variantes
  default: {
    backgroundColor: colors.gray[100],
  },
  success: {
    backgroundColor: colors.success[50],
  },
  warning: {
    backgroundColor: colors.warning[50],
  },
  error: {
    backgroundColor: colors.error[50],
  },
  info: {
    backgroundColor: colors.info[50],
  },
  primary: {
    backgroundColor: colors.primary[50],
  },
  
  // Texto base
  text: {
    fontWeight: fontWeight.medium,
  },
  
  // Texto por variante
  text_default: {
    color: colors.gray[700],
  },
  text_success: {
    color: colors.success[700],
  },
  text_warning: {
    color: colors.warning[700],
  },
  text_error: {
    color: colors.error[700],
  },
  text_info: {
    color: colors.info[700],
  },
  text_primary: {
    color: colors.primary[700],
  },
  
  // Texto por tamaño
  text_sm: {
    fontSize: fontSize.xs,
  },
  text_md: {
    fontSize: fontSize.sm,
  },
  
  // Dot
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dot_default: {
    backgroundColor: colors.gray[500],
  },
  dot_success: {
    backgroundColor: colors.success[500],
  },
  dot_warning: {
    backgroundColor: colors.warning[500],
  },
  dot_error: {
    backgroundColor: colors.error[500],
  },
  dot_info: {
    backgroundColor: colors.info[500],
  },
  dot_primary: {
    backgroundColor: colors.primary[500],
  },
});

export default Badge;
