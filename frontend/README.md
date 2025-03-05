# 🌐 Frontend do Catálogo ML

Este diretório contém o frontend do sistema Catálogo ML, implementado como uma aplicação React moderna.

## 📋 Estrutura de Arquivos

```
frontend/
├── public/             # Arquivos públicos estáticos
├── src/                # Código-fonte da aplicação React
│   ├── components/     # Componentes reutilizáveis
│   ├── layouts/        # Layouts da aplicação
│   ├── pages/          # Páginas da aplicação
│   ├── App.js          # Componente principal
│   └── index.js        # Ponto de entrada
├── .env                # Variáveis de ambiente
├── Dockerfile          # Configuração do container Docker
└── package.json        # Dependências e scripts
```

## 🚀 Como Executar

### Usando Docker Compose (Recomendado)

Na raiz do projeto, execute:

```bash
docker-compose up frontend
```

Isso irá construir e iniciar apenas o serviço de frontend.

### Usando Docker Diretamente

Dentro do diretório `frontend`, execute:

```bash
docker build -t catalogo-ml-frontend .
docker run -p 3000:3000 -v $(pwd):/app -v /app/node_modules catalogo-ml-frontend
```

### Desenvolvimento Local (Sem Docker)

Se você tiver o Node.js instalado localmente:

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm start
   ```

3. Acesse a aplicação em http://localhost:3000

## 🔧 Principais Funcionalidades

- **Upload de Catálogos**: Interface para envio de PDFs
- **Anotação de Produtos**: Ferramenta visual para marcar produtos
- **Treinamento de Modelos**: Interface para configurar e iniciar treinamentos
- **Visualização de Resultados**: Painéis para analisar detecções

## 📦 Principais Dependências

- **React 17**: Biblioteca principal para construção da interface
- **Material UI**: Componentes visuais pré-estilizados
- **React Router**: Navegação entre páginas
- **React Konva**: Manipulação de elementos gráficos para anotações
- **Axios**: Comunicação com a API do backend

## 📝 Scripts Disponíveis

- `npm start`: Inicia o servidor de desenvolvimento
- `npm build`: Compila a aplicação para produção
- `npm test`: Executa os testes
- `npm eject`: Ejeta a configuração do Create React App

## 🔧 Personalização

Para modificar o frontend:

1. Edite os arquivos na pasta `static/`
2. Reconstrua o container Docker se estiver usando Docker

## 📝 Notas

- O servidor está configurado para escutar na porta 3000
- A configuração do Nginx está otimizada para servir uma aplicação de página única (SPA)
- Os volumes no Docker Compose estão configurados para refletir mudanças nos arquivos estáticos sem precisar reconstruir o container 