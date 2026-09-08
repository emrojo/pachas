# 🚀 Guía de CI/CD Estándar: GitHub Actions + GHCR + SSH Deploy

Esta guía describe cómo opera el pipeline automatizado de integración y despliegue continuo (CI/CD) de **Pachas**, cómo aprovisionar el servidor de producción (VPS) y cómo configurar los secretos en GitHub para habilitar despliegues seguros y con tolerancia a fallos (*zero-downtime* y *auto-rollback*).

---

## 🏛️ Visión General de la Arquitectura

```
  Desarrollador              GitHub Actions                GitHub Packages (GHCR)              Servidor de Producción (VPS)
       │                           │                                │                                      │
       ├─ git push main ──────────>│                                │                                      │
       │                           ├─ Job 1: Quality Gate           │                                      │
       │                           │   (tsc, vitest, audit)         │                                      │
       │                           │                                │                                      │
       │                           ├─ Job 2: Docker Buildx ────────>│                                      │
       │                           │   (Multi-stage + GHA Cache)    │  Push: ghcr.io/emrojo/pachas:sha     │
       │                           │                                │                                      │
       │                           ├─ Job 3: SSH Deploy ──────────────────────────────────────────────────>│
       │                           │   (appleboy/ssh-action)        │                                      │
       │                           │                                │       docker pull <image> <──────────┤
       │                           │                                │       npm run db:migrate             │
       │                           │                                │       docker compose up -d (reload)  │
       │                           │                                │       curl /api/health (check)       │
       │                           │<── Despliegue OK / Rollback ──────────────────────────────────────────┘
```

---

## 🔑 Paso 1: Configurar Secretos en GitHub

Ve a tu repositorio en GitHub:
👉 `Settings` > `Secrets and variables` > `Actions` > `New repository secret`

### Secretos Obligatorios:
| Secreto | Descripción | Ejemplo / Formato |
| :--- | :--- | :--- |
| `SSH_HOST` | Dirección IP pública o dominio FQDN de tu servidor VPS | `203.0.113.50` o `pachas.mi-dominio.com` |
| `SSH_USER` | Usuario en el servidor que ejecutará el despliegue | `deploy` (recomendado) o `ubuntu` |
| `SSH_KEY` | Clave privada SSH sin contraseña generada para CI/CD | Contenido de `~/.ssh/id_ed25519` (formato PEM / OpenSSH) |

### Secretos y Variables Opcionales:
| Variable / Secreto | Tipo | Descripción | Valor por defecto |
| :--- | :--- | :--- | :--- |
| `SSH_PORT` | Secret | Puerto SSH personalizado si no usas el puerto estándar 22 | `22` |
| `SSH_PASSPHRASE` | Secret | Frase de paso si tu clave SSH privada tiene cifrado | *(Vacío)* |
| `SERVER_APP_DIR` | Secret | Ruta absoluta en el servidor donde reside el proyecto | `/opt/pachas` |
| `CR_PAT` | Secret | Personal Access Token con permiso `read:packages` (requerido si el paquete GHCR es privado) | `${{ secrets.GITHUB_TOKEN }}` |
| `NEXT_PUBLIC_SUPABASE_URL` | Variable | URL pública del backend Supabase/PostgREST en producción | `http://localhost:3001` |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Variable | Correo del administrador inicial para el bundle compilado | `admin@pachas.local` |

---

## 🖥️ Paso 2: Aprovisionamiento del Servidor de Producción (Ubuntu / Debian)

Conéctate como `root` o con `sudo` a tu servidor VPS y sigue estos pasos:

### 1. Crear el usuario de despliegue dedicado
Para mayor seguridad, no utilices el usuario `root` para los despliegues:

```bash
# Crear usuario 'deploy'
sudo adduser --disabled-password --gecos "" deploy

# Asignar permisos para usar Docker sin sudo
sudo usermod -aG docker deploy
```

