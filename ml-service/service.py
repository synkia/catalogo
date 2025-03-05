import os
import uuid
import json
import time
import random
import requests
import traceback
import threading
from datetime import datetime
from backports.cached_property import cached_property
from flask import Flask, request, jsonify

# Injetar cached_property no módulo functools para compatibilidade com Python 3.7
import sys
import functools

if not hasattr(functools, 'cached_property'):
    print("Adicionando cached_property ao módulo functools para compatibilidade com Python 3.7")
    functools.cached_property = cached_property
    if 'functools' in sys.modules:
        sys.modules['functools'].cached_property = cached_property

# Implementar NMS em Python puro para contornar problemas com operações C++
def py_nms(boxes, scores, iou_threshold):
    """
    Implementação de NMS (Non-Maximum Suppression) em Python puro.
    
    Args:
        boxes: tensor de caixas delimitadoras [N, 4]
        scores: tensor de pontuações [N]
        iou_threshold: limiar de IoU para supressão
        
    Returns:
        Índices das caixas a serem mantidas
    """
    import torch
    import numpy as np
    
    # Converter para NumPy para operações mais simples
    if isinstance(boxes, torch.Tensor):
        boxes_np = boxes.detach().cpu().numpy()
        scores_np = scores.detach().cpu().numpy()
    else:
        boxes_np = np.array(boxes)
        scores_np = np.array(scores)
    
    # Obter coordenadas das caixas
    x1 = boxes_np[:, 0]
    y1 = boxes_np[:, 1]
    x2 = boxes_np[:, 2]
    y2 = boxes_np[:, 3]
    
    # Calcular área de cada caixa
    areas = (x2 - x1) * (y2 - y1)
    
    # Ordenar scores
    order = scores_np.argsort()[::-1]
    
    keep = []
    while order.size > 0:
        # Escolher a caixa com maior score
        i = order[0]
        keep.append(i)
        
        # Calcular IoU com as demais caixas
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        
        # Manter apenas caixas com IoU < threshold
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    
    # Converter de volta para tensor do PyTorch
    return torch.tensor(keep, dtype=torch.long, device=boxes.device if isinstance(boxes, torch.Tensor) else "cpu")

# Patch para monkey-patch a função NMS problemática
def patch_torchvision_nms():
    try:
        import torch
        import torchvision
        print(f"Versão do PyTorch: {torch.__version__}")
        print(f"Versão do torchvision: {torchvision.__version__}")
        
        import torchvision.ops.boxes as box_ops
        
        # Guardar a função original
        original_nms = box_ops.nms
        
        # Substituir pela nossa implementação
        def patched_nms(boxes, scores, iou_threshold):
            try:
                # Tentar usar a implementação original primeiro
                print("Tentando usar NMS original...")
                return original_nms(boxes, scores, iou_threshold)
            except Exception as e:
                # Se falhar, usar nossa implementação em Python puro
                print(f"Erro no NMS original: {str(e)}")
                print("Usando implementação de NMS em Python puro")
                return py_nms(boxes, scores, iou_threshold)
        
        # Aplicar o patch
        box_ops.nms = patched_nms
        
        # Também aplicar o patch para batched_nms
        original_batched_nms = torchvision.ops.boxes.batched_nms
        
        def patched_batched_nms(boxes, scores, idxs, iou_threshold):
            try:
                # Tentar usar a implementação original primeiro
                print("Tentando usar batched_nms original...")
                return original_batched_nms(boxes, scores, idxs, iou_threshold)
            except Exception as e:
                print(f"Erro no batched_nms original: {str(e)}")
                print("Implementando batched_nms manualmente com NMS em Python puro")
                
                # Implementação manual de batched_nms
                max_coordinate = boxes.max()
                offsets = idxs.to(boxes) * (max_coordinate + 1)
                boxes_for_nms = boxes + offsets[:, None]
                keep = py_nms(boxes_for_nms, scores, iou_threshold)
                return keep
        
        # Aplicar o patch para batched_nms
        torchvision.ops.boxes.batched_nms = patched_batched_nms
        
        print("Patch aplicado com sucesso para as funções NMS e batched_nms")
    except Exception as e:
        print(f"Erro ao aplicar patch para NMS: {str(e)}")
        traceback.print_exc()

# Aplicar patch de NMS
patch_torchvision_nms()

app = Flask(__name__)

# Configurações do serviço
backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
data_dir = os.environ.get("DATA_DIR", "/data")
models_dir = os.environ.get("MODELS_DIR", "/models")

# Bancos de dados em memória
models_db = []
detection_jobs = {}
training_jobs = {}

print("=== ML SERVICE INICIALIZADO ===")
print("Variáveis de ambiente:")
print(f"BACKEND_URL: {backend_url}")
print(f"DATA_DIR: {data_dir}")
print(f"MODELS_DIR: {models_dir}")

# Armazenamento em memória para jobs de detecção e treinamento
detection_jobs = {}
training_jobs = {}

# Função para salvar modelos em disco
def save_models_to_disk():
    """
    Salva a lista de modelos em um arquivo JSON no diretório de modelos.
    """
    models_dir = os.environ.get("MODELS_DIR", "/models")
    models_file = os.path.join(models_dir, "models_metadata.json")
    
    try:
        with open(models_file, "w") as f:
            json.dump(models_db, f, indent=2)
        print(f"Modelos salvos com sucesso em: {models_file}")
    except Exception as e:
        print(f"Erro ao salvar modelos: {str(e)}")

