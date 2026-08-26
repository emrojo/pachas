# ==============================================================================
# PACHAS - AUTOMATED LET'S ENCRYPT SSL PROVISIONER (POWERSHELL)
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$Domain,

    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Host "🔐 [1/4] Preparando directorios para Let's Encrypt Certbot..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "deploy/nginx/certbot-www" | Out-Null
New-Item -ItemType Directory -Force -Path "deploy/nginx/certs" | Out-Null

$currentPath = (Get-Location).Path.Replace('\', '/')

Write-Host "🚀 [2/4] Solicitando certificado SSL para $Domain..." -ForegroundColor Cyan
docker run -it --rm --name certbot `
    -v "${currentPath}/deploy/nginx/certbot-www:/var/www/certbot" `
    -v "${currentPath}/deploy/nginx/certs:/etc/letsencrypt" `
    certbot/certbot certonly `
    --webroot `
    --webroot-path=/var/www/certbot `
    --email "$Email" `
    --agree-tos `
    --no-eff-email `
    -d "$Domain"

Write-Host "⚙️ [3/4] Creando configuración Nginx HTTPS con TLS 1.3 y HSTS..." -ForegroundColor Cyan
$nginxConfig = @"
server {
    listen 80;
    listen [::]:80;
    server_name $Domain;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://`$host`$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $Domain;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/$Domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$Domain/privkey.pem;

    # Modern TLS Security (TLS 1.2 & 1.3)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # HSTS & Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 15M;

    limit_req zone=general_limit burst=50 nodelay;
    limit_conn addr_limit 20;

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location = /healthz {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    location ~* ^/(login|register) {
        limit_req zone=auth_limit burst=10 nodelay;

        proxy_pass http://pachas_app_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass `$http_upgrade;
    }

    location /_next/static/ {
        proxy_pass http://pachas_app_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://pachas_app_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass `$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
"@

Set-Content -Path "deploy/nginx/ssl-$Domain.conf" -Value $nginxConfig -Encoding UTF8

Write-Host "🔄 [4/4] Recargando Nginx para activar HTTPS..." -ForegroundColor Cyan
docker-compose -f deploy/docker-compose.yml exec pachas_proxy nginx -s reload

Write-Host "✅ ¡Certificado SSL activado con éxito para https://$Domain!" -ForegroundColor Green
