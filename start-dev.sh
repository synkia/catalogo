#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}Iniciando ambiente de desenvolvimento do Catalogo ML${NC}"
echo -e "${BLUE}=================================${NC}"

# Verificar se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker não encontrado. Por favor, instale o Docker antes de continuar.${NC}"
    exit 1
fi

# Verificar se o Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose não encontrado. Por favor, instale o Docker Compose antes de continuar.${NC}"
    exit 1
fi

# Criar estrutura de diretórios necessária
echo -e "${YELLOW}Criando estrutura de diretórios...${NC}"
mkdir -p data/uploads data/images data/annotations data/results models

# Exibir menu de opções
echo -e "\n${GREEN}Escolha uma opção:${NC}"
echo "1) Iniciar todos os serviços"
echo "2) Iniciar apenas frontend"
echo "3) Iniciar apenas backend"
echo "4) Iniciar apenas serviço ML"
echo "5) Iniciar apenas banco de dados"
echo "6) Parar todos os serviços"
echo "7) Sair"

read -p "Opção: " opcao

case $opcao in
    1)
        echo -e "${YELLOW}Iniciando todos os serviços...${NC}"
        docker-compose up -d
        echo -e "${GREEN}Serviços iniciados.${NC}"
        echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
        echo -e "${BLUE}Backend:${NC} http://localhost:8001"
        echo -e "${BLUE}Minio:${NC} http://localhost:9001 (usuário: minioadmin, senha: minioadmin)"
        ;;
    2)
        echo -e "${YELLOW}Iniciando frontend...${NC}"
        docker-compose up -d frontend
        echo -e "${GREEN}Frontend iniciado em:${NC} http://localhost:3000"
        ;;
    3)
        echo -e "${YELLOW}Iniciando backend...${NC}"
        docker-compose up -d backend
        echo -e "${GREEN}Backend iniciado em:${NC} http://localhost:8001"
        ;;
    4)
        echo -e "${YELLOW}Iniciando serviço ML...${NC}"
        docker-compose up -d ml-service
        echo -e "${GREEN}Serviço ML iniciado.${NC}"
        ;;
    5)
        echo -e "${YELLOW}Iniciando banco de dados e minio...${NC}"
        docker-compose up -d mongodb minio
        echo -e "${GREEN}MongoDB e Minio iniciados.${NC}"
        echo -e "${BLUE}Minio:${NC} http://localhost:9001 (usuário: minioadmin, senha: minioadmin)"
        ;;
    6)
        echo -e "${YELLOW}Parando todos os serviços...${NC}"
        docker-compose down
        echo -e "${GREEN}Serviços parados.${NC}"
        ;;
    7)
        echo -e "${GREEN}Saindo...${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Opção inválida!${NC}"
        ;;
esac

echo -e "\n${BLUE}=================================${NC}"
echo -e "${GREEN}Para visualizar logs:${NC} docker-compose logs -f [serviço]"
echo -e "${GREEN}Para parar:${NC} docker-compose down"
echo -e "${BLUE}=================================${NC}" 