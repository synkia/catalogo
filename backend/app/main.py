from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Any, Optional
import os
import motor.motor_asyncio
import pdf2image
import uuid
from datetime import datetime
import httpx
import logging
import json
from bson import ObjectId
from .models import (
    CatalogSchema,
    AnnotationSchema,
    ProductDetectionSchema,
    TrainingRequestSchema
)
import shutil
from PIL import Image

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Classe para ajudar na serialização do ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

# Função auxiliar para serializar objetos do MongoDB
def serialize_mongo(obj):
    return json.loads(JSONEncoder().encode(obj))

# Inicializar aplicação FastAPI
app = FastAPI(
    title="Catalogo ML API",
    description="API para extração e análise de produtos em catálogos",
    version="0.1.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:50029", 
        "http://localhost:55825",
        "http://191.252.110.108:3000",
        "http://191.252.110.108:50029",
        "http://191.252.110.108:55825",
        "http://191.252.110.108"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurações
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATA_DIR = os.getenv("DATA_DIR", "./data")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:5000")

# Garantir que os diretórios necessários existam
os.makedirs(f"{DATA_DIR}/uploads", exist_ok=True)
os.makedirs(f"{DATA_DIR}/images", exist_ok=True)
os.makedirs(f"{DATA_DIR}/annotations", exist_ok=True)

# Conexão com o MongoDB (com tratamento de erro)
USE_MOCK_DB = os.getenv("USE_MOCK_DB", "false").lower() == "true"

if not USE_MOCK_DB:
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Verificar a conexão
        client.admin.command('ping')
        db = client.catalogo_db
        print("✅ Conexão com MongoDB estabelecida com sucesso")
    except Exception as e:
        print(f"⚠️ Erro ao conectar ao MongoDB: {str(e)}")
        print("⚠️ Usando banco de dados simulado para demonstração")
        USE_MOCK_DB = True
else:
    print("🔧 Modo de demonstração ativado manualmente")
    client = None
    db = None
    
    # Dados simulados para demonstração
    mock_catalogs = [
        {
            "catalog_id": "demo-catalog-1",
            "filename": "catalogo_exemplo.pdf",
            "upload_date": datetime.now().isoformat(),
            "status": "ready",
            "page_count": 3,
            "file_path": f"{DATA_DIR}/uploads/demo-catalog-1.pdf"
        },
        {
            "catalog_id": "demo-catalog-2",
            "filename": "produtos_verao.jpg",
            "upload_date": datetime.now().isoformat(),
            "status": "ready",
            "page_count": 1,
            "file_path": f"{DATA_DIR}/uploads/demo-catalog-2.jpg"
        }
    ]
    mock_annotations = []
    
    # Criar imagens de exemplo para demonstração
    os.makedirs(f"{DATA_DIR}/images/demo-catalog-1", exist_ok=True)
    os.makedirs(f"{DATA_DIR}/images/demo-catalog-2", exist_ok=True)
    
    # Criar imagens de exemplo com texto
    for i in range(1, 4):
        img = Image.new('RGB', (800, 600), color = (255, 255, 255))
        from PIL import ImageDraw, ImageFont
        d = ImageDraw.Draw(img)
        d.text((300, 300), f"Página de exemplo {i}", fill=(0, 0, 0))
        img.save(f"{DATA_DIR}/images/demo-catalog-1/page_{i}.jpg")
    
    # Criar imagem de exemplo para o segundo catálogo
    img = Image.new('RGB', (800, 600), color = (200, 240, 255))
    d = ImageDraw.Draw(img)
    d.text((300, 300), "Produtos de Verão", fill=(0, 0, 0))
    img.save(f"{DATA_DIR}/images/demo-catalog-2/page_1.jpg")

# Rotas de catalogo
@app.post("/catalogs/", response_model=Dict[str, Any])
async def create_catalog(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Faz upload de um novo catálogo em PDF ou imagem (JPG, JPEG, PNG) e processa para extração.
    """
    try:
        # Validar tipos de arquivos aceitos
        accepted_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
        filename_lower = file.filename.lower()
        is_valid = any(filename_lower.endswith(ext) for ext in accepted_extensions)
        
        if not is_valid:
            raise HTTPException(status_code=400, detail="Apenas arquivos PDF, JPG, JPEG e PNG são aceitos")
        
        catalog_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Determinar a extensão
        file_extension = os.path.splitext(filename_lower)[1]
        
        # Salvar arquivo temporariamente (mantendo a extensão original)
        upload_path = f"{DATA_DIR}/uploads/{catalog_id}{file_extension}"
        with open(upload_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Criar entrada no banco de dados
        catalog_info = {
            "catalog_id": catalog_id,
            "filename": file.filename,
            "upload_date": timestamp,
            "status": "processing",
            "page_count": 0,
            "file_path": upload_path,
            "file_type": file_extension[1:]  # Remover o ponto da extensão
        }
        
        if USE_MOCK_DB:
            mock_catalogs.append(catalog_info)
        else:
            await db.catalogs.insert_one(catalog_info)
        
        # Agendar processamento em background
        background_tasks.add_task(process_catalog, catalog_id, upload_path)
        
        return {
            "message": "Catálogo enviado com sucesso e está sendo processado",
            "catalog_id": catalog_id
        }
    
    except Exception as e:
        logger.error(f"Erro ao processar upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar o upload: {str(e)}")

async def process_catalog(catalog_id: str, file_path: str):
    """
    Processa o catálogo (PDF ou imagem), convertendo em imagens e atualizando o status.
    """
    try:
        # Obter informações do catálogo
        if USE_MOCK_DB:
            catalog_info = next((cat for cat in mock_catalogs if cat["catalog_id"] == catalog_id), None)
        else:
            catalog_info = await db.catalogs.find_one({"catalog_id": catalog_id})
            
        if not catalog_info:
            raise Exception(f"Catálogo {catalog_id} não encontrado no banco de dados")
        
        file_type = catalog_info.get("file_type", "pdf")  # Padrão para PDF se não especificado
        
        # Criar pasta para imagens
        images_folder = f"{DATA_DIR}/images/{catalog_id}"
        os.makedirs(images_folder, exist_ok=True)
        
        page_count = 0
        
        # Processamento baseado no tipo de arquivo
        if file_type == "pdf":
            # Usar pdf2image para converter PDF para imagens
            try:
                images = pdf2image.convert_from_path(file_path)
                
                # Salvar imagens
                for i, image in enumerate(images):
                    image_path = f"{images_folder}/page_{i+1}.jpg"
                    image.save(image_path, "JPEG")
                    page_count += 1
            except Exception as pdf_error:
                logger.error(f"Erro ao processar PDF {catalog_id}: {str(pdf_error)}")
                raise pdf_error
        
        elif file_type in ["jpg", "jpeg", "png"]:
            # Processar arquivo de imagem único
            try:
                # Abrir a imagem
                with Image.open(file_path) as img:
                    # Salvar a imagem como JPEG para padronização
                    image_path = f"{images_folder}/page_1.jpg"
                    img.convert("RGB").save(image_path, "JPEG")
                    page_count = 1
            except Exception as img_error:
                logger.error(f"Erro ao processar imagem {catalog_id}: {str(img_error)}")
                raise img_error
        
        else:
            raise Exception(f"Tipo de arquivo não suportado: {file_type}")
        
        # Atualizar status no banco de dados
        if USE_MOCK_DB:
            for cat in mock_catalogs:
                if cat["catalog_id"] == catalog_id:
                    cat["status"] = "ready"
                    cat["page_count"] = page_count
        else:
            await db.catalogs.update_one(
                {"catalog_id": catalog_id},
                {"$set": {"status": "ready", "page_count": page_count}}
            )
        
        logger.info(f"Catálogo {catalog_id} processado com sucesso. {page_count} páginas extraídas.")
        
    except Exception as e:
        logger.error(f"Erro ao processar catálogo {catalog_id}: {str(e)}")
        if USE_MOCK_DB:
            for cat in mock_catalogs:
                if cat["catalog_id"] == catalog_id:
                    cat["status"] = "error"
                    cat["error_message"] = str(e)
        else:
            await db.catalogs.update_one(
                {"catalog_id": catalog_id},
                {"$set": {"status": "error", "error_message": str(e)}}
            )

@app.get("/catalogs/", response_model=List[Dict[str, Any]])
async def list_catalogs():
    """
    Lista todos os catálogos disponíveis.
    """
    if USE_MOCK_DB:
        return mock_catalogs
    else:
        catalogs = await db.catalogs.find().to_list(length=100)
        # Converter ObjectIds para strings
        return serialize_mongo(catalogs)

@app.get("/catalogs/{catalog_id}", response_model=Dict[str, Any])
async def get_catalog(catalog_id: str):
    """
    Obtém informações detalhadas sobre um catálogo específico.
    """
    if USE_MOCK_DB:
        catalog = next((cat for cat in mock_catalogs if cat["catalog_id"] == catalog_id), None)
    else:
        catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
        
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Converter ObjectIds para strings se necessário
    if not USE_MOCK_DB:
        return serialize_mongo(catalog)
    return catalog

@app.delete("/catalogs/{catalog_id}", response_model=Dict[str, Any])
async def delete_catalog(catalog_id: str):
    """
    Exclui um catálogo e todos os seus recursos associados.
    """
    # Verificar se o catálogo existe
    catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    try:
        # Remover registro do banco de dados
        await db.catalogs.delete_one({"catalog_id": catalog_id})
        
        # Remover anotações relacionadas
        await db.annotations.delete_many({"catalog_id": catalog_id})
        
        # Remover arquivos
        pdf_path = catalog.get("file_path")
        if pdf_path and os.path.exists(pdf_path):
            os.remove(pdf_path)
        
        # Remover diretório de imagens
        images_dir = f"{DATA_DIR}/images/{catalog_id}"
        if os.path.exists(images_dir):
            shutil.rmtree(images_dir)
        
        return {"success": True, "message": "Catálogo excluído com sucesso"}
    
    except Exception as e:
        logger.error(f"Erro ao excluir catálogo {catalog_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao excluir catálogo: {str(e)}")

@app.get("/catalogs/{catalog_id}/pages", response_model=List[Dict[str, Any]])
async def list_catalog_pages(catalog_id: str):
    """
    Lista todas as páginas de um catálogo específico.
    """
    if USE_MOCK_DB:
        catalog = next((cat for cat in mock_catalogs if cat["catalog_id"] == catalog_id), None)
    else:
        catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
        
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Simular lista de páginas
    pages = []
    for i in range(1, catalog.get("page_count", 0) + 1):
        pages.append({
            "page_number": i,
            "image_path": f"/catalogs/{catalog_id}/pages/{i}/image"
        })
    
    # Converter ObjectIds para strings se necessário
    if not USE_MOCK_DB:
        return serialize_mongo(pages)
    return pages

@app.get("/catalogs/{catalog_id}/pages/{page_number}/image")
async def get_catalog_page_image(catalog_id: str, page_number: int):
    """
    Obtém a imagem de uma página específica de um catálogo.
    """
    # Verificar se o catálogo existe
    catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Verificar se a página existe
    if page_number < 1 or page_number > catalog.get("page_count", 0):
        raise HTTPException(status_code=404, detail="Página não encontrada")
    
    # Caminho da imagem
    image_path = f"{DATA_DIR}/images/{catalog_id}/page_{page_number}.jpg"
    
    # Verificar se a imagem existe
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    # Retornar a imagem
    return FileResponse(image_path, media_type="image/jpeg")

@app.get("/catalogs/{catalog_id}/detection", response_model=Dict[str, Any])
async def get_catalog_detection(catalog_id: str):
    """
    Obtém as detecções de um catálogo específico.
    """
    # Verificar se o catálogo existe
    catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Para simplificar, vamos buscar o resultado mais recente para este catálogo
    # Em um ambiente real, você pode querer buscar por job_id ou algum outro critério
    
    try:
        # Chamar o serviço ML para buscar as detecções
        # Usando o formato de job_id esperado pelo serviço ML
        job_id = f"detection_job_{catalog_id}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ML_SERVICE_URL}/results/{job_id}")
            
            if response.status_code == 200:
                result_data = response.json()
                
                # Formatar as detecções para a resposta esperada pelo frontend
                # Extrair todos os produtos de todas as páginas
                all_annotations = []
                
                for page_result in result_data.get("results", []):
                    for annotation in page_result.get("annotations", []):
                        # Adicionar informações da página ao objeto de anotação
                        annotation["page_number"] = page_result.get("page_number", 1)
                        annotation["image_url"] = page_result.get("image_url", "")
                        all_annotations.append(annotation)
                
                return {
                    "catalog_id": catalog_id,
                    "annotations": all_annotations
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

# Rotas de anotações
@app.post("/annotations/", response_model=Dict[str, Any])
async def create_annotation(annotation: AnnotationSchema):
    """
    Cria ou atualiza anotações para uma página de catálogo.
    """
    # Verificar se o catálogo existe
    catalog = await db.catalogs.find_one({"catalog_id": annotation.catalog_id})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Estrutura para salvar
    annotation_data = annotation.dict()
    annotation_data["timestamp"] = datetime.now().isoformat()
    
    # Verificar se já existe anotação para essa página
    existing = await db.annotations.find_one({
        "catalog_id": annotation.catalog_id,
        "page_number": annotation.page_number
    })
    
    if existing:
        # Atualizar anotação existente
        result = await db.annotations.update_one(
            {"_id": existing["_id"]},
            {"$set": annotation_data}
        )
        return serialize_mongo({"success": True, "updated": True, "id": str(existing["_id"])})
    else:
        # Inserir nova anotação
        result = await db.annotations.insert_one(annotation_data)
        return serialize_mongo({"success": True, "updated": False, "id": str(result.inserted_id)})

@app.get("/annotations/{catalog_id}/{page_number}", response_model=Dict[str, Any])
async def get_annotation(catalog_id: str, page_number: int):
    """
    Obtém anotações para uma página específica de um catálogo.
    """
    # Buscar anotação
    annotation = await db.annotations.find_one({
        "catalog_id": catalog_id,
        "page_number": page_number
    })
    
    if not annotation:
        # Retornar estrutura vazia se não houver anotação
        return serialize_mongo({
            "catalog_id": catalog_id,
            "page_number": page_number,
            "annotations": []
        })
    
    # Converter ObjectIds para strings
    return serialize_mongo(annotation)

# Rotas de treinamento e detecção
@app.post("/training/start", response_model=Dict[str, Any])
async def start_training(request: TrainingRequestSchema):
    """
    Inicia um novo treinamento do modelo Detectron2.
    (Mantida por compatibilidade, redireciona para /train)
    """
    return await start_training_direct(request)

@app.post("/train", response_model=Dict[str, Any])
async def start_training_direct(request: TrainingRequestSchema):
    """
    Inicia um novo treinamento do modelo Detectron2.
    Rota direta para o serviço ML.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ML_SERVICE_URL}/train",
                json=request.dict(),
                timeout=30.0  # Apenas para iniciar o treinamento, não espera conclusão
            )
            
            if response.status_code == 200:
                return serialize_mongo(response.json())
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

