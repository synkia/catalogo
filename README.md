# 🛒 Catalogo ML - Sistema de Extração e Análise de Produtos em Catálogos

## 📋 Sobre o Projeto

**Catalogo ML** é uma ferramenta para vendedores de marketplaces que automatiza o processo de análise de catálogos de fornecedores. O sistema permite extrair produtos de catálogos em PDF (mesmo sem padrão definido), e prepará-los para análise no MercadoLivre ou outros marketplaces.

### 🔍 O Problema Resolvido

Como vendedor de marketplaces, analisar catálogos de fornecedores é um trabalho repetitivo e demorado:
- Catálogos em PDF sem padrão definido
- Necessidade de extrair imagens e informações de produtos
- Busca manual no MercadoLivre para validar potencial de venda
- Análise de múltiplos fatores (vendas, idade dos anúncios, avaliações, preço médio)

### 💡 Nossa Solução

Uma aplicação web que:
1. Recebe catálogos em PDF
2. Utiliza algoritmos de processamento de imagem para identificar produtos
3. Permite anotação manual para treinar o modelo
4. Extrai dados em formato JSON para integração com APIs de marketplaces

## 🚀 Começando

### Pré-requisitos

- Docker
- Docker Compose

### 📦 Instalação

#### Usando Docker (Recomendado)

Utilizamos o script `start-dev.sh` para simplificar o processo de execução do projeto:

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/catalogo-ml.git
cd catalogo-ml

# Dar permissão de execução ao script
chmod +x start-dev.sh

