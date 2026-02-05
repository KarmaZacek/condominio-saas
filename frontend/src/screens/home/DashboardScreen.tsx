/**
 * Dashboard Principal
 * Detecta el rol del usuario y muestra el dashboard correspondiente
 */
import React from 'react';
import { useAuthStore } from '../../store/authStore';
import AdminDashboardScreen from './AdminDashboardScreen';
import ResidentDashboardScreen from './ResidentDashboardScreen';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  
  // Si es admin o readonly, mostrar dashboard de administrador
  if (user?.role === 'admin' || user?.role === 'readonly') {
    return <AdminDashboardScreen />;
  }
  
  // Si es residente, mostrar dashboard de residente
  return <ResidentDashboardScreen />;
}
