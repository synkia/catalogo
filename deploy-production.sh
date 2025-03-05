#!/bin/bash

# Catalogo ML - Production Deployment Script
# This script installs and configures the Catalogo ML project in a production environment

# Color definitions for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables (can be overridden with environment variables)
DOMAIN_NAME=${DOMAIN_NAME:-"localhost"}
USE_SSL=${USE_SSL:-"false"}
SSL_CERT_PATH=${SSL_CERT_PATH:-""}
SSL_KEY_PATH=${SSL_KEY_PATH:-""}
MONGODB_USER=${MONGODB_USER:-"admin"}
MONGODB_PASSWORD=${MONGODB_PASSWORD:-"$(openssl rand -base64 12)"}
MINIO_USER=${MINIO_USER:-"minioadmin"}
MINIO_PASSWORD=${MINIO_PASSWORD:-"$(openssl rand -base64 12)"}
INSTALL_DIR=${INSTALL_DIR:-"/opt/catalogo"}

# Function to display usage information
function show_usage {
  echo -e "${BLUE}Catalogo ML - Production Deployment Script${NC}"
  echo -e "Usage: $0 [options]"
  echo -e "Options:"
  echo -e "  --domain-name <domain>     Domain name for the application (default: localhost)"
  echo -e "  --use-ssl                  Enable SSL/HTTPS"
  echo -e "  --ssl-cert <path>          Path to SSL certificate file"
  echo -e "  --ssl-key <path>           Path to SSL private key file"
  echo -e "  --mongodb-user <user>      MongoDB username (default: admin)"
  echo -e "  --mongodb-password <pass>  MongoDB password (default: random)"
  echo -e "  --minio-user <user>        Minio username (default: minioadmin)"
  echo -e "  --minio-password <pass>    Minio password (default: random)"
  echo -e "  --install-dir <path>       Installation directory (default: /opt/catalogo)"
  echo -e "  --help                     Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain-name)
      DOMAIN_NAME="$2"
      shift 2
      ;;
    --use-ssl)
      USE_SSL="true"
      shift
      ;;
    --ssl-cert)
      SSL_CERT_PATH="$2"
      shift 2
      ;;
    --ssl-key)
      SSL_KEY_PATH="$2"
      shift 2
      ;;
    --mongodb-user)
      MONGODB_USER="$2"
      shift 2
      ;;
    --mongodb-password)
      MONGODB_PASSWORD="$2"
      shift 2
      ;;
    --minio-user)
      MINIO_USER="$2"
      shift 2
      ;;
    --minio-password)
      MINIO_PASSWORD="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --help)
      show_usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_usage
      exit 1
      ;;
  esac
done

# Validate SSL configuration
if [[ "$USE_SSL" == "true" ]]; then
  if [[ -z "$SSL_CERT_PATH" || -z "$SSL_KEY_PATH" ]]; then
    echo -e "${RED}Error: SSL is enabled but certificate or key path is missing${NC}"
    show_usage
    exit 1
  fi
  
  if [[ ! -f "$SSL_CERT_PATH" || ! -f "$SSL_KEY_PATH" ]]; then
    echo -e "${RED}Error: SSL certificate or key file not found${NC}"
    exit 1
  fi
fi

# Function to check if a command exists
function command_exists {
  command -v "$1" >/dev/null 2>&1
}

# Function to install dependencies
function install_dependencies {
  echo -e "${YELLOW}Checking and installing dependencies...${NC}"
  
  # Check if Docker is installed
  if ! command_exists docker; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
  else
    echo -e "${GREEN}Docker is already installed.${NC}"
  fi
  
  # Check if Docker Compose is installed
  if ! command_exists docker-compose; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  else
    echo -e "${GREEN}Docker Compose is already installed.${NC}"
  fi
  
  # Check if Git is installed
  if ! command_exists git; then
    echo -e "${YELLOW}Installing Git...${NC}"
    apt-get update
    apt-get install -y git
  else
    echo -e "${GREEN}Git is already installed.${NC}"
  fi
}

# Function to clone or update the repository
function setup_repository {
  echo -e "${YELLOW}Setting up repository...${NC}"
  
  # Create installation directory if it doesn't exist
  mkdir -p "$INSTALL_DIR"
  
  # Clone or update the repository
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo -e "${YELLOW}Repository already exists. Updating...${NC}"
    cd "$INSTALL_DIR"
    git pull
  else
    echo -e "${YELLOW}Cloning repository...${NC}"
    git clone https://github.com/synkia/catalogo.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
  
  # Create necessary directories
  mkdir -p data/uploads data/images data/annotations data/results models
}

