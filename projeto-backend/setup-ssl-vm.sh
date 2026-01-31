#!/bin/bash

# ============================================
# Script de Setup HTTPS para VM (sem Docker)
# ============================================
# Instala Nginx + Certbot e configura proxy reverso
# para o backend Python rodando na porta 8000

set -e

DOMAIN="api.dev-core.online"
EMAIL="admin@dev-core.online"  # Altere para seu email
BACKEND_PORT=8000

echo "============================================"
echo "Setup HTTPS para $DOMAIN"
echo "============================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "Por favor, execute como root (sudo)"
    exit 1
fi

# Detectar sistema operacional
if [ -f /etc/debian_version ]; then
    OS="debian"
    echo "Sistema detectado: Debian/Ubuntu"
elif [ -f /etc/redhat-release ]; then
    OS="redhat"
    echo "Sistema detectado: RHEL/CentOS"
else
    echo "Sistema operacional não suportado"
    exit 1
fi

# Instalar Nginx e Certbot
echo ""
echo "Passo 1: Instalando Nginx e Certbot..."
if [ "$OS" = "debian" ]; then
    apt-get update
    apt-get install -y nginx certbot python3-certbot-nginx
elif [ "$OS" = "redhat" ]; then
    yum install -y epel-release
    yum install -y nginx certbot python3-certbot-nginx
    systemctl enable nginx
fi

# Iniciar Nginx
systemctl start nginx
systemctl enable nginx

# Criar configuração inicial do Nginx (sem SSL)
echo ""
echo "Passo 2: Configurando Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout para uploads grandes
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Tamanho máximo de upload (500MB)
        client_max_body_size 500M;
    }
}
EOF

# Criar diretório sites-available se não existir (para sistemas RedHat)
if [ "$OS" = "redhat" ]; then
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled

    # Adicionar include no nginx.conf se não existir
    if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
        sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    fi
fi

# Ativar site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Remover site default se existir
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Recarregar Nginx
systemctl reload nginx

# Abrir portas no firewall
echo ""
echo "Passo 3: Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow $BACKEND_PORT/tcp
    echo "Firewall UFW configurado"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=$BACKEND_PORT/tcp
    firewall-cmd --reload
    echo "Firewall firewalld configurado"
fi

# Verificar se o domínio resolve para este servidor
echo ""
echo "Passo 4: Verificando DNS..."
RESOLVED_IP=$(dig +short $DOMAIN)
MY_IP=$(curl -s ifconfig.me)

echo "IP do domínio $DOMAIN: $RESOLVED_IP"
echo "IP desta máquina: $MY_IP"

if [ "$RESOLVED_IP" != "$MY_IP" ]; then
    echo ""
    echo "AVISO: O domínio $DOMAIN não aponta para este servidor!"
    echo "Configure o DNS antes de continuar."
    echo ""
    read -p "O DNS já está configurado? (s/n): " DNS_OK
    if [ "$DNS_OK" != "s" ]; then
        echo "Configure o DNS e execute novamente."
        exit 1
    fi
fi

# Obter certificado SSL
echo ""
echo "Passo 5: Obtendo certificado SSL..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Configurar renovação automática
echo ""
echo "Passo 6: Configurando renovação automática..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Mostrar status
echo ""
echo "============================================"
echo "Setup concluído!"
echo "============================================"
echo ""
echo "Seu backend está disponível em:"
echo "  https://$DOMAIN"
echo ""
echo "Certifique-se de que o backend Python está rodando:"
echo "  python server.py"
echo ""
echo "Para rodar o backend em background:"
echo "  nohup python server.py > backend.log 2>&1 &"
echo ""
echo "Ou use systemd (recomendado):"
echo "  sudo cp backend.service /etc/systemd/system/"
echo "  sudo systemctl enable backend"
echo "  sudo systemctl start backend"
echo ""
