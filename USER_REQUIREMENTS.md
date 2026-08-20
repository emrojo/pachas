# 📋 User Requirements & Feature Specification Registry — Pachas

This document serves as the official and permanent registry for all **user requirements**, architectural design decisions, and requested features for the **Pachas** application. It is continuously maintained and kept up to date with every new request, modification, or deprecated feature.

---

## 📌 1. Functional Requirements (FR)

### 👥 FR-01: Vacation & Themed Group Management
- **FR-01.1**: Users can create dedicated groups for each trip or getaway, specifying: name, description, thematic emoji icon picker (🏖️, 🏔️, 🍕, ✈️, etc.) or custom cover image upload, and group base currency.
- **FR-01.2**: Dashboard with an active trip list, total trip expenditure, and individual net balance status.
- **FR-01.3**: **Edit Trip Icon, Cover, and Settings**: Ability to edit the group emoji/icon, name, description, and base currency at any time, as well as **upload a custom photo from the device** or pick from curated gallery themes to use as the trip header cover photo.

### 🔗 FR-02: Invitations & Group Onboarding
- **FR-02.1**: Generation of a unique invitation link per group (`/join/[inviteCode]`).
- **FR-02.2**: Scannable **QR code** generator readable directly with a smartphone camera.
- **FR-02.3**: One-click direct button to **share the invitation via WhatsApp** with a pre-formatted message.
- **FR-02.4**: Option to invite or manually add friends via email address.

### 🔐 FR-03: Authentication & User Profile
- **FR-03.1**: Mandatory registration and login with email/password or Google OAuth.
- **FR-03.2**: User profile with full name, avatar, and dedicated field for **Bizum phone number** (to facilitate debt settlements).
- **FR-03.3**: Quick switcher tool between demo users in development to simulate multi-user collaboration.
- **FR-03.4**: **Custom Profile Photo Upload**:
  - Ability to upload a **custom photo directly from the user's device** (mobile or desktop) with automatic canvas compression and optimization for use as an avatar across the application.
  - Curated preset avatar gallery ready to select with 1 tap.
  - Option to remove the avatar photo at any time and revert to default initials badge.
  - Real-time synchronization of the new avatar in Navbar, member lists, and expense cards.

### 🧾 FR-04: Expense Submission & Form
- **FR-04.1**: Desktop and mobile-optimized form with a **2-line primary hierarchy**:
  - *Line 1*: Full-width field for **Expense Title / Concept**.
  - *Line 2*: Dedicated and prominent row for **Numeric Amount and Currency Selector**.
- **FR-04.2**: **Collapsed Sections by Default** to minimize visual clutter:
  - *Who paid for the expense?*: Collapsed by default showing the active payer (you by default); expandable to change payer or split across multiple payers.
  - *With whom is it shared?*: Collapsed by default indicating it is shared equally among everyone; expandable to customize participants or split modes.
- **FR-04.3**: Category classification with emojis (Food 🍽️, Accommodation 🏨, Transport 🚗, Leisure 🎟️, Groceries 🛒, Other 💡).
- **FR-04.4**: Attach receipt/ticket photo as proof with full-screen viewer modal.
- **FR-04.5**: **Multi-Currency Behavior**:
  - In the **expense list**: Foreign currency entries display the **original currency value** directly (e.g., `$150.00` or `¥22,000`) with a currency badge, without converting on the primary card.
  - In the **detail / edit view**: Displays a breakdown panel with the **original currency amount**, the **applied exchange rate** (editable), and the **equivalent converted amount in the trip's base currency** (e.g., `138.89 €`).

### 🍕 FR-05: Flexible Expense Splitting
- **FR-05.1**: **Equal shares**: Divided evenly among all friends or selected participants with exact residual penny distribution without loss.
- **FR-05.2**: **Exact amounts (€)**: Assign specific monetary amounts to each participant.
- **FR-05.3**: **Percentages (%)**: Assign percentage shares ensuring a strict 100% total.
- **FR-05.4**: **Portions / Shares**: Allocate weighted shares (ideal for couples, families, or unequal consumption).
- **FR-05.5**: **Multiple Payers**: Support for expenses paid by multiple friends on a single receipt.

