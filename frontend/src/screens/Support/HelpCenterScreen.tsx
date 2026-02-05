/**
 * Pantalla de Centro de Ayuda - Diseño Neo-Bank
 * Incluye: Buscador, FAQ Acordeón y Botones de Contacto
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  TextInput,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: '¿Cómo ver mi estado de cuenta?',
    icon: 'file-text',
    color: '#4F46E5',
    bgColor: '#EEF2FF',
    answer: `Para ver tu estado de cuenta completo:\n\n1. Ve a la pantalla de "Viviendas" o "Perfil".\n2. Selecciona tu vivienda.\n3. Presiona el botón "Estado de Cuenta".\n\nAllí encontrarás el historial de pagos, cargos y tu saldo actual.`,
  },
  {
    id: '2',
    question: '¿Cómo reportar un pago?',
    icon: 'dollar-sign',
    color: '#10B981',
    bgColor: '#D1FAE5',
    answer: `Si realizaste una transferencia:\n\n1. Ve a la pantalla de Inicio.\n2. Toca "Registrar Pago" en acciones rápidas.\n3. Ingresa el monto y sube tu comprobante.\n\nEl administrador validará tu pago en un lapso de 24-48 horas.`,
  },
  {
    id: '3',
    question: '¿Problemas con el acceso?',
    icon: 'lock',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    answer: `Si olvidaste tu contraseña:\n\n1. En la pantalla de Login, toca "¿Olvidaste tu contraseña?".\n2. Ingresa tu correo registrado.\n3. Recibirás un enlace para restablecerla.\n\nSi el problema persiste, contacta a soporte directo.`,
  },
  {
    id: '4',
    question: '¿Cómo contactar a administración?',
    icon: 'users',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    answer: `Puedes contactar a la administración directamente desde esta pantalla usando los botones de "Soporte Directo" en la parte inferior (WhatsApp, Llamada o Email).`,
  },
  {
    id: '5',
    question: '¿Qué hacer si tengo un cargo incorrecto?',
    icon: 'alert-triangle',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    answer: `Si detectas un error en tu saldo:\n\n1. Revisa tu "Estado de Cuenta" para identificar el movimiento.\n2. Contacta a administración vía WhatsApp.\n3. Ten a la mano tu comprobante de pago real para aclaraciones.`,
  },
];

const CONTACT_INFO = {
  phone: '3333892597',
  email: 'edyese@msn.com',
  whatsapp: '523333892597', // Formato internacional sin +
};

export default function HelpCenterScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredData = useMemo(() => {
    if (!searchQuery) return FAQ_DATA;
    return FAQ_DATA.filter(item => 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleCall = () => {
    Linking.openURL(`tel:${CONTACT_INFO.phone}`);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.email}?subject=Soporte App Condominio`);
  };

  const handleWhatsApp = () => {
    Linking.openURL(`whatsapp://send?phone=${CONTACT_INFO.whatsapp}&text=Hola, necesito ayuda con la app.`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Hero */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>¿Cómo podemos ayudarte?</Text>
          <Text style={styles.headerSubtitle}>
            Busca en nuestras preguntas frecuentes o contáctanos directamente.
          </Text>
          
          {/* Barra de Búsqueda */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar ayuda (ej: pagos, contraseña)..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sección FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>
          
          {filteredData.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="help-circle" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No encontramos resultados</Text>
            </View>
          ) : (
            filteredData.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <View key={item.id} style={styles.faqCard}>
                  <TouchableOpacity
                    style={styles.faqHeader}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                      <Feather name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={styles.questionText}>{item.question}</Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.answerBox}>
                      <View style={styles.answerDivider} />
                      <Text style={styles.answerText}>{item.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Sección Contacto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soporte Directo</Text>
          <View style={styles.contactGrid}>
            <TouchableOpacity style={styles.contactCard} onPress={handleWhatsApp}>
              <View style={[styles.contactIcon, { backgroundColor: '#D1FAE5' }]}>
                <Feather name="message-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactSub}>Chat rápido</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
              <View style={[styles.contactIcon, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="phone" size={24} color="#4F46E5" />
              </View>
              <Text style={styles.contactLabel}>Llamar</Text>
              <Text style={styles.contactSub}>9am - 6pm</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
              <View style={[styles.contactIcon, { backgroundColor: '#F3F4F6' }]}>
                <Feather name="mail" size={24} color="#374151" />
              </View>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactSub}>24-48 hrs</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: {
    backgroundColor: 'white',
    padding: 24,
    paddingTop: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#1F2937',
    height: '100%',
  },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },

  // FAQ Cards
  faqCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  answerBox: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  answerDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  answerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },

  // Contact Grid
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  contactSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
  },
});