@app.get("/training/status/{job_id}", response_model=Dict[str, Any])
async def get_training_status(job_id: str):
    """
    Verifica o status de um job de treinamento.
    (Mantida por compatibilidade, redireciona para /train/status)
    """
    return await get_training_status_direct(job_id)

@app.get("/train/status/{job_id}", response_model=Dict[str, Any]) 
async def get_training_status_direct(job_id: str):
    """
    Verifica o status de um job de treinamento.
    Rota direta para o serviço ML.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ML_SERVICE_URL}/train/status/{job_id}")
            
            if response.status_code == 200:
                return serialize_mongo(response.json())
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

@app.post("/detect/{catalog_id}", response_model=Dict[str, Any])
async def detect_products(catalog_id: str, request: Request):
    """
    Detecta produtos em um catálogo usando o modelo treinado.
    """
    # Extrair o model_id do corpo da requisição
    request_data = await request.json()
    model_id = request_data.get("model_id")
    
    print(f"Backend recebeu requisição para /detect/{catalog_id} com model_id: {model_id}")
    print(f"Dados completos recebidos: {request_data}")
    print(f"Tipo do model_id: {type(model_id)}")
    
    # Verificar se o model_id foi fornecido
    if not model_id:
        print("ERRO: ID do modelo não fornecido na requisição!")
        raise HTTPException(status_code=400, detail="ID do modelo não fornecido")
    
    # Verificar se o catálogo existe
    catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
    if not catalog:
        print(f"ERRO: Catálogo com ID {catalog_id} não encontrado!")
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    try:
        async with httpx.AsyncClient() as client:
            # Modificando para usar a rota correta com o catalog_id na URL
            json_data = {"model_id": model_id}
            print(f"Enviando para ML Service: {json_data}")
            print(f"URL do ML Service: {ML_SERVICE_URL}/detect/{catalog_id}")
            
            response = await client.post(
                f"{ML_SERVICE_URL}/detect/{catalog_id}",
                json=json_data,
                timeout=30.0
            )
            
            print(f"Response from ML service: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                return serialize_mongo(response.json())
            else:
                error_detail = f"Erro no serviço ML: {response.text}"
                print(f"ERRO: {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_detail
                )
    except httpx.RequestError as e:
        error_message = f"Erro ao comunicar com serviço ML: {str(e)}"
        print(f"ERRO DE CONEXÃO: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@app.get("/detect/status/{job_id}", response_model=Dict[str, Any])
async def get_detection_status(job_id: str):
    """
    Verifica o status de um job de detecção.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ML_SERVICE_URL}/detect/status/{job_id}")
            
            if response.status_code == 200:
                return serialize_mongo(response.json())
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

