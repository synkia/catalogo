#!/bin/bash

# Configurar ambiente do frontend
cd /workspace/catalogo/frontend
echo "REACT_APP_API_URL=http://191.252.110.108:55825" > .env.local
echo "HOST=0.0.0.0" >> .env.local
echo "PORT=50029" >> .env.local

# Iniciar o frontend
npm start