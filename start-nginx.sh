#!/bin/bash

echo "Iniciando o Nginx Reverse Proxy..."

# Verificar se o Docker está instalado
if ! command -v docker &> /dev/null; then
  echo "Docker não está instalado. Por favor, instale o Docker primeiro."
  exit 1
fi

# Verificar se o Docker Compose está instalado
if ! command -v docker compose &> /dev/null; then
  echo "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
  exit 1
fi

# Iniciar os serviços com Docker Compose
echo "Iniciando os serviços com Docker Compose..."
docker compose up -d

# Verificar se o Nginx está rodando
echo "Verificando se o Nginx está rodando..."
docker compose ps nginx

echo "Nginx Reverse Proxy iniciado com sucesso!"
echo "Acesse a aplicação em: http://localhost"
echo "Para expor a aplicação para acesso externo, execute: devin expose_port local_port=80"
