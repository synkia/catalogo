from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum


class AnnotationType(str, Enum):
    PRODUTO = "produto"
    LOGO = "logo"
    CABECALHO = "cabecalho"
    DECORATIVO = "decorativo"


class BoundingBox(BaseModel):
    x1: int = Field(..., description="Coordenada X do ponto superior esquerdo")
    y1: int = Field(..., description="Coordenada Y do ponto superior esquerdo")
    x2: int = Field(..., description="Coordenada X do ponto inferior direito")
    y2: int = Field(..., description="Coordenada Y do ponto inferior direito")


class Annotation(BaseModel):
    id: str = Field(..., description="Identificador único da anotação")
    type: AnnotationType = Field(..., description="Tipo de anotação")
    bbox: BoundingBox = Field(..., description="Bounding box da anotação")
    confidence: Optional[float] = Field(None, description="Nível de confiança da detecção")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Metadados adicionais")


class CatalogSchema(BaseModel):
    catalog_id: str = Field(..., description="Identificador único do catálogo")
    filename: str = Field(..., description="Nome original do arquivo")
    upload_date: str = Field(..., description="Data de upload (ISO format)")
    status: str = Field(..., description="Status do processamento")
    page_count: int = Field(..., description="Número de páginas")
    file_path: str = Field(..., description="Caminho do arquivo no servidor")
    error_message: Optional[str] = Field(None, description="Mensagem de erro, se houver")


class AnnotationSchema(BaseModel):
    catalog_id: str = Field(..., description="Identificador do catálogo")
    page_number: int = Field(..., description="Número da página")
    annotations: List[Annotation] = Field(..., description="Lista de anotações na página")


class ProductDetectionSchema(BaseModel):
    catalog_id: str = Field(..., description="Identificador do catálogo")
    min_confidence: Optional[float] = Field(0.5, description="Confiança mínima para detecções")
    detect_classes: Optional[List[AnnotationType]] = Field(
        [AnnotationType.PRODUTO], description="Classes a serem detectadas"
    )


class DetectionResult(BaseModel):
    page_number: int = Field(..., description="Número da página")
    annotations: List[Annotation] = Field(..., description="Anotações detectadas")
    image_path: Optional[str] = Field(None, description="Caminho da imagem processada")


class DetectionResultsSchema(BaseModel):
    catalog_id: str = Field(..., description="Identificador do catálogo")
    job_id: str = Field(..., description="Identificador do job de detecção")
    status: str = Field(..., description="Status da detecção")
    created_at: str = Field(..., description="Data de criação (ISO format)")
    completed_at: Optional[str] = Field(None, description="Data de conclusão (ISO format)")
    results: Optional[List[DetectionResult]] = Field(None, description="Resultados da detecção")
    error_message: Optional[str] = Field(None, description="Mensagem de erro, se houver")


class TrainingRequestSchema(BaseModel):
    name: str = Field(..., description="Nome do modelo")
    catalog_ids: List[str] = Field(..., description="Lista de IDs de catálogos para treinamento")
    config: Optional[Dict[str, Any]] = Field(None, description="Configurações de treinamento")


class PdfToJpgSchema(BaseModel):
    quality: Optional[int] = Field(90, description="Qualidade da imagem JPG (1-100)")
    dpi: Optional[int] = Field(200, description="DPI para conversão (maior = melhor qualidade)") 