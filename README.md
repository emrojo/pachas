# 💸 Pachas — Group Vacation Expense Splitter App

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Docker Swarm](https://img.shields.io/badge/Docker-Swarm_%26_Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-6E9F18?style=flat-square&logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Pachas** is a modern, mobile-first Web & Progressive Web App (PWA) designed to split and manage group travel and vacation expenses with friends fairly, transparently, and without accounting headaches.

---

## 🌟 Key Features

### 🏖️ Group & Trip Management
- **Themed Vacation Trips**: Create custom groups for each getaway with trip descriptions, base currencies (EUR, USD, GBP, JPY...), and custom cover photo upload from your device or thematic gallery presets.
- **Instant Invitations**: Onboard friends via **shareable links**, mobile-scannable **QR codes**, or 1-tap **WhatsApp invitation sharing** with pre-formatted messages.
- **Trip Archiving & Restoration**: Group administrators can archive completed trips to keep their dashboard clutter-free, with an admin-only restore zone.
- **Member Management**: Remove friends from groups with safety confirmation dialogs or leave groups seamlessly.

### 🧾 Smart Expense Recording & Splitting
- **Optimized 2-Line Input**: Streamlined form hierarchy featuring full-width title concept input, prominent amount/currency selection, and collapsed payer/participant accordions.
- **Flexible Splitting Modes**:
  - ⚖️ **Equal Shares**: Divide evenly among all or selected friends with exact residual penny distribution.
  - 💶 **Exact Amounts**: Assign specific monetary amounts per participant.
  - 📊 **Percentages (%)**: Allocate custom percentages with strict 100% total verification.
  - 🍕 **Portions / Shares**: Allocate weighted shares (ideal for couples or families: 2 shares, 1 share, 0.5 shares).
  - 👥 **Multiple Payers**: Support for split-paid bills where multiple friends contributed different amounts to the same ticket.
- **Multi-Currency Support**: Record expenses in foreign local currencies with real-time conversion to the trip's base currency and custom exchange rate editing.
- **Receipt & Proof Attachments**: Attach ticket/receipt photos with a full-screen image viewer.
- **Creator Permission Control**: Strict security ensuring only the original creator of an expense can edit or delete it.

### 🧠 Debt Simplification & Settlements
- **Greedy Cash Flow Algorithm**: Minimizes the total number of transactions needed to settle all trip debts ($O(N)$ complexity).
- **Bizum Integration**: Instant copy button for the payee's Bizum phone number to transfer money effortlessly.
- **Celebratory Confetti**: Interactive confetti animation upon logging a settlement.

### 📊 Analytics, Charts & Trip Maps
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
  - **Location & Google Maps Import**: Parses establishment names, raw GPS coordinates (`39.8631, 4.2186` or `39,8631; 4,2186`), Google Maps URLs, or leaves blank for non-located expenses.
  - Interactive preview table with location pin indicators, diagnostic error popup modals, and **1-Click Undo Import**.
- **Vector PDF & CSV Exporting**:
  - **Full PDF Report**: Official trip header, vector charts (daily evolution, category distribution, friend comparison), complete history table, and **individualized breakdown pages per person**.
  - **European CSV with Location**: Clean spreadsheet export with semicolon separators, decimal commas, and dedicated columns for `Establecimiento / Ubicación`, `Coordenadas`, and clickable `Enlace Google Maps`.

### 📱 Mobile Applications (PWA & Native Capacitor Wrapper)
- **Progressive Web App (PWA)**: Full standalone installability on iOS (Safari) and Android (Chrome) with custom app manifest, icons, theme colors, and full-screen experience.
- **Native Store Packaging (Capacitor.js)**: Pre-configured Capacitor integration (`capacitor.config.ts`, `@capacitor/core`, splash screen, status bar, and haptics) ready to generate native Xcode (iOS) and Android Studio projects for Google Play and the Apple App Store.
- **Comprehensive Mobile Guide**: Detailed instructions in [`deploy/MOBILE.md`](file:///d:/Projects/pachas/deploy/MOBILE.md).

### 🔐 Security, Profiles & Production Readiness
- **Custom Profile Photos**: Upload custom photos directly from mobile/desktop with automatic canvas compression, preset avatar gallery, and initials fallback.
- **Production Mode Lockdown**: Demo user switchers are completely removed in production (`NODE_ENV === 'production'`), requiring real authentication and admin-only user provisioning.
- **Initial Global Admin**: Configurable via `NEXT_PUBLIC_ADMIN_EMAIL`.
- **Safe SSR Fallbacks**: Robust Next.js standalone compilation with defensive build arguments.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Components & Client Hooks) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (Strict type-safety) |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) |
| **State & Persistence** | React Context (`PachasContext`), `localStorage` resilient caching, and Supabase SSR client |
| **Backend & DB** | [PostgreSQL 15](https://www.postgresql.org/) with Row Level Security (RLS) & [PostgREST](https://postgrest.org/) |
| **Testing** | [Vitest](https://vitest.dev/) (Unit testing for split algorithms & debt simplification) |
| **Containerization** | [Docker](https://www.docker.com/) (Multi-stage Alpine standalone image, Docker Swarm Stack, Docker Compose) |
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
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_development
NEXT_PUBLIC_ADMIN_EMAIL=admin@pachas.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note:** The application includes a self-contained local state engine, allowing you to test all workflows immediately out of the box.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Tests
```bash
npm test
```

---

## 🐳 Production Deployment (Docker Swarm & Compose)

Pachas includes production-ready Docker deployment configs in [`deploy/`](./deploy).

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
│   ├── docker-stack.yml         # Docker Swarm stack definition (App, PostgreSQL, PostgREST)
│   ├── docker-compose.yml       # Local development Compose definition
│   ├── deploy.sh / deploy.ps1   # 1-click deployment automation scripts
│   ├── reset-db.sh / reset-db.ps1 # Database reset automation scripts
│   ├── README.md                # Dedicated deployment documentation
│   └── init-scripts/            # PostgreSQL auto-init schemas and RLS policies
├── src/
│   ├── app/                     # Next.js App Router (Auth, Dashboard, Groups, Profile)
│   ├── components/
│   │   ├── balances/            # Debt summary, Bizum settlement modals
│   │   ├── charts/              # Time-series analytics & breakdown charts
│   │   ├── expenses/            # Expense forms, receipt viewers, route maps
│   │   ├── groups/              # Group cards, creation, settings, invite modals
│   │   ├── layout/              # Navbar, BottomNav mobile navigation
│   │   ├── profile/             # Profile management, custom avatar upload
│   │   └── ui/                  # Reusable accessible UI components
│   ├── context/                 # PachasContext (Global state & storage sync)
│   ├── lib/
│   │   ├── algorithms/          # Debt simplification & split calculations
│   │   ├── authConfig.ts        # Admin role enforcement & production checks
│   │   ├── export.ts            # Vector PDF and CSV generators
│   │   └── supabase/            # Client and Server Supabase SSR initializers
│   └── types/                   # Database & application TypeScript definitions
├── USER_REQUIREMENTS.md         # Formal User Requirements Registry (FR-01 to FR-21)
└── README.md                    # Main project documentation
```

---

## 📜 Requirements & Specifications

For the complete, itemized registry of all functional and non-functional specifications, consult:
👉 **[`USER_REQUIREMENTS.md`](./USER_REQUIREMENTS.md)**

---

## 📄 License

MIT License © 2026 Eduardo Martín Rojo
