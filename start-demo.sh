#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# IP do servidor externo
SERVER_IP="191.252.110.108"
BACKEND_PORT=55825
FRONTEND_PORT=50029

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}Iniciando ambiente de demonstração do Catalogo ML${NC}"
echo -e "${BLUE}=================================${NC}"

# Matar processos anteriores
echo -e "${YELLOW}Parando serviços anteriores...${NC}"
pkill -f "uvicorn app.main:app"
pkill -f "node.*react-scripts start"
sleep 2

# Criar estrutura de diretórios necessária
echo -e "${YELLOW}Criando estrutura de diretórios...${NC}"
mkdir -p data/uploads data/images data/annotations data/results models

# Configurar ambiente do frontend
echo -e "${YELLOW}Configurando ambiente do frontend...${NC}"
cat > /workspace/catalogo/frontend/.env.local << EOF
REACT_APP_API_URL=http://${SERVER_IP}:${BACKEND_PORT}
HOST=0.0.0.0
PORT=${FRONTEND_PORT}
EOF

# Iniciar o backend em modo de demonstração
echo -e "${YELLOW}Iniciando backend em modo de demonstração...${NC}"
cd /workspace/catalogo/backend
# Ativar explicitamente o modo de demonstração
USE_MOCK_DB=true uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT} > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}Backend iniciado com PID ${BACKEND_PID}${NC}"

# Aguardar o backend iniciar
echo -e "${YELLOW}Aguardando o backend iniciar...${NC}"
sleep 5

# Verificar se o backend está rodando
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}Backend está rodando corretamente${NC}"
else
    echo -e "${RED}Falha ao iniciar o backend. Verifique os logs em backend.log${NC}"
    exit 1
fi

# Iniciar o frontend
echo -e "${YELLOW}Iniciando frontend...${NC}"
cd /workspace/catalogo/frontend
npm start > frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend iniciado com PID ${FRONTEND_PID}${NC}"

# Aguardar o frontend iniciar
echo -e "${YELLOW}Aguardando o frontend iniciar...${NC}"
sleep 10

# Verificar se o frontend está rodando
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}Frontend está rodando corretamente${NC}"
else
    echo -e "${RED}Falha ao iniciar o frontend. Verifique os logs em frontend.log${NC}"
    exit 1
fi

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}Serviços iniciados com sucesso em modo de demonstração!${NC}"
echo -e "${BLUE}Frontend:${NC} http://${SERVER_IP}:${FRONTEND_PORT}"
echo -e "${BLUE}Backend:${NC} http://${SERVER_IP}:${BACKEND_PORT}"
echo -e "${BLUE}=================================${NC}"
echo -e "${YELLOW}Para parar os serviços, execute:${NC} kill ${BACKEND_PID} ${FRONTEND_PID}"
echo -e "${YELLOW}Para ver os logs do backend:${NC} tail -f /workspace/catalogo/backend/backend.log"
echo -e "${YELLOW}Para ver os logs do frontend:${NC} tail -f /workspace/catalogo/frontend/frontend.log"
echo -e "${BLUE}=================================${NC}"

# Manter o script rodando
echo "Pressione Ctrl+C para encerrar os serviços"
wait