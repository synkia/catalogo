#!/bin/bash

# IP do servidor externo
SERVER_IP="191.252.110.108"

# Iniciar o backend em segundo plano
cd /workspace/catalogo/backend
uvicorn app.main:app --host 0.0.0.0 --port 55825 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend iniciado com PID $BACKEND_PID"

# Aguardar um pouco para o backend iniciar
sleep 3

# Iniciar o frontend em segundo plano
cd /workspace/catalogo/frontend
cp .env.external .env.local
npm start > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend iniciado com PID $FRONTEND_PID"

echo "Serviços iniciados."
echo "Acesse o frontend em http://${SERVER_IP}:50029"
echo "API disponível em http://${SERVER_IP}:55825"
echo "Para parar os serviços, execute: kill $BACKEND_PID $FRONTEND_PID"

# Manter o script rodando
echo "Pressione Ctrl+C para encerrar os serviços"
wait