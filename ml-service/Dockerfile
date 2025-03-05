FROM pytorch/pytorch:1.9.0-cuda11.1-cudnn8-runtime

WORKDIR /app

# Configurar para instalação não-interativa
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Sao_Paulo

# Configurar variáveis de ambiente para o serviço
ENV BACKEND_URL=http://backend:8000
ENV DATA_DIR=/data
ENV MODELS_DIR=/models
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=development
ENV FLASK_APP=service.py

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    git \
    python3-opencv \
    libglib2.0-0 \
    build-essential \
    curl \
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