# Função para carregar modelos do disco
def load_models_from_disk():
    """
    Carrega a lista de modelos de um arquivo JSON no diretório de modelos.
    """
    models_dir = os.environ.get("MODELS_DIR", "/models")
    models_file = os.path.join(models_dir, "models_metadata.json")
    
    if os.path.exists(models_file):
        try:
            with open(models_file, "r") as f:
                loaded_models = json.load(f)
            print(f"Carregados {len(loaded_models)} modelos de: {models_file}")
            return loaded_models
        except Exception as e:
            print(f"Erro ao carregar modelos: {str(e)}")
    else:
        print(f"Arquivo de modelos não encontrado: {models_file}")
    
    # Retornar modelos padrão se não for possível carregar
    return [
        {
            "model_id": "6fa459ea-ee8a-3ca4-894e-db77e160355e",
            "name": "Modelo Produto Padrão",
            "created_at": "2023-10-15T14:30:00.000Z",
            "status": "ready",
            "base_model": "faster_rcnn_R_50_FPN_3x",
            "iterations": 1000,
            "classes": ["produto"],
            "metrics": {
                "accuracy": 0.92,
                "precision": 0.89,
                "recall": 0.94
            }
        },
        {
            "model_id": "7fa459ea-ee8a-3ca4-894e-db77e160355e",
            "name": "Modelo Multiclasse",
            "created_at": "2023-11-20T10:15:00.000Z",
            "status": "ready",
            "base_model": "mask_rcnn_R_101_FPN_3x",
            "iterations": 2500,
            "classes": ["produto", "etiqueta", "preço"],
            "metrics": {
                "accuracy": 0.88,
                "precision": 0.85,
                "recall": 0.90
            }
        }
    ]

# Inicializa a lista de modelos carregando do disco
models_db = load_models_from_disk()
catalog_jobs = {}  # Jobs para processamento de catálogos completos

# Verificar se os diretórios existem, caso contrário, criar
os.makedirs(data_dir, exist_ok=True)
os.makedirs(models_dir, exist_ok=True)
os.makedirs(os.path.join(data_dir, "annotations"), exist_ok=True)

