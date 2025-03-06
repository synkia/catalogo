# 🐳 Regras para Docker no Catálogo ML

## 📋 Princípios Gerais

O Catálogo ML utiliza Docker para containerizar todos os seus serviços, garantindo consistência entre ambientes de desenvolvimento e produção. Esta abordagem facilita a configuração e execução do projeto para desenvolvedores iniciantes.

## 🚀 Estrutura de Containers

O projeto é dividido em vários containers, cada um com uma responsabilidade específica:

1. **Frontend (Nginx)**
   - Serve os arquivos estáticos da interface do usuário
   - Configurado para escutar na porta 3000

2. **Backend (FastAPI)**
   - Fornece a API REST para o frontend
   - Processa requisições e se comunica com o banco de dados
   - Exposto na porta 8001

3. **Serviço ML**
   - Executa tarefas de processamento de imagens e machine learning
   - Disponível na porta 5050

4. **Banco de Dados (MongoDB)**
   - Armazena dados do sistema
   - Exposto na porta 27017

5. **Armazenamento de Objetos (Minio)**
   - Armazena arquivos como PDFs e imagens
   - Interface web disponível na porta 9001

## 🔧 Boas Práticas

1. **Dockerfiles**
   - Manter Dockerfiles simples e legíveis
   - Usar imagens base oficiais e confiáveis
   - Minimizar o número de camadas
   - Incluir apenas o necessário para cada container

2. **Docker Compose**
   - Definir todos os serviços no arquivo docker-compose.yml
   - Usar volumes para persistência de dados
   - Configurar redes para comunicação entre containers
   - Definir dependências entre serviços

3. **Volumes**
   - Usar volumes nomeados para dados persistentes
   - Montar diretórios de código como volumes para desenvolvimento

4. **Redes**
   - Usar redes Docker para isolar comunicação entre containers
   - Expor apenas as portas necessárias

## 📝 Comandos Úteis

Para iniciantes, aqui estão alguns comandos Docker úteis:

```bash
# Iniciar todos os serviços
docker-compose up

# Iniciar apenas um serviço específico
docker-compose up frontend

# Reconstruir um serviço após alterações
docker-compose up --build frontend

# Parar todos os serviços
docker-compose down

# Ver logs de um serviço
docker-compose logs frontend
```

## ⚠️ Solução de Problemas

1. **Portas em uso**
   - Verificar se as portas necessárias estão disponíveis
   - Usar `docker ps` para ver containers em execução
   - Parar containers conflitantes com `docker stop`

2. **Problemas de permissão**
   - Verificar permissões de arquivos montados como volumes
   - Usar `chmod` para ajustar permissões se necessário

3. **Containers não iniciam**
   - Verificar logs com `docker logs [nome-do-container]`
   - Garantir que dependências estão disponíveis 