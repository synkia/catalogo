#!/bin/bash

# Expor a porta do backend para acesso externo
echo "Expondo a porta 8001 do backend para acesso externo..."
curl -s localhost:8001 > /dev/null
if [ $? -eq 0 ]; then
  echo "Backend está rodando na porta 8001. Expondo para acesso externo..."
  # Comando para expor a porta 8001
  # Este comando será executado pelo usuário manualmente
  echo "Execute o comando: devin expose_port local_port=8001"
else
  echo "Erro: Backend não está rodando na porta 8001."
  echo "Inicie o backend primeiro com: ./start-dev.sh (opção 3)"
fi