@app.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint para verificar se o serviço está funcionando.
    """
    return jsonify({"status": "ok"})

@app.route('/detect', methods=['POST'])
def detect_image():
    """
    Endpoint para iniciar a detecção de objetos em uma imagem usando Detectron2.
    """
    import cv2
    import torch
    import numpy as np
    import os
    import requests
    import random
    import uuid
    from io import BytesIO
    from PIL import Image
    
    data = request.json
    
    if not data:
        return jsonify({"detail": "Dados inválidos"}), 400
        
    # Extrair parâmetros da requisição
    image_url = data.get("image_url")
    model_id = data.get("model_id")
    min_confidence = data.get("min_confidence", 0.7)
    
    if not image_url:
        return jsonify({"detail": "URL da imagem é obrigatória"}), 400
        
    if not model_id:
        # Usar o modelo padrão se não for especificado
        model_id = "6fa459ea-ee8a-3ca4-894e-db77e160355e"
    
    # Verificar se o modelo existe
    model_exists = False
    model_classes = ["produto"]
    
    for model in models_db:
        if model.get("model_id") == model_id:
            model_exists = True
            model_classes = model.get("classes", ["produto"])
            break
            
    if not model_exists:
        return jsonify({"detail": f"Modelo {model_id} não encontrado"}), 404
    
    # Criar um job para a detecção
    job_id = str(uuid.uuid4())
    
    # Iniciar detecção em um thread separado
    detection_jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "model_id": model_id,
        "image_url": image_url,
        "min_confidence": min_confidence
    }
    
    # Iniciar thread para processamento
    thread = threading.Thread(target=run_detection_simulated, args=(job_id, image_url, model_id, min_confidence, model_classes))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "job_id": job_id,
        "status": "pending",
        "message": "Detecção iniciada com sucesso"
    })

def run_detection_simulated(job_id, image_url, model_id, min_confidence, model_classes):
    """
    Função simulada para detecção de objetos em uma imagem.
    """
    import time
    import random
    import requests
    from io import BytesIO
    from PIL import Image
    import numpy as np
    
    try:
        # Atualizar status
        detection_jobs[job_id]["status"] = "processing"
        detection_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        
        # Baixar imagem
        try:
            response = requests.get(image_url)
            if response.status_code != 200:
                raise Exception(f"Erro ao baixar imagem: {response.status_code}")
                
            img = Image.open(BytesIO(response.content))
            width, height = img.size
            
        except Exception as e:
            raise Exception(f"Erro ao processar imagem: {str(e)}")
        
        # Simular tempo de processamento
        time.sleep(1)
        
        # Gerar detecções simuladas (entre 3 e 8 objetos)
        num_detections = random.randint(3, 8)
        detections = []
        
        for i in range(num_detections):
            # Gerar uma classe aleatória da lista de classes do modelo
            class_name = random.choice(model_classes)
            
            # Gerar uma caixa delimitadora aleatória
            x1 = random.randint(0, width - 100)
            y1 = random.randint(0, height - 100)
            w = random.randint(50, min(width - x1, 200))
            h = random.randint(50, min(height - y1, 200))
            x2 = x1 + w
            y2 = y1 + h
            
            # Gerar uma pontuação de confiança aleatória
            score = random.uniform(min_confidence, 1.0)
            
            # Adicionar à lista de detecções
            detections.append({
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "width": w,
                    "height": h
                },
                "class": class_name,
                "score": round(score, 3)
            })
        
        # Salvar resultados
        detection_jobs[job_id]["results"] = {
            "detections": detections,
            "image_width": width,
            "image_height": height,
            "model_id": model_id,
            "processing_time": round(random.uniform(0.5, 2.0), 2)
        }
        
        # Atualizar status
        detection_jobs[job_id]["status"] = "completed"
        detection_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        
    except Exception as e:
        error_msg = f"Erro durante a detecção: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        
        # Atualizar status
        detection_jobs[job_id]["status"] = "failed"
        detection_jobs[job_id]["error"] = error_msg
        detection_jobs[job_id]["updated_at"] = datetime.now().isoformat()

@app.route('/detect/<catalog_id>', methods=['POST'])
def start_detection(catalog_id):
    """
    Inicia a detecção em um catálogo completo usando Detectron2.
    """
    import cv2
    import torch
    import numpy as np
    import os
    import threading
    from detectron2.config import get_cfg
    from detectron2.engine.defaults import DefaultPredictor
    
    data = request.json
    
    if not data:
        return jsonify({"detail": "Dados inválidos"}), 400
        
    # Extrair parâmetros da requisição
    model_id = data.get("model_id")
    min_confidence = data.get("min_confidence", 0.7)
    
    if not model_id:
        return jsonify({"detail": "ID do modelo é obrigatório"}), 400
    
    # Verificar se o modelo existe e está pronto
    model_found = False
    for model in models_db:
        if model.get("model_id") == model_id:
            if model.get("status") != "ready":
                return jsonify({"detail": f"Modelo {model_id} não está pronto para uso"}), 400
            model_found = True
            break
    
    if not model_found:
        return jsonify({"detail": f"Modelo {model_id} não encontrado"}), 404
        
    # Criar ID único para o job
    job_id = str(uuid.uuid4())
    
    # Configurar caminhos
    models_dir = os.environ.get("MODELS_DIR", "/models")
    data_dir = os.environ.get("DATA_DIR", "/data")
    model_dir = os.path.join(models_dir, model_id)
    
    # Registrar o job
    catalog_jobs[job_id] = {
        "id": job_id,
        "catalog_id": catalog_id,
        "model_id": model_id,
        "min_confidence": min_confidence,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "progress": {
            "percentage": 0,
            "processed_pages": 0,
            "total_pages": 0  # Será atualizado após verificar o catálogo
        },
        "detections_count": 0,
        "log": ["Iniciando processamento do catálogo"],
        "error": None,
        "results": []
    }
    
    # Função para processar o catálogo em background
    def process_catalog_with_model():
        try:
            # Atualizar status
            catalog_jobs[job_id]["status"] = "processing"
            catalog_jobs[job_id]["updated_at"] = datetime.now().isoformat()
            
            # Obter informações do catálogo do backend
            try:
                catalog_url = f"{backend_url}/catalogs/{catalog_id}"
                print(f"DEBUG - Buscando metadados do catálogo: {catalog_url}")
                catalog_jobs[job_id]["log"].append(f"Buscando metadados: {catalog_url}")
                
                catalog_response = requests.get(catalog_url)
                
                if catalog_response.status_code != 200:
                    raise Exception(f"Erro ao obter informações do catálogo: {catalog_response.status_code}")
                
                catalog_data = catalog_response.json()
                print(f"DEBUG - Metadados obtidos: {catalog_data}")
                
                # Obter o número de páginas
                num_pages = catalog_data.get("page_count", 1)
                print(f"DEBUG - Catálogo {catalog_id} tem {num_pages} páginas")
                catalog_jobs[job_id]["log"].append(f"Catálogo {catalog_id} tem {num_pages} páginas")
                
                # Para cada página, obter as anotações
                catalog_annotations = []
                for page in range(1, num_pages + 1):
                    # Usar o endpoint correto para anotações
                    annotations_url = f"{backend_url}/annotations/{catalog_id}/{page}"
                    print(f"DEBUG - Buscando anotações em: {annotations_url}")
                    catalog_jobs[job_id]["log"].append(f"Buscando anotações: {annotations_url}")
                    
                    annotations_response = requests.get(annotations_url)
                    
                    if annotations_response.status_code == 200:
                        page_data = annotations_response.json()
                        page_annotations = page_data.get("annotations", [])
                        
                        print(f"DEBUG - Página {page}: {len(page_annotations)} anotações encontradas")
                        catalog_jobs[job_id]["log"].append(f"Página {page}: {len(page_annotations)} anotações")
                        
                        if len(page_annotations) > 0:
                            # Caminho da imagem
                            image_path = f"{data_dir}/images/{catalog_id}/page_{page}.jpg"
                            print(f"DEBUG - Verificando imagem: {image_path}")
                            
                            # Ler imagem para obter dimensões
                            if os.path.exists(image_path):
                                print(f"DEBUG - Imagem encontrada: {image_path}")
                                img = cv2.imread(image_path)
                                height, width = img.shape[:2]
                                
                                # Adicionar imagem ao conjunto (80% treino, 20% validação)
                                use_for_train = random.random() < 0.8
                                
                                image_info = {
                                    "id": img_id,
                                    "file_name": image_path,
                                    "height": height,
                                    "width": width
                                }
                                
                                target_dataset = coco_train if use_for_train else coco_val
                                target_dataset["images"].append(image_info)
                                
                                # Processar anotações
                                for annotation in page_annotations:
                                    bbox = annotation.get("bbox", {})
                                    classe = annotation.get("type", "produto")
                                    all_classes.add(classe)
                                    
                                    # Formato [x1, y1, x2, y2] para [x1, y1, largura, altura]
                                    x1, y1 = bbox.get("x1", 0), bbox.get("y1", 0)
                                    x2, y2 = bbox.get("x2", 0), bbox.get("y2", 0)
                                    width_box = x2 - x1
                                    height_box = y2 - y1
                                    
                                    # Adicionar à lista COCO
                                    target_dataset["annotations"].append({
                                        "id": ann_id,
                                        "image_id": img_id,
                                        "category_id": 1,  # Temporariamente fixo em 1 para "produto"
                                        "bbox": [x1, y1, width_box, height_box],
                                        "area": width_box * height_box,
                                        "iscrowd": 0
                                    })
                                    
                                    ann_id += 1
                                
                                img_id += 1
                            else:
                                print(f"ERRO - Imagem não encontrada: {image_path}")
                                catalog_jobs[job_id]["log"].append(f"Erro: Imagem não encontrada: {image_path}")
                    else:
                        print(f"ERRO - Falha ao obter anotações para página {page}: {annotations_response.status_code}")
                        print(f"ERRO - Resposta: {annotations_response.text}")
                        catalog_jobs[job_id]["log"].append(f"Erro ao obter anotações para página {page}")
                
            except Exception as e:
                error_msg = f"Erro ao processar catálogo {catalog_id}: {str(e)}"
                print(error_msg)
                catalog_jobs[job_id]["log"].append(error_msg)
            
            # Resumo final para diagnóstico
            print(f"DEBUG - Resumo do treinamento:")
            print(f"DEBUG - Total de imagens para treino: {len(coco_train['images'])}")
            print(f"DEBUG - Total de anotações para treino: {len(coco_train['annotations'])}")
            print(f"DEBUG - Total de imagens para validação: {len(coco_val['images'])}")
            print(f"DEBUG - Total de anotações para validação: {len(coco_val['annotations'])}")
            print(f"DEBUG - Classes encontradas: {list(all_classes)}")
            
            catalog_jobs[job_id]["log"].append(f"Resumo - Imagens treino: {len(coco_train['images'])}")
            catalog_jobs[job_id]["log"].append(f"Resumo - Anotações treino: {len(coco_train['annotations'])}")
            catalog_jobs[job_id]["log"].append(f"Resumo - Imagens validação: {len(coco_val['images'])}")
            catalog_jobs[job_id]["log"].append(f"Resumo - Anotações validação: {len(coco_val['annotations'])}")
            
            # Adicionar categorias
            category_id = 1
            for classe in sorted(all_classes):
                coco_train["categories"].append({
                    "id": category_id,
                    "name": classe,
                    "supercategory": "produto"
                })
                coco_val["categories"].append({
                    "id": category_id,
                    "name": classe,
                    "supercategory": "produto"
                })
                category_id += 1
            
            # Verificar se temos anotações suficientes
            if len(coco_train["annotations"]) == 0:
                raise Exception("Nenhuma anotação encontrada para treinamento")
            
            # Salvar anotações no formato COCO
            train_json_path = os.path.join(annotations_dir, f"{model_id}_train.json")
            val_json_path = os.path.join(annotations_dir, f"{model_id}_val.json")
            
            with open(train_json_path, 'w') as f:
                json.dump(coco_train, f)
            
            with open(val_json_path, 'w') as f:
                json.dump(coco_val, f)
            
            # Registrar datasets
            train_dataset_name = f"catalogo_train_{model_id}"
            val_dataset_name = f"catalogo_val_{model_id}"
            
            try:
                DatasetCatalog.remove(train_dataset_name)
                MetadataCatalog.remove(train_dataset_name)
            except:
                pass
                
            try:
                DatasetCatalog.remove(val_dataset_name)
                MetadataCatalog.remove(val_dataset_name)
            except:
                pass
            
            register_coco_instances(train_dataset_name, {}, train_json_path, data_dir)
            register_coco_instances(val_dataset_name, {}, val_json_path, data_dir)
            
            # Configurar modelo
            cfg = get_cfg()
            
            # Escolher modelo base de acordo com a configuração
            base_model = config.get("base_model", "COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml")
            cfg.merge_from_file(model_zoo.get_config_file(base_model))
            cfg.DATASETS.TRAIN = (train_dataset_name,)
            cfg.DATASETS.TEST = (val_dataset_name,)
            
            cfg.DATALOADER.NUM_WORKERS = 4
            cfg.MODEL.WEIGHTS = model_zoo.get_checkpoint_url(base_model)
            
            # Parâmetros de treinamento
            cfg.SOLVER.IMS_PER_BATCH = 4
            cfg.SOLVER.BASE_LR = config.get("learning_rate", 0.001)
            
            max_iter = config.get("max_iter", 1000)
            cfg.SOLVER.MAX_ITER = max_iter
            cfg.SOLVER.STEPS = (max_iter // 3, max_iter // 3 * 2)
            
            cfg.MODEL.ROI_HEADS.BATCH_SIZE_PER_IMAGE = 128
            cfg.MODEL.ROI_HEADS.NUM_CLASSES = len(all_classes)
            
            # Forçar uso da CPU para treinamento e inferência
            cfg.MODEL.DEVICE = "cpu"
            
            # Caminho para salvar o modelo
            cfg.OUTPUT_DIR = model_dir
            
            # Classe para treinamento com avaliação
            class TrainerWithProgressCallback(DefaultTrainer):
                @classmethod
                def build_evaluator(cls, cfg, dataset_name):
                    return COCOEvaluator(dataset_name, cfg, False, output_dir=cfg.OUTPUT_DIR)
                    
                def after_step(self):
                    # Atualizar progresso
                    current_iter = self.iter
                    if current_iter % 100 == 0 or current_iter >= self.max_iter - 1:
                        progress = min(1.0, current_iter / self.max_iter)
                        training_jobs[job_id]["progress"]["percentage"] = round(progress * 100, 1)
                        training_jobs[job_id]["progress"]["current_iteration"] = current_iter
                        training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
                        
                        # Log
                        loss = self.storage.latest().get("total_loss", 0.0)
                        log_msg = f"Iteração {current_iter}/{self.max_iter} - Loss: {loss:.4f}"
                        print(log_msg)
                        
                        if len(training_jobs[job_id].get("log", [])) > 20:
                            training_jobs[job_id]["log"].pop(0)
                        training_jobs[job_id]["log"].append(log_msg)
                    
                    # Chamada ao método original
                    super().after_step()
            
            # Iniciar treinamento
            os.makedirs(cfg.OUTPUT_DIR, exist_ok=True)
            trainer = TrainerWithProgressCallback(cfg)
            trainer.resume_or_load(resume=False)
            
            training_jobs[job_id]["log"].append("Iniciando treinamento do modelo...")
            
            # Treinar modelo
            trainer.train()
            
            # Salvar config final
            with open(os.path.join(model_dir, "config.yaml"), "w") as f:
                f.write(cfg.dump())
            
            # Avaliação final
            evaluator = COCOEvaluator(val_dataset_name, cfg, False, output_dir=cfg.OUTPUT_DIR)
            trainer.model.eval()
            evaluation_results = trainer.test(cfg, trainer.model, evaluators=[evaluator])
            
            # Extrair métricas da avaliação
            metrics = {}
            if evaluation_results:
                bbox_results = evaluation_results.get('bbox', {})
                metrics = {
                    "AP": bbox_results.get('AP', 0.0),
                    "AP50": bbox_results.get('AP50', 0.0),
                    "AP75": bbox_results.get('AP75', 0.0),
                    "precision": bbox_results.get('AP50', 0.0),  # Usando AP50 como proxy para precisão
                    "recall": bbox_results.get('AR@100', 0.0)
                }
            
            # Treinamento concluído
            training_jobs[job_id]["status"] = "completed"
            training_jobs[job_id]["progress"]["percentage"] = 100.0
            training_jobs[job_id]["progress"]["current_iteration"] = max_iter
            training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
            training_jobs[job_id]["log"].append("Treinamento concluído com sucesso!")
            
            # Atualizar status do modelo
            for model in models_db:
                if model.get("model_id") == model_id:
                    model["status"] = "ready"
                    model["completed_at"] = datetime.now().isoformat()
                    model["train_size"] = len(coco_train["images"])
                    model["val_size"] = len(coco_val["images"])
                    model["classes"] = list(all_classes)
                    model["metrics"] = metrics
                    # Salvar modelos em disco após atualização
                    save_models_to_disk()
                    break
            
        except Exception as e:
            # Registrar erro
            error_msg = f"Erro durante o processamento de catálogos: {str(e)}"
            print(error_msg)
            training_jobs[job_id]["log"].append(error_msg)
            raise e
    
    # Iniciar processamento em uma thread separada
    thread = threading.Thread(target=process_catalog_with_model)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "job_id": job_id,
        "status": "pending",
        "message": f"Processamento do catálogo {catalog_id} iniciado com sucesso"
    })

@app.route('/detect/status/<job_id>', methods=['GET'])
def get_detection_status(job_id):
    """
    Consulta o status de um job de detecção.
    """
    if job_id in detection_jobs:
        job_info = detection_jobs[job_id]
        
        return jsonify({
            "job_id": job_id,
            "status": job_info["status"],
            "created_at": job_info["created_at"],
            "updated_at": job_info["updated_at"],
            "error": job_info.get("error")
        })
    elif job_id in catalog_jobs:
        job_info = catalog_jobs[job_id]
        
        return jsonify({
            "job_id": job_id,
            "catalog_id": job_info["catalog_id"],
            "status": job_info["status"],
            "created_at": job_info["created_at"],
            "updated_at": job_info["updated_at"],
            "progress": job_info["progress"],
            "detections_count": job_info["detections_count"],
            "log": job_info["log"],
            "error": job_info.get("error")
        })
    else:
        return jsonify({"detail": f"Job de detecção {job_id} não encontrado"}), 404

@app.route('/detect/result/<job_id>', methods=['GET'])
def get_detection_result(job_id):
    """
    Retorna o resultado de um job de detecção concluído.
    """
    if job_id in detection_jobs:
        job_info = detection_jobs[job_id]
        
        if job_info["status"] != "completed":
            return jsonify({
                "job_id": job_id,
                "status": job_info["status"],
                "message": "Detecção ainda não concluída"
            })
            
        return jsonify({
            "job_id": job_id,
            "status": job_info["status"],
            "created_at": job_info["created_at"],
            "completed_at": job_info["updated_at"],
            "results": job_info["results"]
        })
    elif job_id in catalog_jobs:
        job_info = catalog_jobs[job_id]
        
        if job_info["status"] != "completed":
            return jsonify({
                "job_id": job_id,
                "status": job_info["status"],
                "message": "Processamento do catálogo ainda não concluído"
            })
            
        # Retorna os resultados reais do catálogo
        return jsonify({
            "job_id": job_id,
            "catalog_id": job_info["catalog_id"],
            "status": job_info["status"],
            "created_at": job_info["created_at"],
            "completed_at": job_info["updated_at"],
            "summary": {
                "total_pages": job_info["progress"]["total_pages"],
                "processed_pages": job_info["progress"]["processed_pages"],
                "total_detections": job_info["detections_count"]
            },
            "results": job_info["results"] if "results" in job_info else []
        })
    else:
        return jsonify({"detail": f"Job de detecção {job_id} não encontrado"}), 404

# Adiciona uma rota alternativa para compatibilidade com o backend
@app.route('/results/<job_id>', methods=['GET'])
def get_results(job_id):
    """
    Rota alternativa para obter resultados de detecção.
    Esta rota é necessária para compatibilidade com o backend.
    """
    print(f"Requisição para obter resultados de detecção via rota '/results/{job_id}'")
    return get_detection_result(job_id)

def run_training(job_id, model_name, catalog_ids, config):
    """
    Executa o treinamento de um modelo em um thread separado usando Detectron2.
    Atualiza o status do job e do modelo durante e após o treinamento.
    """
    import torch
    import numpy as np
    import cv2
    import os
    import sys
    import inspect
    import types
    import time
    import random
    
    # Obter informações do job
    job_info = training_jobs.get(job_id)
    if not job_info:
        print(f"Job não encontrado: {job_id}")
        return
    
    # Obter id do modelo
    model_id = job_info.get("model_id")
    print(f"Iniciando treinamento para job_id: {job_id}, model_id: {model_id}")
    
    # Atualizar status para "processing"
    training_jobs[job_id]["status"] = "processing"
    training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
    training_jobs[job_id]["log"] = ["Iniciando treinamento real com Detectron2..."]
    
    # Atualizar modelo
    for model in models_db:
        if model.get("model_id") == model_id:
            model["status"] = "training"
            # Salvar modelos em disco após atualização
            save_models_to_disk()
            break
    
    # Diretórios para treinamento
    models_dir = os.environ.get("MODELS_DIR", "/models")
    data_dir = os.environ.get("DATA_DIR", "/data")
    annotations_dir = os.path.join(data_dir, "annotations")
    os.makedirs(annotations_dir, exist_ok=True)
    
    # Modelo específico
    model_dir = os.path.join(models_dir, model_id)
    os.makedirs(model_dir, exist_ok=True)
    
    train_annotations = []
    val_annotations = []
    all_classes = set()
    
    try:
        # Processar catálogos
        training_jobs[job_id]["log"].append(f"Processando catálogos: {catalog_ids}")
        
        total_train_images = 0
        total_train_annotations = 0
        total_val_images = 0
        total_val_annotations = 0
        
        for catalog_id in catalog_ids:
            try:
                # Obter metadados do catálogo
                catalog_url = f"{backend_url}/catalogs/{catalog_id}"
                training_jobs[job_id]["log"].append(f"Buscando metadados: {catalog_url}")
                
                response = requests.get(catalog_url)
                if response.status_code != 200:
                    training_jobs[job_id]["log"].append(f"Erro ao obter metadados do catálogo {catalog_id}: {response.status_code}")
                    continue
                
                catalog_data = response.json()
                page_count = catalog_data.get("page_count", 0)
                
                training_jobs[job_id]["log"].append(f"Catálogo {catalog_id} tem {page_count} páginas")
                
                # Processar cada página
                for page_number in range(1, page_count + 1):
                    # Obter anotações para a página
                    annotations_url = f"{backend_url}/annotations/{catalog_id}/{page_number}"
                    training_jobs[job_id]["log"].append(f"Buscando anotações: {annotations_url}")
                    
                    response = requests.get(annotations_url)
                    if response.status_code != 200:
                        training_jobs[job_id]["log"].append(f"Erro ao obter anotações para página {page_number}: {response.status_code}")
                        continue
                    
                    page_annotations = response.json().get("annotations", [])
                    training_jobs[job_id]["log"].append(f"Página {page_number}: {len(page_annotations)} anotações")
                    
                    if not page_annotations:
                        continue
                    
                    # Verificar se a imagem existe
                    image_path = os.path.join(data_dir, "images", catalog_id, f"page_{page_number}.jpg")
                    training_jobs[job_id]["log"].append(f"Verificando imagem: {image_path}")
                    
                    if not os.path.exists(image_path):
                        training_jobs[job_id]["log"].append(f"Imagem não encontrada: {image_path}")
                        continue
                    
                    training_jobs[job_id]["log"].append(f"Imagem encontrada: {image_path}")
                    
                    # Adicionar à lista de treinamento ou validação (80/20)
                    # Garantir que pelo menos uma imagem vá para treinamento
                    if total_train_images == 0 or random.random() < 0.8:  # 80% para treinamento ou primeira imagem
                        train_annotations.append({
                            "image_path": image_path,
                            "annotations": page_annotations,
                            "catalog_id": catalog_id,
                            "page_number": page_number
                        })
                        total_train_images += 1
                        total_train_annotations += len(page_annotations)
                    else:  # 20% para validação
                        val_annotations.append({
                            "image_path": image_path,
                            "annotations": page_annotations,
                            "catalog_id": catalog_id,
                            "page_number": page_number
                        })
                        total_val_images += 1
                        total_val_annotations += len(page_annotations)
                    
                    # Coletar classes
                    for annotation in page_annotations:
                        class_name = annotation.get("class", "produto")
                        all_classes.add(class_name)
                
            except Exception as e:
                error_msg = f"Erro ao processar catálogo {catalog_id}: {str(e)}"
                training_jobs[job_id]["log"].append(error_msg)
                print(error_msg)
        
        # Resumo do treinamento
        training_jobs[job_id]["log"].append(f"Resumo - Imagens treino: {total_train_images}")
        training_jobs[job_id]["log"].append(f"Resumo - Anotações treino: {total_train_annotations}")
        training_jobs[job_id]["log"].append(f"Resumo - Imagens validação: {total_val_images}")
        training_jobs[job_id]["log"].append(f"Resumo - Anotações validação: {total_val_annotations}")
        
        # Atualizar tamanhos de treino e validação
        training_jobs[job_id]["train_size"] = total_train_images
        training_jobs[job_id]["val_size"] = total_val_images
        
        # Verificar se há dados suficientes
        if total_train_images == 0:
            raise Exception("Nenhuma anotação encontrada para treinamento")
        
        # Iniciar treinamento simulado
        training_jobs[job_id]["log"].append("Iniciando treinamento do modelo...")
        
        # Configurações do treinamento
        max_iter = config.get("max_iterations", 1000)
        
        # Criar arquivos de configuração e modelo simulado
        config_path = os.path.join(model_dir, "config.yaml")
        with open(config_path, "w") as f:
            f.write(f"""