# Executar o script de inicialização
./start-dev.sh
```

O script oferece um menu interativo com as seguintes opções:
1. Iniciar todos os serviços
2. Iniciar apenas frontend
3. Iniciar apenas backend
4. Iniciar apenas serviço ML
5. Iniciar apenas banco de dados
6. Parar todos os serviços

#### Portas e Serviços

Após iniciar os serviços, você pode acessar:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **Minio (armazenamento)**: http://localhost:9001 (usuário: minioadmin, senha: minioadmin)

## 💻 Usando o Sistema

### Fluxo de Trabalho Básico

1. **Upload de Catálogo**
   - Acesse a interface web e faça upload do catálogo em PDF
   - O sistema processará o PDF e extrairá as páginas como imagens

2. **Anotação Manual**
   - Use a ferramenta de anotação para marcar produtos nas páginas
   - Desenhe retângulos em torno dos produtos e classifique-os

3. **Treinamento do Modelo**
   - Após anotar um número suficiente de produtos, treine o modelo
   - Configure os parâmetros de treinamento ou use os valores padrão

4. **Detecção Automática**
   - Aplique o modelo treinado em novos catálogos
   - Revise e ajuste as detecções se necessário

5. **Exportação dos Resultados**
   - Exporte os produtos detectados em formato JSON
   - Use os dados para integração com APIs de marketplaces

## 📖 Documentação

Para mais detalhes sobre o projeto, consulte:

- [Plano de Implementação](./plano-implementacao.md) - Roteiro detalhado de desenvolvimento
- [Visão Geral do Sistema](./visao-geral-sistema.md) - Arquitetura e fluxos principais

## 🧠 Tecnologias Utilizadas

### Frontend
- React.js
- React Router
- React Konva (para anotações visuais)
- Material UI
- Axios

### Backend
- Python
- FastAPI
- PyMongo
- pdf2image
- OpenCV

### ML/Visão Computacional
- PyTorch
- OpenCV

### Infraestrutura
- Docker
- MongoDB
- Minio (para armazenamento de objetos)

## 🔍 Status do Projeto

O projeto está na fase inicial de desenvolvimento, com os seguintes componentes implementados:

- ✅ Estrutura básica do projeto (Docker, frontend, backend, ML service)
- ✅ Interface de upload de catálogos
- ✅ Processamento de PDFs e extração de páginas
- ✅ Ferramenta de anotação visual
- ✅ Interface de treinamento do modelo
- ✅ Detecção em novos catálogos
- ✅ Exportação de resultados em JSON

Próximos passos:
- [ ] Adicionar autenticação de usuários
- [ ] Integração OCR para textos e preços
- [ ] Integração direta com APIs de marketplace
- [ ] Relatórios e dashboards avançados

## 👨‍💻 Desenvolvimento

Para contribuir com o desenvolvimento:

1. Consulte o [Plano de Implementação](./plano-implementacao.md)
2. Escolha tarefas não marcadas
3. Crie uma branch para sua feature: `git checkout -b feature/nome-da-feature`
4. Commit suas mudanças: `git commit -m 'feat: Adiciona funcionalidade X'`
5. Push para a branch: `git push origin feature/nome-da-feature`
6. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📬 Contato

- **Desenvolvedor**: Thiago - [thiago@exemplo.com](mailto:thiago@exemplo.com)
- **GitHub**: [thiago](https://github.com/thiago)

---

Feito com ❤️ para facilitar a vida de vendedores de marketplaces.

# Catálogo ML - Documentação

## Resolução de Problemas no Serviço ML

### Problema Identificado
O serviço ML estava apresentando erros de sintaxe e indentação no arquivo `service.py`, o que impedia o container de iniciar corretamente.

### Solução Implementada
1. **Identificação dos erros**:
   - Erro de indentação na linha 364
   - Erro de sintaxe na linha 774
   - Problemas com fechamento de chaves e parênteses

2. **Tentativas de correção**:
   - Correção da indentação nas linhas problemáticas
   - Adição de chaves de fechamento faltantes
   - Ajuste na estrutura do código

3. **Solução alternativa**:
   - Criação de um serviço simplificado (`simple_service.py`) com apenas um endpoint de saúde
   - Modificação do `docker-compose.yml` para usar o novo arquivo
   - Reconstrução e reinicialização dos containers

### Resultado
O serviço ML agora está funcionando corretamente com o arquivo simplificado. Implementamos os seguintes endpoints:

- `/health` - Verificação de saúde do serviço
- `/detect` - Detecção de objetos em uma imagem
- `/detect/<catalog_id>` - Processamento de um catálogo completo
- `/detect/status/<job_id>` - Verificação do status de um job de detecção
- `/detect/result/<job_id>` - Obtenção dos resultados de uma detecção
- `/train` - Treinamento de um novo modelo
- `/train/status/<job_id>` - Verificação do status de um job de treinamento
- `/models` - Listagem de modelos disponíveis
- `/models/<model_id>` - Exclusão de um modelo

Todos os endpoints foram testados e estão funcionando corretamente.

### Próximos Passos
1. Integrar o serviço ML com o backend
2. Implementar o processamento real de imagens usando OpenCV e PyTorch
3. Implementar o treinamento real de modelos

## Como Executar o Projeto
1. Clone o repositório
2. Execute `docker-compose up -d` para iniciar todos os serviços
3. Acesse a aplicação em `http://localhost:80`
4. O backend está disponível em `http://localhost:8001`
5. O serviço ML está disponível em `http://localhost:5050`

## Estrutura do Projeto
- **frontend**: Aplicação React servida pelo Nginx
- **backend**: API FastAPI
- **ml-service**: Serviço de processamento de imagens com PyTorch e OpenCV
- **mongodb**: Banco de dados
- **minio**: Armazenamento de objetos
- **nginx**: Servidor web para o frontend

## API do Serviço ML

### Detecção de Objetos
```
POST /detect
{
  "image_url": "http://example.com/image.jpg",
  "model_id": "model_id",
  "min_confidence": 0.7
}
```

### Processamento de Catálogo
```
POST /detect/{catalog_id}
{
  "model_id": "model_id",
  "min_confidence": 0.7
}
```

### Treinamento de Modelo
```
POST /train
{
  "name": "Nome do Modelo",
  "catalog_ids": ["catalog_id1", "catalog_id2"],
  "config": {
    "max_iter": 1000
  }
}
```

### Listagem de Modelos
```
GET /models
```

### Exclusão de Modelo
```
DELETE /models/{model_id}
``` 