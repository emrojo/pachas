# 🐳 Despliegue de Pachas en Docker Stack (Docker Swarm)

Guía completa para la contenedorización, orquestación y despliegue de **Pachas** y sus servicios dependientes utilizando **Docker Stack** (Docker Swarm Mode) o **Docker Compose**.

---

## 🏗️ Arquitectura de Servicios en el Stack

El archivo [`docker-stack.yml`](./docker-stack.yml) define la siguiente topología de microservicios:

```
                  ┌─────────────────────────────────┐
                  │    Ingress / Load Balancer      │
                  └──────────────┬──────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        Puerto 3000 (HTTP)              Puerto 3001 (REST)
                 │                               │
                 ▼                               ▼
       ┌───────────────────┐           ┌───────────────────┐
       │    pachas_app     │           │ pachas_postgrest  │
       │ (Next.js Stand-   │           │ (API REST auto-   │
       │  alone 2 Replicas)│           │  mática Postgres) │
       └─────────┬─────────┘           └─────────┬─────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │ Red Interna Overlay
                                 ▼
                       ┌───────────────────┐
                       │  pachas_postgres  │
                       │  (PostgreSQL 15 + │
                       │   Esquema Pachas) │
                       └─────────┬─────────┘
                                 │
                           [Volumen Data]
```

### Servicios incluidos:
1. **`pachas_app`**:
   - Aplicación web Next.js 14 compilada en modo `standalone` con imagen ultra-ligera (Alpine Linux).
   - Escalado en múltiples réplicas (por defecto 2) con balanceo de carga interno y rolling updates con cero tiempo de inactividad (`zero-downtime`).
   - Configuración de *Healthcheck* activo cada 20s.
2. **`pachas_postgres`**:
   - Servidor de base de datos PostgreSQL 15.
   - Monta el script de inicialización [`init-scripts/01-schema.sql`](./init-scripts/01-schema.sql) que crea automáticamente todas las tablas, funciones, disparadores y políticas de seguridad RLS en el primer arranque.
   - Persistencia asegurada en el volumen nombrado `postgres_data`.
3. **`pachas_postgrest`**:
   - Capa API RESTful compatible con Supabase sobre la base de datos PostgreSQL.
4. **`pachas_network`**:
   - Red `overlay` cifrada y aislada para la comunicación interna entre contenedores.

---

## 📁 Estructura del Directorio `deploy/`

```
deploy/
├── Dockerfile                  # Multi-stage build optimizado para Next.js
├── .dockerignore               # Filtro de archivos para acelerar el build
├── docker-stack.yml            # Especificación oficial para Docker Swarm (Stack)
├── docker-compose.yml          # Especificación para desarrollo / Docker Compose simple
├── env.example                 # Plantilla de variables de entorno
├── deploy.sh                   # Script de despliegue automatizado para Linux/macOS
├── deploy.ps1                  # Script de despliegue automatizado para Windows PowerShell
├── README.md                   # Esta guía
└── init-scripts/
    └── 01-schema.sql           # Script SQL con esquemas, tablas y RLS
```

---

## 🚀 Despliegue Rápido (1 solo comando)

### En Linux / macOS:
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### En Windows (PowerShell):
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\deploy\deploy.ps1
```

---

## 🛠️ Despliegue Manual Paso a Paso (Docker Stack)

### 1. Inicializar Docker Swarm (si no está activo)
```bash
docker swarm init
```

### 2. Configurar Variables de Entorno
Copia la plantilla y ajusta los valores si es necesario:
```bash
cp deploy/env.example deploy/.env.production
```

### 3. Construir la Imagen Docker de la Aplicación
```bash
docker build -f deploy/Dockerfile -t pachas:latest .
```

### 4. Desplegar el Stack en el Cluster
```bash
docker stack deploy -c deploy/docker-stack.yml pachas
```

---

## 📊 Comandos de Gestión y Monitoreo

### Ver el estado de los servicios del Stack:
```bash
docker stack services pachas
```

### Listar los contenedores / tareas en ejecución:
```bash
docker stack ps pachas
```

### Ver los logs en tiempo real de la aplicación:
```bash
docker service logs -f pachas_app
```

### Ver los logs de la base de datos PostgreSQL:
```bash
docker service logs -f pachas_postgres
```

### Escalar réplicas de la aplicación web:
```bash
docker service scale pachas_app=4
```

### Actualizar la aplicación con cero tiempo de inactividad:
```bash
# Tras compilar una nueva versión de la imagen:
docker service update --image pachas:latest --update-parallelism 1 --update-delay 10s pachas_app
```

### Eliminar / Desmontar el Stack:
```bash
docker stack rm pachas
```

---

## 🧪 Despliegue Alternativo con Docker Compose (Desarrollo Local)

Si prefieres arrancar el entorno sin activar Docker Swarm, puedes usar:

```bash
# Arrancar servicios en segundo plano
docker compose -f deploy/docker-compose.yml up -d --build

# Ver logs
docker compose -f deploy/docker-compose.yml logs -f

# Detener servicios
docker compose -f deploy/docker-compose.yml down
```

---

## 🌐 Puertos Expuestos

| Servicio | Puerto Host | Descripción |
|---|---|---|
| **App Web (Pachas)** | `http://localhost:3000` | Interfaz de usuario Next.js |
| **PostgREST API** | `http://localhost:3001` | API REST para datos |
| **PostgreSQL** | `localhost:5432` | Base de datos relacional (Compose) |
