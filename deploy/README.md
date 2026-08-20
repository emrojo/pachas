# 🐳 Pachas Deployment with Docker Stack (Docker Swarm)

Complete guide for containerization, orchestration, and production deployment of **Pachas** and its dependent services using **Docker Stack** (Docker Swarm Mode) or **Docker Compose**.

---

## 🏗️ Stack Services Architecture

The [`docker-stack.yml`](./docker-stack.yml) file defines the following microservices topology:

```
                  ┌─────────────────────────────────┐
                  │    Ingress / Load Balancer      │
                  └──────────────┬──────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
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
                                 │ Internal Overlay Network
                                 ▼
                       ┌───────────────────┐
                       │  pachas_postgres  │
                       │  (PostgreSQL 15 + │
                       │   Pachas Schema)  │
                       └─────────┬─────────┘
                                 │
                           [Data Volume]
```

### Included Services:
1. **`pachas_app`**:
   - Next.js 14 web application compiled in `standalone` mode using an ultra-lightweight image (Alpine Linux).
   - Scaled with multiple replicas (default 2) with built-in load balancing and zero-downtime rolling updates.
   - Active healthcheck configured every 20s.
2. **`pachas_postgres`**:
   - PostgreSQL 15 relational database server.
   - Automatically executes the initialization script [`init-scripts/01-schema.sql`](./init-scripts/01-schema.sql) which creates tables, functions, triggers, and Row Level Security (RLS) policies on first boot.
   - Persistent storage backed by named volume `postgres_data`.
3. **`pachas_postgrest`**:
   - RESTful API layer over PostgreSQL for data access.
4. **`pachas_network`**:
   - Isolated and encrypted overlay network for internal container-to-container communication.

---

## 📁 Directory Structure `deploy/`

```
deploy/
├── Dockerfile                  # Multi-stage build optimized for Next.js standalone
├── .dockerignore               # File filter to accelerate builds
├── docker-stack.yml            # Official specification for Docker Swarm (Stack)
├── docker-compose.yml          # Specification for local development / simple Compose
├── env.example                 # Environment variables template
├── deploy.sh                   # Automated deployment script for Linux/macOS
├── deploy.ps1                  # Automated deployment script for Windows PowerShell
├── reset-db.sh                 # Database reset script for Linux/macOS
├── reset-db.ps1                # Database reset script for Windows PowerShell
├── README.md                   # This guide
└── init-scripts/
    ├── 01-schema.sql           # SQL schema with tables, functions, triggers, and RLS
    └── reset-db.sql            # Clean database truncate script
```

---

## 🚀 Quick Deployment (1 Command)

### On Linux / macOS:
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### On Windows (PowerShell):
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\deploy\deploy.ps1
```

---

## 🛠️ Step-by-Step Manual Deployment (Docker Stack)

### 1. Initialize Docker Swarm (if not active)
```bash
docker swarm init
```

### 2. Configure Environment Variables
Copy the template and adjust values if needed:
```bash
cp deploy/env.example deploy/.env.production
```

### 3. Build Application Docker Image
```bash
docker build -f deploy/Dockerfile -t pachas:latest .
```

### 4. Deploy the Stack to the Cluster
```bash
docker stack deploy -c deploy/docker-stack.yml pachas
```

---

## 📊 Management and Monitoring Commands

### Check Stack services status:
```bash
docker stack services pachas
```

### List running containers / tasks:
```bash
docker stack ps pachas
```

### View real-time application logs:
```bash
docker service logs -f pachas_app
```

### View PostgreSQL database logs:
```bash
docker service logs -f pachas_postgres
```

### Scale web application replicas:
```bash
docker service scale pachas_app=4
```

### Zero-downtime rolling update:
```bash
# After building a new image version:
docker service update --image pachas:latest --update-parallelism 1 --update-delay 10s pachas_app
```

### Remove / Teardown the Stack:
```bash
docker stack rm pachas
```

---

## 🧪 Alternative Deployment with Docker Compose (Local Dev)

If you prefer to start services without enabling Docker Swarm, run:

```bash
# Start services in background
docker compose -f deploy/docker-compose.yml up -d --build

# View logs
docker compose -f deploy/docker-compose.yml logs -f

# Stop services
docker compose -f deploy/docker-compose.yml down
```

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

### Option 2: Manual Reset via Docker Commands
```bash
# 1. Stop and remove the stack
docker stack rm pachas

# 2. Remove the persistent PostgreSQL data volume
docker volume rm pachas_postgres_data

# 3. Redeploy (auto-initializes clean schema from scratch)
./deploy/deploy.sh       # On Linux/macOS
.\deploy\deploy.ps1      # On Windows PowerShell
```

### Option 3: Hot-Truncate Tables with SQL (without stopping services)
```bash
docker exec -i $(docker ps -q -f name=pachas_postgres) psql -U pachas_admin -d pachas -f /docker-entrypoint-initdb.d/reset-db.sql
```

---

## 🌐 Exposed Ports

| Service | Host Port | Description |
|---|---|---|
| **Web App (Pachas)** | `http://localhost:3000` | Next.js User Interface |
| **PostgREST API** | `http://localhost:3001` | REST API for data |
| **PostgreSQL** | `localhost:5432` | Relational database (Compose) |
