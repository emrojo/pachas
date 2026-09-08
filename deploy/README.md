# 🐳 Pachas Deployment & Production Hardening Guide

Complete guide for containerization, security hardening, orchestration, and production deployment of **Pachas** and its dependent services using **Docker Stack** (Docker Swarm Mode), **Docker Compose**, or **Native Mobile Packaging (Capacitor)**.

---

## 🏗️ Secure Production Stack Architecture

The [`docker-stack.yml`](./docker-stack.yml) and [`docker-compose.yml`](./docker-compose.yml) files define the following hardened microservices topology:

```
                  ┌─────────────────────────────────┐
                  │    Ingress / Port 80 & 443      │
                  │   Hardened Nginx Reverse Proxy  │
                  │  (Rate Limiting + CSP + SSL)    │
                  └──────────────┬──────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        Internal Proxy                  Internal Proxy
        Port 3000 (HTTP)                Port 3001 (REST)
                 │                               │
                 ▼                               ▼
       ┌───────────────────┐           ┌───────────────────┐
       │    pachas_app     │           │ pachas_postgrest  │
       │ (Next.js Stand-   │           │ (Auto REST API    │
       │  alone 2 Replicas)│           │  over Postgres)   │
       └─────────┬─────────┘           └─────────┬─────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │ Internal Encrypted Overlay Network
                                 ▼
                       ┌───────────────────┐
                       │  pachas_postgres  │
                       │ (PostgreSQL 15 +  │
                       │  Hardened RLS)    │
                       └─────────┬─────────┘
                                 │
                           [Data Volume]
```

### Included Services:
1. **`pachas_proxy` (Nginx Alpine)**:
   - Point of entry with rate limiting (5 req/s on auth endpoints, 30 req/s general).
   - Injects security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
   - Static asset caching and compression (Gzip/Brotli).
2. **`pachas_app`**:
   - Next.js 14 web application compiled in `standalone` mode (Alpine Linux).
   - Scaled with multiple replicas (default 2) with zero-downtime rolling updates.
   - Built-in CSP, HTTPS redirection, and secure cookies.
3. **`pachas_postgres`**:
   - PostgreSQL 15 relational database server with Row Level Security (RLS) on all tables.
   - Auto-initializes schema, tables, triggers, and granular RLS policies (`init-scripts/01-schema.sql`).
4. **`pachas_postgrest`**:
   - RESTful API layer over PostgreSQL for fast data access.

---

## 📁 Directory Structure `deploy/`

```
deploy/
├── Dockerfile                  # Multi-stage build optimized for Next.js standalone
├── .dockerignore               # File filter to accelerate builds
├── CICD-GUIDE.md               # Continuous Integration & Continuous Deployment (GHCR + SSH)
├── docker-stack.yml            # Production Swarm Stack specification with Nginx Proxy
├── docker-compose.yml          # Local / Dev Compose specification with Nginx Proxy
├── docker-compose.prod.yml     # Hardened Production Compose specification consuming GHCR image
├── env.example                 # Environment variables template with security flags
├── generate-secrets.mjs        # Cryptographic secrets generator (PostgreSQL, JWT)
├── generate-secrets.ps1        # PowerShell wrapper for secrets generator
├── rotate-secrets.mjs          # Cryptographic secrets rotation engine with pre-validation & reload
├── rotate-secrets.ps1          # PowerShell wrapper for secrets rotation
├── rotate-secrets.sh           # Bash wrapper for secrets rotation
├── pachas.service              # Linux systemd production service unit template
├── build-native.ps1            # Automated native build pipeline for Windows (Android/iOS)
├── build-native.sh             # Automated native build pipeline for Linux/macOS
├── deploy.sh                   # Automated deployment script for Linux/macOS (Swarm)
├── deploy.ps1                  # Automated deployment script for Windows PowerShell
├── remote-deploy.sh            # Automated remote deployment & rollback engine for SSH CI/CD
├── reset-db.sh                 # Database reset script for Linux/macOS
├── reset-db.ps1                # Database reset script for Windows PowerShell
├── README.md                   # This guide
├── MOBILE.md                   # Mobile native (Capacitor) & PWA guide
├── nginx/
│   ├── nginx.conf              # Global Nginx performance & rate limiting config
│   └── default.conf            # Virtual host with auth brute-force protection
└── init-scripts/
    ├── 01-schema.sql           # SQL schema with tables, triggers, and full RLS policies
    └── reset-db.sql            # Clean database truncate script
```

---

## 🔐 Rotación de Secretos, Invalidación y Recarga en Caliente

En caso de sospecha o confirmación de credenciales comprometidas, Pachas incluye un motor de rotación determinista (`node deploy/rotate-secrets.mjs` o `npm run secrets:rotate`) que permite rotar secretos individualmente o de forma masiva, actualizando tanto `.env.local` como `deploy/.env.production`, con **revalidación previa estricta, rollback automático ante fallos y recarga en caliente del servicio en ejecución**.

### Comandos de Rotación:
```bash
# Modo interactivo asistido:
npm run secrets:rotate

# Rotación masiva de emergencia (Local):
npm run secrets:rotate:all

# Rotación masiva en Producción con recarga automática:
npm run secrets:rotate:prod

# Rotación en Producción forzando recarga de systemd (pachas.service):
npm run secrets:rotate:systemd
```

