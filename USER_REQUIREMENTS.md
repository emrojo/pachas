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
- **FR-03.5**: **PostgreSQL Profile Persistence ([`PUT /api/auth/me`](file:///d:/Projects/pachas/src/app/api/auth/me/route.ts))**:
  - Direct persistence of profile edits (`avatar_url`, `full_name`, `bizum_phone`) into `public.profiles` in the PostgreSQL database, preserving user settings across device sessions and restarts.

### 🧾 FR-04: Expense Submission & Form
- **FR-04.1**: Desktop and mobile-optimized form with a **2-line primary hierarchy**:
  - *Line 1*: Full-width field for **Expense Title / Concept**.
  - *Line 2*: Dedicated and prominent row for **Numeric Amount and Currency Selector**.
- **FR-04.2**: **Collapsed Sections by Default** to minimize visual clutter:
  - *Who paid for the expense?*: Collapsed by default showing the active payer (you by default); expandable to change payer or split across multiple payers.
  - *With whom is it shared?*: Collapsed by default indicating it is shared equally among everyone; expandable to customize participants or split modes.
- **FR-04.3**: Category classification with emojis (Food 🍽️, Accommodation 🏨, Transport 🚗, Leisure 🎟️, Groceries 🛒, Other 💡).
- **FR-04.4**: **Receipt & Ticket Photo Attachment & Capture**:
  - *Direct Mobile Camera Capture*: 📸 Dedicated **"Hacer foto"** button utilizing `capture="environment"` to trigger smartphone camera directly on iOS/Android/PWA, with `Permissions-Policy: camera=(self)`.
  - *File / Gallery Picker*: 🖼️ **"Subir archivo"** button to attach receipts from local device storage, camera roll, or Google Drive.
  - *In-App Lightbox Viewer & Safe External Opener*: Integrated [`ReceiptModal`](file:///d:/Projects/pachas/src/components/expenses/ReceiptModal.tsx) for instant high-resolution ticket preview, popup document stream viewer for new browser tabs, and direct image download option.
  - *Security Warning Alert*: Preventative safety notice warning users against uploading payment receipts displaying full card numbers (PAN) or security codes (CVV).
- **FR-04.5**: **Multi-Currency Behavior**:
  - In the **expense list**: Foreign currency entries display the **original currency value** directly (e.g., `$150.00` or `¥22,000`) with a currency badge, without converting on the primary card.
  - In the **detail / edit view**: Displays a breakdown panel with the **original currency amount**, the **applied exchange rate** (editable), and the **equivalent converted amount in the trip's base currency** (e.g., `138.89 €`).
- **FR-04.6**: **Visual Action Hierarchy & Tools Submenu (`GroupActionMenu`)**:
  - **Primary Hero Action**: **Add Expense** button with maximum visual prominence (brand gradient, prominent icon, glowing shadow, larger typography).
  - **Secondary Action**: **Invite Friends** directly accessible next to the primary action.
  - **Categorized Submenu**: All remaining tools (Trip Route Map, Charts & Analytics, Import CSV/Excel, Export PDF, Export CSV, and Trip Settings) grouped into an organized dropdown menu categorized into *Routes & Analytics*, *Import & Export*, and *Trip Settings*.

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
- **FR-09.2**: Download in **European CSV / Excel** format with semicolon (`;`) column separators, comma (`,`) decimals, and dedicated columns for `Establecimiento / Ubicación` (establishment name), `Coordenadas` (latitude, longitude), and `Enlace Google Maps` (clickable direct link).

### 📍 FR-10: Geolocation & Expense Maps (Google Maps)
- **FR-10.1**: **Physical Presence Detection**: Checkbox *"I am physically at the payment location"* capturing high-precision GPS coordinates from mobile/browser and autocompleting establishment/address name via reverse geocoding.
- **FR-10.2**: **Manual Geocoding**: Search bar for restaurants, stores, and landmarks to geolocate expenses after the fact.
- **FR-10.3**: **Location Viewer & Editor**: Interactive map when editing an expense, allowing repositioning, updating with current GPS location, or removing coordinates.
- **FR-10.4**: **Quick List Access**: Each geolocated expense displays a 📍 pin badge to open the interactive map and a direct link to open the coordinates in native Google Maps.

### 📥 FR-11: Bulk Expense Import from Excel / CSV
- **FR-11.1**: Upload of `.csv`, `.txt`, `.tsv` files or direct copy-pasting from spreadsheets (Excel, Numbers, Google Sheets).
- **FR-11.2**: Automatic detection of separators (`;`, `,`, tabs) and European decimal commas.
- **FR-11.3**: **Official CSV Template Download** button with predefined headers (`Date;Concept;Category;Amount;Currency;Paid By;Split Between;Establecimiento / Ubicación;Coordenadas;Notes`) and personalized suggestions with actual group member names and location examples.
- **FR-11.4**: Automatic normalization of categories, dates, and exchange rates.
- **FR-11.5**: **Interactive Preview Table**: Visual row validation with error/warning badges and the ability to delete or adjust rows before importing.
- **FR-11.6**: **Strict Member Validation & "All" Alias**: Validates group member names; if `"Todos"`, `"All"`, or empty is specified in participants, it automatically maps to all registered group friends without throwing errors.
- **FR-11.7**: **Preventive Import Lock**: Import action is blocked and fails if attempted while unresolved error rows remain in the preview table.
- **FR-11.8**: **Undo Import**: One-click rollback to revert the last imported batch, deleting created expenses and recalculating group balances immediately.
- **FR-11.9**: **Full Error Details Modal**: Clickable error cells/buttons in the preview table opening an explanatory popup with original row values, fix suggestions, and a direct row deletion button.
- **FR-11.10**: **Multi-Payer Import Support**: Ability to process expenses paid by multiple friends with specified amounts (`Eduardo: 350 + Carlos: 250`) or equal splits (`Eduardo + Carlos`).
- **FR-11.11**: **Location, GPS Coordinates & Google Maps Link Import**:
  - Support for importing establishment names, raw GPS coordinates (e.g. `39.8631, 4.2186` or European `39,8631; 4,2186`), Google Maps URLs (`https://maps.google.com/?q=...` or `@lat,lng`), or combined text (`"Restaurante El Faro (39.8631, 4.2186)"`).
  - Graceful fallback for rows with only establishment name, rows with only GPS coordinates, or empty location columns when no physical location is specified.
  - Interactive preview table display with establishment name and clickable 📍 GPS pin link to Google Maps.

### 👥 FR-12: Test Users & Local Simulation
- **FR-12.1**: **Local User Creation Modal**: Create synthetic test profiles specifying full name, email, Bizum phone, avatar picker, and auto-inclusion in existing groups.
- **FR-12.2**: **Quick User Switcher in Navbar**: Dropdown accessible from any screen to switch active session in 1 click or create a new user.
- **FR-12.3**: **Management from Profile and Login**: Profile (`/profile`) and Login (`/login`) screens with direct access to demo users and local profile deletion.
- **FR-12.4**: **Local Persistence**: Created profiles persist in `localStorage` across browser restarts.
- **FR-12.5**: **Active User Persistence on Refresh**: Switching active users immediately persists the selection to `localStorage`, preserving login state upon page refresh (F5).

### 🧭 FR-13: Timezone Recording & Historical Trip Route Map
- **FR-13.1**: **Timestamp & Timezone Capture**: Captures exact time and ISO timezone (`YYYY-MM-DDTHH:mm:ss±HH:MM`) when recording or editing expenses, displaying the user's timezone.
- **FR-13.2**: **Timestamp Display in List**: Expense cards show formatted date and time (`d MMM, HH:mm`, e.g., `20 Aug, 20:44`).
- **FR-13.3**: **Trip Route Map & Multi-Establishment Pins Modal (`TripRouteMapModal` & `TripInteractiveMap`)**:
  - **Exclusive Trip Venue Map**: High-performance interactive vector map displaying strictly and exclusively the trip's geolocated expenses as numbered custom pins (`1`, `2`, `3`...), completely free of third-party advertisements or unrelated nearby businesses.
  - **Interactive Establishment Popups (Fichas)**: Clicking any map pin or list item opens an informational popup with establishment name, expense title, category emoji, amount, date, payer, and a direct Google Maps venue card button.
  - **Toggle View Mode**: Live switch between *"Solo Fichas"* (isolated markers) and *"Con Ruta"* (dashed route polyline connecting chronological stops).
  - **KML Export for Google My Maps & Earth**: 1-click download of a standard `.kml` file containing only the trip's registered establishments with detailed metadata for custom layers in Google My Maps and Google Earth.
  - **Turn-by-turn Navigation Route**: Button to open the full multi-stop directions route in Google Maps (`/maps/dir/...`).
  - **Individual Establishment Links ("Ficha")**: Direct link on each timeline stop item to inspect that specific venue on Google Maps.
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

### 📱 FR-22: Mobile Applications (PWA & Native Capacitor Wrapper)
- **FR-22.1**: **Progressive Web App (PWA) Standalone**:
  - Web App Manifest ([`public/manifest.json`](file:///d:/Projects/pachas/public/manifest.json)), high-resolution scalable SVG icons ([`public/icon.svg`](file:///d:/Projects/pachas/public/icon.svg)), and mobile viewport cover meta tags in [`src/app/layout.tsx`](file:///d:/Projects/pachas/src/app/layout.tsx).
  - Installable on iOS (Safari *"Add to Home Screen"*) and Android (Chrome *"Install App"*) running in full-screen standalone mode without browser navigation bars.
- **FR-22.2**: **Native Store Packaging with Capacitor.js**:
  - Pre-configured Capacitor integration ([`capacitor.config.ts`](file:///d:/Projects/pachas/capacitor.config.ts), `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`).
  - Pre-integrated native plugins: `@capacitor/splash-screen`, `@capacitor/status-bar`, and `@capacitor/haptics`.
  - Configurable for live remote URL loading (instant over-the-air updates without store review delays) or local bundled static export.
  - Helper npm scripts in [`package.json`](file:///d:/Projects/pachas/package.json) (`cap:sync`, `cap:android`, `cap:ios`, `cap:add:android`, `cap:add:ios`).
- **FR-22.3**: **Mobile Deployment & Store Submission Guide**:
  - Comprehensive documentation in [`deploy/MOBILE.md`](file:///d:/Projects/pachas/deploy/MOBILE.md) for Google Play Store (`.aab` / `.apk`) and Apple App Store (`.ipa`) builds and signing.

### 🌐 FR-23: Internationalization (i18n) & Multi-Language Support
- **FR-23.1**: **19 Supported Languages with Country Flags**:
  - Full translations for: Spanish (es 🇪🇸), English (en 🇬🇧), Galician (gl 🏴󠁥󠁳󠁧󠁡󠁿), Catalan (ca 🏴󠁥󠁳󠁣󠁴󠁿), Basque (eu 🏴󠁥󠁳󠁰󠁶󠁿), Valencian (va 🏴󠁥󠁳󠁶󠁣󠁿), French (fr 🇫🇷), Portuguese (pt 🇵🇹), Italian (it 🇮🇹), German (de 🇩🇪), Chinese (zh 🇨🇳), Japanese (ja 🇯🇵), Hindi (hi 🇮🇳), Russian (ru 🇷🇺), Arabic (ar 🇸🇦 with RTL direction support), Greek (el 🇬🇷), Turkish (tr 🇹🇷), Dutch (nl 🇳🇱), and Afrikaans (af 🇿🇦).
- **FR-23.2**: **Contextual `LanguageProvider` & Hook**:
  - React context (`LanguageProvider`) and `useTranslation()` hook providing typed dictionary access `t('category.key')` and dynamic variable interpolation (e.g., `{name}`, `{amount}`, `{count}`).
- **FR-23.3**: **Interactive Language Selector**:
  - Multi-language switcher available as a dropdown, button row, and full modal displaying country flags, English names, and native endonyms.
- **FR-23.4**: **Zero Hardcoded Strings**:
  - 100% coverage across all navigation menus, modals, forms, buttons, tooltips, analytics charts, and legal notices.
- **FR-23.5**: **Automated Dictionary Verification**:
  - Automated test suite ([`src/locales/locales.test.ts`](file:///d:/Projects/pachas/src/locales/locales.test.ts)) guaranteeing key parity across all 19 language dictionaries and detecting untranslated UI tokens.

### ☕ FR-24: Voluntary Support & Donations System (Buy Me a Coffee)
- **FR-24.1**: **Configurable Support Button & Cards**:
  - Reusable component ([`BuyMeACoffeeButton.tsx`](file:///d:/Projects/pachas/src/components/donations/BuyMeACoffeeButton.tsx)) with animated heart icon and custom text support.
  - Dedicated support card ([`DonationCard.tsx`](file:///d:/Projects/pachas/src/components/donations/DonationCard.tsx)) integrated in User Profile and Landing Page.
- **FR-24.2**: **Dynamic URL Resolution & Admin Configuration**:
  - Server API endpoint ([`/api/config/donations`](file:///d:/Projects/pachas/src/app/api/config/donations/route.ts)) and environment variable support (`BMC_URL` / `NEXT_PUBLIC_BUYMEACOFFEE_URL`) for real-time link updates without code recompilation.

### 🔑 FR-25: Robust Authentication, Session Sync & Password Recovery
- **FR-25.1**: **Cryptographic Passwords & Signed JWT Tokens**:
  - Server-side password hashing with PBKDF2/HMAC-SHA512 and Web Crypto HMAC-SHA256 tokens (`sb-access-token`).
- **FR-25.2**: **Dynamic HTTPS/HTTP Cookie Resolution**:
  - Automatic `secure: isHttps` cookie resolution adapting seamlessly across local HTTP Docker containers and SSL-secured production deployments.
- **FR-25.3**: **Case-Insensitive Email Queries**:
  - Database queries comparing emails with `LOWER(u.email) = LOWER($1)`.
- **FR-25.4**: **Unified Session Synchronization Endpoint**:
  - Server endpoint ([`/api/auth/session`](file:///d:/Projects/pachas/src/app/api/auth/session/route.ts)) keeping client `localStorage`, cookies, and server state strictly aligned.
- **FR-25.5**: **Password Recovery Mailer Service**:
  - Email dispatcher ([`src/lib/email/mailer.ts`](file:///d:/Projects/pachas/src/lib/email/mailer.ts)) supporting standard SMTP (`nodemailer`), Resend API (`RESEND_API_KEY`), and SendGrid API.
  - Fallback on-screen reset link with terminal logging for local development or standalone deployments without mail servers.

### ⚖️ FR-26: Legal Framework, GDPR/LOPDGDD Compliance & User Safety
- **FR-26.1**: **Terms and Conditions of Use ([`/terms`](file:///d:/Projects/pachas/src/app/(legal)/terms/page.tsx))**:
  - Clear financial disclaimer stating Pachas is an informational calculation tool and not a banking entity (no fund custody or payment processing).
  - User-generated content (UGC) regulations, liability exemptions, and moderation rights.
- **FR-26.2**: **Privacy Policy & GDPR Compliance ([`/privacy`](file:///d:/Projects/pachas/src/app/(legal)/privacy/page.tsx))**:
  - Data controller identification, explicit legal bases, closed-group data visibility model, data retention terms, and exercise of ARCO rights.
- **FR-26.3**: **Cookie & Storage Policy ([`/cookies`](file:///d:/Projects/pachas/src/app/(legal)/cookies/page.tsx))**:
  - Complete inventory of essential technical cookies (`sb-access-token`) and `localStorage`; zero third-party advertising tracking.
- **FR-26.4**: **Legal Notice & LSSI-CE ([`/legal`](file:///d:/Projects/pachas/src/app/(legal)/legal/page.tsx))**:
  - Service provider details, intellectual property rights, and jurisdiction.
- **FR-26.5**: **Mandatory Consent on Registration**:
  - Required unchecked checkbox on registration ([`register/page.tsx`](file:///d:/Projects/pachas/src/app/(auth)/register/page.tsx)) accepting Terms and Privacy Policy.
- **FR-26.6**: **Receipt & Geolocation Safety Warnings**:
  - Preventative alert in receipt uploads ([`ExpenseForm.tsx`](file:///d:/Projects/pachas/src/components/expenses/ExpenseForm.tsx)) warning users not to upload cards showing full PAN or CVV codes.
- **FR-26.7**: **Content Reporting & Moderation**:
  - Modal ([`ReportContentModal.tsx`](file:///d:/Projects/pachas/src/components/safety/ReportContentModal.tsx)) and API ([`/api/reports`](file:///d:/Projects/pachas/src/app/api/reports/route.ts)) allowing group members to flag offensive photos, fake receipts, or privacy violations.
- **FR-26.8**: **GDPR Rights Tools in Profile ([`profile/page.tsx`](file:///d:/Projects/pachas/src/app/(dashboard)/profile/page.tsx))**:
  - *Data Portability*: 1-click download of personal data in structured JSON format ([`/api/user/export-data`](file:///d:/Projects/pachas/src/app/api/user/export-data/route.ts)).
  - *Right to Erasure / Right to be Forgotten*: Modal ([`DeleteAccountModal.tsx`](file:///d:/Projects/pachas/src/components/profile/DeleteAccountModal.tsx)) with double verification to permanently delete accounts and purge personal data ([`/api/user/delete-account`](file:///d:/Projects/pachas/src/app/api/user/delete-account/route.ts)).
- **FR-26.9**: **Cookie Consent Banner ([`CookieConsentBanner.tsx`](file:///d:/Projects/pachas/src/components/legal/CookieConsentBanner.tsx))**:
  - Informative banner on first visit explaining technical storage and linking to cookie policies.
- **FR-26.10**: **Unified Global Footer ([`Footer.tsx`](file:///d:/Projects/pachas/src/components/layout/Footer.tsx))**:
  - Consistent footer with direct links to `/terms`, `/privacy`, `/cookies`, and `/legal` across landing, registration, profile, and legal pages.

### 🧮 FR-27: Step-by-Step Mathematical Balance Audit with Virtual Calculator
- **FR-27.1**: **Dedicated Audit Page (`/groups/[id]/audit`)**:
  - Full mathematical transparency walkthrough providing sequential step-by-step verification of how a member's net balance was computed.
- **FR-27.2**: **Audited Member Switcher**:
  - Ability to audit the current user or switch to any other group member to verify their personal balance calculation.
- **FR-27.3**: **Sequential Calculation Phases with Dual/Triple Formula Breakdown**:
  - *Phase 1*: Initial setup and final target balance statement.
  - *Phase 2*: Individual and shared payments fronted by the user ($\sum \text{Paid}$) with distinct `+ MONEY ADVANCED` badge, rich natural language description detailing original ticket value, and payment subtotal summary.
  - *Phase 3*: Consumption quotas participated in by the user ($\sum \text{Consumed}$) with distinct `- CONSUMPTION SHARE` badge, original ticket value in natural language, **arithmetic breakdown** (Step A: ticket division $\text{Ticket} \div N$, and Step B: addition to running total consumed $\text{Prev} + \text{Share}$), and consumption subtotal summary.
  - *Phase 4*: Gross balance calculation ($\text{Total Paid} - \text{Total Consumed} = \text{Gross Balance}$).
  - *Phase 5*: Direct settlements and Bizum transfers already executed ($\sum \text{Sent} - \sum \text{Received}$).
  - *Phase 6*: Final verified net balance and debt minimization settlement plan with mathematical zeroing proof.
- **FR-27.4**: **Final Settlement Sum & Balance Zeroing Proof ($0{,}00\text{ €}$)**:
  - Phase 6 incorporates a dual mathematical proof:
    - *Step A (Sum of Pending Transfers)*: Sum of all transfers to receive (for creditors) or pay (for debtors) with 1-click **"Load Transfers Sum"** button.
    - *Step B (Proof of Zero Balance)*: Arithmetic balance zeroing equation ($\text{Net Balance} \pm \text{Total Transfers} = 0{,}00\text{ €}$) with 1-click **"Load Zero Proof"** button proving that all accounts are 100% squared.
- **FR-27.5**: **Currency Conversion & Exchange Rate Verification**:
  - For expenses in foreign currencies (USD, JPY, GBP, etc.): Dedicated currency conversion arithmetic step ($\text{Original Amount} \times \text{Exchange Rate} = \text{Base Amount}$) with applied rate badge and 1-tap **"Load Conversion"** button into the virtual calculator.
- **FR-27.6**: **Interactive Virtual Calculator ([`VirtualCalculator.tsx`](file:///d:/Projects/pachas/src/components/calculator/VirtualCalculator.tsx))**:
  - Digital LCD display with formula history, full touch keypad, and physical keyboard numpad support.
  - 1-click buttons (**"Load Conversion"**, **"Load Division"**, **"Load Addition"**, **"Load Transfers Sum"**, **"Load Zero Proof"**) copying exact mathematical expressions directly into the calculator display for instant verification.
- **FR-27.7**: **Navigation & Access Points**:
  - Direct option in Group Tools Submenu (`GroupActionMenu.tsx`) and quick-access banner in Balances Summary (`BalanceSummary.tsx`).

### 💱 FR-28: Reliable Real-Time & Historical Exchange Rate Engine and Group Base Currency Recalculation
- **FR-28.1**: **Official Exchange Rate Integration (Frankfurter / European Central Bank & Fallbacks)**:
  - Connects to the European Central Bank (ECB) daily fixing dataset via Frankfurter API for exact historical rates on the date of each expense, with Open Exchange Rates and local matrix fallbacks.
- **FR-28.2**: **Automatic Form Rate Fetching ([`ExpenseForm.tsx`](file:///d:/Projects/pachas/src/components/expenses/ExpenseForm.tsx))**:
  - When selecting a foreign currency or modifying the expense date, automatically fetches and populates the official exchange rate for that exact day.
  - Displays official rate badge with provider and date details, and a 1-tap **Reset Official Rate** button if custom values were entered.
- **FR-28.3**: **Automatic Group Base Currency Recalculation ([`EditGroupModal.tsx`](file:///d:/Projects/pachas/src/components/groups/EditGroupModal.tsx) & [`PachasContext.tsx`](file:///d:/Projects/pachas/src/context/PachasContext.tsx))**:
  - Changing the base currency of a group triggers an automated batch recalculation of all expenses:
    - Queries official historical exchange rates for each expense's transaction date.
    - Updates converted amounts and recalculates participant quota shares (`amount_owed`) across all split types (`EQUAL`, `EXACT`, `PERCENTAGE`, `SHARES`).
    - Persists changes to the database and synchronizes local state.
- **FR-28.4**: **Centralized Daily Exchange Rates Cache (`public.exchange_rates`)**:
  - Global PostgreSQL table (`public.exchange_rates`) storing conversion rates indexed by `(base_currency, target_currency, rate_date)`.
  - Ensures each daily exchange rate is downloaded from external services only once and reused across all trips, groups, and expenses.
  - Automatic upsert on expense creation/editing for newly introduced dates and currencies.
- **FR-28.5**: **Database Schema Normalization & Migrations**:
  - Removal of redundant `exchange_rate` and `converted_amount` columns from `public.expenses` to maintain a single source of truth.
  - Provided migration scripts: `01-schema.sql` (canonical schema), `02-migration-exchange-rates.sql` (rate cache table), `03-cleanup-redundant-columns.sql` (schema normalization), and `04-push-notifications.sql` (push subscriptions).

### 📶 FR-29: Enhanced Offline PWA Mode (Service Worker Cache-First)
- **FR-29.1**: **Full Cache-First Strategy**:
  - Service Worker (`public/sw.js`) precaches core assets and applies stale-while-revalidate / cache-first strategies for scripts, CSS, fonts, and images.
- **FR-29.2**: **Offline HTML Navigation**:
  - Visited pages serve immediately from cache with graceful offline fallbacks.
- **FR-29.3**: **Automatic Offline Status Indicator**:
  - Client component (`ServiceWorkerRegister.tsx`) detecting offline transitions and rendering a non-intrusive status banner.

### 🔔 FR-30: Granular WebPush & Mobile Push Notifications (Opt-in by Default)
- **FR-30.1**: **Default Disabled (Opt-In Policy)**:
  - All existing and new group memberships start with `notifications_enabled = false` to respect user privacy and avoid unsolicited alerts.
- **FR-30.2**: **Opt-in on Group Join (`/join/[inviteCode]`)**:
  - Interactive toggle allowing users to enable push notifications for the group before joining.
- **FR-30.3**: **Granular In-Group Toggling**:
  - 1-click toggle directly in the Group Tools Submenu (`GroupActionMenu.tsx`) and in Group Settings (`EditGroupModal.tsx`).
- **FR-30.4**: **Automated Activity Dispatching**:
  - Triggers push notifications on new expenses and settlements exclusively to subscribed group members with `notifications_enabled = true`.

### 📷 FR-31: Intelligent Receipt Vision Scanning with Google Gemini 1.5 Flash (Free Tier) & Local Fallback
- **FR-31.1**: **Multimodal Vision AI Backend ([`/api/ocr/scan`](file:///d:/Projects/pachas/src/app/api/ocr/scan/route.ts))**:
  - Integration with **Google Gemini 1.5 Flash** vision model via REST API (`GEMINI_API_KEY`), delivering ~99% parsing precision on real smartphone photos (thermal ink, skewed angles, wrinkles, shadows).
  - Free Tier utilization (up to 15 requests per minute free via Google AI Studio).
  - Guarantees structured JSON output `{ title, amount, amountFormatted, date, category, currency }`.
- **FR-31.2**: **Resilient Hybrid Fallback Engine ([`receiptScanner.ts`](file:///d:/Projects/pachas/src/lib/ocr/receiptScanner.ts))**:
  - Automatically queries the Gemini 1.5 Flash Vision endpoint first.
  - If no API key is configured or the device is offline, gracefully switches to local `tesseract.js` OCR and heuristic text extraction without throwing user errors.
- **FR-31.3**: **Hero Scan Card & 1-Click Autofill Banner ([`ExpenseForm.tsx`](file:///d:/Projects/pachas/src/components/expenses/ExpenseForm.tsx))**:
  - Prominent top action card with 📸 **"Hacer foto al ticket"** (`capture="environment"`) and 🖼️ **"Subir archivo"**.
  - Visual badge indicating model source (`✨ Gemini 1.5 Flash` vs `IA OCR`).
  - 1-click **"Autocompletar gasto"** button filling title, amount, date, and category in seconds.

### 💬 FR-32: In-Expense Discussion Threads & Comments
- **FR-32.1**: **Discussion Thread Section ([`ExpenseCommentsSection.tsx`](file:///d:/Projects/pachas/src/components/expenses/ExpenseCommentsSection.tsx))**:
  - Interactive comment feed in expense details allowing trip members to leave notes, clarifications, or itemize specific consumptions.
- **FR-32.2**: **PostgreSQL Persistence & Offline Cache**:
  - Relational table `public.expense_comments` (`05-expense-comments.sql`) with foreign keys and cascade deletion.
  - Offline sync with `localStorage` (`pachas_expense_comments_v2`) and optimistic local updates.
- **FR-32.3**: **Comments Counter Badge ([`ExpenseCard.tsx`](file:///d:/Projects/pachas/src/components/expenses/ExpenseCard.tsx))**:
  - Visual badge with comment count (`💬 N`) on each expense card in the trip list.

---

## ⚙️ 2. Non-Functional Requirements (NFR)

- **NFR-01**: **Mobile-First Design**: Native app-like experience on mobile phones with bottom navigation bar (`BottomNav`) and desktop responsiveness.
- **NFR-02**: **PWA (Progressive Web App)**: Web App Manifest configured for installation on mobile home screens.
- **NFR-03**: **Security & RLS**: Row Level Security policies in PostgreSQL ensuring that no non-member can read or modify group data.
- **NFR-04**: **Persistence & Offline Mode**: Interactive `localStorage` state acting as an immediate resilient layer with backend synchronization.
- **NFR-05**: **Internationalization (i18n)**: Full multi-language dictionary architecture supporting 19 languages with RTL support for Arabic.
- **NFR-06**: **Regulatory & GDPR Compliance**: Full alignment with European General Data Protection Regulation (GDPR / LOPDGDD) and LSSI-CE.

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
| **24/08/2026** | 📍 Added | **FR-11.11 & FR-09.2** | CSV export/import of establishment locations, GPS coordinates (or European comma syntax), and Google Maps URLs, with preview pin indicators and updated sample templates. |
| **24/08/2026** | 🗺️ Added | **FR-13.3** | Dedicated interactive map (`TripInteractiveMap`) rendering exclusively trip establishments (no third-party places), interactive popups (fichas), route line toggle, KML export for Google My Maps / Earth, and individual venue Google Maps links. |
| **24/08/2026** | 📱 Added | **FR-22** | Mobile readiness: Complete Progressive Web App (PWA) configuration with manifest and icons, plus native store packaging setup with Capacitor.js and guide (`deploy/MOBILE.md`). |
| **28/08/2026** | 🌐 Added | **FR-23** | Complete internationalization (i18n) framework supporting 19 languages with country flag badges, RTL support, and automated dictionary verification test suite. |
| **28/08/2026** | ☕ Added | **FR-24** | Configurable voluntary donations system (Buy Me a Coffee) with API integration and profile cards. |
| **28/08/2026** | 🔐 Fixed & Added | **FR-25** | Robust authentication, dynamic HTTP/HTTPS session cookie resolution (`secure: isHttps`), case-insensitive email queries, session sync (`/api/auth/session`), and password recovery mailer with SMTP/Resend/SendGrid support. |
| **29/08/2026** | ⚖️ Added | **FR-26** | Complete legal framework and GDPR compliance: Terms of Service, Privacy Policy, Cookie Policy, Legal Notice, mandatory registration consent, receipt safety warnings, content reporting (`/api/reports`), personal data portability (`/api/user/export-data`), right to erasure (`/api/user/delete-account`), cookie consent banner, and global footer. |
| **29/08/2026** | 🌟 Changed | **FR-04.6** | Group page action hierarchy redesign: Prominent primary **Add Expense** button, secondary **Invite Friends** button, and organized dropdown **Submenu** for remaining tools (Routes, Charts, Import, PDF, CSV, Settings). |
| **29/08/2026** | 🧮 Added | **FR-27** | Step-by-step mathematical balance audit with interactive virtual calculator (`/groups/[id]/audit`): sequential proof of payments, consumptions, and settlements with 1-tap formula loading into calculator. |
| **29/08/2026** | 🖼️ Fixed | **FR-03.5** | Fixed profile photo, name, and Bizum phone persistence in PostgreSQL database (`PUT /api/auth/me` updating `public.profiles`). |
| **29/08/2026** | 💱 Added | **FR-28** | Real-time & historical exchange rate engine (European Central Bank / Frankfurter + Open Exchange Rates), auto-fetching by transaction date in expense form, and batch recalculation of group expenses on base currency change. |
| **29/08/2026** | 🗄️ Added | **FR-28.4 & FR-28.5** | Centralized `public.exchange_rates` daily cache table (download rate once by date and reuse globally across all trips), database schema cleanup of redundant columns in `public.expenses`, and migrations catalog. |
| **29/08/2026** | 📶 Added | **FR-29** | Full offline PWA mode with Cache-First Service Worker (`public/sw.js`), asset precaching, offline navigation, and connection status indicator. |
| **29/08/2026** | 🔔 Added | **FR-30** | Granular WebPush & mobile push notification system with opt-in defaults (`notifications_enabled = false`), joining checkbox, in-group toggling in submenu & settings, and auto-dispatch on new expenses/settlements. |
| **29/08/2026** | ⚡ Changed | **Next.js 16 Proxy Migration** | Migrated deprecated `src/middleware.ts` to `src/proxy.ts` conforming to the Next.js 16 proxy convention. |
| **30/08/2026** | 🖼️ Fixed | **Favicon 404 Resolution** | Generated multi-resolution `favicon.ico` (16x16, 32x32, 48x48) in `public/` and `src/app/`, updated `metadata.icons`, and added to Service Worker static cache. |
| **30/08/2026** | ⚡ Fixed | **React Hydration Error #418** | Resolved SSR hydration mismatch: aligned initial `currentUser` state between server and client, and added `suppressHydrationWarning` to `<html>` and `<body>` in root layout. |
| **30/08/2026** | 🖼️ Fixed | **Profile Save Hanging Fix** | Resolved infinite AJAX hang on saving profile picture: added `isSupabaseConfigured()` guard preventing network requests to placeholder URLs, added 6s AbortController timeout to `/api/auth/me`, implemented `INSERT ON CONFLICT DO UPDATE` upsert on `public.profiles`, and wrapped `handleSave` in `try...finally { setIsLoading(false) }`. |
| **30/08/2026** | 🌐 Changed | **Searchable Language Selector Control** | Upgraded `LanguageSelector` in Profile Page and global dropdowns: added live search filter, responsive scroll-capped grid layout (`variant="grid"`), native/English names, flag badges, and max-height scrolling to prevent viewport overflow. |
| **30/08/2026** | 📄 Fixed | **PDF Export Emoji Encoding Artifacts** | Resolved `Ø=Üd` corruption in PDF friend breakdown caused by Unicode emoji (`👤`) decomposition in standard jsPDF WinAnsi fonts: replaced with vector bullet rendering, added `cleanPdfText` sanitization for all participant names and titles, and added automated test suite. |
| **30/08/2026** | 🧾 Fixed | **Receipt Viewer Blank Tab & Modal Integration** | Fixed empty browser tab issue when viewing compressed Base64 tickets (`data:` URLs blocked by browser top-level navigation): integrated in-app `ReceiptModal` lightbox directly in `ExpenseForm`, added safe HTML document stream opener for new tabs, and added ticket image download option. |
| **30/08/2026** | 📅 Fixed | **Standard European Date Format (`dd/MM/yyyy`)** | Enforced strict `dd/MM/yyyy HH:mm` standard date format across all views: replaced browser-native `<input type="datetime-local">` in read-only expense details with clean European formatted text badge (`dd/MM/yyyy HH:mm`), updated `formatLocaleDate` to eliminate `MM/DD/YYYY` output, and added automated test suite. |
| **30/08/2026** | 📷 Added | **FR-31** | **Intelligent Receipt OCR Scanning with AI**: Client-side optical character recognition (`tesseract.js`), automatic extraction of monetary total, transaction date, merchant title and category heuristics, with interactive 1-click autofill banner in `ExpenseForm`. |
| **30/08/2026** | 💬 Added | **FR-32** | **In-Expense Discussion Threads & Comments**: Comment feed on expenses (`ExpenseCommentsSection`), counter badge on expense cards (`💬 N`), database migration `05-expense-comments.sql`, REST API `/api/expenses/[id]/comments`, and 19-language translations. |
| **30/08/2026** | 🐛 Fixed | **FR-32** | **Comment Submission Form Event Isolation**: Replaced nested `<form>` in `ExpenseCommentsSection` with event-isolated `<div>` and `type="button"` with `e.stopPropagation()`, preventing comment submission from prematurely closing the parent expense editing modal. |
| **30/08/2026** | 🔔 Fixed | **FR-30** | **Notification Preferences Resilient Query & Auto-Migration**: Added automatic table/column auto-healing (`ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS notifications_enabled...`) in `GET /api/notifications/preferences`, string type-casting (`group_id::text = $1::text`), and graceful non-blocking fallback avoiding HTTP 500 errors. |
| **30/08/2026** | 🛡️ Fixed | **FR-31** | **CSP Web Worker & Blob Authorization for OCR**: Updated `next.config.mjs` Content-Security-Policy headers adding `worker-src 'self' blob:;`, `child-src 'self' blob:;`, and CDN connections, allowing `tesseract.js` OCR background workers to execute without browser security violations. |
| **30/08/2026** | 🛡️ Fixed | **FR-31** | **CSP `script-src` / `script-src-elem` CDN Authorization**: Added `https://cdn.jsdelivr.net` and `https://tessdata.projectnaptha.com` to `script-src` and `script-src-elem` in `next.config.mjs`, permitting `tesseract.js` workers to dynamically load `worker.min.js` and language dictionary models without `importScripts` NetworkErrors. |
| **30/08/2026** | 📸 Added | **FR-04.4 & FR-31** | **Direct Mobile Camera Receipt Capture**: Added dedicated **"Hacer foto"** (`capture="environment"`) camera button alongside **"Subir archivo"** in `ExpenseForm`, and enabled `camera=(self)` in `Permissions-Policy` HTTP security headers, allowing instant mobile camera capture and subsequent AI OCR autofill. |
| **30/08/2026** | 🌟 Changed | **FR-04.4 & FR-31** | **Top Hero Quick-Scan Card in Add Expense**: Positioned the **"Hacer foto al ticket"** camera action and AI OCR scanning card at the very top of `ExpenseForm`, allowing users to photograph physical receipts immediately upon opening the modal and auto-populate title, amount, date, and category in 1 tap before typing. |
| **30/08/2026** | 🤖 Added | **FR-31** | **Google Gemini 1.5 Flash Vision Multimodal Extraction**: Created `/api/ocr/scan` route integrating Google Gemini 1.5 Flash (~99% precision, free tier 15 RPM) for high-accuracy receipt extraction with structured JSON schemas, visual model badge (`✨ Gemini 1.5 Flash`), and automatic graceful fallback to local `tesseract.js` when offline or unconfigured. |

