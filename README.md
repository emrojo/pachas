# 💸 Pachas — App de Gastos de Vacaciones entre Amigos

**Pachas** es una aplicación Web / PWA moderna y Mobile-First para dividir y gestionar los gastos en viajes y vacaciones entre amigos de forma justa, transparente y sin líos contables.

---

## 🌟 Características Principales

- **🏖️ Grupos Temáticos de Vacaciones**: Crea grupos para cada viaje con emoji personalizado, nombre, descripción y moneda base.
- **🔗 Invitaciones Instantáneas**: Añade amigos mediante **enlace compartible** (WhatsApp / Telegram), escaneo de **código QR** o por email.
- **✨ Reparto Flexible de Gastos**:
  - **Partes iguales**: Dividido equitativamente entre todos los miembros o solo los que participaron con un solo toque.
  - **Cantidades exactas (€)**: Especifica el importe exacto para cada amigo.
  - **Porcentajes (%)**: Asigna un tanto por ciento a cada persona.
  - **Raciones / Partes**: Ideal para parejas o familias (ej. 2 partes, 1 parte, 0.5 partes).
- **👥 Múltiples Pagadores**: Soporte para gastos pagados a medias por más de una persona en un mismo ticket.
- **🧠 Algoritmo de Liquidación de Deudas (Debt Simplification)**: Minimiza el número de transferencias entre amigos para que saldar cuentas sea rápido.
- **📱 Integración con Bizum**: Muestra el teléfono Bizum de cada amigo para transferir con un toque y registrar el pago.
- **🧾 Fotos de Tickets / Recibos**: Adjunta justificantes visuales en Supabase Storage con visor a pantalla completa.
- **🌍 Soporte Multidivisa**: Registra gastos en divisa local extranjera (USD, GBP, JPY, MXN...) con conversión automática a la moneda del viaje.
- **📄 Exportación de Informes**: Descarga un resumen completo del viaje en **PDF** con tablas de saldos y categorías, o en formato **Excel / CSV**.
- **📋 [Documento de Requisitos de Usuario (USER_REQUIREMENTS.md)](./USER_REQUIREMENTS.md)**: Registro exhaustivo de funcionalidades y control de cambios.

---

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Crea tu archivo `.env.local` (o utiliza los valores por defecto para el modo interactivo local):
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Nota:** La aplicación incluye un motor de datos interactivo con persistencia local que te permite probar todos los flujos inmediatamente aunque no configures Supabase al instante.

### 3. Base de Datos en Supabase (Opcional)
Ejecuta el script SQL ubicado en `supabase/schema.sql` en el SQL Editor de tu panel de Supabase para crear las tablas con Row Level Security (RLS) y los buckets de Storage (`receipts`, `avatars`).

### 4. Ejecutar en desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador o móvil en la misma red local.

### 5. Ejecutar tests unitarios
```bash
npm test
```

---

## 📁 Estructura del Código

- `src/app/`: Rutas de Next.js (Landing, Login, Registro, Dashboard, Detalle de Grupo, Perfil, Unirse por QR).
- `src/components/`:
  - `expenses/`: `ExpenseForm` (reparto flexible, múltiples pagadores), `ExpenseCard`, `ReceiptModal`.
  - `balances/`: `BalanceSummary`, `DebtList`, `SettleModal` (con confetti y Bizum).
  - `groups/`: `GroupCard`, `CreateGroupModal`, `InviteModal` (QR + enlace + WhatsApp), `MemberList`.
  - `ui/`: Botones, inputs, badges, avatars y modales responsive.
- `src/lib/algorithms/`:
  - `simplifyDebts.ts`: Algoritmo codicioso de flujo mínimo de efectivo.
  - `splitCalculations.ts`: Repartos exactos, porcentuales y distribución de céntimos residuales.
- `src/lib/export.ts`: Generador de informes PDF con `jsPDF` y exportador CSV.
- `src/context/PachasContext.tsx`: Gestor de estado global y sincronización.
- `supabase/schema.sql`: Esquema PostgreSQL con políticas RLS para Supabase.

---

## 📄 Licencia
MIT License © 2026 Eduardo Martín Rojo
