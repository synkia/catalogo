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
echo -e "${GREEN}Verificando acesso externo ao Catalogo ML${NC}"
echo -e "${BLUE}=================================${NC}"

# Verificar se o backend está acessível localmente
echo -e "${YELLOW}Verificando backend localmente...${NC}"
if curl -s http://localhost:${BACKEND_PORT}/catalogs/ > /dev/null; then
    echo -e "${GREEN}✅ Backend está acessível localmente${NC}"
else
    echo -e "${RED}❌ Backend não está acessível localmente${NC}"
fi

# Verificar se o frontend está acessível localmente
echo -e "${YELLOW}Verificando frontend localmente...${NC}"
if curl -s http://localhost:${FRONTEND_PORT} > /dev/null; then
    echo -e "${GREEN}✅ Frontend está acessível localmente${NC}"
else
    echo -e "${RED}❌ Frontend não está acessível localmente${NC}"
fi

echo -e "${BLUE}=================================${NC}"
echo -e "${YELLOW}URLs para acesso externo:${NC}"
echo -e "${BLUE}Frontend:${NC} http://${SERVER_IP}:${FRONTEND_PORT}"
echo -e "${BLUE}Backend:${NC} http://${SERVER_IP}:${BACKEND_PORT}"
echo -e "${BLUE}=================================${NC}"

# Mostrar processos em execução
echo -e "${YELLOW}Processos em execução:${NC}"
ps aux | grep -E 'node|uvicorn' | grep -v grep | grep -v defunct

echo -e "${BLUE}=================================${NC}"