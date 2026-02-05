/**
 * Pantalla de Política de Privacidad - Diseño Documento Legal
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

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header con Navegación */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Privacidad</Text>
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
            <Feather name="shield" size={32} color="#9333EA" />
          </View>
          <Text style={styles.docTitle}>Política de Privacidad</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Última actualización: Enero 2026</Text>
          </View>
        </View>

        {/* Contenido Legal (Tarjeta de Papel) */}
        <View style={styles.paperCard}>
          
          {/* Introducción */}
          <View style={styles.section}>
            <Text style={styles.paragraph}>
              El <Text style={styles.bold}>CONDOMINIO PARQUES DE SANTA CRUZ 9 MANZANA XIV</Text> se compromete a proteger la privacidad y seguridad de los datos personales de sus condóminos y usuarios.
            </Text>
            <Text style={styles.paragraph}>
              Esta Política describe cómo recopilamos, usamos y protegemos su información conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
            </Text>
          </View>

          <View style={styles.divider} />

          {/* 1. Responsable */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Responsable del Tratamiento</Text>
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Feather name="user" size={16} color="#4B5563" />
                <Text style={styles.infoText}><Text style={styles.bold}>Responsable:</Text> Edgar Ramírez Guzmán</Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="briefcase" size={16} color="#4B5563" />
                <Text style={styles.infoText}><Text style={styles.bold}>Cargo:</Text> Administrador</Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={16} color="#4B5563" />
                <Text style={styles.infoText}><Text style={styles.bold}>Ubicación:</Text> San Camilo 2898, Tlaquepaque</Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="mail" size={16} color="#4B5563" />
                <Text style={styles.infoText}>edyese@msn.com</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 2. Datos Recopilados */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Datos que Recopilamos</Text>
            <Text style={styles.subTitle}>2.1 Datos de Identificación:</Text>
            <View style={styles.bulletList}>
              {['Nombre completo', 'Correo electrónico', 'Teléfono', 'Número de unidad'].map((item, i) => (
                <View key={i} style={styles.bulletItem}>
                  <Feather name="check" size={16} color="#9333EA" style={{ marginTop: 2 }} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.subTitle, { marginTop: 12 }]}>2.2 Datos Financieros:</Text>
            <View style={styles.bulletList}>
              {['Historial de pagos', 'Saldo de cuenta', 'Comprobantes de pago'].map((item, i) => (
                <View key={i} style={styles.bulletItem}>
                  <Feather name="check" size={16} color="#9333EA" style={{ marginTop: 2 }} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* 3. Finalidades */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Uso de la Información</Text>
            <Text style={styles.paragraph}>
              Sus datos personales serán utilizados para las siguientes finalidades primarias y necesarias:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Feather name="arrow-right" size={16} color="#6B7280" style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>Identificación y autenticación en la app.</Text>
              </View>
              <View style={styles.bulletItem}>
                <Feather name="arrow-right" size={16} color="#6B7280" style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>Administración de cuotas y estados de cuenta.</Text>
              </View>
              <View style={styles.bulletItem}>
                <Feather name="arrow-right" size={16} color="#6B7280" style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>Comunicación oficial sobre el condominio.</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 4. Seguridad */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Almacenamiento y Seguridad</Text>
            <Text style={styles.paragraph}>
              Sus datos se almacenan en servidores seguros en la nube (AWS/Digital Ocean) y están protegidos mediante:
            </Text>
            <View style={styles.gridList}>
              <View style={styles.gridItem}>
                <Feather name="lock" size={18} color="#10B981" />
                <Text style={styles.gridText}>Encriptación</Text>
              </View>
              <View style={styles.gridItem}>
                <Feather name="shield" size={18} color="#10B981" />
                <Text style={styles.gridText}>Conexión SSL</Text>
              </View>
              <View style={styles.gridItem}>
                <Feather name="database" size={18} color="#10B981" />
                <Text style={styles.gridText}>Respaldos</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 6. Derechos ARCO */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Derechos ARCO</Text>
            <Text style={styles.paragraph}>
              Usted tiene derecho a <Text style={styles.bold}>Acceder, Rectificar, Cancelar u Oponerse</Text> al tratamiento de sus datos.
            </Text>
            <Text style={styles.paragraph}>
              Para ejercer estos derechos, envíe una solicitud a <Text style={{ color: '#4F46E5' }}>edyese@msn.com</Text>. Responderemos en un plazo máximo de 20 días hábiles.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* 7. Consentimiento */}
          <View style={styles.consentBox}>
            <Feather name="check-circle" size={24} color="#059669" />
            <Text style={styles.consentText}>
              Al utilizar esta aplicación, usted acepta el tratamiento de sus datos personales conforme a esta Política de Privacidad.
            </Text>
          </View>

        </View>

        {/* Pie de Página */}
        <View style={styles.docFooter}>
          <Text style={styles.footerText}>Fin del documento</Text>
          <Text style={styles.footerSubText}>Condominio Parques de Santa Cruz 9</Text>
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
    backgroundColor: '#F3E8FF', justifyContent: 'center', alignItems: 'center',
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
  subTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  paragraph: { fontSize: 15, lineHeight: 24, color: '#4B5563', marginBottom: 12, textAlign: 'justify' },
  bold: { fontWeight: '700', color: '#1F2937' },
  
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },

  // Bullets
  bulletList: { gap: 8, marginBottom: 12 },
  bulletItem: { flexDirection: 'row', gap: 10, paddingRight: 10 },
  bulletText: { fontSize: 15, color: '#4B5563', flex: 1, lineHeight: 22 },

  // Info Box (Responsable)
  infoBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#9333EA',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#374151', flex: 1 },

  // Grid List (Seguridad)
  gridList: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  gridItem: { 
    alignItems: 'center', backgroundColor: '#ECFDF5', 
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, flex: 1, marginHorizontal: 4,
    gap: 4 
  },
  gridText: { fontSize: 12, fontWeight: '600', color: '#065F46' },

  // Consent Box
  consentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#065F46',
    fontWeight: '500',
  },

  // Footer
  docFooter: { alignItems: 'center', marginTop: 24, opacity: 0.5 },
  footerText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  footerSubText: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
});