### 2. Generar el par de claves SSH en tu máquina local o servidor
Genera una clave Ed25519 de alta seguridad:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy-pachas" -f ./id_ed25519_deploy -N ""
```

- Copia el contenido de `id_ed25519_deploy.pub` (clave pública) en el servidor dentro de:
  `/home/deploy/.ssh/authorized_keys` con permisos correctos:
  ```bash
  sudo mkdir -p /home/deploy/.ssh
  sudo cat >> /home/deploy/.ssh/authorized_keys << 'EOF'
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... github-actions-deploy-pachas
  EOF
  sudo chmod 700 /home/deploy/.ssh
  sudo chmod 600 /home/deploy/.ssh/authorized_keys
  sudo chown -R deploy:deploy /home/deploy/.ssh
  ```
- Copia el contenido de `id_ed25519_deploy` (clave privada) y pégalo en el secreto **`SSH_KEY`** de GitHub.

### 3. Preparar el directorio de la aplicación en el servidor
```bash
sudo mkdir -p /opt/pachas
sudo chown -R deploy:deploy /opt/pachas

# Clonar o copiar los archivos del repositorio en /opt/pachas
sudo -u deploy git clone https://github.com/emrojo/pachas.git /opt/pachas
cd /opt/pachas

# Configurar el archivo de variables de producción
cp deploy/env.example deploy/.env.production
chmod 600 deploy/.env.production
```

> [!CAUTION]
> Edita `deploy/.env.production` en el servidor con tus contraseñas seguras (`POSTGRES_PASSWORD`, `JWT_SECRET`, claves SMTP, etc.). Puedes generarlas automáticamente en local o servidor con:
> ```bash
> node deploy/generate-secrets.mjs
> ```

---

## 🔒 Paso 3: Permisos del Registro de Paquetes GHCR

Por defecto, GitHub Actions tiene permiso de escritura (`packages: write`) en el repositorio.
Para que tu servidor VPS pueda descargar la imagen desde `ghcr.io`:

1. **Si el repositorio / paquete es público**:
   - No requiere autenticación adicional; `docker pull` funciona libremente.
2. **Si el paquete es privado**:
   - Crea un **Personal Access Token (Classic)** en tu cuenta GitHub (`Settings` > `Developer settings` > `Personal access tokens` > `Tokens (classic)`).
   - Marca la casilla **`read:packages`**.
   - Guárdalo en los secretos del repositorio con el nombre **`CR_PAT`**.
   - O bien, en el servidor ejecuta una única vez:
     ```bash
     echo "TU_TOKEN_PERSONAL" | docker login ghcr.io -u TU_USUARIO_GITHUB --password-stdin
     ```

---

## 🛡️ Características de Seguridad y Resiliencia del Pipeline

1. **CI Quality Gate**:
   - Verificación de tipos TypeScript con `tsc --noEmit`.
   - Ejecución de 33 archivos de test (168 pruebas unitarias y de integración).
   - Motor de auditoría criptográfica `deploy/security-audit.mjs` que valida que no existan fugas de credenciales ni cabeceras inseguras.
   - Si cualquiera falla, la compilación de la imagen y el despliegue SSH **se cancelan inmediatamente**.

2. **Imágenes Inmutables y Trazables**:
   - Cada imagen se etiqueta con el hash SHA del commit (`sha-4a2b6d...`), permitiendo identificar con precisión quirúrgica el código en ejecución.
   - La etiqueta `latest` se actualiza de forma automática en cada subida exitosa a `main`.

3. **Caché Acelerada de GitHub Actions**:
   - Usa `type=gha` en Buildx, reduciendo el tiempo de compilación y empaquetado de Docker a solo unos segundos en builds incrementales.

4. **Healthcheck Automático y Rollback**:
   - Tras actualizar el contenedor, el runner ejecuta sondeos HTTP a `/api/health` durante hasta 60 segundos.
   - Si el contenedor nuevo no responde con código HTTP 200, se detiene, se muestran los últimos logs del contenedor y **se revierte automáticamente** a la imagen anterior funcional (`PREV_IMAGE`).

5. **Aislamiento de Red y Puertos**:
   - `docker-compose.prod.yml` vincula los puertos de PostgreSQL y de la aplicación a `127.0.0.1`, permitiendo que únicamente el proxy Nginx exponga los puertos 80 y 443 al exterior con limitadores de tasa (*rate limiting*).
