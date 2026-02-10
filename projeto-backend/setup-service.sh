#!/bin/bash
# ============================================
# Setup script: Backend como serviço systemd
# ============================================
# Uso: sudo bash setup-service.sh
#
# Este script:
# 1. Cria o virtual environment
# 2. Instala dependências
# 3. Configura o serviço systemd
# 4. Habilita e inicia o serviço

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_DIR="/home/user/gestao-organizacional-python/projeto-backend"
SERVICE_NAME="gestao-backend"
SERVICE_FILE="${BACKEND_DIR}/${SERVICE_NAME}.service"
VENV_DIR="${BACKEND_DIR}/venv"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Setup do Backend como Serviço systemd${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Este script precisa ser executado como root (sudo)${NC}"
    exit 1
fi

# 2. Verificar se o arquivo .env.production existe
if [ ! -f "${BACKEND_DIR}/.env.production" ]; then
    echo -e "${YELLOW}[!] Arquivo .env.production não encontrado.${NC}"
    echo -e "${YELLOW}    Criando a partir do exemplo...${NC}"

    if [ -f "${BACKEND_DIR}/.env.production.example" ]; then
        cp "${BACKEND_DIR}/.env.production.example" "${BACKEND_DIR}/.env.production"
        echo -e "${RED}[!] IMPORTANTE: Edite o arquivo .env.production com suas configurações reais!${NC}"
        echo -e "${RED}    ${BACKEND_DIR}/.env.production${NC}"
        echo ""
    else
        echo -e "${RED}Arquivo .env.production.example também não encontrado. Crie o .env.production manualmente.${NC}"
        exit 1
    fi
fi

# 3. Criar virtual environment
echo -e "${GREEN}[1/5] Criando virtual environment...${NC}"
if [ ! -d "${VENV_DIR}" ]; then
    python3 -m venv "${VENV_DIR}"
    echo "  Virtual environment criado em ${VENV_DIR}"
else
    echo "  Virtual environment já existe"
fi

# 4. Instalar dependências
echo -e "${GREEN}[2/5] Instalando dependências...${NC}"
"${VENV_DIR}/bin/pip" install --upgrade pip -q
"${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt" -q
echo "  Dependências instaladas"

# 5. Criar diretórios de upload
echo -e "${GREEN}[3/5] Criando diretórios de upload...${NC}"
mkdir -p "${BACKEND_DIR}/uploads/documents"
mkdir -p "${BACKEND_DIR}/uploads/videos"
mkdir -p "${BACKEND_DIR}/uploads/photos"
chown -R user:user "${BACKEND_DIR}/uploads"
echo "  Diretórios criados"

# 6. Instalar serviço systemd
echo -e "${GREEN}[4/5] Instalando serviço systemd...${NC}"
cp "${SERVICE_FILE}" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
echo "  Serviço instalado"

# 7. Habilitar e iniciar
echo -e "${GREEN}[5/5] Habilitando e iniciando serviço...${NC}"
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
echo "  Serviço iniciado"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Setup concluído!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Comandos úteis:"
echo "  sudo systemctl status ${SERVICE_NAME}     # Ver status"
echo "  sudo systemctl restart ${SERVICE_NAME}    # Reiniciar"
echo "  sudo systemctl stop ${SERVICE_NAME}       # Parar"
echo "  sudo journalctl -u ${SERVICE_NAME} -f     # Ver logs em tempo real"
echo "  sudo journalctl -u ${SERVICE_NAME} --since '1 hour ago'  # Logs recentes"
echo ""
echo -e "${YELLOW}Certifique-se de editar .env.production antes de expor em produção!${NC}"
