#!/bin/bash

# Iniciar o backend em modo de demonstração
cd /workspace/catalogo/backend
USE_MOCK_DB=true uvicorn app.main:app --host 0.0.0.0 --port 55825