### ✏️ FR-06: Editing & Creator Permission Controls
- **FR-06.1**: Ability to edit any registered expense (concept, amount, category, date, payers, split, photo, and geolocation).
- **FR-06.2**: **Strict Edit Permission**: Only the user who originally created the expense can edit it. For other members, edit controls remain hidden and inaccessible.
- **FR-06.3**: **Strict Delete Permission**: Only the creator of the expense can delete it.

### 🧠 FR-07: Debt Simplification & Settlement Algorithm
- **FR-07.1**: Real-time calculation of each member's net individual balance ($\sum \text{Paid} - \sum \text{Consumed} + \sum \text{Settled}$).
- **FR-07.2**: **Debt Simplification Algorithm**: Minimizes the total number of transactions needed to settle all trip debts ($O(N)$ cash flow algorithm).
- **FR-07.3**: **Settle Debt Modal** with automatic Bizum phone number suggestion, quick-copy button, and settlement transaction logging.
- **FR-07.4**: Festive confetti animation upon confirming a debt settlement.

### 🇪🇺 FR-08: European Formatting Standards (Dates & Numbers)
- **FR-08.1**: **European Number Formatting**: Standard comma (`,`) for decimals and period (`.`) for thousands (e.g., `1.250,50 €`).
- **FR-08.2**: **Flexible Decimal Input**: Accepts both comma `,` and period `.` in all numeric inputs.
- **FR-08.3**: **European Date Format**: Standard `DD/MM/YYYY` (e.g., `15/08/2026`) and `DD/MM/YYYY HH:mm` in records and generated reports.

### 📄 FR-09: Report Exporting
- **FR-09.1**: **Full PDF Report with Vector Graphics and Individual Breakdown**:
  - *Page 1*: Official trip header, key KPI metric cards, **Time Evolution Chart of Expenses by Day** (crisp vector bars with dates and amounts), and **Expense Distribution by Category** (percentage and total bars).
  - *Page 2*: **Comparative Friend Chart (Total Paid vs Consumed)**, Full Balance Table by Participant, and Suggested Settlement Plan with Bizum.
  - *Page 3*: **Full Expense History Table**: Complete table of all trip expenses (date, concept, category, payer, original and converted currency amounts).
  - *Page 4 onwards*: **Individual Expense Breakdown per Person**: Dedicated section for each friend with a summary card (Total Paid, Total Consumed, Net Balance) and a detailed table of all expenses they participated in or paid for individual verification.
- **FR-09.2**: Download in **European CSV / Excel** format with semicolon (`;`) column separators and comma (`,`) decimals.

### 📍 FR-10: Geolocation & Expense Maps (Google Maps)
- **FR-10.1**: **Physical Presence Detection**: Checkbox *"I am physically at the payment location"* capturing high-precision GPS coordinates from mobile/browser and autocompleting establishment/address name via reverse geocoding.
- **FR-10.2**: **Manual Geocoding**: Search bar for restaurants, stores, and landmarks to geolocate expenses after the fact.
- **FR-10.3**: **Location Viewer & Editor**: Interactive map when editing an expense, allowing repositioning, updating with current GPS location, or removing coordinates.
- **FR-10.4**: **Quick List Access**: Each geolocated expense displays a 📍 pin badge to open the interactive map and a direct link to open the coordinates in native Google Maps.

### 📥 FR-11: Bulk Expense Import from Excel / CSV
- **FR-11.1**: Upload of `.csv`, `.txt`, `.tsv` files or direct copy-pasting from spreadsheets (Excel, Numbers, Google Sheets).
- **FR-11.2**: Automatic detection of separators (`;`, `,`, tabs) and European decimal commas.
- **FR-11.3**: **Official CSV Template Download** button with predefined headers (`Date;Concept;Category;Amount;Currency;Paid By;Split Between;Notes`) and personalized suggestions with actual group member names.
- **FR-11.4**: Automatic normalization of categories, dates, and exchange rates.
- **FR-11.5**: **Interactive Preview Table**: Visual row validation with error/warning badges and the ability to delete or adjust rows before importing.
- **FR-11.6**: **Strict Member Validation & "All" Alias**: Validates group member names; if `"Todos"`, `"All"`, or empty is specified in participants, it automatically maps to all registered group friends without throwing errors.
- **FR-11.7**: **Preventive Import Lock**: Import action is blocked and fails if attempted while unresolved error rows remain in the preview table.
- **FR-11.8**: **Undo Import**: One-click rollback to revert the last imported batch, deleting created expenses and recalculating group balances immediately.
- **FR-11.9**: **Full Error Details Modal**: Clickable error cells/buttons in the preview table opening an explanatory popup with original row values, fix suggestions, and a direct row deletion button.
- **FR-11.10**: **Multi-Payer Import Support**: Ability to process expenses paid by multiple friends with specified amounts (`Eduardo: 350 + Carlos: 250`) or equal splits (`Eduardo + Carlos`).

