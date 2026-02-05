/**
 * Componente UnitItem
 * Muestra una vivienda en listas
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Unit } from '../../../types';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import Badge from './Badge';

interface UnitItemProps {
  unit: Unit;
  onPress?: () => void;
}

const UnitItem: React.FC<UnitItemProps> = ({ unit, onPress }) => {
  const hasDebt = unit.balance < 0;
  const hasCredit = unit.balance > 0;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Math.abs(amount));
  };
  
  const getBalanceBadge = () => {
    if (hasDebt) {
      return (
        <Badge 
          label={`Adeudo: ${formatCurrency(unit.balance)}`} 
          variant="error" 
          size="sm" 
        />
      );
    }
    if (hasCredit) {
      return (
        <Badge 
          label={`A favor: ${formatCurrency(unit.balance)}`} 
          variant="success" 
          size="sm" 
        />
      );
    }
    return (
      <Badge 
        label="Al corriente" 
        variant="success" 
        size="sm" 
        dot 
      />
    );
  };
  
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Icono de casa */}
      <View style={[
        styles.iconContainer,
        hasDebt ? styles.iconContainerDebt : styles.iconContainerOk,
      ]}>
        <Feather
          name="home"
          size={24}
          color={hasDebt ? colors.error[600] : colors.success[600]}
        />
      </View>
      
      {/* Información */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.unitNumber}>Casa {unit.unit_number}</Text>
          {getBalanceBadge()}
        </View>
        
        {unit.owner_name && (
          <View style={styles.ownerRow}>
            <Feather name="user" size={14} color={colors.gray[400]} />
            <Text style={styles.ownerName} numberOfLines={1}>
              {unit.owner_name}
            </Text>
          </View>
        )}
        
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Cuota mensual:</Text>
          <Text style={styles.feeAmount}>
            {formatCurrency(unit.monthly_fee)}
          </Text>
        </View>
      </View>
      
      {/* Flecha */}
      <Feather name="chevron-right" size={20} color={colors.gray[400]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  
  iconContainerOk: {
    backgroundColor: colors.success[50],
  },
  
  iconContainerDebt: {
    backgroundColor: colors.error[50],
  },
  
  content: {
    flex: 1,
  },
  
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  
  unitNumber: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray[900],
  },
  
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
    gap: spacing[1.5],
  },
  
  ownerName: {
    fontSize: fontSize.sm,
    color: colors.gray[600],
    flex: 1,
  },
  
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  feeLabel: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginRight: spacing[1],
  },
  
  feeAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[700],
  },
});

export default UnitItem;
