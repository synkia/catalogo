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
    TrainingRequestSchema,
    PdfToJpgSchema
)
import shutil
from PIL import Image
import zipfile
import io

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
    allow_origins=["*"],  # Permite todas as origens
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Configurações
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATA_DIR = os.getenv("DATA_DIR", "./data")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:5000")

# Configuração global para tamanho máximo de upload
# 100MB = 100 * 1024 * 1024 = 104857600 bytes
MAX_UPLOAD_SIZE = 104857600

# Garantir que os diretórios necessários existam
os.makedirs(f"{DATA_DIR}/uploads", exist_ok=True)
os.makedirs(f"{DATA_DIR}/images", exist_ok=True)
os.makedirs(f"{DATA_DIR}/annotations", exist_ok=True)

# Conexão com o MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = client.catalogo_db

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
        await db.catalogs.update_one(
            {"catalog_id": catalog_id},
            {"$set": {"status": "ready", "page_count": page_count}}
        )
        
        logger.info(f"Catálogo {catalog_id} processado com sucesso. {page_count} páginas extraídas.")
        
    except Exception as e:
        logger.error(f"Erro ao processar catálogo {catalog_id}: {str(e)}")
        await db.catalogs.update_one(
            {"catalog_id": catalog_id},
            {"$set": {"status": "error", "error_message": str(e)}}
        )

@app.get("/catalogs/", response_model=List[Dict[str, Any]])
async def list_catalogs():
    """
    Lista todos os catálogos disponíveis.
    """
    catalogs = await db.catalogs.find().to_list(length=100)
    # Converter ObjectIds para strings
    return serialize_mongo(catalogs)

@app.get("/catalogs/{catalog_id}", response_model=Dict[str, Any])
async def get_catalog(catalog_id: str):
    """
    Obtém informações detalhadas sobre um catálogo específico.
    """
    catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Converter ObjectIds para strings
    return serialize_mongo(catalog)

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
    catalog = await db.catalogs.find_one({"catalog_id": catalog_id})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo não encontrado")
    
    # Simular lista de páginas
    pages = []
    for i in range(1, catalog.get("page_count", 0) + 1):
        pages.append({
            "page_number": i,
            "image_path": f"/api/catalogs/{catalog_id}/pages/{i}/image"
        })
    
    # Converter ObjectIds para strings se necessário
    return serialize_mongo(pages)

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
    
    # Tentar diferentes formatos de job_id
    possible_job_ids = [
        f"detection_job_{catalog_id}",  # Formato padrão
        catalog_id,                      # O próprio catalog_id
    ]
    
    # Buscar na coleção de jobs se existe algum job para este catálogo
    detection_job = await db.detection_jobs.find_one({"catalog_id": catalog_id}, sort=[("created_at", -1)])
    if detection_job and "job_id" in detection_job:
        possible_job_ids.insert(0, detection_job["job_id"])  # Adiciona o job_id mais recente
    
    # Log dos job_ids que serão testados
    print(f"Tentando recuperar resultados para o catálogo {catalog_id} com os seguintes job_ids: {possible_job_ids}")
    
    # Tentar cada job_id em sucessão
    for job_id in possible_job_ids:
        try:
            # Chamar o serviço ML para buscar as detecções com este job_id
            async with httpx.AsyncClient() as client:
                print(f"Tentando buscar resultados com job_id: {job_id}")
                response = await client.get(f"{ML_SERVICE_URL}/results/{job_id}")
                
                if response.status_code == 200:
                    result_data = response.json()
                    
                    # Formatar as detecções para a resposta esperada pelo frontend
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
        except httpx.RequestError as e:
            print(f"Erro ao tentar job_id {job_id}: {str(e)}")
            continue
    
    # Se nenhum dos job_ids funcionou, tentar buscar anotações manuais
    try:
        annotations = []
        # Buscar as páginas do catálogo
        pages = await db.pages.find({"catalog_id": catalog_id}).to_list(1000)
        
        for page in pages:
            page_number = page.get("page_number", 1)
            # Buscar anotações para esta página
            page_annotations = await db.annotations.find_one({
                "catalog_id": catalog_id,
                "page_number": page_number
            })
            
            if page_annotations and "annotations" in page_annotations:
                for annotation in page_annotations["annotations"]:
                    if annotation.get("type") == "produto":
                        # Adicionar informação da página
                        annotation["page_number"] = page_number
                        annotation["image_url"] = f"/catalogs/{catalog_id}/pages/{page_number}/image"
                        annotations.append(annotation)
        
        if annotations:
            return {
                "catalog_id": catalog_id,
                "annotations": annotations
            }
    except Exception as e:
        print(f"Erro ao buscar anotações manuais: {str(e)}")
    
    # Se chegou aqui, não encontrou nenhum resultado
    raise HTTPException(
        status_code=404,
        detail=f"Detecções não encontradas para o catálogo {catalog_id}. Execute uma detecção primeiro."
    )

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