### 👥 FR-12: Test Users & Local Simulation
- **FR-12.1**: **Local User Creation Modal**: Create synthetic test profiles specifying full name, email, Bizum phone, avatar picker, and auto-inclusion in existing groups.
- **FR-12.2**: **Quick User Switcher in Navbar**: Dropdown accessible from any screen to switch active session in 1 click or create a new user.
- **FR-12.3**: **Management from Profile and Login**: Profile (`/profile`) and Login (`/login`) screens with direct access to demo users and local profile deletion.
- **FR-12.4**: **Local Persistence**: Created profiles persist in `localStorage` across browser restarts.
- **FR-12.5**: **Active User Persistence on Refresh**: Switching active users immediately persists the selection to `localStorage`, preserving login state upon page refresh (F5).

### 🧭 FR-13: Timezone Recording & Historical Trip Route Map
- **FR-13.1**: **Timestamp & Timezone Capture**: Captures exact time and ISO timezone (`YYYY-MM-DDTHH:mm:ss±HH:MM`) when recording or editing expenses, displaying the user's timezone.
- **FR-13.2**: **Timestamp Display in List**: Expense cards show formatted date and time (`d MMM, HH:mm`, e.g., `20 Aug, 20:44`).
- **FR-13.3**: **Trip Route Map Modal (`TripRouteMapModal`)**: Interactive viewer ordering all geolocated trip expenses chronologically, showing numbered stop pins (1, 2, 3...), and providing a direct button to open the **full multi-stop navigation route in Google Maps**.
- **FR-13.4**: **Trip Timeline Feed**: Chronological activity feed with amount, currency, title, payer, and exact timestamp.

### ⏱️ FR-14: Temporal Expense List Sorting
- **FR-14.1**: **Default Sort (Newest First)**: Group expense items are sorted chronologically in descending order (`expense_date` / `created_at`), showing latest expenses at the top.
- **FR-14.2**: **Interactive Sort Switcher**: Toggle button next to search bar to switch between **"Newest"** and **"Oldest"** (ascending), fully integrated with category filters and text search.

### 👤 FR-15: Member Removal & Leaving Groups
- **FR-15.1**: **Remove Friends from Group**: Trip administrators can remove members from the group directly from the *"Friends"* tab, and members can choose to leave.
- **FR-15.2**: **Confirmation Modal**: Preventative confirmation dialog before member removal to prevent accidental removals.

### 📦 FR-16: Group Archiving & Restoration (Admin Only)
- **FR-16.1**: **Exclusive Administrator Control**: Only group admins have permissions to archive or restore a trip.
- **FR-16.2**: **Hide from Main View**: Archived trips disappear from the active trip dashboard and are excluded from overall active balances.
- **FR-16.3**: **Member Access Block**: Non-admin members trying to access an archived group URL are shown an informative locked screen.
- **FR-16.4**: **Separated Section in Dashboard**: Archived groups appear in a dedicated *"Archived Trips"* section visible only to administrators, showing archive date, history link, and a 1-click **"Restore"** button.
- **FR-16.5**: **Informative Banner & Settings Management**: Admin banner inside archived groups with restore button, plus an *"Admin Zone"* in the Group Settings Modal (`EditGroupModal`).

