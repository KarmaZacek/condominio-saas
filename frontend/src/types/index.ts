/**
 * Tipos TypeScript para la aplicación
 */

// ============ Enums ============

export type UserRole = 'admin' | 'resident' | 'readonly';

export type CategoryType = 'income' | 'expense';

export type TransactionStatus = 'completed' | 'pending' | 'cancelled';

// ============ Entidades Base ============

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  unit_id?: string;
  created_at: string;
  last_login?: string;
}

export interface Unit {
  id: string;
  unit_number: string;
  owner_user_id?: string;
  owner_name?: string;
  tenant_user_id?: string;  
  tenant_name?: string; 
  owner_email?: string;
  owner_phone?: string;
  monthly_fee: number;
  current_balance: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description?: string;
  color: string;
  icon: string;
  is_system: boolean;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  type: CategoryType;
  amount: number;
  description?: string;
  transaction_date: string;
  fiscal_period: string;
  receipt_url?: string;
  status: TransactionStatus;
  category_id: string;
  category?: Category;
  unit_id?: string;
  unit?: Pick<Unit, 'id' | 'unit_number'>;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

// ============ Respuestas API ============

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
}

// ============ Auth ============

export interface LoginCredentials {
  email: string;
  password: string;
  device_info?: {
    platform: string;
    device_name: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  unit_number?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ============ Filtros ============

export interface TransactionFilters {
  type?: CategoryType;
  category_id?: string;
  unit_id?: string;
  status?: TransactionStatus;
  from_date?: string;    // ← nuevo nombre
  to_date?: string;      // ← nuevo nombre
  fiscal_period?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface UnitsFilters {
  search?: string;
  has_debt?: boolean;
  page?: number;
  page_size?: number;
}

// ============ Formularios ============

export interface TransactionCreate {
  type: CategoryType;
  amount: number;
  description?: string;
  transaction_date: string;
  fiscal_period?: string;
  category_id: string;
  unit_id?: string;
}

export interface TransactionUpdate {
  amount?: number;
  description?: string;
  transaction_date?: string;
  fiscal_period?: string;
  category_id?: string;
  unit_id?: string;
  status?: TransactionStatus;
}

export interface UnitCreate {
  unit_number: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  monthly_fee: number;
  notes?: string;
}

export interface UnitUpdate {
  owner_user_id?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  monthly_fee?: number;
  notes?: string;
}

export interface CategoryCreate {
  name: string;
  type: CategoryType;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// ============ Dashboard / Reports ============

export interface DashboardSummary {
  current_period: {
    period: string;
    total_income: number;
    total_expense: number;
    net_balance: number;
    transaction_count: number;
  };
  previous_period: {
    period: string;
    total_income: number;
    total_expense: number;
    net_balance: number;
  };
  year_to_date: {
    total_income: number;
    total_expense: number;
    net_balance: number;
  };
  pending_payments: {
    count: number;
    total_amount: number;
  };
  units_status: {
    total: number;
    with_debt: number;
    up_to_date: number;
  };
}

export interface TransactionsByCategory {
  income: {
    category_id: string;
    category_name: string;
    category_color: string;
    total: number;
    percentage: number;
  }[];
  expense: {
    category_id: string;
    category_name: string;
    category_color: string;
    total: number;
    percentage: number;
  }[];
}

export interface MonthlyTrend {
  period: string;
  income: number;
  expense: number;
  net: number;
}

// ============ Unit Balance ============

export interface UnitBalanceEntry {
  id: string;
  date: string;
  description: string;
  type: CategoryType;
  amount: number;
  balance: number;
}

export interface UnitBalanceStatement {
  unit: Unit;
  entries: UnitBalanceEntry[];
  opening_balance: number;
  closing_balance: number;
  total_charges: number;
  total_payments: number;
}

// ============ Navigation ============

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Units: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  Reports: undefined;
  ExportReport: undefined;
};

export type TransactionsStackParamList = {
  TransactionsList: { unitId?: string } | undefined;
  TransactionDetail: { transactionId: string };
  TransactionForm: { id?: string; type?: CategoryType; unitId?: string };
  ReceiptUpload: { transactionId: string };
};

export type UnitsStackParamList = {
  UnitsList: undefined;
  UnitDetail: { unitId: string };
  UnitForm: { unit?: Unit };
  UnitBalance: { unitId: string };
};

export type ProfileStackParamList = {
  ProfileView: undefined;
  ProfileEdit: undefined;
  ChangePassword: undefined;
  Settings: undefined;
};
