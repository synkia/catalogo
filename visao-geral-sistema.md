# 🔄 Visão Geral do Sistema de Anotação e Treinamento

## 📊 Arquitetura do Sistema

```
+-------------------+        +---------------------+        +--------------------+
|                   |        |                     |        |                    |
|  FRONTEND (React) | <----> |  BACKEND (Python)   | <----> |  BANCO DE DADOS   |
|                   |        |                     |        |                    |
+-------------------+        +---------------------+        +--------------------+
         ^                             ^
         |                             |
         v                             v
+-------------------+        +---------------------+
|                   |        |                     |
|   ARMAZENAMENTO   |        |  DETECTRON2 / ML    |
|                   |        |                     |
+-------------------+        +---------------------+
```

## 🌊 Fluxos Principais

### 1️⃣ Fluxo de Upload e Processamento

```
Upload PDF -> Conversão para Imagens -> Armazenamento -> Visualização
```

### 2️⃣ Fluxo de Anotação

```
Seleção de Catálogo -> Visualização de Página -> Desenho de Bounding Box -> 
Classificação -> Salvamento Automático
```

### 3️⃣ Fluxo de Treinamento

```
Seleção de Dataset -> Configuração de Parâmetros -> Execução de Treinamento -> 
Monitoramento -> Avaliação
```

### 4️⃣ Fluxo de Inferência/Exportação

```
Upload de Novo Catálogo -> Detecção Automática -> Revisão Manual (opcional) -> 
Exportação para JSON
```

## 🧩 Componentes Principais

### Frontend

1. **Módulo de Upload**
   - Interface drag-and-drop
   - Visualização de progresso
   - Gestão de arquivos

2. **Editor de Anotações**
   - Canvas interativo
   - Ferramentas de desenho
   - Painel de categorias

3. **Painel de Treinamento**
   - Configuração de parâmetros
   - Visualização de métricas
   - Controles de execução

4. **Visualizador de Resultados**
   - Exibição de detecções
   - Ferramentas de correção
   - Opções de exportação

### Backend

1. **Serviço de Processamento de PDFs**
   - Conversão PDF -> Imagens
   - Pré-processamento de imagens
   - Extração de metadados

2. **API de Anotações**
   - CRUD de anotações
   - Validação de dados
   - Versionamento

3. **Gerenciador de Treinamento**
   - Preparação de datasets
   - Configuração do Detectron2
   - Execução e monitoramento

4. **Serviço de Inferência**
   - Aplicação do modelo treinado
   - Pós-processamento de resultados
   - Geração de JSON

### Banco de Dados

1. **Coleções/Tabelas Principais**
   - Catálogos
   - Páginas
   - Anotações
   - Modelos Treinados
   - Resultados de Inferência

## 🔌 Integrações Externas (Opcionais)

1. **Serviços de Armazenamento**
   - AWS S3 / Google Cloud Storage
   - Armazenamento local

2. **Serviços de OCR**
   - Google Vision API
   - AWS Textract
   - Tesseract (local)

3. **APIs do Marketplace**
   - Integração com API do MercadoLivre
   - Outros marketplaces

## 🔍 Detalhes Técnicos

### Formato de Dados de Anotação

```json
{
  "catalog_id": "cat123",
  "page_number": 5,
  "annotations": [
    {
      "id": "anno1",
      "type": "produto",
      "bbox": [100, 200, 300, 400],
      "confidence": 0.95,
      "metadata": {
        "created_at": "2023-06-15T10:30:00Z",
        "created_by": "user1"
      }
    }
  ]
}
```

### Formato de Saída JSON

```json
{
  "catalog_id": "cat123",
  "extracted_date": "2023-06-15T10:30:00Z",
  "products": [
    {
      "id": "prod1",
      "image_path": "storage/products/prod1.jpg",
      "bbox": [100, 200, 300, 400],
      "ocr_text": "Produto XYZ Modelo ABC",
      "confidence": 0.95
    }
  ]
}
```

## 🛡️ Considerações de Segurança

1. Validação de entrada em todos os endpoints
2. Sanitização de nomes de arquivos e paths
3. Limitação de tamanho de upload
4. Controle de acesso a recursos (opcional)

## 🚀 Caminhos de Expansão Futura

1. Reconhecimento de texto (OCR) integrado
2. Detecção automática de campos específicos (preço, código, etc.)
3. Integração direta com APIs de marketplaces
4. Interface móvel para anotação em tablets 