### 📊 FR-17: Expense Analytics & Charts (Temporal & Individual)
- **FR-17.1**: **Analytics Tab & Modal (`ExpenseChartsView` / `ExpenseChartsModal`)**: Accessible both as a main trip tab (*"Charts & Analytics"*) and via the quick-access *"Charts"* button in the header.
- **FR-17.2**: **Granularity Selector**:
  - *By Hours*: Groups expenses into hourly intervals (`HH:00 - HH:00`) and day.
  - *By Days*: Day-by-day evolution of total trip expenses.
  - *By Weeks*: Comparative spend grouped by calendar weeks.
  - *Overall*: Cumulative trip total with category distribution percentages (Food, Hotel, Leisure, Transport...).
- **FR-17.3**: **Breakdown Modes**:
  - *By Payer*: Stacked bar chart showing who fronted money in each interval.
  - *By Consumption*: Stacked bar chart showing consumption shares assigned to each friend.
  - *Global Total*: Single total group spend bars without friend breakdown.
- **FR-17.4**: **Interactive Friend Filter**: Legend with interactive chips to toggle specific friends on/off in the chart.
- **FR-17.5**: **Interactive Drill-Down**: Clicking on any bar opens a breakdown card detailing exact amounts per person and the list of expenses in that timeframe.
- **FR-17.6**: **KPI Summary Cards**: Top metrics for total trip spend, average per person, peak spending interval, and active intervals count.

### 📱 FR-18: Mobile Tab Navigation with Arrow Controls
- **FR-18.1**: **Previous / Next Navigation Buttons**: Left and right arrow buttons (<kbd>&lt;</kbd> and <kbd>&gt;</kbd>) flanking the tabs bar for 1-tap navigation without awkward touch dragging.
- **FR-18.2**: **Smooth Auto-Scroll & Centering**: Switching tabs smoothly scrolls the tabs bar (`scrollIntoView`) to keep the active tab visible and centered.
- **FR-18.3**: **Visual Indicators & Disabled States**: Arrows disable automatically at boundaries, and tab touch targets are styled for mobile ergonomics.