# Function to create production docker-compose.yml
function create_docker_compose {
  echo -e "${YELLOW}Creating production docker-compose.yml...${NC}"
  
  cat > "$INSTALL_DIR/docker-compose.prod.yml" << EOF
version: '3.8'

services:
  # Nginx - Reverse Proxy
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - frontend
      - backend
      - ml-service
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl
    networks:
      - catalogo-net

  # Frontend - Aplicação React
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=
    networks:
      - catalogo-net

  # Backend - API Python com FastAPI
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    volumes:
      - ./data:/data
    depends_on:
      - mongodb
    environment:
      - MONGODB_URI=mongodb://${MONGODB_USER}:${MONGODB_PASSWORD}@mongodb:27017/catalogo?authSource=admin
      - DATA_DIR=/data
      - ENVIRONMENT=production
    networks:
      - catalogo-net

  # Serviço de ML - Para processamento pesado/treinamento
  ml-service:
    build:
      context: ./ml-service
      dockerfile: Dockerfile.prod
    volumes:
      - ./data:/data
      - ./models:/models
    environment:
      - MODELS_DIR=/models
      - DATA_DIR=/data
      - ENVIRONMENT=production
    networks:
      - catalogo-net

  # Banco de Dados MongoDB
  mongodb:
    image: mongo:latest
    volumes:
      - mongodb-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGODB_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGODB_PASSWORD}
    networks:
      - catalogo-net

  # Serviço Minio para armazenamento de objetos
  minio:
    image: minio/minio
    volumes:
      - minio-data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
    command: server --console-address ":9001" /data
    networks:
      - catalogo-net

volumes:
  mongodb-data:
  minio-data:

networks:
  catalogo-net:
    driver: bridge
EOF
}

# Function to create production Dockerfiles
function create_dockerfiles {
  echo -e "${YELLOW}Creating production Dockerfiles...${NC}"
  
  # Frontend Dockerfile for production
  cat > "$INSTALL_DIR/frontend/Dockerfile.prod" << EOF
FROM node:14-alpine as build

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --no-optional

# Copiar o restante do código
COPY . .

# Construir a aplicação para produção
RUN npm run build

# Estágio de produção
FROM nginx:alpine

# Copiar os arquivos de build
COPY --from=build /app/build /usr/share/nginx/html

# Copiar configuração do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

  # Create nginx.conf for frontend
  mkdir -p "$INSTALL_DIR/frontend/nginx"
  cat > "$INSTALL_DIR/frontend/nginx.conf" << EOF
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html index.htm;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 7d;
    }
}
EOF

  # Backend Dockerfile for production
  cat > "$INSTALL_DIR/backend/Dockerfile.prod" << EOF
FROM python:3.9-slim

WORKDIR /app

# Configurar para instalação não-interativa
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Sao_Paulo
ENV PYTHONUNBUFFERED=1

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \\
    build-essential \\
    libpq-dev \\
    poppler-utils \\
    ffmpeg \\
    libsm6 \\
    libxext6 \\
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY . .

# Porta que será exposta
EXPOSE 8000

# Comando para iniciar a aplicação em modo de produção
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

  # ML Service Dockerfile for production
  cat > "$INSTALL_DIR/ml-service/Dockerfile.prod" << EOF
FROM pytorch/pytorch:1.9.0-cuda11.1-cudnn8-runtime

WORKDIR /app

# Configurar para instalação não-interativa
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Sao_Paulo
ENV PYTHONUNBUFFERED=1

# Configurar variáveis de ambiente para o serviço
ENV BACKEND_URL=http://backend:8000
ENV DATA_DIR=/data
ENV MODELS_DIR=/models

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \\
    git \\
    python3-opencv \\
    libglib2.0-0 \\
    build-essential \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Instalar Detectron2
RUN pip install --no-cache-dir 'git+https://github.com/facebookresearch/detectron2.git'

# Instalar outras dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Criar diretórios necessários
RUN mkdir -p /data/annotations /models

# Copiar código da aplicação
COPY . .

# Porta para API de inferência/treinamento
EXPOSE 5000

# Comando para iniciar o serviço
CMD ["python", "service.py"]
EOF

  # Nginx Dockerfile for production
  cat > "$INSTALL_DIR/nginx/Dockerfile.prod" << EOF
FROM nginx:alpine

# Copiar configuração do nginx
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

# Criar diretório para certificados SSL
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
EOF
}

# Function to create Nginx configuration for production
function create_nginx_config {
  echo -e "${YELLOW}Creating Nginx configuration for production...${NC}"
  
  # Create SSL directory
  mkdir -p "$INSTALL_DIR/nginx/ssl"
  
  # Create Nginx configuration for production
  if [[ "$USE_SSL" == "true" ]]; then
    # Copy SSL certificates
    cp "$SSL_CERT_PATH" "$INSTALL_DIR/nginx/ssl/cert.pem"
    cp "$SSL_KEY_PATH" "$INSTALL_DIR/nginx/ssl/key.pem"
    
    # Create Nginx configuration with SSL
    cat > "$INSTALL_DIR/nginx/nginx.prod.conf" << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    
    # Redirect all HTTP requests to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN_NAME};
    
    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    
    # Frontend
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://${DOMAIN_NAME}' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://${DOMAIN_NAME}' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
EOF
  else
    # Create Nginx configuration without SSL
    cat > "$INSTALL_DIR/nginx/nginx.prod.conf" << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    
    # Frontend
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'http://${DOMAIN_NAME}' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'http://${DOMAIN_NAME}' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
EOF
  fi
}