### Tabla de Invalidación de Credenciales:
| Secreto / Clave | ¿Desactiva la anterior de inmediato? | Comportamiento Técnico |
|---|:---:|---|
| **`JWT_SECRET`** | **SÍ (Inmediata y total)** | Invalida al instante todas las sesiones activas y cookies previas. Todos los usuarios deben iniciar sesión de nuevo. |
| **`POSTGRES_PASSWORD`** | **SÍ (Inmediata en motor SQL)** | Ejecuta `ALTER USER ... WITH PASSWORD` en PostgreSQL. La contraseña previa queda destruida en la base de datos. |
| **`VAPID_KEYS` (WebPush)** | **SÍ (Invalida suscripciones previas)** | Genera nuevo par elíptico. Requiere que los navegadores renueven la suscripción push. |
| **Contraseñas de Cuenta** | **SÍ (Inmediata)** | Sobreescribe el hash criptográfico del usuario en `auth.users`. |
| **Google Gemini API Key** | **NO en Google (Acción requerida)** | Requiere entrar a [Google AI Studio](https://aistudio.google.com/app/apikey) y pulsar **Delete / Revoke** en la clave anterior. |
| **Pexels API Key** | **NO en Pexels (Acción requerida)** | Requiere revocar o regenerar en el portal de [Pexels API](https://www.pexels.com/api/). |
| **SMTP / Resend / SendGrid** | **NO en proveedor (Acción requerida)** | Requiere borrar la App Password de Google o la API Key comprometida en el panel de Resend/SendGrid. |

### Ciclo de Seguridad: Revalidación Previa y Rollback
1. **Copia de Respaldo**: Antes de tocar ningún archivo, crea un backup timestamped (ej. `.env.production.bak-YYYYMMDD-HHMMSS`).
2. **Revalidación Estricta**: Verifica formato, sintaxis, longitud mínima y realiza una prueba de conexión handshake con PostgreSQL.
3. **Rollback Automático**: Si la validación falla, restaura el `.bak` inmediatamente y cancela el reinicio de servicios para evitar caídas.
4. **Recarga de Servicio**: Detecta automáticamente si la aplicación corre bajo **`pachas.service`** (systemd), **PM2** o **Docker**, ejecutando el reinicio seguro y comprobando la respuesta HTTP (healthcheck).

---

## 🔒 Production Security Quickstart

### 1. Generate High-Entropy Cryptographic Secrets
Generate strong random keys and create `deploy/.env.production`:
```bash
# Node.js:
node deploy/generate-secrets.mjs

# Or PowerShell:
.\deploy\generate-secrets.ps1
```

### 2. Deploy the Stack
```powershell
# Windows (PowerShell):
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\deploy\deploy.ps1

# Linux / macOS:
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

---

## ⚡ Native Node.js Production Mode (Standalone & Cluster)

If you prefer to run Pachas natively on a Node.js server (e.g. Bare Metal, VPS, AWS EC2, DigitalOcean) without Docker:

### 1. Standalone Single-Process Production Server:
```powershell
# Windows:
.\deploy\start-node-prod.ps1

# Linux / macOS / NPM:
npm run start:prod
```
- Automatically prepares static assets into `.next/standalone/`.
- Loads `deploy/.env.production`.
- Enables production security headers and graceful process shutdown.

### 2. Multi-Core Cluster Mode with PM2:
```bash
# Start cluster across all CPU cores:
npm run prod:cluster

# View live cluster status & CPU/RAM metrics:
npx pm2 status

# Stream production logs:
npx pm2 logs pachas-prod

# Graceful reload / stop:
npm run prod:stop
```

---

## 📱 Mobile Native Production Builds (Android & iOS)

To build the secure native application wrapper with Capacitor:

```powershell
# Build Android Standalone Bundle:
.\deploy\build-native.ps1 -Platform android

# Build Android with Live Production HTTPS Server:
.\deploy\build-native.ps1 -Platform android -ServerUrl "https://pachas.yourdomain.com"

# Build iOS Release (macOS):
./deploy/build-native.sh ios "https://pachas.yourdomain.com"
```

For complete store submission steps, see [`MOBILE.md`](./MOBILE.md).

---

## 🧹 Database Reset and Clean Slate for Production

To **wipe all test data and leave the database completely clean** for official deployment:

### Option 1: Automated 1-Click Reset Script
- **On Windows (PowerShell):**
  ```powershell
  .\deploy\reset-db.ps1
  ```
- **On Linux / macOS:**
  ```bash
  chmod +x deploy/reset-db.sh
  ./deploy/reset-db.sh
  ```

---

## 🌐 Exposed Ports

| Service | Host Port | Description |
|---|---|---|
| **Nginx Reverse Proxy** | `http://localhost:80` / `:443` | Main secure ingress with Rate Limiting |
| **Next.js Web App** | `http://localhost:3000` | Application container (internal) |
| **PostgREST API** | `http://localhost:3001` | REST API (internal proxy routing) |

