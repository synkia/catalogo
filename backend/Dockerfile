FROM python:3.9-slim

WORKDIR /app

# Configurar para instalação não-interativa
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Sao_Paulo

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    poppler-utils \
    ffmpeg \
    libsm6 \
    libxext6 \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY . .

# Porta que será exposta
EXPOSE 8000

# Configurações para lidar com uploads grandes
ENV UVICORN_TIMEOUT=300

# Comando para iniciar a aplicação com configurações para uploads grandes
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--timeout-keep-alive", "300"] 