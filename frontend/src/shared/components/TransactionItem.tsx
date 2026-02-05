/**
 * Componente TransactionItem
 * Muestra una transacción en listas
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Transaction } from '../../../types';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import Badge from './Badge';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
  showUnit?: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onPress,
  showUnit = true,
}) => {
  const isIncome = transaction.type === 'income';
  const isCompleted = transaction.status === 'completed';
  const isPending = transaction.status === 'pending';
  const isCancelled = transaction.status === 'cancelled';
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
    });
  };
  
  const getCategoryIcon = (): keyof typeof Feather.glyphMap => {
    const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
      home: 'home',
      shield: 'shield',
      droplet: 'droplet',
      zap: 'zap',
      tool: 'tool',
      briefcase: 'briefcase',
      'alert-triangle': 'alert-triangle',
      calendar: 'calendar',
      sparkles: 'star',
      flower: 'sun',
    };
    return iconMap[transaction.category?.icon || 'tag'] || 'tag';
  };
  
  const getStatusBadge = () => {
    if (isPending) {
      return <Badge label="Pendiente" variant="warning" size="sm" dot />;
    }
    if (isCancelled) {
      return <Badge label="Cancelado" variant="default" size="sm" dot />;
    }
    return null;
  };
  
  return (
    <TouchableOpacity
      style={[styles.container, isCancelled && styles.containerCancelled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Icono de categoría */}
      <View style={[
        styles.iconContainer,
        isIncome ? styles.iconContainerIncome : styles.iconContainerExpense,
        isCancelled && styles.iconContainerCancelled,
      ]}>
        <Feather
          name={getCategoryIcon()}
          size={20}
          color={isCancelled 
            ? colors.gray[400] 
            : isIncome ? colors.success[600] : colors.error[600]
          }
        />
      </View>
      
      {/* Información */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text 
            style={[styles.category, isCancelled && styles.textCancelled]} 
            numberOfLines={1}
          >
            {transaction.category?.name || 'Sin categoría'}
          </Text>
          <Text style={[
            styles.amount,
            isIncome ? styles.amountIncome : styles.amountExpense,
            isCancelled && styles.textCancelled,
          ]}>
            {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          </Text>
        </View>
        
        <View style={styles.bottomRow}>
          <View style={styles.metaInfo}>
            <Text style={styles.date}>{formatDate(transaction.transaction_date)}</Text>
            
            {showUnit && transaction.unit && (
              <>
                <View style={styles.separator} />
                <Feather name="home" size={12} color={colors.gray[400]} />
                <Text style={styles.unit}>{transaction.unit.unit_number}</Text>
              </>
            )}
            
            {transaction.receipt_url && (
              <>
                <View style={styles.separator} />
                <Feather name="paperclip" size={12} color={colors.gray[400]} />
              </>
            )}
          </View>
          
          {getStatusBadge()}
        </View>
        
        {transaction.description && (
          <Text style={styles.description} numberOfLines={1}>
            {transaction.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  
  containerCancelled: {
    backgroundColor: colors.gray[50],
  },
  
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  
  iconContainerIncome: {
    backgroundColor: colors.success[50],
  },
  
  iconContainerExpense: {
    backgroundColor: colors.error[50],
  },
  
  iconContainerCancelled: {
    backgroundColor: colors.gray[100],
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
  
  category: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.gray[900],
    flex: 1,
    marginRight: spacing[2],
  },
  
  amount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  
  amountIncome: {
    color: colors.success[600],
  },
  
  amountExpense: {
    color: colors.error[600],
  },
  
  textCancelled: {
    color: colors.gray[400],
  },
  
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  date: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
  
  separator: {
    width: 1,
    height: 12,
    backgroundColor: colors.gray[300],
    marginHorizontal: spacing[2],
  },
  
  unit: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginLeft: spacing[1],
  },
  
  description: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginTop: spacing[1],
    fontStyle: 'italic',
  },
});

export default TransactionItem;
