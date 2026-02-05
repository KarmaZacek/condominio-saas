import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useCreateTransaction } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useAllUnits } from '../../hooks/useUnits';
import { formatCurrency, formatFiscalPeriod, getFiscalPeriods, getLastFiscalPeriods, getCurrentFiscalPeriod } from '../../utils/formatters';
import type { TransactionsStackParamList } from '../../navigation/AppNavigation';
import type { CategoryType } from '../../types';
import { toast } from '../../store/toastStore';

type RouteProps = RouteProp<TransactionsStackParamList, 'TransactionForm'>;

export default function TransactionFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const isEditing = !!route.params?.id;

  // Obtener períodos disponibles (12 meses atrás y 12 adelante)
  const fiscalPeriods = getFiscalPeriods(12, 12);
  const currentPeriod = getCurrentFiscalPeriod();

  // Form state
  const [type, setType] = useState<CategoryType>('income');

  // Leer tipo desde parámetros de navegación
  useEffect(() => {
    if (route.params?.type) {
      setType(route.params.type);
    }
  }, [route.params?.type]);
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [fiscalPeriod, setFiscalPeriod] = useState(currentPeriod);
  const [showCategories, setShowCategories] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [showPeriods, setShowPeriods] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Calcular tipo de pago (adelantado, atrasado o normal)
  const isAdvancePayment = type === 'income' && fiscalPeriod > currentPeriod;
  const isLatePayment = type === 'income' && fiscalPeriod < currentPeriod;
  const isSpecialPayment = isAdvancePayment || isLatePayment;
  
  // Métodos de pago disponibles
  const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: 'dollar-sign' },
    { value: 'transfer', label: 'Transferencia', icon: 'send' },
    { value: 'card', label: 'Tarjeta', icon: 'credit-card' },
    { value: 'check', label: 'Cheque', icon: 'file-text' },
    { value: 'other', label: 'Otro', icon: 'more-horizontal' },
  ];

  // Queries
  const { data: categories, isLoading: loadingCategories } = useCategories(type);
  const { data: units, isLoading: loadingUnits } = useAllUnits();
  const createMutation = useCreateTransaction();

  const selectedCategory = categories?.find((c: any) => c.id === categoryId);
  const selectedUnit = units?.find((u: any) => u.id === unitId);

  // Reset category when type changes
  useEffect(() => {
    setCategoryId('');
  }, [type]);

  // Auto-fill description based on category and unit
  useEffect(() => {
    // 1. Calculamos primero cuál debería ser la nueva descripción (newValue)
    let generatedDescription = '';
    
    let paymentLabel = '';
    if (isAdvancePayment) paymentLabel = ' (Adelantado)';
    else if (isLatePayment) paymentLabel = ' (Atrasado)';

    if (selectedCategory && type === 'income' && selectedUnit) {
      generatedDescription = `${selectedCategory.name} - Casa ${selectedUnit.unit_number} - ${formatFiscalPeriod(fiscalPeriod)}${paymentLabel}`;
    } else if (selectedCategory) {
      generatedDescription = `${selectedCategory.name} - ${formatFiscalPeriod(fiscalPeriod)}`;
    }

    // 2. Verificamos si es seguro sobrescribir
    // (Solo sobrescribimos si el campo está vacío o parece que tiene un texto automático anterior)
    const isSafeToOverwrite = description === '' || description.includes(' - ') || description.includes('Movimiento');

    // 3. Aplicamos el cambio
    if (generatedDescription && isSafeToOverwrite) {
      setDescription(generatedDescription);
    }
    // Nota: No incluimos 'description' en las dependencias para evitar bucles infinitos
  }, [selectedCategory, selectedUnit, fiscalPeriod, type, isAdvancePayment, isLatePayment]);

  // Seleccionar imagen de comprobante (CORREGIDO)
  const pickReceiptImage = async () => {
    try {
      // 1. Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar el comprobante.');
        return;
      }

      // 2. Abrir galería
      const result = await ImagePicker.launchImageLibraryAsync({
        // ✅ CORRECCIÓN AQUÍ: Usar MediaTypeOptions en lugar de MediaType
        mediaTypes: ImagePicker.MediaType.Images, 
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error al abrir galería:", error);
      Alert.alert("Error", "No se pudo abrir la galería. Intenta de nuevo.");
    }
  };

  // Tomar foto del comprobante
  const takeReceiptPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para tomar la foto del comprobante.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  // Subir comprobante al servidor
  const uploadReceipt = async (transactionId: string) => {
    if (!receiptImage) return;

    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      const filename = receiptImage.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: receiptImage,
        name: filename,
        type: fileType,
      } as any);

      await api.post(`/transactions/${transactionId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Comprobante subido correctamente');
    } catch (error: any) {
      // Error específico: Pago duplicado en el mismo período
      if (error.response?.data?.detail === 'DUPLICATE_PAYMENT_SAME_PERIOD') {
        Alert.alert(
          'Pago Duplicado',
          'Ya existe un pago de cuota mensual para esta vivienda en el período seleccionado. Por favor, verifica los pagos existentes.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      console.error('Error uploading receipt:', error);
      toast.error('Error al subir comprobante');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async () => {
    // Validación
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    if (!categoryId) {
      Alert.alert('Error', 'Selecciona una categoría');
      return;
    }
    
    // Validar vivienda para ingresos de cuotas
    if (type === 'income' && !unitId) {
      Alert.alert('Error', 'Selecciona una vivienda para el ingreso');
      return;
    }

    // Generar descripción si está vacía
    let paymentLabel = '';
    if (isAdvancePayment) paymentLabel = ' (Adelantado)';
    else if (isLatePayment) paymentLabel = ' (Atrasado)';
    
    const finalDescription = description || 
      `${selectedCategory?.name || 'Movimiento'} - ${formatFiscalPeriod(fiscalPeriod)}${paymentLabel}`;

    try {
      const newTransaction = await createMutation.mutateAsync({
        type,
        amount: parseFloat(amount),
        description: finalDescription,
        category_id: categoryId,
        unit_id: unitId || undefined,
        transaction_date: new Date().toISOString().split('T')[0],
        fiscal_period: fiscalPeriod,
        payment_method: paymentMethod || undefined,
        reference_number: referenceNumber || undefined,
      });

      // Si hay imagen y es gasto, subir comprobante
      const transactionId = newTransaction?.transaction?.id || newTransaction?.id;
      if (receiptImage && transactionId && type === 'expense') {
        await uploadReceipt(transactionId);
      }

      let successMessage = 'Movimiento registrado correctamente';
      if (isAdvancePayment) successMessage = 'Pago adelantado registrado correctamente';
      else if (isLatePayment) successMessage = 'Pago atrasado registrado correctamente';
      
      toast.success(successMessage);
      navigation.goBack();
    } catch (error: any) {
      // Manejo específico para pago duplicado
      if (error?.response?.data?.detail === 'DUPLICATE_PAYMENT_SAME_PERIOD') {
        Alert.alert(
          'Pago Duplicado',
          'Ya existe un pago de cuota mensual para esta vivienda en el período seleccionado. Por favor, verifica los pagos existentes.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      console.error('Error creating transaction:', error);
      const errorDetail = error?.response?.data?.detail;
      const errorMessage = typeof errorDetail === 'object' 
        ? errorDetail.message 
        : errorDetail || 'No se pudo registrar el movimiento';
      Alert.alert('Error', errorMessage);
    }
  };

  // Helper para obtener nombre del propietario
  const getOwnerName = (unit: any) => {
    return unit.owner_name || unit.notes || `Casa ${unit.unit_number}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Tipo de movimiento */}
          <Text style={styles.label}>Tipo de movimiento</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
              onPress={() => setType('income')}
            >
              <Feather 
                name="arrow-down-left" 
                size={20} 
                color={type === 'income' ? '#10B981' : '#9CA3AF'} 
              />
              <Text style={[
                styles.typeText, 
                type === 'income' && styles.typeTextIncome
              ]}>Ingreso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
              onPress={() => setType('expense')}
            >
              <Feather 
                name="arrow-up-right" 
                size={20} 
                color={type === 'expense' ? '#EF4444' : '#9CA3AF'} 
              />
              <Text style={[
                styles.typeText, 
                type === 'expense' && styles.typeTextExpense
              ]}>Gasto</Text>
            </TouchableOpacity>
          </View>

          {/* Período Fiscal */}
          <Text style={styles.label}>Período (Mes al que aplica)</Text>
          <TouchableOpacity 
            style={[
              styles.selector, 
              isAdvancePayment && styles.selectorAdvance,
              isLatePayment && styles.selectorLate
            ]}
            onPress={() => setShowPeriods(!showPeriods)}
          >
            <View style={styles.selectorContent}>
              <Feather 
                name="calendar" 
                size={18} 
                color={isAdvancePayment ? "#F59E0B" : isLatePayment ? "#EF4444" : "#6B7280"} 
              />
              <Text style={[
                styles.selectorText, 
                isAdvancePayment && styles.selectorTextAdvance,
                isLatePayment && styles.selectorTextLate
              ]}>
                {formatFiscalPeriod(fiscalPeriod)}
              </Text>
              {isAdvancePayment && (
                <View style={styles.advanceBadge}>
                  <Text style={styles.advanceBadgeText}>Adelantado</Text>
                </View>
              )}
              {isLatePayment && (
                <View style={styles.lateBadge}>
                  <Text style={styles.lateBadgeText}>Atrasado</Text>
                </View>
              )}
            </View>
            <Feather name={showPeriods ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
          </TouchableOpacity>
          
          {/* Indicador de pago adelantado */}
          {isAdvancePayment && (
            <View style={styles.advanceNotice}>
              <Feather name="info" size={16} color="#F59E0B" />
              <Text style={styles.advanceNoticeText}>
                Este pago corresponde a un mes futuro y se marcará como adelantado
              </Text>
            </View>
          )}
          
          {/* Indicador de pago atrasado */}
          {isLatePayment && (
            <View style={styles.lateNotice}>
              <Feather name="info" size={16} color="#EF4444" />
              <Text style={styles.lateNoticeText}>
                Este pago corresponde a un mes anterior y se marcará como atrasado
              </Text>
            </View>
          )}
          
          {showPeriods && (
            <View style={styles.optionsList}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {fiscalPeriods.map((period) => {
                  const isPeriodAdvance = period > currentPeriod;
                  const isPeriodLate = period < currentPeriod;
                  return (
                    <TouchableOpacity
                      key={period}
                      style={[
                        styles.optionItem,
                        fiscalPeriod === period && styles.optionItemSelected
                      ]}
                      onPress={() => {
                        setFiscalPeriod(period);
                        setShowPeriods(false);
                      }}
                    >
                      <Text style={styles.optionText}>
                        {formatFiscalPeriod(period)}
                      </Text>
                      {isPeriodAdvance && type === 'income' && (
                        <View style={styles.advanceBadgeSmall}>
                          <Text style={styles.advanceBadgeSmallText}>Adelantado</Text>
                        </View>
                      )}
                      {isPeriodLate && type === 'income' && (
                        <View style={styles.lateBadgeSmall}>
                          <Text style={styles.lateBadgeSmallText}>Atrasado</Text>
                        </View>
                      )}
                      {fiscalPeriod === period && (
                        <Feather name="check" size={18} color="#4F46E5" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Sección de Monto Hero */}
          <View style={styles.heroAmountContainer}>
            <Text style={styles.heroCurrency}>$</Text>
            <TextInput
              style={styles.heroInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="numeric" 
              placeholderTextColor="#E5E7EB"
              autoFocus={!isEditing} 
            />
            <Text style={styles.heroLabel}>Monto del movimiento</Text>
          </View>

          {/* Categoría */}
          <Text style={styles.label}>Categoría</Text>
          <TouchableOpacity 
            style={styles.selector}
            onPress={() => setShowCategories(!showCategories)}
          >
            <Text style={selectedCategory ? styles.selectorText : styles.selectorPlaceholder}>
              {selectedCategory?.name || 'Seleccionar categoría'}
            </Text>
            <Feather name={showCategories ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
          </TouchableOpacity>
          
          {showCategories && (
            <View style={styles.optionsList}>
              {loadingCategories ? (
                <ActivityIndicator size="small" color="#4F46E5" style={{ padding: 16 }} />
              ) : categories && categories.length > 0 ? (
                // ✅ CORRECCIÓN: ScrollView agregado para la lista de categorías
                <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                  {categories.map((category: any) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.optionItem,
                        categoryId === category.id && styles.optionItemSelected
                      ]}
                      onPress={() => {
                        setCategoryId(category.id);
                        setShowCategories(false);
                      }}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <Text style={styles.optionText}>{category.name}</Text>
                      {categoryId === category.id && (
                        <Feather name="check" size={18} color="#4F46E5" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noDataText}>No hay categorías disponibles</Text>
              )}
            </View>
          )}

          {/* ==============================================
              SELECTOR DE VIVIENDA (BOTONES)
             ============================================== */}

          {/* CASO 1: VIVIENDA PARA INGRESOS (Obligatorio) */}
          {type === 'income' && (
            <View>
              <Text style={styles.label}>
                Vivienda <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowUnits(true)}
              >
                <View style={styles.selectorContent}>
                  <Text style={selectedUnit ? styles.selectorText : styles.selectorPlaceholder}>
                      {selectedUnit ? `Casa ${selectedUnit.unit_number} - ${getOwnerName(selectedUnit)}` : 'Seleccionar vivienda'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* CASO 2: VIVIENDA PARA GASTOS (Opcional) */}
          {type === 'expense' && (
            <>
              <Text style={styles.label}>Vivienda (opcional)</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowUnits(true)}
              >
                <Text style={selectedUnit ? styles.selectorText : styles.selectorPlaceholder}>
                  {selectedUnit ? `Casa ${selectedUnit.unit_number} - ${getOwnerName(selectedUnit)}` : 'Sin asignar'}
                </Text>
                <Feather name="chevron-right" size={20} color="#6B7280" />
              </TouchableOpacity>
            </>
          )}

          {/* ==============================================
              MODAL DE SELECCIÓN (ÚNICO Y FUERA DEL FLUJO)
             ============================================== */}
          
          <SelectionModal
            visible={showUnits}
            onClose={() => setShowUnits(false)}
            title={type === 'income' ? "Seleccionar Vivienda" : "Asignar a Vivienda (Opcional)"}
          >
            {/* Opción "Sin Asignar" (Solo para gastos) */}
            {type === 'expense' && (
              <TouchableOpacity
                style={[styles.optionItem, !unitId && styles.optionItemSelected]}
                onPress={() => {
                  setUnitId('');
                  setShowUnits(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionText}>Sin asignar (Gasto general)</Text>
                </View>
                {!unitId && <Feather name="check" size={18} color="#4F46E5" />}
              </TouchableOpacity>
            )}

            {/* Lista de Viviendas */}
            {loadingUnits ? (
              <ActivityIndicator size="small" color="#4F46E5" style={{ padding: 16 }} />
            ) : (
              units?.map((unit: any) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[
                    styles.optionItem,
                    unitId === unit.id && styles.optionItemSelected
                  ]}
                  onPress={() => {
                    setUnitId(unit.id);
                    setShowUnits(false);
                    
                    // Lógica especial para Ingresos: Auto-llenar monto
                    if (type === 'income' && !amount && unit.monthly_fee) {
                      setAmount(parseFloat(unit.monthly_fee).toString());
                    }
                  }}
                >
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeText}>{unit.unit_number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionText}>{getOwnerName(unit)}</Text>
                    {/* Mostrar cuota solo en ingresos para referencia */}
                    {type === 'income' && (
                      <Text style={styles.unitFee}>Cuota: {formatCurrency(parseFloat(unit.monthly_fee))}</Text>
                    )}
                  </View>
                  {unitId === unit.id && (
                    <Feather name="check" size={18} color="#4F46E5" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </SelectionModal>

          {/* Método de Pago - MOSTRAR PARA INGRESOS */}
          {type === 'income' && (
            <>
              <Text style={styles.label}>Método de Pago</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowPaymentMethods(!showPaymentMethods)}
              >
                <View style={styles.selectorContent}>
                  <Feather 
                    name={paymentMethods.find(p => p.value === paymentMethod)?.icon as any || 'credit-card'} 
                    size={18} 
                    color="#6B7280" 
                  />
                  <Text style={paymentMethod ? styles.selectorText : styles.selectorPlaceholder}>
                    {paymentMethods.find(p => p.value === paymentMethod)?.label || 'Seleccionar método'}
                  </Text>
                </View>
                <Feather name={showPaymentMethods ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
              </TouchableOpacity>
              
              {showPaymentMethods && (
                <View style={styles.optionsList}>
                  <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.value}
                        style={[
                          styles.optionItem,
                          paymentMethod === method.value && styles.optionItemSelected
                        ]}
                        onPress={() => {
                          setPaymentMethod(method.value);
                          setShowPaymentMethods(false);
                        }}
                      >
                        <Feather name={method.icon as any} size={18} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text style={styles.optionText}>{method.label}</Text>
                        {paymentMethod === method.value && (
                          <Feather name="check" size={18} color="#4F46E5" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Número de Referencia (para transferencias y cheques) */}
              {(paymentMethod === 'transfer' || paymentMethod === 'check') && (
                <>
                  <Text style={styles.label}>Número de Referencia</Text>
                  <TextInput
                    style={styles.input}
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="Ej: 123456789"
                    placeholderTextColor="#9CA3AF"
                  />
                </>
              )}
            </>
          )}

          {/* Método de Pago para gastos */}
          {type === 'expense' && (
            <>
              <Text style={styles.label}>Método de Pago</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowPaymentMethods(!showPaymentMethods)}
              >
                <View style={styles.selectorContent}>
                  <Feather 
                    name={paymentMethods.find(p => p.value === paymentMethod)?.icon as any || 'credit-card'} 
                    size={18} 
                    color="#6B7280" 
                  />
                  <Text style={paymentMethod ? styles.selectorText : styles.selectorPlaceholder}>
                    {paymentMethods.find(p => p.value === paymentMethod)?.label || 'Seleccionar método'}
                  </Text>
                </View>
                <Feather name={showPaymentMethods ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
              </TouchableOpacity>
              
              {showPaymentMethods && (
                <View style={styles.optionsList}>
                  {/* ✅ CORRECCIÓN: ScrollView también para métodos de pago por consistencia */}
                  <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.value}
                        style={[
                          styles.optionItem,
                          paymentMethod === method.value && styles.optionItemSelected
                        ]}
                        onPress={() => {
                          setPaymentMethod(method.value);
                          setShowPaymentMethods(false);
                        }}
                      >
                        <Feather name={method.icon as any} size={18} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text style={styles.optionText}>{method.label}</Text>
                        {paymentMethod === method.value && (
                          <Feather name="check" size={18} color="#4F46E5" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Número de Referencia (para transferencias y cheques) */}
              {(paymentMethod === 'transfer' || paymentMethod === 'check') && (
                <>
                  <Text style={styles.label}>Número de Referencia</Text>
                  <TextInput
                    style={styles.input}
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="Ej: 123456789"
                    placeholderTextColor="#9CA3AF"
                  />
                </>
              )}
            </>
          )}

          {/* Descripción */}
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Descripción del movimiento..."
            multiline
            numberOfLines={3}
            placeholderTextColor="#9CA3AF"
          />

          {/* Comprobante (solo para gastos) */}
          {type === 'expense' && (
            <>
              <Text style={styles.label}>Comprobante (opcional)</Text>
              {receiptImage ? (
                <View style={styles.receiptPreview}>
                  <Image 
                    source={{ uri: receiptImage }} 
                    style={styles.receiptImage}
                    resizeMode="cover"
                  />
                  <View style={styles.receiptActions}>
                    <TouchableOpacity 
                      style={styles.receiptActionButton}
                      onPress={() => setReceiptImage(null)}
                    >
                      <Feather name="trash-2" size={18} color="#EF4444" />
                      <Text style={styles.receiptActionTextDanger}>Eliminar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.receiptActionButton}
                      onPress={pickReceiptImage}
                    >
                      <Feather name="refresh-cw" size={18} color="#4F46E5" />
                      <Text style={styles.receiptActionText}>Cambiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.receiptButtons}>
                  <TouchableOpacity 
                    style={styles.receiptButton}
                    onPress={takeReceiptPhoto}
                  >
                    <View style={styles.receiptButtonIcon}>
                      <Feather name="camera" size={24} color="#4F46E5" />
                    </View>
                    <Text style={styles.receiptButtonText}>Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.receiptButton}
                    onPress={pickReceiptImage}
                  >
                    <View style={styles.receiptButtonIcon}>
                      <Feather name="image" size={24} color="#4F46E5" />
                    </View>
                    <Text style={styles.receiptButtonText}>Galería</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Espacio inferior */}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Botón de guardar */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton, 
              createMutation.isPending && styles.submitButtonDisabled,
              isAdvancePayment && styles.submitButtonAdvance,
              isLatePayment && styles.submitButtonLate
            ]}
            onPress={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather 
                  name={isAdvancePayment ? "fast-forward" : isLatePayment ? "rewind" : "check"} 
                  size={20} 
                  color="white" 
                />
                <Text style={styles.submitText}>
                  {isAdvancePayment 
                    ? 'Guardar Pago Adelantado' 
                    : isLatePayment 
                      ? 'Guardar Pago Atrasado'
                      : 'Guardar Movimiento'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  // Estilos de comprobante
  receiptButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  receiptButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  receiptButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
  },
  receiptPreview: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  receiptImage: {
    width: '100%',
    height: 200,
  },
  receiptActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  receiptActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  receiptActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
  },
  receiptActionTextDanger: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  content: { flex: 1, padding: 16 },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#374151', 
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: '#EF4444',
  },
  typeContainer: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  typeButtonActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  typeButtonActiveExpense: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  typeText: { fontSize: 16, fontWeight: '500', color: '#6B7280' },
  typeTextIncome: { color: '#10B981' },
  typeTextExpense: { color: '#EF4444' },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 24, fontWeight: '600', color: '#6B7280' },
  amountInput: { 
    flex: 1, 
    fontSize: 32, 
    fontWeight: '700', 
    color: '#1F2937',
    padding: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  selectorAdvance: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectorText: { fontSize: 16, color: '#1F2937' },
  selectorTextAdvance: { color: '#B45309', fontWeight: '600' },
  selectorPlaceholder: { fontSize: 16, color: '#9CA3AF' },
  optionsList: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
    maxHeight: 250,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  optionItemSelected: { backgroundColor: '#EEF2FF' },
  optionText: { flex: 1, fontSize: 14, color: '#1F2937' },
  categoryDot: { width: 12, height: 12, borderRadius: 6 },
  unitBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unitBadgeText: { fontSize: 12, fontWeight: '600', color: '#4F46E5' },
  unitFee: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  noDataText: {
    padding: 16,
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonAdvance: { backgroundColor: '#F59E0B' },
  submitButtonLate: { backgroundColor: '#EF4444' },
  submitText: { color: 'white', fontSize: 16, fontWeight: '600' },
  // Estilos para pago adelantado
  advanceBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  advanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  advanceBadgeSmall: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  advanceBadgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
  advanceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  advanceNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#B45309',
  },
  // Estilos para pago atrasado
  selectorLate: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  selectorTextLate: { 
    color: '#DC2626', 
    fontWeight: '600' 
  },
  lateBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  lateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  lateBadgeSmall: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lateBadgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#DC2626',
  },
  lateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  lateNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  // Estilos nuevos para el input Hero
  heroAmountContainer: {
    alignItems: 'center',
    marginVertical: 24,
    backgroundColor: 'white',
    paddingVertical: 20,
    borderRadius: 20, // Bordes más suaves
    // Sombra suave para darle elevación
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroCurrency: {
    fontSize: 24,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  heroInput: {
    fontSize: 48, // Texto GIGANTE
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    minWidth: 150,
  },
  heroLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  // Estilos para el Modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
});

// Componente reutilizable para selecciones (Vivienda, Categoría, Periodo)
const SelectionModal = ({ 
  visible, 
  onClose, 
  title, 
  children 
}: { 
  visible: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet" // Estilo nativo iOS
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