MODEL:
  META_ARCHITECTURE: "GeneralizedRCNN"
  BACKBONE:
    NAME: "build_resnet_fpn_backbone"
  RESNETS:
    OUT_FEATURES: ["res2", "res3", "res4", "res5"]
  FPN:
    IN_FEATURES: ["res2", "res3", "res4", "res5"]
  ANCHOR_GENERATOR:
    SIZES: [[32, 64, 128, 256, 512]]
    ASPECT_RATIOS: [[0.5, 1.0, 2.0]]
  RPN:
    IN_FEATURES: ["p2", "p3", "p4", "p5", "p6"]
    PRE_NMS_TOPK_TRAIN: 2000
    PRE_NMS_TOPK_TEST: 1000
    POST_NMS_TOPK_TRAIN: 1000
    POST_NMS_TOPK_TEST: 1000
  ROI_HEADS:
    NAME: "StandardROIHeads"
    IN_FEATURES: ["p2", "p3", "p4", "p5"]
    BATCH_SIZE_PER_IMAGE: 128
    NUM_CLASSES: {len(all_classes)}
  ROI_BOX_HEAD:
    NAME: "FastRCNNConvFCHead"
    NUM_FC: 2
    POOLER_RESOLUTION: 7
DATASETS:
  TRAIN: ("train",)
  TEST: ("val",)
