/**
 * Pantalla de Gestión de Categorías
 * Lista, crea, edita y elimina categorías de ingresos y gastos
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { 
  useCategories, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory 
} from '../../hooks/useCategories';
import type { CategoryType } from '../../types';
import { toast } from '../../store/toastStore';

type TabType = 'income' | 'expense';

interface CategoryForm {
  id?: string;
  name: string;
  description: string;
  type: CategoryType;
}

const initialForm: CategoryForm = {
  name: '',
  description: '',
  type: 'income',
};

export default function CategoriesScreen() {
  // Estados
  const [activeTab, setActiveTab] = useState<TabType>('income');
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState<CategoryForm>(initialForm);
  const [isEditing, setIsEditing] = useState(false);

  // Queries
  const { 
    data: incomeCategories, 
    isLoading: loadingIncome,
    refetch: refetchIncome,
    isFetching: fetchingIncome,
  } = useCategories('income');
  
  const { 
    data: expenseCategories, 
    isLoading: loadingExpense,
    refetch: refetchExpense,
    isFetching: fetchingExpense,
  } = useCategories('expense');

  // Mutations
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const categories = activeTab === 'income' ? incomeCategories : expenseCategories;
  const isLoading = activeTab === 'income' ? loadingIncome : loadingExpense;
  const isFetching = activeTab === 'income' ? fetchingIncome : fetchingExpense;

  const onRefresh = useCallback(() => {
    if (activeTab === 'income') {
      refetchIncome();
    } else {
      refetchExpense();
    }
  }, [activeTab, refetchIncome, refetchExpense]);

  // Abrir modal para crear
  const handleAdd = () => {
    setFormData({ ...initialForm, type: activeTab });
    setIsEditing(false);
    setShowFormModal(true);
  };

  // Abrir modal para editar
  const handleEdit = (category: any) => {
    setFormData({
      id: category.id,
      name: category.name,
      description: category.description || '',
      type: category.type,
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  // Eliminar categoría
  const handleDelete = (category: any) => {
    Alert.alert(
      'Eliminar Categoría',
      `¿Estás seguro de eliminar "${category.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(category.id);
              toast.success('Categoría eliminada correctamente');
            } catch (error: any) {
              const message = error.response?.data?.detail?.message || 
                             error.response?.data?.detail ||
                             'No se pudo eliminar la categoría';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  // Guardar categoría (crear o actualizar)
  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Ingresa el nombre de la categoría');
      return;
    }

    try {
      if (isEditing && formData.id) {
        await updateMutation.mutateAsync({
          id: formData.id,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        toast.success('Categoría actualizada correctamente');
      } else {
        await createMutation.mutateAsync({
          name: formData.name.trim(),
          type: formData.type,
          description: formData.description.trim() || undefined,
        });
        toast.success('Categoría creada correctamente');
      }
      setShowFormModal(false);
      setFormData(initialForm);
    } catch (error: any) {
      const message = error.response?.data?.detail?.message || 
                     error.response?.data?.detail ||
                     'No se pudo guardar la categoría';
      Alert.alert('Error', message);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Renderizar tabs
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'income' && styles.tabActiveIncome]}
        onPress={() => setActiveTab('income')}
      >
        <Feather 
          name="arrow-down-left" 
          size={18} 
          color={activeTab === 'income' ? '#10B981' : '#6B7280'} 
        />
        <Text style={[
          styles.tabText, 
          activeTab === 'income' && styles.tabTextActiveIncome
        ]}>
          Ingresos
        </Text>
        <View style={[
          styles.tabBadge, 
          activeTab === 'income' ? styles.tabBadgeIncome : styles.tabBadgeInactive
        ]}>
          <Text style={[
            styles.tabBadgeText,
            activeTab === 'income' && styles.tabBadgeTextIncome
          ]}>
            {incomeCategories?.length || 0}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'expense' && styles.tabActiveExpense]}
        onPress={() => setActiveTab('expense')}
      >
        <Feather 
          name="arrow-up-right" 
          size={18} 
          color={activeTab === 'expense' ? '#EF4444' : '#6B7280'} 
        />
        <Text style={[
          styles.tabText, 
          activeTab === 'expense' && styles.tabTextActiveExpense
        ]}>
          Gastos
        </Text>
        <View style={[
          styles.tabBadge, 
          activeTab === 'expense' ? styles.tabBadgeExpense : styles.tabBadgeInactive
        ]}>
          <Text style={[
            styles.tabBadgeText,
            activeTab === 'expense' && styles.tabBadgeTextExpense
          ]}>
            {expenseCategories?.length || 0}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // Renderizar item de categoría
  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.categoryItem}>
      <View style={[
        styles.categoryIcon,
        item.type === 'income' ? styles.incomeIcon : styles.expenseIcon
      ]}>
        <Feather 
          name={item.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'} 
          size={18} 
          color={item.type === 'income' ? '#10B981' : '#EF4444'} 
        />
      </View>
      
      <View style={styles.categoryContent}>
        <Text style={styles.categoryName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.categoryDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>

      <View style={styles.categoryActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleEdit(item)}
        >
          <Feather name="edit-2" size={16} color="#4F46E5" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizar lista vacía
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="folder" size={48} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Sin categorías</Text>
      <Text style={styles.emptySubtitle}>
        Agrega tu primera categoría de {activeTab === 'income' ? 'ingresos' : 'gastos'}
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleAdd}>
        <Feather name="plus" size={18} color="white" />
        <Text style={styles.emptyButtonText}>Agregar Categoría</Text>
      </TouchableOpacity>
    </View>
  );

  // Modal de formulario
  const renderFormModal = () => (
    <Modal
      visible={showFormModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFormModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header del modal */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowFormModal(false)}
              disabled={isPending}
            >
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
            </Text>
            <TouchableOpacity 
              onPress={handleSave}
              disabled={isPending || !formData.name.trim()}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : (
                <Text style={[
                  styles.modalSave,
                  !formData.name.trim() && styles.modalSaveDisabled
                ]}>
                  Guardar
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Formulario */}
          <View style={styles.modalContent}>
            {/* Tipo (solo para crear) */}
            {!isEditing && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Categoría</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formData.type === 'income' && styles.typeOptionIncomeActive
                    ]}
                    onPress={() => setFormData({ ...formData, type: 'income' })}
                  >
                    <Feather 
                      name="arrow-down-left" 
                      size={18} 
                      color={formData.type === 'income' ? '#10B981' : '#6B7280'} 
                    />
                    <Text style={[
                      styles.typeOptionText,
                      formData.type === 'income' && styles.typeOptionTextIncome
                    ]}>
                      Ingreso
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formData.type === 'expense' && styles.typeOptionExpenseActive
                    ]}
                    onPress={() => setFormData({ ...formData, type: 'expense' })}
                  >
                    <Feather 
                      name="arrow-up-right" 
                      size={18} 
                      color={formData.type === 'expense' ? '#EF4444' : '#6B7280'} 
                    />
                    <Text style={[
                      styles.typeOptionText,
                      formData.type === 'expense' && styles.typeOptionTextExpense
                    ]}>
                      Gasto
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Nombre */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Ej: Cuota de mantenimiento"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>

            {/* Descripción */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción (opcional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Descripción de la categoría"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Info de tipo (solo para editar) */}
            {isEditing && (
              <View style={styles.infoBox}>
                <Feather name="info" size={16} color="#6B7280" />
                <Text style={styles.infoText}>
                  Tipo: {formData.type === 'income' ? 'Ingreso' : 'Gasto'} (no editable)
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (isLoading && !categories) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando categorías...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Categorías</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Lista */}
      <FlatList
        data={categories || []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            colors={['#4F46E5']}
          />
        }
      />

      {/* Modal de formulario */}
      {renderFormModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  tabActiveIncome: {
    backgroundColor: '#D1FAE5',
  },
  tabActiveExpense: {
    backgroundColor: '#FEE2E2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActiveIncome: {
    color: '#059669',
  },
  tabTextActiveExpense: {
    color: '#DC2626',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeInactive: {
    backgroundColor: '#E5E7EB',
  },
  tabBadgeIncome: {
    backgroundColor: '#10B981',
  },
  tabBadgeExpense: {
    backgroundColor: '#EF4444',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabBadgeTextIncome: {
    color: 'white',
  },
  tabBadgeTextExpense: {
    color: 'white',
  },

  // Lista
  list: {
    padding: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incomeIcon: {
    backgroundColor: '#D1FAE5',
  },
  expenseIcon: {
    backgroundColor: '#FEE2E2',
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  modalSaveDisabled: {
    color: '#9CA3AF',
  },
  modalContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  typeOptionIncomeActive: {
    backgroundColor: '#D1FAE5',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  typeOptionExpenseActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  typeOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeOptionTextIncome: {
    color: '#059669',
  },
  typeOptionTextExpense: {
    color: '#DC2626',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