# Function to create a production deployment script
function create_deployment_script {
  echo -e "${YELLOW}Creating deployment script...${NC}"
  
  cat > "$INSTALL_DIR/deploy.sh" << EOF
#!/bin/bash

# Catalogo ML - Deployment Script

# Color definitions for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}Implantando Catalogo ML em produção${NC}"
echo -e "${BLUE}=================================${NC}"

# Parar serviços existentes
echo -e "${YELLOW}Parando serviços existentes...${NC}"
docker compose -f docker-compose.prod.yml down

# Construir e iniciar serviços
echo -e "${YELLOW}Construindo e iniciando serviços...${NC}"
docker compose -f docker-compose.prod.yml up -d --build

# Verificar status dos serviços
echo -e "${YELLOW}Verificando status dos serviços...${NC}"
docker compose -f docker-compose.prod.yml ps

echo -e "${GREEN}Implantação concluída!${NC}"
EOF
  
  chmod +x "$INSTALL_DIR/deploy.sh"
}

# Function to create a backup script
function create_backup_script {
  echo -e "${YELLOW}Creating backup script...${NC}"
  
  cat > "$INSTALL_DIR/backup.sh" << EOF
#!/bin/bash

# Catalogo ML - Backup Script

# Color definitions for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração
BACKUP_DIR="\${BACKUP_DIR:-/opt/catalogo/backups}"
DATE=\$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}Realizando backup do Catalogo ML${NC}"
echo -e "${BLUE}=================================${NC}"

# Criar diretório de backup
mkdir -p "\$BACKUP_DIR"

# Backup do MongoDB
echo -e "${YELLOW}Realizando backup do MongoDB...${NC}"
docker compose -f docker-compose.prod.yml exec -T mongodb mongodump --authenticationDatabase admin \\
  --username "\${MONGODB_USER}" --password "\${MONGODB_PASSWORD}" \\
  --archive > "\$BACKUP_DIR/mongodb_\$DATE.archive"

# Backup dos dados
echo -e "${YELLOW}Realizando backup dos dados...${NC}"
tar -czf "\$BACKUP_DIR/data_\$DATE.tar.gz" data

# Backup dos modelos
echo -e "${YELLOW}Realizando backup dos modelos...${NC}"
tar -czf "\$BACKUP_DIR/models_\$DATE.tar.gz" models

echo -e "${GREEN}Backup concluído em \$BACKUP_DIR${NC}"
EOF
  
  chmod +x "$INSTALL_DIR/backup.sh"
}

# Main function
function main {
  echo -e "${BLUE}=================================${NC}"
  echo -e "${GREEN}Iniciando instalação do Catalogo ML em produção${NC}"
  echo -e "${BLUE}=================================${NC}"
  
  # Install dependencies
  install_dependencies
  
  # Setup repository
  setup_repository
  
  # Create production configuration files
  create_docker_compose
  create_dockerfiles
  create_nginx_config
  create_deployment_script
  create_backup_script
  
  echo -e "${GREEN}Instalação concluída!${NC}"
  echo -e "${YELLOW}Para implantar o Catalogo ML, execute:${NC}"
  echo -e "  cd $INSTALL_DIR && ./deploy.sh"
  
  # Display credentials
  echo -e "${BLUE}=================================${NC}"
  echo -e "${GREEN}Credenciais geradas:${NC}"
  echo -e "${YELLOW}MongoDB:${NC}"
  echo -e "  Usuário: $MONGODB_USER"
  echo -e "  Senha: $MONGODB_PASSWORD"
  echo -e "${YELLOW}Minio:${NC}"
  echo -e "  Usuário: $MINIO_USER"
  echo -e "  Senha: $MINIO_PASSWORD"
  echo -e "${BLUE}=================================${NC}"
  
  # Save credentials to a file
  echo -e "${YELLOW}Salvando credenciais em $INSTALL_DIR/credentials.txt...${NC}"
  cat > "$INSTALL_DIR/credentials.txt" << EOF
# Catalogo ML - Credenciais
# ATENÇÃO: Mantenha este arquivo seguro!

MongoDB:
  Usuário: $MONGODB_USER
  Senha: $MONGODB_PASSWORD

Minio:
  Usuário: $MINIO_USER
  Senha: $MINIO_PASSWORD
EOF
  
  chmod 600 "$INSTALL_DIR/credentials.txt"
}

# Run the main function
main