@app.get("/results/{job_id}", response_model=Dict[str, Any])
async def get_detection_results(job_id: str):
    """
    Obtém os resultados de uma detecção.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ML_SERVICE_URL}/results/{job_id}")
            
            if response.status_code == 200:
                return serialize_mongo(response.json())
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

@app.get("/models", response_model=List[Dict[str, Any]])
async def list_models():
    """
    Lista todos os modelos treinados disponíveis.
    """
    print("Backend - Requisição para listar modelos")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ML_SERVICE_URL}/models")
            
            if response.status_code == 200:
                models_list = response.json()
                print(f"Backend - Modelos recebidos do ML Service: {len(models_list)}")
                for idx, model in enumerate(models_list):
                    print(f"  Modelo {idx+1}: ID={model.get('model_id')}, Nome={model.get('name')}")
                
                return serialize_mongo(models_list)
            else:
                print(f"Backend - Erro ao listar modelos: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        print(f"Backend - Erro de conexão ao listar modelos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

@app.delete("/models/{model_id}", response_model=Dict[str, Any])
async def delete_model(model_id: str):
    """
    Exclui um modelo treinado.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(f"{ML_SERVICE_URL}/models/{model_id}")
            
            if response.status_code == 200:
                return serialize_mongo(response.json())
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro no serviço ML: {response.text}"
                )
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comunicar com serviço ML: {str(e)}")

@app.get("/")
async def root():
    return serialize_mongo({"message": "Catalogo ML API - Sistema de Extração e Análise de Produtos em Catálogos"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 