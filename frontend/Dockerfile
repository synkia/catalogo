FROM node:14-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências ignorando erros de plataforma
RUN npm install --no-optional --no-package-lock --no-shrinkwrap

# Copiar o restante do código
COPY . .

# Expor a porta
EXPOSE 3000

# Iniciar a aplicação
CMD ["npm", "start"] 