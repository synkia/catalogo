#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}Parando Catalogo ML no servidor${NC}"
echo -e "${BLUE}=================================${NC}"

# Verificar se o arquivo de PIDs existe
if [ -f "/workspace/catalogo/running.pid" ]; then
    # Ler os PIDs do arquivo
    read BACKEND_PID FRONTEND_PID < /workspace/catalogo/running.pid
    
    # Parar os processos
    echo -e "${YELLOW}Parando backend (PID: ${BACKEND_PID})...${NC}"
    kill $BACKEND_PID 2>/dev/null || echo -e "${RED}Backend já não está rodando${NC}"
    
    echo -e "${YELLOW}Parando frontend (PID: ${FRONTEND_PID})...${NC}"
    kill $FRONTEND_PID 2>/dev/null || echo -e "${RED}Frontend já não está rodando${NC}"
    
    # Remover o arquivo de PIDs
    rm /workspace/catalogo/running.pid
else
    # Parar todos os processos relacionados
    echo -e "${YELLOW}Parando todos os processos relacionados...${NC}"
    pkill -f "uvicorn app.main:app"
    pkill -f "node.*react-scripts start"
fi

# Verificar se ainda há processos rodando
sleep 2
RUNNING_BACKEND=$(pgrep -f "uvicorn app.main:app")
RUNNING_FRONTEND=$(pgrep -f "node.*react-scripts start")

if [ -n "$RUNNING_BACKEND" ] || [ -n "$RUNNING_FRONTEND" ]; then
    echo -e "${RED}Alguns processos ainda estão rodando. Forçando parada...${NC}"
    pkill -9 -f "uvicorn app.main:app"
    pkill -9 -f "node.*react-scripts start"
fi

echo -e "${GREEN}Todos os serviços foram parados.${NC}"
echo -e "${BLUE}=================================${NC}"