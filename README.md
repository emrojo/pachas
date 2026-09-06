# 💸 Pachas — Group Vacation Expense Splitter App

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Docker Swarm](https://img.shields.io/badge/Docker-Swarm_%26_Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Pachas** is a modern, mobile-first Web, Progressive Web App (PWA), and native mobile application designed to split and manage group travel and vacation expenses with friends fairly, transparently, and without accounting headaches.

---

## 🌟 Key Features

### 🏖️ Group & Trip Management
- **Themed Vacation Trips**: Create custom groups for each getaway with trip descriptions, base currencies (EUR, USD, GBP, JPY...), and custom cover photo upload from your device or thematic gallery presets.
- **Instant Invitations**: Onboard friends via **shareable links**, mobile-scannable **QR codes**, or 1-tap **WhatsApp invitation sharing** with pre-formatted messages.
- **Trip Archiving & Restoration**: Group administrators can archive completed trips to keep their dashboard clutter-free, with an admin-only restore zone.
- **Member Management**: Remove friends from groups with safety confirmation dialogs or leave groups seamlessly.

### 💬 Real-Time Group Chat & Omnichannel Discussions (FR-40, FR-42)
- **Integrated Group Chat Sub-Tab (`tab=members&chat=true`)**: Direct conversational stream inside the Friends section of every group.
- **Rich Messaging**: Send real-time text, categorized **animated GIFs** (Giphy API), emoji selector, and multi-user **floating emoji reaction pills** (`❤️ 👍 😂 🎉 🔥 👏`).
- **Contextual Message Replies (↩️)**:
  - 1-tap reply action on any message with floating composer preview and cancel (✕) option.
  - Quoted snippet bubble rendering parent author and text inside the reply.
- **Omnichannel Expense Comments Integration**:
  - Comments posted inside any expense discussion automatically mirror into the group chat with an interactive card (`💸 Gasto: "[Título]" ([Importe])`).
  - Replies in group chat to an expense comment automatically synchronize back to the expense's private discussion thread.
  - **Single Notification Guarantee**: Only a single notification is dispatched per comment, preventing duplicate alerts across channels.

### 🧾 Smart Expense Recording, Multimodal AI OCR & Splitting
- **Intelligent Multimodal OCR Vision Scanner (Google Gemini 1.5 Flash Vision & Tesseract.js fallback)**:
  - High-accuracy optical extraction of monetary totals, merchant names, categories, European dates (`DD/MM/YYYY`), exact hours/minutes (`HH:mm`), and physical establishment addresses.
  - **Automatic Forward Geocoding**: Automatically resolves GPS coordinates (`latitude`, `longitude`) and attaches Google Maps pin links directly from receipt addresses.
  - **Privacy Pre-Censorship & Inspection Tools**: Black marker manual pre-censorship, mandatory post-AI validation, 50%-400% zoom, pan/hand tool (✋), and precision eraser (🧼).
- **Optimized 2-Line Input**: Streamlined form hierarchy featuring full-width title concept input, prominent amount/currency selection, and collapsed payer/participant accordions.
- **Strict 4-Column Aligned Financial Presentation**:
  - Re-architected expense card (`ExpenseCard.tsx`) with fixed category icon slot, standardized metadata tray with interactive pill badges (receipt 🧾, map location 📍, participants 👥, comments 💬), right-aligned fixed-width price slot with `tabular-nums`, and dedicated action toolbar.
  - Desktop list column header (`Categoría | Detalles | Importe | Acciones`).
- **Flexible Splitting Modes**:
  - ⚖️ **Equal Shares**: Divide evenly among all or selected friends with exact residual penny distribution.
  - 💶 **Exact Amounts**: Assign specific monetary amounts per participant.
  - 📊 **Percentages (%)**: Allocate custom percentages with strict 100% total verification.
  - 🍕 **Portions / Shares**: Allocate weighted shares (ideal for couples or families: 2 shares, 1 share, 0.5 shares).
  - 👥 **Multiple Payers**: Support for split-paid bills where multiple friends contributed different amounts to the same ticket.
- **Multi-Currency Support**: Real-time conversion via European Central Bank / Frankfurter and Open Exchange Rates with historical date-rate fetching.
- **Creator Permission Control**: Strict security ensuring only the original creator of an expense or group admin can edit or delete it.

### 🧠 Debt Simplification, Settlements & Mathematical Audit (FR-27)
- **Greedy Cash Flow Algorithm**: Minimizes the total number of transactions needed to settle all trip debts ($O(N)$ complexity).
- **Step-by-Step Mathematical Audit & Virtual Calculator (`/groups/[id]/audit`)**: Complete step-by-step arithmetic proof of payments, individual consumptions, net balances, and settlement chains with 1-tap formula loading into an interactive virtual calculator.
- **Bizum Integration**: Instant copy button for the payee's Bizum phone number to transfer money effortlessly.
- **Celebratory Confetti**: Interactive confetti animation upon logging a settlement.

### 📊 Analytics, Charts & Trip Route Maps
- **Interactive Expense Analytics**: Time-series charts broken down by **Hours, Days, Weeks, or Overall Total** with stacked bars by Payer, Consumption, or Total Spend.
- **KPI Dashboards**: Real-time metrics for total trip spend, average spend per person, peak spending timeframe, and active intervals.
- **GPS & Google Maps Integration**:
  - Automatic geolocation detection with reverse geocoding of establishment names.
  - Interactive expense map viewer with manual search.
  - **Trip Route Map & Multi-Establishment Pins Modal**: Chronological multi-stop trip route with direct navigation in Google Maps, plus a standalone places view to explore all establishments as identified markers without route lines.

### 📥 Bulk Imports & 📄 Comprehensive Reports
- **Bulk Excel / CSV Import**:
  - Upload `.csv`, `.tsv`, `.txt` files or copy-paste spreadsheet tables.
  - Official downloadable CSV template customized with actual group member names and location examples.
  - Multi-payer parsing (`Eduardo: 350 + Carlos: 250`) and `"Todos"` / `"All"` aliases.
  - Interactive preview table with location pin indicators, diagnostic error popup modals, and **1-Click Undo Import**.
- **Vector PDF & CSV Exporting**:
  - **Full PDF Report**: Official trip header, vector charts (daily evolution, category distribution, friend comparison), complete history table, and **individualized breakdown pages per person**.
  - Contextual direct download (`downloadPDF`) vs native OS share sheet (`sharePDF`).
  - **European CSV with Location**: Clean spreadsheet export with semicolon separators, decimal commas, and dedicated columns for establishment names, coordinates, and Google Maps links.

### 🔔 Granular Notification Center & Deep-Linking (FR-30, FR-37)
- **Unified Notification Hub (`/notifications`)**: Centralized inbox with filters (*Payments/Validations, Comments, Groups/Roles*), direct action CTAs, and unread counter badges.
- **Contextual Deep Linking**: Clicking any notification routes directly to the relevant expense detail, comment thread, group chat, or member list.
- **WebPush & Push Preferences**: Opt-in notification defaults with customizable toggles during group creation, joining, and in trip settings.

### 🌐 20-Language Internationalization (i18n) & RTL Support
- Full multi-language localization supporting 20 languages: Spanish (es), English (en), Catalan (ca), Valencian (va), Basque (eu), Galician (gl), French (fr), German (de), Italian (it), Portuguese (pt), Dutch (nl), Russian (ru), Chinese (zh), Japanese (ja), Arabic (ar - RTL), Hindi (hi), Turkish (tr), Greek (el), and Afrikaans (af).
- Searchable language picker modal with country flags and native name display.

### ⚖️ Legal Framework, GDPR & Compliance (FR-26, FR-39)
- Complete legal pages: Terms of Service (`/terms`), Privacy Policy (`/privacy`), Cookie Policy (`/cookies`), and Legal Notice (`/legal`).
- European GDPR / RGPD (EU 2016/679) and LSSI-CE compliance disclosures.
- Personal data portability export (`/api/user/export-data`) and right to erasure (`/api/user/delete-account`).
- Global compliant footer present across 100% of application views.

### 📱 Mobile Applications (PWA & Native Capacitor Wrapper)
- **Progressive Web App (PWA)**: Standalone installability on iOS (Safari) and Android (Chrome) with cache-first offline service worker (`public/sw.js`), app manifest, and splash screens.
- **Native Store Packaging (Capacitor.js)**: Pre-configured Capacitor integration ready to generate native Xcode (iOS) and Android Studio projects for Google Play and Apple App Store.
- Detailed mobile build guide in [`deploy/MOBILE.md`](file:///d:/Projects/pachas/deploy/MOBILE.md).

---

## 🏗️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Framework** | [Next.js 16 (Turbopack)](https://nextjs.org/) (App Router, Server Components & Proxy Middleware) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (Strict type-safety) |
| **Styling & UI** | [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) |
| **State & Persistence** | React Context (`PachasContext`), `localStorage` resilient caching, and PostgreSQL backend |
| **Backend & DB** | [PostgreSQL 15](https://www.postgresql.org/) with Row Level Security (RLS) & Connection Pooling (`pg`) |
| **AI / OCR** | [Google Gemini 1.5 Flash Vision](https://ai.google.dev/) API & [Tesseract.js](https://tesseract.projectnaptha.com/) Client Fallback |
| **Push Notifications** | [web-push](https://www.npmjs.com/package/web-push) (VAPID protocol) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Haptics, Share, Splash Screen, Status Bar, Filesystem) |
| **Testing** | [Vitest 4.1](https://vitest.dev/) (100+ unit tests across 23 test suites) |
| **Containerization** | [Docker](https://www.docker.com/) (Multi-stage standalone image, Docker Swarm Stack, Docker Compose) |
| **Reporting** | [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) |

---

## 🚀 Quick Start (Local Development — Native Priority)

Follow these steps to run Pachas natively on your local machine:

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/emrojo/pachas.git
cd pachas
npm install
```

### 2. Environment Variables Setup
Copy the template to create your local `.env.local`:
```bash
cp .env.example .env.local
```

Recommended minimum configuration for local development:
```env
# Application Base URL
APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_EMAIL=admin@pachas.local
NEXT_PUBLIC_ENABLE_DEMO_USERS=true
JWT_SECRET=default-pachas-jwt-secret-key-32-chars-long

# PostgreSQL Database (Local or Remote)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pachas
POSTGRES_USER=pachas_admin
POSTGRES_PASSWORD=password
# Or full connection string:
# DATABASE_URL=postgresql://pachas_admin:password@localhost:5432/pachas

# Optional API Keys (Pachas includes built-in fallbacks for all services):
# GEMINI_API_KEY=your_gemini_key_here
# PEXELS_API_KEY=your_pexels_key_here
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
# VAPID_PRIVATE_KEY=your_vapid_private_key
```

> [!TIP]
> **Zero-Friction Fallback Guarantee**: Every third-party integration (Gemini OCR, Pexels Cover Photos, VAPID WebPush, Email Delivery) includes automated fallbacks. You can run and test 100% of Pachas locally immediately without having to register or acquire any external API keys beforehand!

### 3. Initialize Database & Run Migrations
Run the deterministic migration engine to create all tables, indexes, and RLS policies:
```bash
npm run db:init
```
Verify the migration ledger status at any time:
```bash
npm run db:status
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Automated Tests
```bash
npm test
# Or directly via Vitest:
npx vitest run
```

### 6. Build for Production
```bash
npm run build
```

---

## 🔑 External Services, APIs & Media Configuration

Pachas connects to several specialized services to deliver intelligent OCR scanning, rich media, and real-time push notifications. Below is the complete setup guide for each service:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             PACHAS SERVICE ECOSYSTEM                             │
├───────────────────────┬─────────────────────────┬────────────────────────────────┤
│ Service / Feature     │ Provider & Keys         │ Fallback Behavior              │
├───────────────────────┼─────────────────────────┼────────────────────────────────┤
│ Receipt OCR Scanner   │ Google Gemini 1.5 Flash │ Client-side Tesseract.js       │
│                       │ GEMINI_API_KEY          │ Optical Scanner                │
├───────────────────────┼─────────────────────────┼────────────────────────────────┤
│ Dynamic Cover Photos  │ Pexels REST API         │ Curated HD Travel Preset       │
│                       │ PEXELS_API_KEY          │ Offline Photo Library          │
├───────────────────────┼─────────────────────────┼────────────────────────────────┤
│ User Avatars & Icons  │ DiceBear Avatar Engine  │ Initials on Deterministic      │
│                       │ NO API KEY (Public SVG) │ Color Palette + Custom Upload  │
├───────────────────────┼─────────────────────────┼────────────────────────────────┤
│ Push Notifications    │ WebPush (W3C VAPID)     │ Pre-configured internal        │
│                       │ VAPID Public & Private  │ Development Keys               │
├───────────────────────┼─────────────────────────┼────────────────────────────────┤
│ Database & Migrations │ PostgreSQL 15 (Pool)    │ Automatic Schema Self-Healing  │
│                       │ DATABASE_URL            │ & Transaction Ledger           │
├───────────────────────┼─────────────────────────┼────────────────────────────────┤
│ Password Reset / Mail │ SMTP / Resend / SendGrid│ Formatted Terminal Simulation  │
│                       │ SMTP_HOST, RESEND_API...│ [Pachas Mailer] Console Output │
└───────────────────────┴─────────────────────────┴────────────────────────────────┘
```

### 🧠 1. Google Gemini 1.5 Flash Vision (Intelligent Receipt OCR & Geocoding)
- **What it does**: Multimodal optical character recognition for physical receipts and bills (`src/lib/ocr/geminiScanner.ts`). Automatically extracts monetary totals, split-payment breakdowns, merchant names, purchase categories, European dates (`DD/MM/YYYY`), time (`HH:mm`), and physical establishment addresses with forward-geocoded GPS coordinates pinned on Google Maps.
- **How to obtain your key (Free — 15 requests/min)**:
  1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
  2. Sign in with your Google account.
  3. Click **"Create API Key"** and copy the generated token.
  4. Add it to your `.env.local`:
     ```env
     GEMINI_API_KEY=AIzaSy...
     ```
- **Fallback**: If `GEMINI_API_KEY` is not defined, Pachas automatically falls back to client-side [Tesseract.js](https://tesseract.projectnaptha.com/) for in-browser OCR extraction with manual confirmation dialogs.

---

### 📸 2. Pexels API (Dynamic Contextual Trip Cover Photos)
- **What it does**: Real-time contextual search for high-definition, landscape-oriented travel photographs when creating or editing vacation groups (`GroupCoverPicker.tsx` via `/api/photos/search`). Matches group titles and destination search terms (e.g. *"Playa Formentera"*, *"Pirineos Cabaña"*, *"Tokio Shibuya"*).
- **How to obtain your key (Free)**:
  1. Register a developer account at [Pexels Developer Portal](https://www.pexels.com/api/).
  2. Request your free API key in your account dashboard.
  3. Add it to your `.env.local`:
     ```env
     PEXELS_API_KEY=your_pexels_api_key_here
     # Also supported for client-direct environments:
     # NEXT_PUBLIC_PEXELS_API_KEY=your_pexels_api_key_here
     ```
- **Fallback**: If no key is set, Pachas seamlessly displays its built-in, curated high-definition travel photography catalog categorized by themes (*Beach & Coast, Mountain & Nature, City & Culture, Party & Nightlife, Relax & Wellness*) with photographer credits and zero network errors.

---

### 👤 3. User Avatar System (DiceBear Engine & Custom Device Upload)
- **DiceBear Avatar Engine (Zero API Key Needed)**:
  - Pachas integrates the open-source [DiceBear Avatar API](https://www.dicebear.com) (`https://api.dicebear.com/9.x/`) under CC0 1.0 / MIT licenses.
  - Offers **8 artistic styles**:
    - `lorelei` (Modern vector illustration)
    - `bottts` (Fun playful robots)
    - `avataaars` (Expressive sketch characters)
    - `adventurer` (Adventure and outdoor personas)
    - `fun-emoji` (Vibrant custom emojis)
    - `notionists` (Clean Notion-inspired art)
    - `pixel-art` (Retro 8-bit characters)
    - `micah` (Contemporary abstract artwork)
  - Features interactive live customization: seed-based traits (username or random dice throw) and background color palettes (Sky, Lavender, Indigo, Pink, Peach, Emerald, Slate, or Transparent).
  - **No registration, no API key, and no costs required.**
- **Custom Photo Upload**: Users can upload any custom avatar image (JPEG, PNG, WebP) directly from their smartphone camera roll or PC file browser with client-side image compression.
- **Fallback**: If no avatar or photo is chosen, `Avatar.tsx` automatically renders the user's initials over an elegant deterministic background color derived from their display name.

---

### 🔔 4. WebPush Push Notifications (W3C VAPID Protocol)
- **What it does**: Cross-platform Web Push notifications for browsers (Chrome, Edge, Firefox, Safari iOS 16.4+) and native PWA / mobile wrappers. Alerts users when:
  - An expense is recorded or edited in their trip group.
  - A friend comments on a ticket or replies in the group chat.
  - A settlement or Bizum debt repayment is marked as completed.
- **How to generate VAPID keys**:
  Generate your cryptographically secure public/private VAPID keypair using either command:
  ```bash
  # Using web-push CLI:
  npx web-push generate-vapid-keys

  # Or using the built-in Pachas secrets generator:
  npm run secrets:generate
  # (or node deploy/generate-secrets.mjs)
  ```
  Copy the keys to `.env.local`:
  ```env
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLu_...
  VAPID_PRIVATE_KEY=...
  VAPID_SUBJECT=mailto:admin@tu-dominio.com
  ```
- **Fallback**: If keys are omitted, Pachas uses pre-configured local development VAPID keys (`DEFAULT_VAPID_PUBLIC_KEY` in `src/lib/notifications/webPush.ts`) so local testing works seamlessly without configuration.

---

### 🗄️ 5. PostgreSQL Database & Deterministic Migrations
- **What it does**: Robust relational data persistence with Row Level Security (RLS) policies, foreign key cascades, and connection pooling. Compatible with:
  - Local PostgreSQL (`localhost:5432`)
  - Cloud PostgreSQL providers ([Supabase](https://supabase.com), [Neon](https://neon.tech), [Railway](https://railway.app), [Aiven](https://aiven.io))
  - Containerized PostgreSQL (`postgres:15-alpine`)
- **Connection Configuration**:
  ```env
  # Option A: Single connection URI
  DATABASE_URL=postgresql://user:password@localhost:5432/pachas

  # Option B: Discrete connection variables (highest priority)
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  POSTGRES_DB=pachas
  POSTGRES_USER=pachas_admin
  POSTGRES_PASSWORD=your_secure_password
  ```
- **Deterministic Migration Commands**:
  - `npm run db:init` / `npm run db:migrate`: Executes all pending numbered SQL files in `deploy/init-scripts/` in sequential order (`01` through `12`) within an atomic transaction ledger (`_migrations`).
  - `npm run db:status`: Prints an interactive terminal status table showing applied vs pending migrations with execution timestamps.
  - `npm run db:reset`: Truncates application tables and resets the schema to a clean state.
  - `npm run db:heal`: Verifies and repairs missing columns or constraints automatically.

---

### ✉️ 6. Email Delivery Services (Password Reset & Group Invitations)
- **What it does**: Dispatches transactional emails for password recovery links (`/reset-password`) and email-based group invitations (`/join/[token]`).
- **Supported Providers**:
  - **SMTP Server** (Gmail with App Passwords, Outlook, Mailgun, Amazon SES, Brevo):
    ```env
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=tu_correo@gmail.com
    SMTP_PASS=tu_app_password
    SMTP_FROM="Pachas" <tu_correo@gmail.com>
    ```
  - **Resend API** (Recommended for serverless & modern Next.js deployments):
    ```env
    RESEND_API_KEY=re_123456789
    EMAIL_FROM=Pachas <onboarding@resend.dev>
    ```
  - **SendGrid API**:
    ```env
    SENDGRID_API_KEY=SG.123456789
    EMAIL_FROM=notificaciones@tudominio.com
    ```
- **Simulation Fallback**: If no email credentials are provided, Pachas logs transactional messages to the server terminal (`[Pachas Mailer]`) with clickable simulation links, ensuring complete local testability without needing real SMTP servers.

---

## 🐳 Production Deployment (Docker Swarm & Compose)

Pachas includes production-ready Docker deployment configurations in [`deploy/`](./deploy).

### 1-Click Deployment:
- **On Linux / macOS:**
  ```bash
  chmod +x deploy/deploy.sh
  ./deploy/deploy.sh
  ```
- **On Windows (PowerShell):**
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\deploy\deploy.ps1
  ```

### Clean Database Reset (for production fresh start):
- **On Windows (PowerShell):**
  ```powershell
  .\deploy\reset-db.ps1
  ```
- **On Linux / macOS:**
  ```bash
  chmod +x deploy/reset-db.sh
  ./deploy/reset-db.sh
  ```

For detailed deployment guides, service scaling, and rolling updates, refer to [`deploy/README.md`](./deploy/README.md).

---

## 📁 Repository Structure

```
pachas/
├── deploy/                      # Production deployment configurations
│   ├── Dockerfile               # Multi-stage standalone Next.js build
│   ├── docker-stack.yml         # Docker Swarm stack definition (App, PostgreSQL)
│   ├── docker-compose.yml       # Local development Compose definition
│   ├── deploy.sh / deploy.ps1   # 1-click deployment automation scripts
│   ├── reset-db.sh / reset-db.ps1 # Database reset automation scripts
│   ├── README.md                # Dedicated deployment documentation
│   ├── MOBILE.md                # Native mobile build guide (iOS / Android)
│   └── init-scripts/            # PostgreSQL auto-init schemas and RLS policies (01-07)
├── src/
│   ├── app/                     # Next.js App Router (Auth, Dashboard, Groups, Notifications, Legal, Admin)
│   ├── components/
│   │   ├── balances/            # Debt summary, Bizum settlement modals, audit calculator
│   │   ├── charts/              # Time-series analytics & breakdown charts
│   │   ├── expenses/            # Expense cards, forms, receipt OCR, route maps, comments
│   │   ├── groups/              # Group chat section, creation, settings, invite modals
│   │   ├── layout/              # Navbar, BottomNav, Legal Footer
│   │   ├── profile/             # Profile management, custom avatar upload
│   │   └── ui/                  # Reusable accessible UI components
│   ├── context/                 # PachasContext, LanguageContext
│   ├── lib/
│   │   ├── algorithms/          # Debt simplification, split calculations, audit math
│   │   ├── ocr/                 # Google Gemini 1.5 Flash Vision & Tesseract.js scanner
│   │   ├── notifications/       # WebPush & in-app notification dispatchers
│   │   ├── currencies/          # Real-time exchange rate engine
│   │   ├── export.ts            # Vector PDF and European CSV generators
│   │   └── db/                  # PostgreSQL connection pool & helpers
│   ├── locales/                 # 20 full language dictionary definitions
│   └── types/                   # Database & application TypeScript definitions
├── USER_REQUIREMENTS.md         # Formal User Requirements Registry (FR-01 to FR-43)
└── README.md                    # Main project documentation
```

---

## 📜 Requirements & Specifications

For the complete, itemized registry of all functional and non-functional specifications, consult:
👉 **[`USER_REQUIREMENTS.md`](./USER_REQUIREMENTS.md)**

---

## 📄 License

MIT License © 2026 Eduardo Martín Rojo
