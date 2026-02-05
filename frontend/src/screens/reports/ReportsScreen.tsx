/**
 * Pantalla de Reportes y Estadísticas - Diseño Neo-Bank
 * Muestra gastos reales (excluyendo deuda virtual) y métricas administrativas.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useDashboardReport } from '../../hooks/useReports';
import { 
  formatCurrency, 
  formatFiscalPeriod, 
  getCurrentFiscalPeriod, // <--- Faltaba esta
  getFiscalPeriods        // <--- Y esta para la lista del selector
} from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import api, { getAccessToken } from '../../shared/services/api/client';
import * as FileSystem from 'expo-file-system/legacy'; // Ojo con la importación correcta según tu versión de Expo
import * as Sharing from 'expo-sharing';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 48; // Margen ajustado

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // Índigo primario
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#4F46E5',
  },
  propsForBackgroundLines: {
    strokeDasharray: '4', // Líneas punteadas
    stroke: 'rgba(0,0,0,0.05)',
  },
};

export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'monthly' | 'debtors'>('monthly');
  const [exportPeriod, setExportPeriod] = useState(getCurrentFiscalPeriod()); // Ejem: "2025-11"
  const [exporting, setExporting] = useState(false);
  const [selectedChart, setSelectedChart] = useState<'trend' | 'categories'>('trend');
  
  const availablePeriods = useMemo(() => getFiscalPeriods(12, 0), []);
  
  const { 
    data: dashboardData, 
    isLoading, 
    refetch, 
    isFetching 
  } = useDashboardReport();

  // Datos para Gráfica de Tendencia (Líneas)
  const trendData = useMemo(() => {
    if (!dashboardData?.monthly_trend || dashboardData.monthly_trend.length === 0) return null;
    
    const trend = dashboardData.monthly_trend;
    // Tomamos los últimos 6 meses para que quepa bien en pantalla
    const recentTrend = trend.slice(-6);
    
    const labels = recentTrend.map((item: any) => MONTHS[item.month - 1]);
    // Dividimos entre 1000 para que los números del eje Y no sean enormes (ej: 15k)
    const incomeData = recentTrend.map((item: any) => item.income);
    const expenseData = recentTrend.map((item: any) => item.expense);
    
    return {
      labels: labels,
      datasets: [
        {
          data: incomeData,
          color: (opacity = 4) => `rgba(16, 185, 129, ${opacity})`, // Verde Ingresos #4F46E5' : '#6B7280'
          strokeWidth: 3,
        },
        {
          data: expenseData,
          color: (opacity = 4) => `rgba(239, 68, 68, ${opacity})`, // Rojo Gastos
          strokeWidth: 3,
        },
      ],
      legend: ['Ingresos', 'Gastos'],
    };
  }, [dashboardData]);

  // Datos para Gráfica de Categorías (Pastel)
  const categoryData = useMemo(() => {
    if (!dashboardData?.top_categories || dashboardData.top_categories.length === 0) return null;
    
    const colors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    
    return dashboardData.top_categories.slice(0, 5).map((cat: any, index: number) => ({
      name: cat.name,
      total: cat.total,
      color: cat.color || colors[index % colors.length], // Usar color de DB o fallback
      legendFontColor: '#4B5563',
      legendFontSize: 11,
    }));
  }, [dashboardData]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = await getAccessToken();
      
      if (!token) {
        toast.error('Sesión expirada, vuelve a iniciar sesión');
        setExporting(false);
        return;
      }

      // 1. Determinar Endpoint y Nombre de Archivo
      let endpoint = '';
      let filename = '';

      if (exportType === 'monthly') {
        // Desglosar el periodo seleccionado (YYYY-MM)
        const [year, month] = exportPeriod.split('-');
        
        endpoint = `/reports/export/monthly/${year}/${month}`;
        filename = `Reporte_Mensual_${year}-${month}.xlsx`;
      } else {
        // Reporte de Deudores (Generalmente es al momento actual)
        endpoint = '/reports/export/debtors';
        const todayStr = new Date().toISOString().split('T')[0];
        filename = `Reporte_Deudores_${todayStr}.xlsx`;
      }

      // 2. Realizar la Petición al Backend
      const baseUrl = api.defaults.baseURL || '';
      // Aseguramos que no haya doble slash //
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      const response = await fetch(`${cleanBaseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      // 3. Procesar el Archivo (Blob -> Base64 -> FileSystem)
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const fileUri = FileSystem.documentDirectory + filename;

          // Escribir archivo
          await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: FileSystem.EncodingType.Base64
          });

          // Compartir / Guardar
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              dialogTitle: `Guardar ${filename}`,
              UTI: 'com.microsoft.excel.xlsx'
            });
            toast.success('Reporte exportado correctamente');
          } else {
            toast.info('Archivo guardado en documentos');
          }
        } catch (saveError) {
          console.error("Error guardando archivo:", saveError);
          toast.error("No se pudo guardar el archivo en el dispositivo");
        } finally {
          setExporting(false);
          setShowExportModal(false);
        }
      };

    } catch (error) {
      console.error("Error en exportación:", error);
      toast.error('Error al descargar el reporte');
      setExporting(false);
    }
  };

  // Función para forzar el cobro manual
  const handleManualCharge = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      toast.info("Iniciando generación de cuotas...");
      
      const baseUrl = api.defaults.baseURL || '';
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      const response = await fetch(`${cleanBaseUrl}/admin/trigger-monthly-fees`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        toast.success("Cuotas generadas exitosamente");
        // Recargamos los datos para ver reflejado el cambio en el balance
        refetch(); 
      } else {
        const err = await response.json();
        toast.error(err.detail || "Error al generar cuotas");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión");
    }
  };

  // =====================================================
  // MODIFICADO: Navegar a la nueva pantalla de gastos
  // =====================================================
  const handleViewExpenses = () => {
    // Navegar a la pantalla dedicada de gastos del condominio
    // @ts-ignore - Navegación al RootStack
    navigation.getParent()?.navigate('CondominiumExpenses');
  };

  const handleViewPending = () => {
    // Navegar a transacciones. Idealmente con filtro pre-cargado de "Pendientes"
    navigation.navigate('Transactions'); 
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  const currentMonth = dashboardData?.current_month;
  const currentYear = dashboardData?.current_year;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reportes</Text>
          <Text style={styles.headerSubtitle}>Estadísticas en tiempo real</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.exportBtn}
            onPress={() => setShowExportModal(true)}
          >
            <Feather name="download" size={20} color="#4F46E5" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} colors={['#4F46E5']} />}
      >
        {/* Balance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Balance Operativo (Mes)</Text>
            <View style={[styles.trendPill, { backgroundColor: (currentMonth?.balance || 0) >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
              <Feather 
                name={(currentMonth?.balance || 0) >= 0 ? "trending-up" : "trending-down"} 
                size={14} 
                color={(currentMonth?.balance || 0) >= 0 ? "#059669" : "#DC2626"} 
              />
              <Text style={[styles.trendText, { color: (currentMonth?.balance || 0) >= 0 ? "#059669" : "#DC2626" }]}>
                {(currentMonth?.balance || 0) >= 0 ? "Superávit" : "Déficit"}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.heroAmount, { color: (currentMonth?.balance || 0) >= 0 ? "#10B981" : "#EF4444" }]}>
            {formatCurrency(currentMonth?.balance || 0)}
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Ingresos</Text>
              <Text style={[styles.heroStatValue, { color: '#10B981' }]}>
                {formatCurrency(currentMonth?.income || 0)}
              </Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Gastos Reales</Text>
              <Text style={[styles.heroStatValue, { color: '#EF4444' }]}>
                {formatCurrency(currentMonth?.expense || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Acumulado Anual */}
        <View style={styles.yearSummaryContainer}>
          <Text style={styles.sectionTitle}>Acumulado Anual</Text>
          <View style={styles.yearRow}>
            <View style={styles.yearCard}>
               <View style={[styles.yearIcon, { backgroundColor: '#ECFDF5' }]}>
                 <Feather name="arrow-down-left" size={18} color="#10B981" />
               </View>
               <View>
                 <Text style={styles.yearLabel}>Ingresos</Text>
                 <Text style={styles.yearValue}>{formatCurrency(currentYear?.income || 0)}</Text>
               </View>
            </View>
                                     
            
            {/* BOTÓN DE GASTOS - Navega a CondominiumExpensesScreen */}
            <TouchableOpacity 
              style={styles.yearCard} 
              onPress={handleViewExpenses}
              activeOpacity={0.7}
            >
               <Feather name="arrow-up-right" size={16} color="#EF4444" />
               <View style={{ flex: 1 }}>
                 <Text style={styles.yearLabel}>Gastos</Text>
                 <Text style={styles.yearValue}>{formatCurrency(currentYear?.expense || 0)}</Text>
               </View>
               <Feather name="chevron-right" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gráficas */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Análisis</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={[styles.segmentBtn, selectedChart === 'trend' && styles.segmentBtnActive]}
                onPress={() => setSelectedChart('trend')}
              >
                <Feather name="activity" size={16} color={selectedChart === 'trend' ? '#4F46E5' : '#6B7280'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, selectedChart === 'categories' && styles.segmentBtnActive]}
                onPress={() => setSelectedChart('categories')}
              >
                <Feather name="pie-chart" size={16} color={selectedChart === 'categories' ? '#4F46E5' : '#6B7280'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {selectedChart === 'trend' ? (
              <>
                <Text style={styles.chartTitle}>Tendencia Financiera (6 Meses)</Text>
                {trendData ? (
                  <LineChart
                    data={trendData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    yAxisLabel="$"
                    yAxisSuffix="k"
                    formatYLabel={(y) => (parseInt(y) / 1000).toFixed(0)} // Simplificar eje Y
                  />
                ) : (
                  <View style={styles.noDataBox}><Text style={styles.noDataText}>Sin datos suficientes</Text></View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.chartTitle}>Distribución de Gastos (Top 5)</Text>
                {categoryData && categoryData.length > 0 ? (
                  <PieChart
                    data={categoryData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    accessor="total"
                    backgroundColor="transparent"
                    paddingLeft="0"
                    center={[0, 0]}
                    absolute={false} // Mostrar valores monetarios
                  />
                ) : (
                  <View style={styles.noDataBox}><Text style={styles.noDataText}>No hay gastos registrados</Text></View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Métricas Admin */}
        {isAdmin && dashboardData?.admin_stats && (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>Tablero de Control</Text>
            <View style={styles.adminGrid}>
              
              <View style={[styles.adminStatCard, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.adminStatValue, { color: '#DC2626' }]}>
                  {dashboardData.admin_stats.units_with_debt}
                </Text>
                <Text style={styles.adminStatLabel}>Morosos</Text>
              </View>

              <View style={[styles.adminStatCard, { backgroundColor: '#FFF7ED' }]}>
                <Text style={[styles.adminStatValue, { color: '#D97706', fontSize: 16 }]}>
                  {formatCurrency(dashboardData.admin_stats.total_debt)}
                </Text>
                <Text style={styles.adminStatLabel}>Cartera Vencida</Text>
              </View>

              <TouchableOpacity 
                style={[styles.adminStatCard, { backgroundColor: '#EEF2FF' }]}
                onPress={handleViewPending}
                activeOpacity={0.7}
              >
                <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                   <Text style={[styles.adminStatValue, { color: '#4F46E5' }]}>
                    {dashboardData.admin_stats.pending_transactions}
                   </Text>
                   <Feather name="arrow-right" size={14} color="#4F46E5" style={{opacity: 0.5}} />
                </View>
                <Text style={styles.adminStatLabel}>Por Aprobar</Text>
              </TouchableOpacity>

              <View style={[styles.adminStatCard, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.adminStatValue, { color: '#059669' }]}>
                  {dashboardData.admin_stats.active_users}
                </Text>
                <Text style={styles.adminStatLabel}>Usuarios App</Text>
              </View>

            </View>
            {/* BOTÓN DE GENERACIÓN MANUAL DE CUOTAS */}
            <TouchableOpacity 
              style={styles.manualChargeBtn}
              onPress={handleManualCharge}
              activeOpacity={0.8}
            >
              <View style={styles.manualChargeIcon}>
                <Feather name="zap" size={20} color="white" />
              </View>
              <View>
                <Text style={styles.manualChargeTitle}>Ejecutar Corte Mensual</Text>
                <Text style={styles.manualChargeSubtitle}>Generar cargos de {formatFiscalPeriod(getCurrentFiscalPeriod())}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      
        <View style={styles.financialSection}>
          <Text style={styles.sectionTitle}>Contabilidad</Text>
          <TouchableOpacity 
            style={styles.financialCard}
            onPress={() => navigation.navigate('FinancialStatus')}
            activeOpacity={0.8}
          >
            <View style={styles.financialIconBox}>
             <Feather name="briefcase" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.financialContent}>
             <Text style={styles.financialTitle}>Estado Financiero</Text>
             <Text style={styles.financialDesc} numberOfLines={2}>
               Balance general con remanentes y desglose detallado.
             </Text>
            </View>
            <View style={styles.financialArrowBox}>
              <Feather name="chevron-right" size={20} color="#4F46E5" />
            </View>
           </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal de Configuración de Exportación */}
      <Modal 
        visible={showExportModal} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.exportModalCard}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Exportar Reporte</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Feather name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Selector de Tipo */}
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, exportType === 'monthly' && styles.typeBtnActive]}
                  onPress={() => setExportType('monthly')}
                >
                  <Feather name="calendar" size={18} color={exportType === 'monthly' ? '#4F46E5' : '#6B7280'} />
                  <Text style={[styles.typeBtnText, exportType === 'monthly' && styles.textActive]}>Mensual</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.typeBtn, exportType === 'debtors' && styles.typeBtnActive]}
                  onPress={() => setExportType('debtors')}
                >
                  <Feather name="users" size={18} color={exportType === 'debtors' ? '#4F46E5' : '#6B7280'} />
                  <Text style={[styles.typeBtnText, exportType === 'debtors' && styles.textActive]}>Deudores</Text>
                </TouchableOpacity>
              </View>

              {/* Selector de Mes (Solo visible si es Mensual) */}
              {exportType === 'monthly' && (
                <View style={styles.periodSelectorContainer}>
                  <Text style={styles.periodLabel}>Selecciona el mes:</Text>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {availablePeriods.map((period) => (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.periodOption,
                          exportPeriod === period && styles.periodOptionSelected
                        ]}
                        onPress={() => setExportPeriod(period)}
                      >
                        <Text style={[
                          styles.periodOptionText,
                          exportPeriod === period && styles.textSelected
                        ]}>
                          {formatFiscalPeriod(period)}
                        </Text>
                        {exportPeriod === period && (
                          <Feather name="check" size={18} color="#4F46E5" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Botón de Acción */}
              <TouchableOpacity 
                style={[styles.downloadBtn, exporting && styles.downloadBtnDisabled]}
                onPress={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Feather name="download" size={20} color="white" />
                    <Text style={styles.downloadBtnText}>
                      {exportType === 'monthly' 
                        ? `Descargar ${formatFiscalPeriod(exportPeriod)}`
                        : 'Descargar Lista de Deudores'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  exportBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center'
  },

  heroCard: {
    backgroundColor: 'white', margin: 20, borderRadius: 24, padding: 24,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5,
    borderWidth: 1, borderColor: '#F3F4F6'
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 14, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  trendPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 6 },
  trendText: { fontSize: 12, fontWeight: '700' },
  heroAmount: { fontSize: 38, fontWeight: '800', marginBottom: 24, letterSpacing: -1 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStatItem: { flex: 1 },
  heroStatLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 6, fontWeight: '500' },
  heroStatValue: { fontSize: 18, fontWeight: '700' },
  verticalDivider: { width: 1, height: 40, backgroundColor: '#F3F4F6', marginHorizontal: 20 },

  yearSummaryContainer: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  yearRow: { flexDirection: 'row', gap: 12 },
  yearCard: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', padding: 16, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
    borderWidth: 1, borderColor: '#F9FAFB'
  },
  yearIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  yearValue: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },

  chartSection: { marginHorizontal: 20, marginBottom: 24 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  segmentControl: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#EEF2FF' },
  chartCard: {
    backgroundColor: 'white', borderRadius: 24, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6'
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: '#374151', alignSelf: 'flex-start', marginBottom: 20 },
  chart: { borderRadius: 16, marginVertical: 8 },
  noDataBox: { height: 200, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#9CA3AF', fontSize: 14 },

  adminSection: { paddingHorizontal: 20, marginBottom: 30 },
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  adminStatCard: {
    width: (screenWidth - 52) / 2,
    padding: 16, borderRadius: 20,
    justifyContent: 'center',
    minHeight: 100,
  },
  adminStatValue: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  adminStatLabel: { fontSize: 12, color: '#4B5563', fontWeight: '600' },

  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  modalContent: { padding: 20 },
  exportOption: { 
    flexDirection: 'row', alignItems: 'center', gap: 16, 
    padding: 16, backgroundColor: '#F9FAFB', borderRadius: 16, marginBottom: 12 
  },
  exportIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportOptionTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  exportOptionDesc: { fontSize: 12, color: '#6B7280' },
  // Sección Financiera
  financialSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
    marginTop: 8,
  },
  financialCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1b255f', // Dark Indigo Background
    borderRadius: 24, padding: 20,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  financialIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#6f68ec', // Color primario sólido
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    // Sombra interna del icono (simulada con elevación en Android)
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  financialContent: {
    flex: 1,
    marginRight: 8,
  },
  financialTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF', // ✅ CAMBIO: Blanco para contrastar con el fondo oscuro
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  financialDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)', // ✅ CAMBIO: Blanco semitransparente
    lineHeight: 18,
    fontWeight: '500',
  },
  financialArrowBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.58)', // ✅ CAMBIO: Sutil para que combine
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Estilos del Modal de Exportación
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', // Estilo Bottom Sheet
  },
  exportModalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalBody: {
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  typeBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  textActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  periodSelectorContainer: {
    marginBottom: 20,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  periodOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  periodOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  periodOptionText: {
    fontSize: 15,
    color: '#4B5563',
  },
  textSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  downloadBtn: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 10,
  },
  downloadBtnDisabled: {
    backgroundColor: '#A5B4FC',
  },
  downloadBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  manualChargeBtn: {
    marginTop: 16,
    backgroundColor: '#111827', // Negro/Gris muy oscuro
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  manualChargeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  manualChargeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  manualChargeSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
