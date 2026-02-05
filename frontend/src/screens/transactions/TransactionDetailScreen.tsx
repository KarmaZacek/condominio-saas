/**
 * Pantalla de Detalle de Transacción - Versión Completa
 * CORREGIDO: Modal de imagen a pantalla completa (Full Screen Gallery)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TransactionsStackParamList } from '../../navigation/AppNavigation';
import { useTransaction, useCancelTransaction } from '../../hooks/useTransactions';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatDate, formatDateTime, formatDateShort } from '../../utils/formatters';
import { toast } from '../../store/toastStore';
import api, { getAccessToken } from '../../shared/services/api/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Obtener base URL sin /v1 para archivos estáticos
const getStaticFileUrl = (path: string) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const baseUrl = api.defaults.baseURL?.replace('/v1', '') || 'http://localhost:8000';
  return `${baseUrl}${path}`;
};

type Props = NativeStackScreenProps<TransactionsStackParamList, 'TransactionDetail'>;

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Métodos de pago con labels
const PAYMENT_METHODS: Record<string, { label: string; icon: string }> = {
  cash: { label: 'Efectivo', icon: 'dollar-sign' },
  transfer: { label: 'Transferencia', icon: 'send' },
  card: { label: 'Tarjeta', icon: 'credit-card' },
  check: { label: 'Cheque', icon: 'file-text' },
  other: { label: 'Otro', icon: 'more-horizontal' },
};

// Estados de transacción
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Activo', color: '#16A34A', bg: '#DCFCE7' },
  confirmed: { label: 'Confirmado', color: '#16A34A', bg: '#DCFCE7' },
  pending: { label: 'Pendiente', color: '#F59E0B', bg: '#FEF3C7' },
  cancelled: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2' },
};

export const TransactionDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { transactionId } = route.params;
  const { user } = useAuthStore();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  
  const { data: transaction, isLoading, error, refetch } = useTransaction(transactionId);
  const cancelMutation = useCancelTransaction();

  const isAdmin = user?.role === 'admin';
  const canCancel = isAdmin && transaction?.status !== 'cancelled';
  const canGenerateReceipt = isAdmin && transaction?.type === 'income' && transaction?.status !== 'cancelled';

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Transacción',
      '¿Estás seguro de que deseas cancelar esta transacción? Esta acción no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate(transactionId, {
              onSuccess: () => {
                toast.success('Transacción cancelada correctamente');
                refetch();
              },
              onError: () => {
                toast.error('Error al cancelar la transacción');
              },
            });
          },
        },
      ]
    );
  };

  const handleGenerateReceipt = async () => {
    if (!transaction) return;
    
    try {
      setGeneratingPdf(true);
      
      const token = await getAccessToken();
      
      if (!token) {
        toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
        return;
      }
      
      const baseURL = api.defaults.baseURL || '';
      const pdfUrl = `${baseURL}/transactions/${transaction.id}/receipt/pdf`;
      
      const fileName = `recibo_${transaction.id.slice(-8)}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(
        pdfUrl,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (downloadResult.status !== 200) {
        throw new Error(`Error descargando PDF: ${downloadResult.status}`);
      }
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Recibo de Pago',
          UTI: 'com.adobe.pdf',
        });
        toast.success('Recibo generado correctamente');
      } else {
        toast.info('Recibo guardado en: ' + fileName);
      }
    } catch (error: any) {
      console.error('Error generando recibo:', error);
      toast.error('Error al generar el recibo');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando transacción...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorIcon}>
            <Feather name="alert-circle" size={48} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Error al cargar</Text>
          <Text style={styles.errorMessage}>No se pudo cargar la transacción</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Feather name="refresh-cw" size={18} color="#4F46E5" />
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isIncome = transaction.type === 'income';
  const statusConfig = STATUS_CONFIG[transaction.status] || STATUS_CONFIG.active;
  const paymentMethodConfig = transaction.payment_method 
    ? PAYMENT_METHODS[transaction.payment_method] 
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Moderno Centrado */}
        <View style={styles.headerContainer}>
          <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          
          <Text style={[styles.heroAmount, { color: isIncome ? '#10B981' : '#EF4444' }]}>
            {isIncome ? '+ ' : '- '}{formatCurrency(transaction.amount).replace('$', '')}
            <Text style={styles.currencyCode}> MXN</Text>
          </Text>
          
          <Text style={styles.transactionDate}>
            {formatDate(transaction.date)}
          </Text>
        </View>

        {/* Información General */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información General</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <View style={styles.infoIconContainer}>
                <Feather name="calendar" size={16} color="#6B7280" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Fecha</Text>
                <Text style={styles.infoValue}>{formatDateShort(transaction.date)}</Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <View style={styles.infoIconContainer}>
                <Feather name="clock" size={16} color="#6B7280" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Período Fiscal</Text>
                <Text style={styles.infoValue}>{transaction.fiscal_period}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Feather name="tag" size={16} color="#6B7280" />
            </View>
            <View style={styles.infoRowContent}>
              <Text style={styles.infoLabel}>Categoría</Text>
              <View style={styles.categoryBadge}>
                <View style={[styles.categoryDot, { backgroundColor: isIncome ? '#16A34A' : '#DC2626' }]} />
                <Text style={styles.infoValue}>{transaction.category?.name || 'Sin categoría'}</Text>
              </View>
            </View>
          </View>

          {transaction.unit && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Feather name="home" size={16} color="#6B7280" />
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoLabel}>Unidad</Text>
                  <Text style={styles.infoValue}>
                    Casa {transaction.unit.unit_number}
                    {transaction.unit.owner_name && ` • ${transaction.unit.owner_name}`}
                  </Text>
                </View>
              </View>
            </>
          )}

          {transaction.description && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Feather name="file-text" size={16} color="#6B7280" />
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoLabel}>Descripción</Text>
                  <Text style={styles.descriptionText}>{transaction.description}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Información de Pago (solo para ingresos) */}
        {isIncome && (paymentMethodConfig || transaction.reference_number) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Información de Pago</Text>
            
            {paymentMethodConfig && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Feather name={paymentMethodConfig.icon as any} size={16} color="#6B7280" />
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoLabel}>Método de Pago</Text>
                  <Text style={styles.infoValue}>{paymentMethodConfig.label}</Text>
                </View>
              </View>
            )}

            {transaction.reference_number && (
              <>
                {paymentMethodConfig && <View style={styles.divider} />}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconContainer}>
                    <Feather name="hash" size={16} color="#6B7280" />
                  </View>
                  <View style={styles.infoRowContent}>
                    <Text style={styles.infoLabel}>Número de Referencia</Text>
                    <Text style={styles.infoValue}>{transaction.reference_number}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Comprobante */}
        {transaction.receipt_url && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Comprobante Adjunto</Text>
            <TouchableOpacity 
              style={styles.receiptContainer}
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: getStaticFileUrl(transaction.receipt_url)! }}
                style={styles.receiptThumbnail}
                resizeMode="cover"
              />
              <View style={styles.receiptOverlay}>
                <Feather name="maximize-2" size={20} color="#FFF" />
                <Text style={styles.receiptOverlayText}>Ver imagen completa</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Metadatos */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Feather name="hash" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>ID: {transaction.id.slice(-8)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="user" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>
              Creado por: {transaction.created_by_name || 'Sistema'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="clock" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>
              Creado: {formatDateTime(transaction.created_at)}
            </Text>
          </View>
          {transaction.status === 'cancelled' && transaction.cancelled_at && (
            <View style={styles.metaRow}>
              <Feather name="x-circle" size={14} color="#EF4444" />
              <Text style={[styles.metaText, { color: '#EF4444' }]}>
                Cancelado: {formatDateTime(transaction.cancelled_at)}
              </Text>
            </View>
          )}
        </View>

        {/* Espaciado para botones */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        {/* Botón Primario: Generar Recibo */}
        {canGenerateReceipt && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleGenerateReceipt}
            disabled={generatingPdf}
          >
            {generatingPdf ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="download" size={20} color="#FFF" />
            )}
            <Text style={styles.primaryButtonText}>
              {generatingPdf ? 'Generando...' : 'Generar Recibo'}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Botón Secundario: Cancelar */}
        {canCancel && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Feather name="x-circle" size={20} color="#EF4444" />
            )}
            <Text style={styles.secondaryButtonText}>
              {cancelMutation.isPending ? '...' : 'Cancelar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ==========================================================
          MODAL DE IMAGEN A PANTALLA COMPLETA
         ========================================================== */}
      <Modal
        visible={imageModalVisible}
        transparent={true} // Permite ver el fondo negro
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
        statusBarTranslucent={true} // Oculta barra de estado
      >
        <View style={styles.modalBackdrop}>
          {/* Botón Cerrar Flotante */}
          <TouchableOpacity 
            style={styles.modalClose} 
            onPress={() => setImageModalVisible(false)}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
          >
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>
          
          {/* Imagen Full Screen */}
          {transaction.receipt_url && (
            <Image
              source={{ uri: getStaticFileUrl(transaction.receipt_url)! }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  retryText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  // NUEVOS ESTILOS PARA EL HEADER
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  currencyCode: {
    fontSize: 20,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  transactionDate: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // ESTILOS DE TARJETAS
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoRowContent: {
    flex: 1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  descriptionText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  receiptContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  receiptThumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: '#F3F4F6',
  },
  receiptOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  receiptOverlayText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  metaCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  // BOTONES
  actionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'column',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
  
  // ====================
  // ESTILOS MODAL FULL SCREEN
  // ====================
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: '#000', // Fondo negro total
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalClose: { 
    position: 'absolute', 
    top: 50, // Ajuste para SafeArea superior
    right: 20, 
    zIndex: 20,
    backgroundColor: 'rgba(50,50,50,0.6)', // Círculo semitransparente para contraste
    padding: 8,
    borderRadius: 20
  },
  fullImage: { 
    width: '100%', 
    height: '100%' 
  },
});

export default TransactionDetailScreen;
