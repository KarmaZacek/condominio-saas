/**
 * Componentes de Estados
 * Loading, Empty, Error states
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../theme';
import Button from './Button';

// ============ Loading ============

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
}

export const Loading: React.FC<LoadingProps> = ({ 
  message = 'Cargando...', 
  size = 'large' 
}) => (
  <View style={styles.container}>
    <ActivityIndicator size={size} color={colors.primary[600]} />
    {message && <Text style={styles.loadingText}>{message}</Text>}
  </View>
);

// ============ Empty State ============

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container}>
    <View style={styles.iconContainer}>
      <Feather name={icon} size={48} color={colors.gray[400]} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {message && <Text style={styles.message}>{message}</Text>}
    {actionLabel && onAction && (
      <Button
        title={actionLabel}
        onPress={onAction}
        variant="primary"
        style={styles.actionButton}
      />
    )}
  </View>
);

// ============ Error State ============

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Algo salió mal',
  message = 'No pudimos cargar la información. Por favor intenta de nuevo.',
  onRetry,
}) => (
  <View style={styles.container}>
    <View style={[styles.iconContainer, styles.errorIconContainer]}>
      <Feather name="alert-triangle" size={48} color={colors.error[500]} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <Button
        title="Reintentar"
        onPress={onRetry}
        variant="outline"
        leftIcon={<Feather name="refresh-cw" size={18} color={colors.gray[700]} />}
        style={styles.actionButton}
      />
    )}
  </View>
);

// ============ Skeleton ============

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => (
  <View
    style={[
      styles.skeleton,
      { width, height, borderRadius },
      style,
    ]}
  />
);

// ============ List Loading ============

export const ListLoading: React.FC = () => (
  <View style={styles.listLoadingContainer}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={styles.listItem}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <View style={styles.listItemContent}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={80} height={20} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  
  loadingText: {
    marginTop: spacing[4],
    fontSize: fontSize.base,
    color: colors.gray[600],
  },
  
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  
  errorIconContainer: {
    backgroundColor: colors.error[50],
  },
  
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  
  message: {
    fontSize: fontSize.base,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  
  actionButton: {
    marginTop: spacing[6],
    minWidth: 160,
  },
  
  skeleton: {
    backgroundColor: colors.gray[200],
  },
  
  listLoadingContainer: {
    padding: spacing[4],
  },
  
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: spacing[3],
  },
  
  listItemContent: {
    flex: 1,
    marginLeft: spacing[3],
  },
});