### 🐳 FR-19: Docker Stack & Production Service Orchestration (Swarm / Compose)
- **FR-19.1**: **Dedicated Deployment Directory (`deploy/`)**: Containerized and modular structure for production and testing environments.
- **FR-19.2**: **Optimized Multi-Stage Dockerfile**: Alpine Linux image compiled with Next.js `output: 'standalone'`, non-privileged user `nextjs:nodejs`, and automated `HEALTHCHECK`.
- **FR-19.3**: **Docker Stack Specification (`deploy/docker-stack.yml`)**: Services for Docker Swarm (`pachas_app` with replicas and rolling updates, `pachas_postgres` with persistent volume and schema `01-schema.sql`, `pachas_postgrest`, and overlay network `pachas_network`).
- **FR-19.4**: **Docker Compose Support (`deploy/docker-compose.yml`)**: Complementary setup for single-node local development.
- **FR-19.5**: **Automated Deployment Scripts & Documentation**: Executables for Linux/macOS (`deploy.sh`), Windows PowerShell (`deploy.ps1`), and step-by-step guide ([`deploy/README.md`](file:///d:/Projects/pachas/deploy/README.md)).
- **FR-19.6**: **Build Resilience & Safe Fallbacks**: Default build arguments in `Dockerfile` (`ARG NEXT_PUBLIC_SUPABASE_URL`, `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ARG NEXT_PUBLIC_ADMIN_EMAIL`) and defensive client/server Supabase initializers to ensure builds and runtime never fail due to missing external keys.
- **FR-19.7**: **Production Database Reset & Clean Slate Tools**: Automated scripts (`deploy/reset-db.ps1`, `deploy/reset-db.sh`, `deploy/init-scripts/reset-db.sql`) to purge persistent volumes and truncate relational tables, accompanied by empty default test group seeds.

### 🔒 FR-20: Production Security Restrictions & Admin Role Enforcement
- **FR-20.1**: **Complete Block of Demo Login in Production**:
  - In production mode (`NODE_ENV === 'production'`), demo user switchers are completely hidden and disabled in Login ([`login/page.tsx`](file:///d:/Projects/pachas/src/app/(auth)/login/page.tsx)), Navbar ([`Navbar.tsx`](file:///d:/Projects/pachas/src/components/layout/Navbar.tsx)), and Profile ([`profile/page.tsx`](file:///d:/Projects/pachas/src/app/(dashboard)/profile/page.tsx)).
  - Login strictly validates credentials against the authentication backend, preventing impersonation.
- **FR-20.2**: **User Creation & Deletion Restricted to Administrators**:
  - Only **Administrators** (`role === 'admin'`, group creators, or admins) can open the user creation modal or execute user provisioning ([`CreateUserModal.tsx`](file:///d:/Projects/pachas/src/components/profile/CreateUserModal.tsx) and `createLocalUser` in [`PachasContext.tsx`](file:///d:/Projects/pachas/src/context/PachasContext.tsx)).
  - Standard members have creation buttons hidden, and direct unauthorized calls are blocked.
- **FR-20.3**: **Initial Admin Configuration via Environment Variable (`NEXT_PUBLIC_ADMIN_EMAIL`)**:
  - Automatic Global Administrator privileges assigned to the email defined in `NEXT_PUBLIC_ADMIN_EMAIL` upon registration or login.

### 🚪 FR-21: User Logout Functionality
- **FR-21.1**: **Complete & Secure Logout**:
  - Centralized `logout()` in [`PachasContext.tsx`](file:///d:/Projects/pachas/src/context/PachasContext.tsx) invalidating authentication sessions (Supabase `signOut()`), wiping active user tokens from `localStorage`, and resetting application state.
- **FR-21.2**: **Accessible Logout Buttons in Navbar & Profile**:
  - Direct **Log Out** button in user dropdown ([`Navbar.tsx`](file:///d:/Projects/pachas/src/components/layout/Navbar.tsx)) and in profile settings ([`profile/page.tsx`](file:///d:/Projects/pachas/src/app/(dashboard)/profile/page.tsx)), smoothly redirecting to the login screen ([`/login`](file:///d:/Projects/pachas/src/app/(auth)/login/page.tsx)).

---

## ⚙️ 2. Non-Functional Requirements (NFR)

- **NFR-01**: **Mobile-First Design**: Native app-like experience on mobile phones with bottom navigation bar (`BottomNav`) and desktop responsiveness.
- **NFR-02**: **PWA (Progressive Web App)**: Web App Manifest configured for installation on mobile home screens.
- **NFR-03**: **Security & RLS**: Row Level Security policies in PostgreSQL ensuring that no non-member can read or modify group data.
- **NFR-04**: **Persistence & Offline Mode**: Interactive `localStorage` state acting as an immediate resilient layer with backend synchronization.

---

## 📜 3. Changelog & Version History

| Date | Type | Requirement / Change | Description |
|---|---|---|---|
| **20/08/2026** | ✨ Added | **FR-01 to FR-05** | Initial app release: Themed groups, QR/WhatsApp/link invitations, flexible splitting (equal, exact, %, portions), multi-payers, and receipt photos. |
| **20/08/2026** | ✨ Added | **FR-07 & FR-09** | Minimum cash flow debt simplification algorithm, Bizum settlement modal with confetti, and PDF/CSV report exports. |
| **20/08/2026** | 🎨 Changed | **FR-04.1 & FR-04.2** | Form layout split into 2 primary lines (Title and Amount) and collapsed "Who paid?" and "Shared with" sections. |
| **20/08/2026** | 🇪🇺 Changed | **FR-08** | European standards adaptation: decimal comma (`,`), `DD/MM/YYYY` dates, and flexible input with `,` and `.`. |
| **20/08/2026** | 🔒 Added | **FR-06** | Expense editing feature and permission lock: only the original creator of an expense can edit or delete it. |
| **20/08/2026** | 🌍 Changed | **FR-04.5** | Expense list displays original foreign currency without converting; edit view displays original amount, exchange rate, and base currency equivalent. |
| **20/08/2026** | 🐛 Fixed | **FR-04.5 & FR-05** | Fixed multi-currency split validation: splits validate against transaction currency and convert coherently to group base currency for balances. |
| **20/08/2026** | 📍 Added | **FR-10** | Automatic GPS geolocation (physical presence checkbox), reverse geocoding, manual place search, embedded Google Maps viewer, and edit support. |
| **20/08/2026** | 🐛 Fixed | **FR-09** | Fixed multi-currency calculation in exported PDF and CSV reports with accurate conversions and rate breakdowns. |
| **20/08/2026** | 📥 Added | **FR-11** | Bulk expense import via CSV/Excel upload or table pasting, official template download, smart separator detection, and interactive preview table. |
| **20/08/2026** | 🛡️ Changed | **FR-11.6 - FR-11.8** | Strict member validation during import (import blocks on unresolved errors) and full **Undo Import** feature. |
| **20/08/2026** | 👥 Added | **FR-12** | Local test user simulation with quick switcher in Navbar, profile, and login, auto-joining groups, and localStorage persistence. |
| **20/08/2026** | 🎨 Added | **FR-01.3** | Custom cover photo upload from device, thematic gallery presets, emoji customization, and `EditGroupModal`. |
| **20/08/2026** | 🧭 Added | **FR-13** | Timezone timestamp recording and historical payment route map (`TripRouteMapModal`) with multi-waypoint Google Maps directions. |
| **20/08/2026** | 📥 Changed | **FR-11.6** | Support for `"Todos"` / `"All"` aliases in CSV import, mapping automatically to all group members. |
| **20/08/2026** | 🔍 Added | **FR-11.9** | Error detail modal popup in import preview with explanatory diagnostics, fix suggestions, and direct row removal. |
| **20/08/2026** | 💰 Added | **FR-11.10** | Multi-payer support in CSV/Excel import with itemized amounts (`Eduardo: 350 + Carlos: 250`) or equal splits (`Eduardo + Carlos`). |
| **20/08/2026** | ⏱️ Added | **FR-14** | Chronological sort toggle in group expense list (Newest first by default vs Oldest). |
| **20/08/2026** | 👤 Added | **FR-15** | Remove friends from group feature with confirmation modal and admin permissions. |
| **20/08/2026** | 📦 Added | **FR-16** | Admin-exclusive trip archiving and restoration: hidden from dashboard, member lockdown, and dedicated admin restore interface. |
| **20/08/2026** | 💾 Changed | **FR-12.5** | Immediate active user persistence to `localStorage` preserving active login across browser reloads (F5). |
| **20/08/2026** | 📊 Added | **FR-17** | Interactive charts and analytics tab and modal supporting hours, days, weeks, and totals, friend filters, and KPIs. |
| **20/08/2026** | 🐛 Fixed | **FR-17** | Fixed stacked bar chart height rendering using explicit `CHART_TRACK_HEIGHT` and `flex-grow` proportional segment scaling. |
| **20/08/2026** | 📱 Added | **FR-18** | Mobile tab navigation arrows and smooth auto-centering scroll for ergonomic touch navigation. |
| **20/08/2026** | 📊 Added | **FR-09.1** | Vector charts in PDF export: daily spend timeline, category distribution, and paid vs consumed comparison. |
| **20/08/2026** | 👤 Added | **FR-09.1** | Individualized personal breakdown in PDF report: dedicated tables per friend with ticket total, paid amount, share, and balance. |
| **20/08/2026** | 🐳 Added | **FR-19** | Complete deployment bundle (`deploy/`) with standalone `Dockerfile`, `docker-stack.yml` for Swarm, `docker-compose.yml`, automation scripts (`deploy.sh`, `deploy.ps1`), and auto-initializing PostgreSQL with RLS. |
| **20/08/2026** | 🔒 Added | **FR-20** | Production security restrictions (demo user login disabled in production) and admin-only user provisioning. |
| **20/08/2026** | 🚪 Added | **FR-21** | Full user logout functionality with session destruction and redirect to login from Navbar and Profile. |
| **20/08/2026** | 🧹 Added | **FR-19.7** | Production database reset tools (`deploy/reset-db.ps1`, `deploy/reset-db.sh`, `deploy/init-scripts/reset-db.sql`) and clean initial demo seeds. |
| **20/08/2026** | 🖼️ Added | **FR-03.4** | Custom profile photo upload with automated canvas compression, preset avatar gallery, and remove photo option in Profile and User Creation. |
| **21/08/2026** | 🌐 Translated | **Documentation** | Translated all repository Markdown documentation files (`README.md`, `deploy/README.md`, `USER_REQUIREMENTS.md`) to English. |
