# Parques de Santa Cruz 9 - Sistema de Gestión de Condominios

Sistema completo de gestión de condominios desarrollado con React Native (Expo) para el frontend móvil y FastAPI para el backend.

## 📋 Características

### Para Administradores
- **Dashboard completo** con resumen financiero y estadísticas
- **Gestión de transacciones**: Registrar ingresos y egresos
- **Gestión de unidades**: Alta, baja y modificación de viviendas
- **Estados de cuenta**: Por unidad y período fiscal
- **Reportes exportables**: Generación de reportes en Excel
- **Gestión de usuarios**: Control de acceso por roles

### Para Residentes
- **Consulta de saldo**: Ver estado de cuenta actualizado
- **Historial de movimientos**: Revisión de pagos y cargos
- **Perfil personal**: Gestión de datos personales

## 🏗️ Arquitectura

```
condominio-app/
├── backend/                 # API REST con FastAPI
│   ├── app/
│   │   ├── api/            # Rutas de la API
│   │   ├── core/           # Configuración central
│   │   ├── models/         # Modelos SQLAlchemy
│   │   ├── schemas/        # Esquemas Pydantic
│   │   ├── services/       # Lógica de negocio
│   │   └── middleware/     # Middleware (auth, rate limit)
│   └── requirements.txt
│
└── frontend/               # App móvil con Expo
    ├── App.tsx            # Punto de entrada
    ├── src/
    │   ├── hooks/         # Custom hooks (React Query)
    │   ├── navigation/    # Configuración de navegación
    │   ├── screens/       # Pantallas de la app
    │   │   ├── auth/      # Login, Register
    │   │   ├── home/      # Dashboard
    │   │   ├── transactions/
    │   │   ├── units/
    │   │   └── profile/
    │   ├── shared/        # Componentes y utilidades
    │   │   ├── components/ # UI components
    │   │   └── theme/     # Sistema de diseño
    │   ├── store/         # Estado global (Zustand)
    │   ├── types/         # Tipos TypeScript
    │   └── utils/         # Utilidades (API client)
    ├── app.json           # Configuración Expo
    └── package.json
```

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis (opcional, para cache)

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o: .\venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu configuración

# Iniciar servidor
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar Expo
npm start

# Opciones específicas
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Navegador web
```

## 🔧 Configuración

### Variables de entorno (Backend)

```env
# Base de datos
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/condominio

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# AWS S3 (para recibos)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=
AWS_REGION=us-east-1
```

### Variables de entorno (Frontend)

```env
# API
EXPO_PUBLIC_API_URL=http://localhost:8000/v1
```

## 📱 Pantallas

| Pantalla | Descripción |
|----------|-------------|
| Login | Autenticación de usuarios |
| Register | Registro de nuevos usuarios |
| Dashboard | Resumen financiero y accesos rápidos |
| Transacciones | Lista y filtrado de movimientos |
| Detalle Transacción | Información completa del movimiento |
| Nueva Transacción | Formulario para registrar ingreso/egreso |
| Unidades | Lista de viviendas (admin) |
| Detalle Unidad | Información y estado de cuenta |
| Perfil | Configuración del usuario |

## 🎨 Sistema de Diseño

### Colores principales
- **Primary**: #2563EB (Azul)
- **Success**: #16A34A (Verde)
- **Error**: #DC2626 (Rojo)
- **Warning**: #D97706 (Amarillo)

### Componentes UI
- `Button` - Botones con variantes
- `Input` - Campos de formulario
- `Card` - Contenedores con elevación
- `Badge` - Etiquetas de estado
- `FilterPanel` - Panel de filtros avanzados
- `TransactionItem` - Item de transacción
- `UnitItem` - Item de unidad

## 🔐 Autenticación

El sistema utiliza JWT con refresh tokens:

1. **Access Token**: Expira en 30 minutos
2. **Refresh Token**: Expira en 7 días
3. **Rotación automática**: El frontend maneja la renovación

### Roles
- `admin`: Acceso completo
- `resident`: Solo su unidad
- `readonly`: Solo lectura

## 📊 API Endpoints

### Autenticación
- `POST /v1/auth/login` - Iniciar sesión
- `POST /v1/auth/register` - Registrar usuario
- `POST /v1/auth/refresh` - Renovar token
- `POST /v1/auth/logout` - Cerrar sesión

### Transacciones
- `GET /v1/transactions` - Listar transacciones
- `POST /v1/transactions` - Crear transacción
- `GET /v1/transactions/{id}` - Obtener detalle
- `PUT /v1/transactions/{id}` - Actualizar
- `DELETE /v1/transactions/{id}` - Eliminar

### Unidades
- `GET /v1/units` - Listar unidades
- `POST /v1/units` - Crear unidad
- `GET /v1/units/{id}` - Obtener detalle
- `GET /v1/units/{id}/balance` - Estado de cuenta

### Reportes
- `GET /v1/reports/summary` - Resumen financiero
- `GET /v1/reports/export` - Exportar a Excel

## 🧪 Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

## 📦 Build y Deploy

### Build de producción (Frontend)

```bash
cd frontend

# Build para iOS
eas build --platform ios

# Build para Android
eas build --platform android
```

### Deploy Backend

```bash
# Con Docker
docker build -t condominio-api .
docker run -p 8000:8000 condominio-api

# En Railway/Render
# Configurar desde el dashboard
```

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y de uso exclusivo para Parques de Santa Cruz 9.

---

Desarrollado con ❤️ para Parques de Santa Cruz 9
