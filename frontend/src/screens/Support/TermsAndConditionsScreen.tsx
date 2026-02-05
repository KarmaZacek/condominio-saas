/**
 * Pantalla de Términos y Condiciones - Diseño Documento Legal
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function TermsAndConditionsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header con Navegación */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Legales</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado del Documento */}
        <View style={styles.docHeader}>
          <View style={styles.iconContainer}>
            <Feather name="file-text" size={32} color="#4F46E5" />
          </View>
          <Text style={styles.docTitle}>Términos y Condiciones</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Última actualización: Enero 2026</Text>
          </View>
        </View>

        {/* Contenido Legal (Tarjeta de Papel) */}
        <View style={styles.paperCard}>
          
          {/* Sección 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Información General</Text>
            <Text style={styles.paragraph}>
              Los presentes Términos y Condiciones regulan el uso de la aplicación móvil de administración del <Text style={styles.bold}>CONDOMINIO PARQUES DE SANTA CRUZ 9 MANZANA XIV</Text>, ubicado en San Camilo 2898, San Pedro Tlaquepaque, Jalisco.
            </Text>
            <Text style={styles.paragraph}>
              Al utilizar esta aplicación, usted acepta estos términos en su totalidad. Si no está de acuerdo, le rogamos no utilizar el servicio.
            </Text>
          </View>
          
          <View style={styles.divider} />

          {/* Sección 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Uso de la Aplicación</Text>
            <Text style={styles.paragraph}>
              La aplicación está destinada exclusivamente para:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Feather name="check" size={16} color="#10B981" style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>Consulta de estados de cuenta y saldos.</Text>
              </View>
              <View style={styles.bulletItem}>
                <Feather name="check" size={16} color="#10B981" style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>Registro y comprobación de pagos de cuotas.</Text>
              </View>
              <View style={styles.bulletItem}>
                <Feather name="check" size={16} color="#10B981" style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>Comunicación oficial con la administración.</Text>
              </View>
            </View>
            <Text style={styles.paragraph}>
              Está prohibido el uso de la aplicación para fines ilícitos o que perjudiquen la operación del condominio.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Sección 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Pagos y Comprobantes</Text>
            <Text style={styles.paragraph}>
              Los pagos registrados en la aplicación están sujetos a validación por parte de la administración. La carga de un comprobante no implica la confirmación inmediata del pago hasta que sea conciliado con el estado de cuenta bancario del condominio.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Sección 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Privacidad y Datos</Text>
            <Text style={styles.paragraph}>
              Sus datos personales serán tratados conforme a nuestra Política de Privacidad. La información financiera visible es estrictamente confidencial y de uso exclusivo para el propietario de la unidad correspondiente.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Sección 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Modificaciones</Text>
            <Text style={styles.paragraph}>
              La administración se reserva el derecho de modificar estos términos en cualquier momento. Las actualizaciones serán notificadas a través de la aplicación.
            </Text>
          </View>

          {/* Pie de Documento */}
          <View style={styles.docFooter}>
            <Text style={styles.footerText}>Fin del documento</Text>
            <Text style={styles.footerSubText}>Condominio Parques de Santa Cruz 9</Text>
          </View>

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  // Nav Header
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F9FAFB',
  },
  backButton: { padding: 8, marginLeft: -8 },
  navTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },

  // Scroll
  scrollView: { flex: 1 },
  contentContainer: { padding: 20, paddingTop: 0 },

  // Doc Header
  docHeader: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  iconContainer: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  docTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

  // Paper Card
  paperCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  // Sections
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  paragraph: { fontSize: 15, lineHeight: 24, color: '#4B5563', marginBottom: 12, textAlign: 'justify' },
  bold: { fontWeight: '700', color: '#1F2937' },
  
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },

  // Bullets
  bulletList: { marginTop: 4, marginBottom: 16, gap: 8 },
  bulletItem: { flexDirection: 'row', gap: 10, paddingRight: 10 },
  bulletText: { fontSize: 15, color: '#4B5563', flex: 1, lineHeight: 22 },

  // Footer
  docFooter: { alignItems: 'center', marginTop: 24, opacity: 0.5 },
  footerText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  footerSubText: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
});
