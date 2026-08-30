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

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/emrojo/pachas.git
cd pachas
npm install
```

### 2. Environment Variables Setup
Copy the template or create `.env.local`:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_EMAIL=admin@pachas.local
GEMINI_API_KEY=your_gemini_api_key_here
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pachas
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Tests
```bash
npx vitest run
```

### 5. Build for Production
```bash
npm run build
```

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
├── USER_REQUIREMENTS.md         # Formal User Requirements Registry (FR-01 to FR-42)
└── README.md                    # Main project documentation
```

---

## 📜 Requirements & Specifications

For the complete, itemized registry of all functional and non-functional specifications, consult:
👉 **[`USER_REQUIREMENTS.md`](./USER_REQUIREMENTS.md)**

---

## 📄 License

MIT License © 2026 Eduardo Martín Rojo