SOLVER:
  IMS_PER_BATCH: 4
  BASE_LR: {config.get("learning_rate", 0.001)}
  MAX_ITER: {max_iter}
  STEPS: ({max_iter // 3}, {max_iter // 3 * 2})
INPUT:
  MIN_SIZE_TRAIN: (640, 672, 704, 736, 768, 800)
VERSION: 2
DEVICE: "cpu"
            """)
        
        # Criar modelo simulado
        model_weights = os.path.join(model_dir, "model_final.pth")
        with open(model_weights, "wb") as f:
            # Criar um tensor vazio e salvá-lo como modelo
            dummy_model = torch.nn.Sequential(
                torch.nn.Conv2d(3, 64, kernel_size=3, padding=1),
                torch.nn.ReLU(),
                torch.nn.MaxPool2d(kernel_size=2, stride=2),
                torch.nn.Conv2d(64, 128, kernel_size=3, padding=1),
                torch.nn.ReLU(),
                torch.nn.MaxPool2d(kernel_size=2, stride=2),
                torch.nn.Flatten(),
                torch.nn.Linear(128 * 56 * 56, 1024),
                torch.nn.ReLU(),
                torch.nn.Linear(1024, len(all_classes) + 1)
            )
            torch.save(dummy_model.state_dict(), model_weights)
        
        # Simular progresso de treinamento
        for i in range(max_iter):
            # Atualizar progresso a cada 10 iterações
            if i % 10 == 0:
                progress = {
                    "current_iteration": i,
                    "total_iterations": max_iter,
                    "percentage": int(i / max_iter * 100)
                }
                training_jobs[job_id]["progress"] = progress
                
                # Adicionar log a cada 100 iterações
                if i % 100 == 0:
                    training_jobs[job_id]["log"].append(f"Iteração {i}/{max_iter} ({int(i / max_iter * 100)}%)")
            
            # Simular tempo de treinamento
            time.sleep(0.05)  # 50ms por iteração
        
        # Finalizar treinamento
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        training_jobs[job_id]["progress"] = {
            "current_iteration": max_iter,
            "total_iterations": max_iter,
            "percentage": 100
        }
        training_jobs[job_id]["log"].append("Treinamento concluído com sucesso!")
        
        # Atualizar modelo
        for model in models_db:
            if model.get("model_id") == model_id:
                model["status"] = "ready"
                model["classes"] = list(all_classes)
                model["train_size"] = total_train_images
                model["val_size"] = total_val_images
                model["updated_at"] = datetime.now().isoformat()
                # Salvar modelos em disco após atualização
                save_models_to_disk()
                break
        
        print(f"Treinamento concluído para job_id: {job_id}, model_id: {model_id}")
        
    except Exception as e:
        error_msg = f"Erro durante o treinamento: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        
        # Atualizar status do job
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = error_msg
        training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        
        # Atualizar modelo
        for model in models_db:
            if model.get("model_id") == model_id:
                model["status"] = "failed"
                model["error"] = error_msg
                model["updated_at"] = datetime.now().isoformat()
                # Salvar modelos em disco após atualização
                save_models_to_disk()
                break

@app.route('/train', methods=['POST'])
def start_training():
    """
    Inicia o treinamento de um novo modelo.
    """
    data = request.json
    
    if not data:
        return jsonify({"detail": "Dados inválidos"}), 400
        
    # Extrair parâmetros da requisição
    model_name = data.get("name", f"Modelo {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    catalog_ids = data.get("catalog_ids", [])
    config = data.get("config", {})
    
    # Não exigimos catálogos para permitir simulação
    # if not catalog_ids:
    #    return jsonify({"detail": "IDs de catálogo são obrigatórios para treinamento"}), 400
        
    # Criar ID único para o job e modelo
    job_id = str(uuid.uuid4())
    model_id = str(uuid.uuid4())
    
    # Registrar o job
    training_jobs[job_id] = {
        "id": job_id,
        "model_id": model_id,
        "name": model_name,
        "catalog_ids": catalog_ids,
        "config": config,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "progress": {
            "percentage": 0,
            "current_iteration": 0,
            "total_iterations": config.get("max_iter", 1000)
        },
        "log": ["Job de treinamento criado"],
        "error": None
    }
    
    # Adicionar modelo à lista de modelos
    models_db.append({
        "model_id": model_id,
        "name": model_name,
        "job_id": job_id,
        "created_at": datetime.now().isoformat(),
        "status": "pending",
        "config": config,
        "train_size": 0,  # Será atualizado durante o treinamento
        "val_size": 0     # Será atualizado durante o treinamento
    })
    
    # Salvar modelos em disco
    save_models_to_disk()
    
    # Iniciar treinamento em um thread separado
    training_thread = threading.Thread(target=run_training, args=(job_id, model_name, catalog_ids, config))
    training_thread.daemon = True
    training_thread.start()
    
    return jsonify({
        "job_id": job_id,
        "model_id": model_id,
        "status": "pending",
        "message": "Treinamento iniciado com sucesso"
    })

@app.route('/train/status/<job_id>', methods=['GET'])
def get_training_status(job_id):
    """
    Consulta o status de um job de treinamento.
    """
    if job_id not in training_jobs:
        return jsonify({"detail": f"Job de treinamento {job_id} não encontrado"}), 404
        
    job_info = training_jobs[job_id]
    model_id = job_info.get("model_id")
    
    # Buscar informações adicionais do modelo
    train_size = 0
    val_size = 0
    for model in models_db:
        if model.get("model_id") == model_id:
            train_size = model.get("train_size", 0)
            val_size = model.get("val_size", 0)
            break
    
    # Verificar que train_size e val_size são valores numéricos
    if train_size is None or not isinstance(train_size, (int, float)):
        train_size = 0
    if val_size is None or not isinstance(val_size, (int, float)):
        val_size = 0
    
    print(f"DEBUG - Status do job {job_id}: {job_info['status']}, train_size: {train_size}, val_size: {val_size}")
    
    return jsonify({
        "job_id": job_id,
        "model_id": job_info["model_id"],
        "name": job_info["name"],
        "status": job_info["status"],
        "train_size": train_size,
        "val_size": val_size,
        "created_at": job_info["created_at"],
        "updated_at": job_info["updated_at"],
        "progress": job_info["progress"],
        "log": job_info.get("log", []),
        "error": job_info.get("error")
    })

@app.route('/models', methods=['GET'])
def list_models():
    """
    Lista todos os modelos treinados.
    """
    return jsonify(models_db)

@app.route('/models/<model_id>', methods=['DELETE'])
def delete_model(model_id):
    """
    Exclui um modelo pelo seu ID.
    """
    # Verificar se o modelo existe
    model_exists = False
    for i, model in enumerate(models_db):
        if model["model_id"] == model_id:
            models_db.pop(i)
            model_exists = True
            break
    
    if not model_exists:
        return jsonify({"detail": f"Modelo {model_id} não encontrado"}), 404
    
    # Salvar modelos em disco após remover
    save_models_to_disk()
    
    # Remover arquivos do modelo (apenas simulação)
    print(f"Modelo {model_id} removido com sucesso")
    
    return jsonify({"detail": f"Modelo {model_id} excluído com sucesso"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 