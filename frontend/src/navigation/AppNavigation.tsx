/**
 * Navegación principal de la aplicación
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/authStore';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/home/DashboardScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Transactions
import TransactionsListScreen from '../screens/transactions/TransactionsListScreen';
import TransactionFormScreen from '../screens/transactions/TransactionFormScreen';
import TransactionDetailScreen from '../screens/transactions/TransactionDetailScreen';

// Units
import UnitsListScreen from '../screens/units/UnitsListScreen';
import UnitDetailScreen from '../screens/units/UnitDetailScreen';
import UnitFormScreen from '../screens/units/UnitFormScreen';
import UnitStatementScreen from '../screens/units/UnitStatementScreen';

// Settings
import CategoriesScreen from '../screens/settings/CategoriesScreen';
import AuditLogScreen from '../screens/settings/AuditLogScreen';

// Users
import UsersScreen from '../screens/users/UsersScreen';
import UserFormScreen from '../screens/users/UserFormScreen';
import UserDetailScreen from '../screens/users/UserDetailScreen';

// Reports
import ReportsScreen from '../screens/reports/ReportsScreen';
import FinancialStatusScreen from '../screens/reports/FinancialStatusScreen';

// Nueva pantalla de gastos del condominio
import CondominiumExpensesScreen from '../screens/reports/CondominiumExpensesScreen';

import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

// Support Screens
import HelpCenterScreen from '../screens/Support/HelpCenterScreen';
import TermsAndConditionsScreen from '../screens/Support/TermsAndConditionsScreen';
import PrivacyPolicyScreen from '../screens/Support/PrivacyPolicyScreen';

// Types
export type TransactionsStackParamList = {
  TransactionDetail: { transactionId: string };
  TransactionsList: undefined;
  TransactionForm: { id?: string; type?: 'income' | 'expense' } | undefined;
};

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  UnitStatement: { unitId: string; unitNumber: string };
  CondominiumExpenses: undefined;
  TransactionDetailRoot: { transactionId: string };  // ← Para navegación desde CondominiumExpenses
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Categories: undefined;
  Users: undefined;
  UserForm: { userId?: string };
  UserDetail: { userId: string };
  AuditLog: undefined;
  HelpCenter: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
};

export type UsersStackParamList = {
  UsersList: undefined;
  UserForm: { userId?: string };
  UserDetail: { userId: string };
  AuditLog: undefined;
};

export type UnitsStackParamList = {
  UnitsList: undefined;
  UnitDetail: { id: string };
  UnitForm: { unit?: any } | undefined;
  UnitStatement: { unitId: string; unitNumber: string };
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TransactionsStack = createNativeStackNavigator<TransactionsStackParamList>();
const UnitsStack = createNativeStackNavigator<UnitsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// Transactions Navigator
const TransactionsNavigator = () => (
  <TransactionsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: 'white' },
      headerTintColor: '#1F2937',
      headerTitleStyle: { fontWeight: '600' },
      headerShadowVisible: false,
    }}
  >
    <TransactionsStack.Screen 
      name="TransactionsList" 
      component={TransactionsListScreen}
      options={{ headerShown: false }}
    />
    <TransactionsStack.Screen 
      name="TransactionForm" 
      component={TransactionFormScreen}
      options={({ route }) => ({ 
        title: route.params?.id ? 'Editar Movimiento' : 'Nuevo Movimiento',
        presentation: 'modal',
      })}
    />
    <TransactionsStack.Screen 
      name="TransactionDetail" 
      component={TransactionDetailScreen}
      options={{ 
        title: 'Detalle del Movimiento',
        headerShown: true,
      }}
    />
  </TransactionsStack.Navigator>
);

// Units Navigator
const UnitsNavigator = () => (
  <UnitsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: 'white' },
      headerTintColor: '#1F2937',
      headerTitleStyle: { fontWeight: '600' },
      headerShadowVisible: false,
    }}
  >
    <UnitsStack.Screen 
      name="UnitsList" 
      component={UnitsListScreen}
      options={{ headerShown: false }}
    />
    <UnitsStack.Screen 
      name="UnitDetail" 
      component={UnitDetailScreen}
      options={{ title: 'Detalle de Vivienda' }}
    />
    <UnitsStack.Screen 
      name="UnitForm" 
      component={UnitFormScreen}
      options={({ route }) => ({ 
        title: route.params?.unit ? 'Editar Vivienda' : 'Nueva Vivienda',
        presentation: 'modal',
      })}
    />
    <UnitsStack.Screen 
      name="UnitStatement" 
      component={UnitStatementScreen}
      options={{ title: 'Estado de Cuenta' }}
    />
  </UnitsStack.Navigator>
);
// Profile Navigator
const ProfileNavigator = () => (
  <ProfileStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: 'white' },
      headerTintColor: '#1F2937',
      headerTitleStyle: { fontWeight: '600' },
      headerShadowVisible: false,
    }}
  >
    <ProfileStack.Screen 
      name="ProfileMain" 
      component={ProfileScreen}
      options={{ headerShown: false }}
    />
    <ProfileStack.Screen 
      name="Categories" 
      component={CategoriesScreen}
      options={{ title: 'Categorías' }}
    />
    <ProfileStack.Screen 
      name="Users" 
      component={UsersScreen}
      options={{ headerShown: false }}
    />
    <ProfileStack.Screen 
      name="UserForm" 
      component={UserFormScreen}
      options={{ headerShown: false }}
    />
    <ProfileStack.Screen 
      name="UserDetail" 
      component={UserDetailScreen}
      options={{ headerShown: false }}
    />
    <ProfileStack.Screen 
      name="AuditLog" 
      component={AuditLogScreen}
      options={{ title: 'Log de Auditoría' }}
    />
    <ProfileStack.Screen 
      name="HelpCenter" 
      component={HelpCenterScreen}
      options={{ 
        title: 'Centro de Ayuda',
        headerShown: true,
      }}
    />
    <ProfileStack.Screen 
      name="TermsAndConditions" 
      component={TermsAndConditionsScreen}
      options={{ 
        title: 'Términos y Condiciones',
        headerShown: true,
      }}
    />
    <ProfileStack.Screen 
      name="PrivacyPolicy" 
      component={PrivacyPolicyScreen}
      options={{ 
        title: 'Política de Privacidad',
        headerShown: true,
      }}
    />
  </ProfileStack.Navigator>
);
// Main Tab Navigator
const MainTabs = () => {
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');
  const insets = useSafeAreaInsets();
  
  // Calcular padding inferior - mínimo 10px, máximo el inset del sistema + 10
  const bottomPadding = Math.max(insets.bottom, 10) + 10;
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = 'home';
          if (route.name === 'Home') iconName = 'home';
          if (route.name === 'Transactions') iconName = 'list';
          if (route.name === 'Units') iconName = 'grid';
          if (route.name === 'Reports') iconName = 'bar-chart-2';
          if (route.name === 'Profile') iconName = 'user';
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 10,
          paddingBottom: bottomPadding,
          height: 60 + bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{ tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsNavigator} 
        options={{ tabBarLabel: 'Movimientos' }}
      />
      {isAdmin && (
        <Tab.Screen 
          name="Units" 
          component={UnitsNavigator} 
          options={{ tabBarLabel: 'Viviendas' }}
        />
      )}
      <Tab.Screen 
        name="Reports" 
        component={ReportsScreen} 
        options={{ tabBarLabel: 'Reportes' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileNavigator} 
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
};

// Root Navigator
const AppNavigation = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4F46E5' }}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="UnitStatement"
          component={UnitStatementScreen}
          options={{ 
            headerShown: true,
            title: 'Estado de Cuenta'
          }}
        />
        {/* ============================================== */}
        {/* NUEVA PANTALLA: Gastos del Condominio         */}
        {/* ============================================== */}
        <Stack.Screen
          name="CondominiumExpenses"
          component={CondominiumExpensesScreen}
          options={{ 
            headerShown: false,  // La pantalla tiene su propio header
          }}
        />
        {/* ============================================== */}
        {/* Detalle de Transacción (acceso desde RootStack) */}
        {/* ============================================== */}
        <Stack.Screen
          name="TransactionDetailRoot"
          component={TransactionDetailScreen}
          options={{ 
            headerShown: true,
            title: 'Detalle del Movimiento',
            headerStyle: { backgroundColor: 'white' },
            headerTintColor: '#1F2937',
            headerTitleStyle: { fontWeight: '600' },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen 
          name="FinancialStatus" 
          component={FinancialStatusScreen}
          options={{ 
            headerShown: false,
            title: 'Estado Financiero'
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigation;
