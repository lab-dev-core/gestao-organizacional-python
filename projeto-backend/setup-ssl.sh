#!/bin/bash

# ============================================
# Script de Setup SSL com Let's Encrypt
# ============================================
# Este script configura HTTPS para o backend
# Dominio: api.dev-core.online

set -e

DOMAIN="api.dev-core.online"
EMAIL="admin@dev-core.online"  # Altere para seu email

echo "============================================"
echo "Setup SSL para $DOMAIN"
echo "============================================"

# Verificar se docker e docker-compose estao instalados
if ! command -v docker &> /dev/null; then
    echo "Docker nao encontrado. Instalando..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker instalado. Por favor, faca logout e login novamente."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose nao encontrado. Instalando..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Copiar arquivo de ambiente de producao
if [ ! -f .env.production ]; then
    echo "Copiando .env.production.example para .env.production..."
    cp .env.production.example .env.production
    echo "IMPORTANTE: Edite o arquivo .env.production com suas configuracoes!"
fi

# Passo 1: Usar configuracao inicial (sem SSL)
echo ""
echo "Passo 1: Configurando Nginx inicial (sem SSL)..."
cp nginx/nginx.initial.conf nginx/nginx.conf

# Passo 2: Subir containers
echo ""
echo "Passo 2: Subindo containers..."
docker-compose -f docker-compose.prod.yml up -d --build backend nginx

# Aguardar Nginx iniciar
echo "Aguardando Nginx iniciar..."
sleep 5

# Passo 3: Obter certificado SSL
echo ""
echo "Passo 3: Obtendo certificado SSL do Let's Encrypt..."
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Passo 4: Usar configuracao com SSL
echo ""
echo "Passo 4: Ativando configuracao HTTPS..."
cat > nginx/nginx.conf << 'NGINX_CONF'
events {
    worker_connections 1024;
}

http {
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    upstream backend {
        server backend:8000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name api.dev-core.online;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name api.dev-core.online;

        ssl_certificate /etc/letsencrypt/live/api.dev-core.online/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.dev-core.online/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        location / {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            client_max_body_size 500M;
        }

        location /health {
            proxy_pass http://backend/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }
    }
}
NGINX_CONF

# Passo 5: Reiniciar Nginx com SSL
echo ""
echo "Passo 5: Reiniciando Nginx com HTTPS..."
docker-compose -f docker-compose.prod.yml restart nginx

# Passo 6: Iniciar renovacao automatica
echo ""
echo "Passo 6: Iniciando servico de renovacao automatica..."
docker-compose -f docker-compose.prod.yml up -d certbot

echo ""
echo "============================================"
echo "Setup concluido!"
echo "============================================"
echo ""
echo "Seu backend esta disponivel em:"
echo "  https://$DOMAIN"
echo ""
echo "Endpoints uteis:"
echo "  https://$DOMAIN/health  - Health check"
echo "  https://$DOMAIN/docs    - Documentacao Swagger"
echo ""
echo "Comandos uteis:"
echo "  docker-compose -f docker-compose.prod.yml logs -f     # Ver logs"
echo "  docker-compose -f docker-compose.prod.yml restart     # Reiniciar"
echo "  docker-compose -f docker-compose.prod.yml down        # Parar"
echo ""