@app.post("/detect/{catalog_id}", response_model=Dict[str, Any])
async def detect_products(catalog_id: str, request: Request):
    """
    Detecta produtos em um catálogo.
    """
    try:
        # Extrair dados do corpo da requisição (se houver)
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        min_confidence = body.get("min_confidence", 0.5)
        detect_classes = body.get("detect_classes", ["produto"])
        
        print(f"Detectando produtos no catálogo {catalog_id}")
        print(f"min_confidence: {min_confidence}")
        print(f"detect_classes: {detect_classes}")
        
        async with httpx.AsyncClient() as client:
            # Modificando para usar a rota correta com o catalog_id na URL
            json_data = {
                "min_confidence": min_confidence,
                "detect_classes": detect_classes
            }
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

@app.get("/manifest.json", include_in_schema=False)
async def get_manifest():
    return JSONResponse({
        "short_name": "Catalogo ML",
        "name": "Catalogo ML - Sistema de Extração e Análise de Produtos em Catálogos",
        "icons": [
            {
                "src": "favicon.ico",
                "sizes": "64x64 32x32 24x24 16x16",
                "type": "image/x-icon"
            }
        ],
        "start_url": ".",
        "display": "standalone",
        "theme_color": "#2D4B73",
        "background_color": "#ffffff"
    })

@app.get("/")
async def root():
    return serialize_mongo({"message": "Catalogo ML API - Sistema de Extração e Análise de Produtos em Catálogos"})

# Função para converter PDF para JPG
async def convert_pdf_to_jpg(file_path: str, output_dir: str, dpi: int = 200, quality: int = 90):
    """
    Converte todas as páginas de um PDF para arquivos JPG
    """
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Converter PDF para imagens
        images = pdf2image.convert_from_path(
            file_path,
            dpi=dpi,
            output_folder=None,
            fmt="jpeg"
        )
        
        image_paths = []
        
        # Salvar cada página como um arquivo JPG
        for i, image in enumerate(images):
            image_path = os.path.join(output_dir, f"pagina_{i+1}.jpg")
            image.save(image_path, "JPEG", quality=quality)
            image_paths.append(image_path)
            
        return image_paths
    except Exception as e:
        logger.error(f"Erro ao converter PDF para JPG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao converter PDF: {str(e)}")

@app.post("/pdf-to-jpg/", response_model=Dict[str, Any])
async def pdf_to_jpg(
    background_tasks: BackgroundTasks,
    params: Optional[PdfToJpgSchema] = None,
    file: UploadFile = File(..., description="Arquivo PDF para converter em JPG"),
):
    """
    Converte um arquivo PDF em imagens JPG.
    Se o PDF tiver mais de uma página, retorna um arquivo ZIP com todas as imagens.
    """
    # Log para debug
    logging.info(f"Recebendo arquivo PDF para conversão: {file.filename}, Content-Type: {file.content_type}")
    
    # Verificar tamanho do arquivo (limite de 100MB)
    MAX_FILE_SIZE = MAX_UPLOAD_SIZE
    
    # Verificar o tipo de arquivo
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos")
    
    # Criar diretório temporário para processar o arquivo
    conversion_id = str(uuid.uuid4())
    temp_dir = os.path.join("/data", "pdf_to_jpg", conversion_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    # Salvar o arquivo PDF com verificação de tamanho
    pdf_path = os.path.join(temp_dir, "arquivo.pdf")
    
    try:
        content = await file.read()
        file_size = len(content)
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"Arquivo muito grande. O tamanho máximo permitido é 100MB. Seu arquivo tem {file_size / (1024 * 1024):.2f}MB"
            )
            
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(content)
            
        # Resetar o cursor do arquivo para o início
        await file.seek(0)
    
    except Exception as e:
        # Limpar diretório temporário em caso de erro
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.error(f"Erro ao salvar arquivo PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")

    # Diretório para salvar as imagens JPG
    jpg_dir = os.path.join(temp_dir, "jpg")
    os.makedirs(jpg_dir, exist_ok=True)
    
    # Configurações de conversão
    config = {
        "dpi": 200,
        "quality": 90
    }
    
    if params:
        config["dpi"] = params.dpi if params.dpi else 200
        config["quality"] = params.quality if params.quality else 90
    
    try:
        # Converter PDF para JPG
        image_paths = await convert_pdf_to_jpg(
            pdf_path, 
            jpg_dir,
            dpi=config["dpi"],
            quality=config["quality"]
        )
        
        # Verificar se há uma ou mais páginas
        if len(image_paths) == 1:
            # Se há apenas uma página, retornar a imagem diretamente
            return FileResponse(
                image_paths[0],
                media_type="image/jpeg",
                filename=f"{os.path.splitext(file.filename)[0]}.jpg"
            )
        else:
            # Se há múltiplas páginas, criar um arquivo ZIP
            zip_path = os.path.join(temp_dir, "imagens.zip")
            
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for i, img_path in enumerate(image_paths):
                    zipf.write(
                        img_path, 
                        arcname=f"pagina_{i+1}.jpg"
                    )
            
            # Retornar o arquivo ZIP
            return FileResponse(
                zip_path,
                media_type="application/zip",
                filename=f"{os.path.splitext(file.filename)[0]}_imagens.zip"
            )
    
    except Exception as e:
        logger.error(f"Erro ao processar PDF: {str(e)}")
        # Limpar arquivos temporários em caso de erro
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar PDF: {str(e)}")
    
    finally:
        # Agendar limpeza dos arquivos temporários (após 30 minutos)
        background_tasks.add_task(lambda: shutil.rmtree(temp_dir, ignore_errors=True))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)      