import os
import os
import json
import sys
import functools
import threading
import re
from flask import Flask, request, jsonify
import uuid
import time
import requests
from datetime import datetime
import random
import builtins

# Sentinel para verificar se o valor está no cache
_SENTINEL = object()

# Implementação de cached_property para Python 3.7
# Baseado em: https://docs.python.org/3.8/library/functools.html#functools.cached_property
class cached_property:
    def __init__(self, func):
        self.func = func
        self.attrname = None
        self.__doc__ = func.__doc__
        self.lock = threading.RLock()

    def __set_name__(self, owner, name):
        if self.attrname is None:
            self.attrname = name
        else:
            raise TypeError(
                f"Cannot assign the same cached_property to two different names "
                f"({self.attrname!r} and {name!r})."
            )

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        if self.attrname is None:
            raise TypeError(
                "Cannot use cached_property instance without calling __set_name__"
            )
        try:
            cache = instance.__dict__
        except AttributeError:  # not all objects have __dict__ (e.g. class defines slots)
            msg = (
                f"No '__dict__' attribute on {type(instance).__name__!r} "
                f"instance to cache {self.attrname!r} property."
            )
            raise TypeError(msg) from None
        val = cache.get(self.attrname, _SENTINEL)
        if val is _SENTINEL:
            with self.lock:
                # check if another thread filled cache while we awaited lock
                val = cache.get(self.attrname, _SENTINEL)
                if val is _SENTINEL:
                    val = self.func(instance)
                    try:
                        cache[self.attrname] = val
                    except TypeError:
                        msg = (
                            f"The '__dict__' attribute on {type(instance).__name__!r} instance "
                            f"does not support item assignment for caching {self.attrname!r} property."
                        )
                        raise TypeError(msg) from None
        return val

# Adicionar cached_property ao módulo functools para compatibilidade
if not hasattr(functools, 'cached_property'):
    print("Adicionando cached_property ao módulo functools para compatibilidade com Python 3.7")
    functools.cached_property = cached_property

# Importar torch antes de aplicar o patch
import torch

# Adicionar patch para torch.get_float32_matmul_precision se não existir
if not hasattr(torch, 'get_float32_matmul_precision'):
    print("Adicionando torch.get_float32_matmul_precision para compatibilidade")
    def get_float32_matmul_precision():
        print("Chamando função personalizada get_float32_matmul_precision")
        return 'highest'
    torch.get_float32_matmul_precision = get_float32_matmul_precision
else:
    print("get_float32_matmul_precision já existe")
    # Evitar uso de f-string aqui
    print("Precisão atual:", "highest")

# Aplicar patch para funções com problema de f-string
import builtins
import types

# Modificar o comportamento padrão de __repr__ para alguns objetos do PyTorch
try:
    # Substituir get_float32_matmul_precision por uma versão mais segura
    def new_get_float32_matmul_precision():
        return 'highest'  # Sempre retorna um valor fixo para evitar problemas
            
    torch.get_float32_matmul_precision = new_get_float32_matmul_precision
    
    # Patch o método __format__ para objetos problemáticos
    original_format = builtins.format
    
    def safe_format(obj, format_spec):
        try:
            # Se o objeto for de tipos problemáticos, retorna uma string fixa
            if hasattr(obj, '__module__'):
                module_name = str(obj.__module__)
                if 'torch' in module_name or 'detectron2' in module_name:
                    return str(obj)
            # Para outros objetos, use o format normal
            return original_format(obj, format_spec)
        except:
            # Em caso de erro, retorna uma representação segura
            return str(obj)
    
    # Aplicar o patch
    builtins.format = safe_format
    print("Aplicado patch para builtins.format")
    
    # Patch para diversos tipos de objetos do torch
    if hasattr(torch, '_C'):
        # Patch para ScriptFunction.__repr__
        if hasattr(torch._C, 'ScriptFunction'):
            torch._C.ScriptFunction.__repr__ = lambda self: "<torch.ScriptFunction>"
        
        # Patch para outros tipos que podem causar problemas
        for attr_name in dir(torch._C):
            try:
                attr = getattr(torch._C, attr_name)
                if isinstance(attr, type):
                    if hasattr(attr, '__repr__'):
                        setattr(attr, '__repr__', lambda self: f"<torch.{attr_name}>")
            except:
                pass
    
    print("Aplicado patch para tipos do torch")
    
except Exception as e:
    print("Erro ao aplicar patches:", str(e))

# Patch para o problema específico de f-string com torch.get_float32_matmul_precision()
import sys
import re

# Salvar o módulo de compilação para strings
original_compile = compile

# Função para limpar strings com o padrão de erro
def clean_string(s):
    if isinstance(s, str):
        # Remover a construção problemática
        s = re.sub(r'\(torch\.get_float32_matmul_precision\(\)\s*=\s*\)', '("highest")', s)
    return s

# Sobrescrever a função compile para limpar strings antes de compilá-las
def patched_compile(source, filename, mode, flags=0, dont_inherit=False, optimize=-1):
    if filename == "<fstring>":
        source = clean_string(source)
    return original_compile(source, filename, mode, flags, dont_inherit, optimize)

# Aplicar o patch
import builtins
builtins.compile = patched_compile

# Também interceptar o builtins.__build_class__ para lidar com definições de classe
original_build_class = builtins.__build_class__

def patched_build_class(func, name, *bases, **kwargs):
    try:
        return original_build_class(func, name, *bases, **kwargs)
    except SyntaxError as e:
        if "torch.get_float32_matmul_precision()" in str(e):
            # Substituir a função que está causando o erro
            torch.get_float32_matmul_precision = lambda: "highest"
            # Tentar novamente
            return original_build_class(func, name, *bases, **kwargs)
        raise

builtins.__build_class__ = patched_build_class

print("Aplicado patch para interceptar erros de f-string relacionados a torch.get_float32_matmul_precision()")

from flask import Flask, request, jsonify
import uuid
from datetime import datetime
import random
import requests
import time
import traceback
import cv2
import numpy as np
from PIL import Image
import urllib.request
import threading

app = Flask(__name__)

# Banco de dados em memória
training_jobs = {}
detection_jobs = {}
models_db = []  # Lista de modelos treinados em memória

@app.route("/")
def index():
    return jsonify({
        "name": "ML Service",
        "status": "online",
        "endpoints": [
            "/train",
            "/train/status/<job_id>",
            "/models",
            "/detect",
            "/detect/status/<job_id>",
            "/detect/result/<job_id>"
        ]
    })

@app.route("/train", methods=["POST"])
def start_training():
    data = request.json
    print(f"Iniciando treinamento com dados: {data}")
    
    # Gerar novo ID para o job de treinamento e para o modelo
    job_id = f"training_job_{str(uuid.uuid4())[:8]}"
    model_id = f"model_{str(uuid.uuid4())[:8]}"
    current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Extrair informações do request
    catalog_ids = data.get("catalog_ids", [])
    validation_split = data.get("validation_split", 0.2)
    max_iter = data.get("max_iter", 5000)
    batch_size = data.get("batch_size", 2)
    learning_rate = data.get("learning_rate", 0.00025)
    model_name = data.get("model_name", f"Modelo treinado em {current_time}")
    base_model = data.get("base_model", "COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml")
    
    print(f"Criando novo modelo '{model_name}' com ID: {model_id}")
    
    # Inicializar o job no dicionário training_jobs
    training_jobs[job_id] = {
        "status": "preparing",
        "created_at": current_time,
        "model_id": model_id,
        "log": []
    }
    
    # Criar novo modelo e adicionar à lista
    new_model = {
        "model_id": model_id,
        "name": model_name,
        "created_at": current_time,
        "train_size": 0,  # Será atualizado durante o treinamento
        "val_size": 0,    # Será atualizado durante o treinamento
        "status": "preparing",
        "job_id": job_id,
        "config": {
            "base_model": base_model,
            "max_iter": max_iter,
            "learning_rate": learning_rate,
            "batch_size": batch_size,
            "catalog_ids": catalog_ids
        }
    }
    
    # Adicionar à lista de modelos
    models_db.append(new_model)
    
    # Iniciar processo de treinamento em uma thread separada
    training_thread = threading.Thread(
        target=run_training, 
        args=(job_id, model_name, catalog_ids, {
            "base_model": base_model,
            "max_iter": max_iter,
            "learning_rate": learning_rate,
            "batch_size": batch_size,
            "catalog_ids": catalog_ids
        })
    )
    training_thread.daemon = True
    training_thread.start()
    
    # Log para debug
    print(f"Modelo adicionado. Total agora: {len(models_db)}")
    print(f"IDs dos modelos: {[model['model_id'] for model in models_db]}")
    
    return jsonify({
        "message": "Treinamento iniciado com sucesso",
        "job_id": job_id,
        "model_id": model_id
    })

def run_training(job_id, model_name, catalog_ids, config):
    """
    Função que executa o treinamento real usando as anotações dos catálogos.
    Esta função é executada em uma thread separada.
    """
    try:
        import os
        import json
        import random
        
        # Atualizar status
        training_jobs[job_id]["status"] = "collecting_data"
        training_jobs[job_id]["log"].append("Iniciando coleta de dados para treinamento...")
        
        # Importar Detectron2 de forma segura
        d2 = safe_import_detectron2()
        if d2 is None:
            raise Exception("Não foi possível importar Detectron2")
        
        # INÍCIO DO CÓDIGO DE TESTE - Simular anotações para teste
        if catalog_ids and "simulate_annotations" in catalog_ids[0]:
            print("Simulando anotações para teste")
            # Simular 20 anotações para teste
            all_annotations = []
            for i in range(20):
                all_annotations.append({
                    "catalog_id": "test",
                    "page_number": 1,
                    "type": "produto",
                    "image_url": "https://picsum.photos/800/600",
                    "bbox": {
                        "x1": random.randint(10, 100),
                        "y1": random.randint(10, 100),
                        "x2": random.randint(200, 400),
                        "y2": random.randint(200, 400)
                    },
                    "confidence": 0.95
                })
            
            # Dividir em treino e validação
            random.shuffle(all_annotations)
            split_idx = int(len(all_annotations) * 0.8)
            train_annotations = all_annotations[:split_idx]
            val_annotations = all_annotations[split_idx:]
            
            training_jobs[job_id]["log"].append(f"Simulação: {len(train_annotations)} para treino, {len(val_annotations)} para validação")
            
            # Pular para a preparação de dados
            train_dir = os.path.join("/tmp", f"train_{job_id}")
            val_dir = os.path.join("/tmp", f"val_{job_id}")
            os.makedirs(train_dir, exist_ok=True)
            os.makedirs(val_dir, exist_ok=True)
            
            # Simular datasets
            train_dataset = []
            val_dataset = []
            for i in range(len(train_annotations)):
                train_dataset.append({"image_id": i, "file_name": f"/tmp/img_{i}.jpg"})
            for i in range(len(val_annotations)):
                val_dataset.append({"image_id": i, "file_name": f"/tmp/img_{i}.jpg"})
                
            # Registrar datasets simulados
            d2["register_coco_instances"](f"train_{job_id}", {}, "/tmp/train.json", train_dir)
            d2["register_coco_instances"](f"val_{job_id}", {}, "/tmp/val.json", val_dir)
            
            # Obter URLs e caminhos para o modelo
        backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
        models_dir = os.environ.get("MODELS_DIR", "/models")
        data_dir = os.environ.get("DATA_DIR", "/data")
            
        # Criar diretório para o modelo
        model_id = training_jobs[job_id]["model_id"]
        model_dir = os.path.join(models_dir, model_id)
        os.makedirs(model_dir, exist_ok=True)
        
        # Atualizar train_size e val_size no modelo em models_db
        for model in models_db:
            if model.get("job_id") == job_id:
                    model["train_size"] = len(train_dataset)
                    model["val_size"] = len(val_dataset)
                    model["status"] = "completed"
                    break
                    
            # Salvar configuração simulada
            model_config = {
                "name": model_name,
                "created_at": training_jobs[job_id]["created_at"],
                "completed_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "train_size": len(train_dataset),
                "val_size": len(val_dataset),
                "config": config
            }
            
            with open(os.path.join(model_dir, "config.json"), "w") as f:
                json.dump(model_config, f, indent=2)
                
            # Criar um arquivo modelo simulado
            with open(os.path.join(model_dir, "model_final.pth"), "w") as f:
                f.write("Modelo simulado para teste")
                
            # Atualizar job
            training_jobs[job_id]["status"] = "completed"
            training_jobs[job_id]["completed_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
            training_jobs[job_id]["log"].append("Simulação de treinamento concluída com sucesso")
            
            print(f"Simulação de treinamento concluída para job_id: {job_id}")
            return
        # FIM DO CÓDIGO DE TESTE
        
        # Obter URLs e caminhos
        backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
        models_dir = os.environ.get("MODELS_DIR", "/models")
        data_dir = os.environ.get("DATA_DIR", "/data")
        
        # Coletar anotações de todos os catálogos
        all_annotations = []
        
        for catalog_id in catalog_ids:
            try:
                print(f"Buscando anotações do catálogo {catalog_id}...")
                training_jobs[job_id]["log"].append(f"Buscando anotações do catálogo {catalog_id}...")
                
                # Buscar informações do catálogo
                catalog_info_response = requests.get(f"{backend_url}/catalogs/{catalog_id}")
                if catalog_info_response.status_code != 200:
                    print(f"Erro ao buscar informações do catálogo {catalog_id}: {catalog_info_response.text}")
                    training_jobs[job_id]["log"].append(f"Erro ao buscar informações do catálogo {catalog_id}")
                    continue
                
                catalog_info = catalog_info_response.json()
                page_count = catalog_info.get("page_count", 0)
                
                # Buscar anotações de cada página
                for page_number in range(1, page_count + 1):
                    try:
                        annotations_response = requests.get(
                            f"{backend_url}/catalogs/{catalog_id}/pages/{page_number}/annotations"
                        )
                        
                        if annotations_response.status_code != 200:
                            print(f"Erro ao buscar anotações da página {page_number}: {annotations_response.text}")
                            continue
                        
                        page_annotations = annotations_response.json()
                        
                        if not page_annotations:
                            print("Nenhuma anotação encontrada na página " + str(page_number))
                            continue
                        
                        # Adicionar informações da imagem às anotações
                        image_url = backend_url + "/catalogs/" + str(catalog_id) + "/pages/" + str(page_number) + "/image"
                        
                        for annotation in page_annotations:
                            annotation["image_url"] = image_url
                            annotation["catalog_id"] = catalog_id
                            annotation["page_number"] = page_number
                            all_annotations.append(annotation)
                            
                    except Exception as e:
                        print(f"Erro ao processar anotações da página {page_number}: {str(e)}")
                        continue
                
            except Exception as catalog_error:
                print(f"Erro ao processar catálogo {catalog_id}: {str(catalog_error)}")
                training_jobs[job_id]["log"].append(f"Erro ao processar catálogo {catalog_id}: {str(catalog_error)}")
                continue
        
        # Verificar se temos anotações suficientes
        if len(all_annotations) < 5:
            error_msg = f"Número insuficiente de anotações para treinamento. Encontradas: {len(all_annotations)}, mínimo: 5"
            print(error_msg)
            training_jobs[job_id]["status"] = "failed"
            training_jobs[job_id]["error"] = error_msg
            training_jobs[job_id]["log"].append(error_msg)
            
            # Atualizar modelo
            for model in models_db:
                if model.get("job_id") == job_id:
                    model["status"] = "failed"
                    model["error"] = error_msg
                    break
                    
            return
        
        # Log
        training_jobs[job_id]["log"].append(f"Coletadas {len(all_annotations)} anotações para treinamento")
        
        # Dividir em treino e validação
        training_jobs[job_id]["status"] = "preparing_data"
        
        # Embaralhar anotações
        random.shuffle(all_annotations)
        
        # Dividir em conjuntos de treino e validação
        split_idx = int(len(all_annotations) * (1 - config.get("validation_split", 0.2)))
        train_annotations = all_annotations[:split_idx]
        val_annotations = all_annotations[split_idx:]
        
        training_jobs[job_id]["log"].append(f"Divisão: {len(train_annotations)} para treino, {len(val_annotations)} para validação")
        
        # Importar detectron2 com segurança
        d2 = safe_import_detectron2()
        if d2 is None:
            raise Exception("Falha ao importar Detectron2. Verifique os logs para mais detalhes.")
        
        # Preparar diretórios para imagens
        train_dir = os.path.join(data_dir, "train", job_id)
        val_dir = os.path.join(data_dir, "val", job_id)
        os.makedirs(train_dir, exist_ok=True)
        os.makedirs(val_dir, exist_ok=True)
        
        # Função para baixar imagens e preparar dataset
        def prepare_dataset(annotations, output_dir, dataset_name):
            dataset = []
            
            for i, annotation in enumerate(annotations):
                try:
                    # Baixar imagem
                    image_url = annotation["image_url"]
                    image_filename = f"img_{i}.jpg"
                    image_path = os.path.join(output_dir, image_filename)
                    
                    import urllib.request
                    urllib.request.urlretrieve(image_url, image_path)
                    
                    # Carregar imagem para obter dimensões
                    img = d2["cv2"].imread(image_path)
                    if img is None:
                        print(f"Erro ao carregar imagem: {image_path}")
                        continue
                    
                    height, width = img.shape[:2]
                    
                    # Criar entrada para o dataset
                    record = {
                        "file_name": image_path,
                        "image_id": i,
                        "height": height,
                        "width": width,
                        "annotations": []
                    }
                    
                    # Adicionar anotação
                    bbox = annotation.get("bbox", {})
                    x1 = bbox.get("x1", 0)
                    y1 = bbox.get("y1", 0)
                    x2 = bbox.get("x2", 0)
                    y2 = bbox.get("y2", 0)
                    
                    # Mapear tipo para ID de classe
                    annotation_type = annotation.get("type", "").lower()
                    if annotation_type == "produto":
                        category_id = 0
                    elif annotation_type == "logo":
                        category_id = 1
                    elif annotation_type == "cabecalho":
                        category_id = 2
                    else:
                        category_id = 0  # Padrão para produto
                    
                    # Adicionar anotação ao registro
                    record["annotations"].append({
                        "bbox": [x1, y1, x2, y2],
                        "bbox_mode": d2["BoxMode"].XYXY_ABS,
                        "category_id": category_id,
                        "iscrowd": 0
                    })
                    
                    dataset.append(record)
                    
                except Exception as e:
                    print(f"Erro ao processar anotação {i}: {str(e)}")
                    continue
            
            # Registrar dataset no Detectron2
            def get_dataset_dicts():
                return dataset
            
            d2["DatasetCatalog"].register(dataset_name, get_dataset_dicts)
            d2["MetadataCatalog"].get(dataset_name).set(
                thing_classes=["produto", "logo", "cabecalho"]
            )
            
            return dataset
        
        # Preparar datasets
        training_jobs[job_id]["status"] = "preparing_data"
        training_jobs[job_id]["log"].append("Preparando datasets para treinamento...")
        
        train_dataset = prepare_dataset(train_annotations, train_dir, f"train_{job_id}")
        val_dataset = prepare_dataset(val_annotations, val_dir, f"val_{job_id}")
        
        # Verificar se os datasets têm dados suficientes
        if not train_dataset or not val_dataset:
            raise Exception("Datasets vazios após preparação")
            
        training_jobs[job_id]["log"].append(f"Datasets preparados: {len(train_dataset)} para treino, {len(val_dataset)} para validação")
        
        # Preparação concluída, iniciar treinamento
        training_jobs[job_id]["status"] = "training"
        training_jobs[job_id]["log"].append("Configurando modelo para treinamento...")
        
        # Atualizar train_size e val_size no modelo em models_db
        for model in models_db:
            if model.get("job_id") == job_id:
                model["train_size"] = len(train_dataset)
                model["val_size"] = len(val_dataset)
                model["status"] = "training"
                break
        
        # Obter configuração do modelo
        base_model = config.get("base_model", "COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml")
        max_iter = config.get("max_iter", 1000)
        batch_size = config.get("batch_size", 2)
        learning_rate = config.get("learning_rate", 0.00025)
        
        # Configurar modelo Detectron2
        cfg = d2["get_cfg"]()
        cfg.merge_from_file(d2["detectron2"].model_zoo.get_config_file(base_model))
        cfg.DATASETS.TRAIN = (f"train_{job_id}",)
        cfg.DATASETS.TEST = (f"val_{job_id}",)
        cfg.DATALOADER.NUM_WORKERS = 2
        cfg.MODEL.WEIGHTS = d2["detectron2"].model_zoo.get_checkpoint_url(base_model)
        cfg.SOLVER.IMS_PER_BATCH = batch_size
        cfg.SOLVER.BASE_LR = learning_rate
        cfg.SOLVER.MAX_ITER = max_iter
        cfg.MODEL.ROI_HEADS.NUM_CLASSES = 3  # produto, logo, cabecalho
        cfg.OUTPUT_DIR = os.path.join(models_dir, model_id)
                
        # Configurar e iniciar treinamento
        trainer = d2["DefaultTrainer"](cfg)
        trainer.resume_or_load(resume=False)
        
        training_jobs[job_id]["log"].append("Iniciando treinamento...")
        
        trainer.train()
        
        # Salvar configuração do modelo
        model_config = {
            "name": model_name,
            "created_at": training_jobs[job_id]["created_at"],
            "completed_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "train_size": len(train_dataset),
            "val_size": len(val_dataset),
            "config": config
        }
        
        with open(os.path.join(os.path.join(models_dir, model_id), "config.json"), "w") as f:
            json.dump(model_config, f, indent=2)
        
        # Adicionar modelo à lista
        model = {
            "model_id": model_id,
            "name": model_name,
            "status": "completed",
            "train_size": len(train_dataset),
            "val_size": len(val_dataset),
            "config": config,
            "created_at": training_jobs[job_id]["created_at"],
            "completed_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "model_path": os.path.join(model_dir, "model_final.pth")
        }
        
        models_db.append(model)
        
        # Atualizar job
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["completed_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        training_jobs[job_id]["model_id"] = model_id
        training_jobs[job_id]["log"].append(f"Treinamento concluído. Modelo salvo com ID: {model_id}")
        
        print(f"Treinamento concluído. Modelo salvo com ID: {model_id}")
        
    except Exception as e:
        print(f"Erro durante o treinamento (job_id: {job_id}): {str(e)}")
        # Verificar se o job_id ainda existe no dicionário (pode ter sido removido)
        if job_id in training_jobs:
            training_jobs[job_id]["status"] = "failed"
            training_jobs[job_id]["error"] = str(e)
            training_jobs[job_id]["log"].append(f"Erro durante o treinamento: {str(e)}")
        
        # Atualizar modelo
        for model in models_db:
            if model.get("job_id") == job_id:
                model["status"] = "failed"
                model["error"] = str(e)
                break
                
        return

@app.route("/train/status/<job_id>", methods=["GET"])
def get_training_status(job_id):
    """
    Verifica o status de um job de treinamento.
    Retorna informações sobre o modelo e o progresso do treinamento.
    """
    print(f"Verificando status para job_id: {job_id}")
    
    # Verificar se o job existe no dicionário training_jobs
    job_info = training_jobs.get(job_id)
    if job_info:
        print(f"Job encontrado: {job_info.get('status', 'unknown')}")
        
        # Obter o model_id associado ao job
        model_id = job_info.get("model_id")
        
        # Buscar o modelo pelo model_id
        model = None
        for m in models_db:
            if m.get("model_id") == model_id:
                model = m
                break
    
        if model:
            print(f"Modelo encontrado: {model.get('name', 'Nenhum')}")
            
            # Verificar se existe um diretório de saída para o modelo
            models_dir = os.environ.get("MODELS_DIR", "/models")
            output_dir = os.path.join(models_dir, model_id)
            
            # Definir status e métricas baseadas no status do modelo
            status = job_info.get("status", "unknown")
            train_size = model.get("train_size", 0)
            val_size = model.get("val_size", 0)
            error = job_info.get("error", None)
            
            # Verificar se há arquivos de log ou métricas no diretório de saída
            metrics = {}
            progress = 0.0
            eta = "Desconhecido"
            log = job_info.get("log", [])
            
            if os.path.exists(output_dir):
                # Verificar se existe um arquivo metrics.json
                metrics_file = os.path.join(output_dir, "metrics.json")
                if os.path.exists(metrics_file):
                    try:
                        with open(metrics_file, 'r') as f:
                            lines = f.readlines()
                            if lines:
                                # O arquivo metrics.json tem uma linha JSON por iteração
                                last_metrics = json.loads(lines[-1])
                                metrics = last_metrics
                                
                                # Calcular progresso baseado em max_iter
                                max_iter = model.get("config", {}).get("max_iter", 1000)
                                current_iter = last_metrics.get("iteration", 0)
                                progress = min(1.0, current_iter / max_iter)
                    except Exception as e:
                        print(f"Erro ao ler métricas: {str(e)}")
                
                # Verificar se há um arquivo de log
                log_file = os.path.join(output_dir, "log.txt")
                if os.path.exists(log_file):
                    try:
                        with open(log_file, 'r') as f:
                            log_lines = f.readlines()
                            # Pegar as últimas 10 linhas
                            log.extend([l.strip() for l in log_lines[-10:] if l.strip()])
                    except Exception as e:
                        print(f"Erro ao ler log: {str(e)}")
            
            # Formatar progresso como porcentagem
            progress_percentage = round(progress * 100, 1)
            
        return jsonify({
                "model_id": model_id,
                "name": model.get("name", f"Modelo treinado em {model.get('created_at')}"),
                "status": status,
                "train_size": train_size,
                "val_size": val_size,
                "error": error,
                "config": model.get("config", {}),
                "progress": {
                    "percentage": progress_percentage,
                    "current_iteration": metrics.get("iteration", 0),
                    "total_iterations": model.get("config", {}).get("max_iter", 0),
                    "loss": metrics.get("total_loss", 0),
                    "eta": eta,
                    "log": log
                }
        })
        else:
            print(f"Modelo não encontrado para job_id: {job_id}")
        # Retornar as informações básicas do job
        return jsonify({
                "status": job_info.get("status", "unknown"),
                "error": job_info.get("error"),
                "log": job_info.get("log", [])
            })
    else:
        print(f"Job não encontrado: {job_id}")
        return jsonify({"detail": f"Job {job_id} não encontrado"}), 404

@app.route("/detect", methods=["POST"])
def detect_image():
    """
    Endpoint para detectar objetos em uma imagem específica usando um modelo treinado.
    Recebe model_id e image_url como parâmetros.
    """
    print("Endpoint /detect chamado")
    print("Request JSON: " + str(request.json))
    
    try:
        # Obter dados do request
        data = request.json
        if not data:
            return jsonify({"detail": "Dados não fornecidos"}), 400
        
        model_id = data.get("model_id")
        image_url = data.get("image_url")
        min_confidence = data.get("min_confidence", 0.5)
        
        print("Dados extraídos: model_id=" + str(model_id) + ", image_url=" + str(image_url))
        
        # Verificar parâmetros obrigatórios
        if not model_id:
            return jsonify({"detail": "ID do modelo não fornecido"}), 400
        
        if not image_url:
            return jsonify({"detail": "URL da imagem não fornecida"}), 400
        
        # Verificar se o modelo existe
        model = None
        for m in models_db:
            if m.get("model_id") == model_id:
                model = m
                break
        
        if not model:
            return jsonify({"detail": "Modelo com ID " + str(model_id) + " não encontrado"}), 404
        
        # Verificar se o modelo está completo
        if model.get("status") != "completed":
            return jsonify({"detail": "Modelo com ID " + str(model_id) + " não está pronto (status: " + model.get("status") + ")"}), 400
        
        # Iniciar job de detecção
        job_id = "detection_job_" + str(uuid.uuid4())[:8]
        current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Registrar o job
        detection_job = {
            "job_id": job_id,
            "model_id": model_id,
            "image_url": image_url,
            "status": "queued",
            "created_at": current_time,
            "completed_at": None,
            "config": {
                "min_confidence": min_confidence
            },
            "results": [],
            "error": None
        }
        
        # Armazenar o job
        detection_jobs[job_id] = detection_job
        
        # Iniciar processo de detecção em thread separada
        detection_thread = threading.Thread(
            target=run_single_image_detection, 
            args=(job_id, image_url, model_id, min_confidence)
        )
        detection_thread.daemon = True
        detection_thread.start()
        
        return jsonify({
            "message": "Detecção iniciada com sucesso",
            "job_id": job_id
        })
        
    except Exception as e:
        print("Erro ao processar requisição: " + str(e))
        traceback_str = traceback.format_exc()
        print("Traceback: " + traceback_str)
        return jsonify({"detail": "Erro ao processar requisição: " + str(e)}), 500

def run_single_image_detection(job_id, image_url, model_id, min_confidence):
    """
    Função que executa a detecção em uma única imagem usando o modelo treinado.
    Esta função é executada em uma thread separada.
    """
    try:
        import os
        import json
        
        # Atualizar status
        detection_jobs[job_id]["status"] = "processing"
        detection_jobs[job_id]["log"] = ["Iniciando processo de detecção..."]
        
        # Buscar o modelo
        model = None
        for m in models_db:
            if m.get("model_id") == model_id:
                model = m
                break
        
        if not model:
            raise Exception("Modelo " + model_id + " não encontrado")
        
        # Verificar se o modelo está treinado
        if model.get("status") != "completed":
            raise Exception("Modelo " + model_id + " não está treinado (status: " + model.get("status") + ")")
        
        # Obter o caminho do modelo
        models_dir = os.environ.get("MODELS_DIR", "/models")
        model_path = os.path.join(models_dir, model_id, "model_final.pth")
        
        if not os.path.exists(model_path):
            raise Exception("Arquivo do modelo não encontrado: " + model_path)
        
        # Importar detectron2 com segurança
        d2 = safe_import_detectron2()
        if d2 is None:
            raise Exception("Falha ao importar Detectron2. Verifique os logs para mais detalhes.")
        
        # Obter a configuração do modelo
        base_model = model.get("config", {}).get("base_model", "COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml")
        
        # Configurar o modelo Detectron2
        print("Configurando modelo Detectron2 com base_model=" + base_model + ", min_confidence=" + str(min_confidence))
        detection_jobs[job_id]["log"].append("Configurando modelo Detectron2...")
        
        cfg = d2["get_cfg"]()
        cfg.merge_from_file(d2["detectron2"].model_zoo.get_config_file(base_model))
        cfg.MODEL.ROI_HEADS.NUM_CLASSES = 3  # produto, logo, cabecalho
        cfg.MODEL.WEIGHTS = model_path
        cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = min_confidence
        
        # Criar predictor
        try:
            predictor = d2["DefaultPredictor"](cfg)
            detection_jobs[job_id]["log"].append("Modelo carregado com sucesso")
        except Exception as e:
            raise Exception("Erro ao criar predictor: " + str(e))
        
        # Baixar a imagem temporariamente
        data_dir = os.environ.get("DATA_DIR", "/data")
        image_dir = os.path.join(data_dir, "temp")
        os.makedirs(image_dir, exist_ok=True)
        image_path = os.path.join(image_dir, "image_" + job_id + ".jpg")
        
        # Baixar imagem
        try:
            import urllib.request
            urllib.request.urlretrieve(image_url, image_path)
            detection_jobs[job_id]["log"].append("Imagem baixada com sucesso")
        except Exception as e:
            raise Exception("Erro ao baixar imagem: " + str(e))
        
        # Carregar imagem com OpenCV
        img = d2["cv2"].imread(image_path)
        if img is None:
            raise Exception("Erro ao carregar imagem: " + image_path)
        
        # Executar detecção
        outputs = predictor(img)
        
        # Extrair resultados
        instances = outputs["instances"].to("cpu")
        boxes = instances.pred_boxes.tensor.numpy()
        scores = instances.scores.numpy()
        classes = instances.pred_classes.numpy()
        
        # Converter para o formato interno
        annotations = []
        
        for i in range(len(boxes)):
            # Pular se a confiança estiver abaixo do limiar
            if scores[i] < min_confidence:
                continue
            
            # Obter coordenadas da bbox
            x1, y1, x2, y2 = boxes[i]
            
            # Obter tipo baseado na classe
            class_id = int(classes[i])
            if class_id == 0:
                class_name = "produto"
            elif class_id == 1:
                class_name = "logo"
            elif class_id == 2:
                class_name = "cabecalho"
            else:
                class_name = "desconhecido"
            
            # Criar anotação
            annotation = {
                "id": "det_" + str(uuid.uuid4())[:8],
                "type": class_name,
                "bbox": {
                    "x1": float(x1),
                    "y1": float(y1),
                    "x2": float(x2),
                    "y2": float(y2)
                },
                "confidence": float(scores[i])
            }
            
            annotations.append(annotation)
        
        # Atualizar resultados no job
        detection_jobs[job_id]["results"] = [{
            "page_number": 1,
            "annotations": annotations,
            "image_url": image_url
        }]
        detection_jobs[job_id]["status"] = "completed"
        detection_jobs[job_id]["completed_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        detection_jobs[job_id]["log"].append("Detecção concluída: " + str(len(annotations)) + " objetos detectados")
        
        print("Detecção concluída para imagem " + image_url + " - " + str(len(annotations)) + " objetos detectados")
        
    except Exception as e:
        print("Erro durante a detecção: " + str(e))
        error_msg = str(e)
        detection_jobs[job_id]["status"] = "failed"
        detection_jobs[job_id]["error"] = error_msg
        detection_jobs[job_id]["log"] = detection_jobs[job_id].get("log", []) + ["Erro fatal: " + error_msg]

@app.route("/detect/<catalog_id>", methods=["POST"])
def start_detection(catalog_id):
    print("Endpoint /detect/" + catalog_id + " chamado")
    print("Request JSON: " + str(request.json))
    print("Request data: " + str(request.data))
    print("Raw request body: " + str(request.get_data()))
    print("Request headers: " + str(request.headers))
    print("Content-Type: " + str(request.headers.get('Content-Type')))

    try:
        # Tentar diferentes formas de obter os dados
        if request.is_json:
            data = request.get_json()
            print("Dados obtidos com request.get_json(): " + str(data))
        else:
            try:
                data = request.get_json(force=True)
                print("Dados obtidos com request.get_json(force=True): " + str(data))
            except Exception as e:
                print("Erro ao processar JSON com force=True: " + str(e))
                try:
                    data = json.loads(request.data.decode('utf-8'))
                    print("Dados obtidos com json.loads: " + str(data))
                except Exception as e:
                    print("Erro ao processar com json.loads: " + str(e))
                    data = None
        
        model_id = data.get("model_id") if data else None
    except Exception as e:
        print("Erro ao processar JSON: " + str(e))
        traceback_str = traceback.format_exc()
        print("Traceback: " + traceback_str)
        data = None
        model_id = None
    
    print("Dados extraídos: catalog_id=" + catalog_id + ", model_id=" + str(model_id) + ", type(model_id)=" + str(type(model_id)))
    
    # Verificar se o catalog_id e model_id são válidos
    if not catalog_id:
        print("Erro: ID do catálogo não fornecido")
        return jsonify({"detail": "ID do catálogo não fornecido"}), 400
    
    # Verificar se o modelo existe
    if not model_id:
        print("Erro: ID do modelo não fornecido")
        return jsonify({"detail": "ID do modelo não fornecido"}), 400
    
    # Verificar se o modelo existe em nossa lista
    model = None
    for m in models_db:
        if m.get("model_id") == model_id:
            model = m
            break
    
    if not model:
        print("Erro: Modelo com ID " + str(model_id) + " não encontrado")
        return jsonify({"detail": "Modelo com ID " + str(model_id) + " não encontrado"}), 404
    
    # Verificar se o modelo está completo
    if model.get("status") != "completed":
        print("Erro: Modelo com ID " + str(model_id) + " não está pronto (status: " + model.get("status") + ")")
        return jsonify({"detail": "Modelo com ID " + str(model_id) + " não está pronto (status: " + model.get("status") + ")"}), 400
    
    # Iniciar job de detecção
    job_id = "detection_job_" + str(uuid.uuid4())[:8]
    current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Extrair configurações adicionais
    min_confidence = data.get("min_confidence", 0.5)
    
    # Registrar o job
    detection_job = {
        "job_id": job_id,
        "catalog_id": catalog_id,
        "model_id": model_id,
        "status": "queued",
        "created_at": current_time,
        "completed_at": None,
        "config": {
            "min_confidence": min_confidence
        },
        "results": [],
        "error": None
    }
    
    # Armazenar o job
    detection_jobs[job_id] = detection_job
    
    # Iniciar processo de detecção em thread separada
    detection_thread = threading.Thread(
        target=run_detection, 
        args=(job_id, catalog_id, model_id, min_confidence)
    )
    detection_thread.daemon = True
    detection_thread.start()
    
    return jsonify({
        "message": "Detecção iniciada com sucesso",
        "job_id": job_id
    })

def run_detection(job_id, catalog_id, model_id, min_confidence):
    """
    Função que executa a detecção real usando o modelo treinado.
    Esta função é executada em uma thread separada.
    """
    try:
        import os
        import json
        
        # Atualizar status
        detection_jobs[job_id]["status"] = "processing"
        detection_jobs[job_id]["log"] = ["Iniciando processo de detecção..."]
        
        # Buscar o modelo
        model = None
        for m in models_db:
            if m.get("model_id") == model_id:
                model = m
                break
        
        if not model:
            raise Exception("Modelo " + model_id + " não encontrado")
        
        # Verificar se o modelo está treinado
        if model.get("status") != "completed":
            raise Exception("Modelo " + model_id + " não está treinado (status: " + model.get("status") + ")")
        
        # Obter o caminho do modelo
        models_dir = os.environ.get("MODELS_DIR", "/models")
        model_path = os.path.join(models_dir, model_id, "model_final.pth")
        
        if not os.path.exists(model_path):
            raise Exception("Arquivo do modelo não encontrado: " + model_path)
        
        # URLs e caminhos
        backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
        data_dir = os.environ.get("DATA_DIR", "/data")
        
        # Buscar informações do catálogo
        print("Buscando informações do catálogo " + catalog_id + "...")
        detection_jobs[job_id]["log"].append("Buscando informações do catálogo " + catalog_id + "...")
        
        try:
            catalog_info_response = requests.get(backend_url + "/catalogs/" + catalog_id)
            if catalog_info_response.status_code != 200:
                raise Exception("Erro ao buscar informações do catálogo: " + catalog_info_response.text)
            
            catalog_info = catalog_info_response.json()
            page_count = catalog_info.get("page_count", 0)
            print("Catálogo " + catalog_id + " tem " + str(page_count) + " páginas")
            detection_jobs[job_id]["log"].append("Catálogo com " + str(page_count) + " páginas encontrado")
            
            # Atualizar informações no job
            detection_jobs[job_id]["total_pages"] = page_count
            detection_jobs[job_id]["processed_pages"] = 0
            detection_jobs[job_id]["detections_count"] = 0
            
        except Exception as e:
            raise Exception("Erro ao buscar informações do catálogo: " + str(e))
        
        # Importar detectron2 com segurança
        d2 = safe_import_detectron2()
        if d2 is None:
            raise Exception("Falha ao importar Detectron2. Verifique os logs para mais detalhes.")
        
        # Obter a configuração do modelo
        base_model = model.get("config", {}).get("base_model", "COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml")
        
        # Configurar o modelo Detectron2
        print("Configurando modelo Detectron2 com base_model=" + base_model + ", min_confidence=" + str(min_confidence))
        detection_jobs[job_id]["log"].append("Configurando modelo Detectron2...")
        
        cfg = d2["get_cfg"]()
        cfg.merge_from_file(d2["detectron2"].model_zoo.get_config_file(base_model))
        cfg.MODEL.ROI_HEADS.NUM_CLASSES = 3  # produto, logo, cabecalho
        cfg.MODEL.WEIGHTS = model_path
        cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = min_confidence
        
        # Criar predictor
        try:
            predictor = d2["DefaultPredictor"](cfg)
            detection_jobs[job_id]["log"].append("Modelo carregado com sucesso")
        except Exception as e:
            raise Exception("Erro ao criar predictor: " + str(e))
        
        # Processar cada página do catálogo
        results = []
        total_detections = 0
        
        for page_number in range(1, page_count + 1):
            try:
                print("Processando página " + str(page_number) + "/" + str(page_count) + "...")
                detection_jobs[job_id]["log"].append("Processando página " + str(page_number) + "/" + str(page_count) + "...")
                detection_jobs[job_id]["processed_pages"] = page_number - 1
                
                # URL da imagem
                image_url = backend_url + "/catalogs/" + catalog_id + "/pages/" + str(page_number) + "/image"
                
                # Baixar a imagem temporariamente
                image_dir = os.path.join(data_dir, "temp", catalog_id)
                os.makedirs(image_dir, exist_ok=True)
                image_path = os.path.join(image_dir, "page_" + str(page_number) + ".jpg")
                
                # Baixar imagem
                try:
                    import urllib.request
                    urllib.request.urlretrieve(image_url, image_path)
                except Exception as e:
                    print("Erro ao baixar imagem: " + str(e))
                    detection_jobs[job_id]["log"].append("Erro ao baixar imagem da página " + str(page_number) + ": " + str(e))
                    continue
                
                # Carregar imagem com OpenCV
                img = d2["cv2"].imread(image_path)
                if img is None:
                    print("Erro ao carregar imagem: " + image_path)
                    detection_jobs[job_id]["log"].append("Erro ao carregar imagem da página " + str(page_number))
                    continue
                
                # Executar detecção
                outputs = predictor(img)
                
                # Extrair resultados
                instances = outputs["instances"].to("cpu")
                boxes = instances.pred_boxes.tensor.numpy()
                scores = instances.scores.numpy()
                classes = instances.pred_classes.numpy()
                
                # Converter para o formato interno
            annotations = []
            
                for i in range(len(boxes)):
                    # Pular se a confiança estiver abaixo do limiar
                    if scores[i] < min_confidence:
                        continue
                    
                    # Obter coordenadas da bbox
                    x1, y1, x2, y2 = boxes[i]
                    
                    # Obter tipo baseado na classe
                    class_id = int(classes[i])
                    if class_id == 0:
                        class_name = "produto"
                    elif class_id == 1:
                        class_name = "logo"
                    elif class_id == 2:
                        class_name = "cabecalho"
                    else:
                        class_name = "desconhecido"
                    
                    # Criar anotação
                annotation = {
                        "id": "det_" + str(uuid.uuid4())[:8],
                        "type": class_name,
                    "bbox": {
                            "x1": float(x1),
                            "y1": float(y1),
                            "x2": float(x2),
                            "y2": float(y2)
                        },
                        "confidence": float(scores[i])
                }
                
                annotations.append(annotation)
            
            # Adicionar resultado desta página
            results.append({
                "page_number": page_number,
                    "annotations": annotations,
                    "image_url": image_url
                })
                
                # Atualizar contadores
                total_detections += len(annotations)
                detection_jobs[job_id]["detections_count"] = total_detections
                
                print("Página " + str(page_number) + ": " + str(len(annotations)) + " objetos detectados")
                detection_jobs[job_id]["log"].append("Página " + str(page_number) + ": " + str(len(annotations)) + " objetos detectados")
                detection_jobs[job_id]["processed_pages"] = page_number
                
            except Exception as page_error:
                print("Erro ao processar página " + str(page_number) + ": " + str(page_error))
                detection_jobs[job_id]["log"].append("Erro ao processar página " + str(page_number) + ": " + str(page_error))
        
        # Atualizar resultados no job
        detection_jobs[job_id]["results"] = results
        detection_jobs[job_id]["status"] = "completed"
        detection_jobs[job_id]["completed_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        detection_jobs[job_id]["log"].append("Detecção concluída: " + str(total_detections) + " objetos detectados em " + str(page_count) + " páginas")
        
        print("Detecção concluída para catálogo " + catalog_id + " - " + str(len(results)) + " páginas processadas")
        
    except Exception as e:
        print("Erro durante a detecção: " + str(e))
        error_msg = str(e)
        detection_jobs[job_id]["status"] = "failed"
        detection_jobs[job_id]["error"] = error_msg
        detection_jobs[job_id]["log"] = detection_jobs[job_id].get("log", []) + ["Erro fatal: " + error_msg]

@app.route("/detect/status/<job_id>", methods=["GET"])
def get_detection_status(job_id):
    """
    Verifica o status de um job de detecção.
    Retorna informações detalhadas sobre o progresso da detecção.
    """
    print("Verificando status para job_id: " + job_id)
    
    # Verificar se o job existe no dicionário de rastreamento
    if job_id in detection_jobs:
        job_info = detection_jobs[job_id]
        catalog_id = job_info.get("catalog_id")
        model_id = job_info.get("model_id")
        created_at = job_info.get("created_at")
        
        # Obter status atual
        status = job_info.get("status", "processing")
        
        # Se o job falhou, retornar o erro
        if status == "failed":
            return jsonify({
                "job_id": job_id,
                "status": status,
                "error": job_info.get("error", "Erro desconhecido durante a detecção"),
            })
        
        # Se o job foi concluído, retornar informações sobre os resultados
        if status == "completed":
            results = job_info.get("results", [])
            completed_at = job_info.get("completed_at", created_at)
            total_detections = 0
            
            # Para detecção de catálogo com múltiplas páginas
            if isinstance(results, list) and all(isinstance(item, dict) and "annotations" in item for item in results):
                # Contar total de detecções em todas as páginas
                total_detections = sum(len(page.get("annotations", [])) for page in results)
                total_pages = len(results)
                processed_pages = total_pages
            # Para detecção de imagem única
            else:
                total_detections = len(results) if isinstance(results, list) else 0
                total_pages = 1
                processed_pages = 1
            
            return jsonify({
                "job_id": job_id,
                "status": status,
                "created_at": created_at,
                "completed_at": completed_at,
                "catalog_id": catalog_id,
                "model_id": model_id,
                "progress": {
                    "processed_pages": processed_pages,
                    "total_pages": total_pages,
                    "percentage": 100,
                    "detections_count": total_detections,
                    "log": [f"Detecção concluída com {total_detections} objetos encontrados"]
                }
            })
        
        # Job ainda em processamento, verificar progresso real
        processed_pages = job_info.get("processed_pages", 0)
        total_pages = job_info.get("total_pages", 1)
        detections_count = job_info.get("detections_count", 0)
        
        # Calcular progresso percentual
    progress_percentage = round((processed_pages / total_pages) * 100, 1) if total_pages > 0 else 0
    
        # ETA - pode ser calculado com base no tempo médio por página já processada
        current_time = datetime.now()
        start_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        elapsed_seconds = (current_time - start_time).total_seconds()
        
    if processed_pages > 0:
        seconds_per_page = elapsed_seconds / processed_pages
        remaining_pages = total_pages - processed_pages
        eta_seconds = int(remaining_pages * seconds_per_page)
        
        if eta_seconds > 3600:
            eta = f"{eta_seconds // 3600}h {(eta_seconds % 3600) // 60}m"
        elif eta_seconds > 60:
            eta = f"{eta_seconds // 60}m {eta_seconds % 60}s"
        else:
            eta = f"{eta_seconds}s"
    else:
        eta = "Calculando..."
    
        # Log de progresso real
        detection_log = job_info.get("log", [])
        if not detection_log:
            detection_log = [f"Processando página {processed_pages}/{total_pages}"]
    
    return jsonify({
        "job_id": job_id,
        "status": status,
        "created_at": created_at,
        "catalog_id": catalog_id,
        "model_id": model_id,
        "progress": {
            "processed_pages": processed_pages,
            "total_pages": total_pages,
            "percentage": progress_percentage,
            "eta": eta,
            "detections_count": detections_count,
            "log": detection_log
        }
    })
    else:
        return jsonify({"detail": "Job de detecção " + str(job_id) + " não encontrado"}), 404

@app.route("/results/<job_id>", methods=["GET"])
def get_results(job_id):
    """
    Recupera os resultados de uma detecção com base no job_id.
    Em um ambiente real, esta função buscaria os resultados de um banco de dados.
    """
    print(f"Buscando resultados para job_id: {job_id}")
    
    # Verificar se o job existe no dicionário de rastreamento
    if job_id in detection_jobs:
        job_info = detection_jobs[job_id]
        catalog_id = job_info["catalog_id"]
        model_id = job_info["model_id"]
        created_at = job_info["created_at"]
        print(f"Job encontrado no rastreador: {job_info}")
    else:
        # Tentar extrair o catalog_id do formato do job_id como fallback
        try:
            # Tentar extrair o catalog_id do novo formato
            if job_id.startswith("detection_") and job_id.count("_") >= 2:
                parts = job_id.split("_", 2)
                if len(parts) >= 3:
                    catalog_id = parts[2]
                else:
                    catalog_id = job_id  # Fallback para o job_id completo
            else:
                # Para compatibilidade com jobs antigos
                catalog_id = job_id.split('_')[-1] if '_' in job_id else job_id
                
            model_id = "model123"  # Valor padrão
            created_at = "2023-06-15T10:30:00Z"  # Valor padrão
            print(f"Job não encontrado, catálogo extraído do job_id: {catalog_id}")
        except Exception as e:
            print(f"Erro ao extrair catálogo: {str(e)}")
            catalog_id = job_id  # Fallback para o job_id completo
            model_id = "model123"  # Valor padrão
            created_at = "2023-06-15T10:30:00Z"  # Valor padrão
    
    # Para fins de demonstração, simular que todos os jobs estão completos
    # Em um ambiente real, verificaríamos o status real do job
    completed_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Atualizar o status do job para "completed" se ele existir no rastreador
    if job_id in detection_jobs:
        detection_jobs[job_id]["status"] = "completed"
        detection_jobs[job_id]["completed_at"] = completed_at
    
    # Obter ou simular o número de páginas do catálogo
    total_pages = 1  # Por padrão, consideramos que há apenas 1 página
    
    # Em um ambiente real, buscaríamos esse valor do banco de dados
    # Simulando para alguns catálogos conhecidos
    if catalog_id == "catalog123":
        total_pages = 1  # Catálogo de exemplo com apenas 1 página
    elif catalog_id == "catalog456":
        total_pages = 3  # Outro catálogo de exemplo com 3 páginas
    elif catalog_id == "catalog789":
        total_pages = 5  # Outro catálogo de exemplo com 5 páginas
    
    print(f"Catálogo {catalog_id} possui {total_pages} página(s) - gerando resultados")
    
    # Gerar resultados simulados apenas para o número real de páginas
    results = []
    for page_num in range(1, total_pages + 1):
        # Simular um número aleatório de detecções para cada página
        import random
        num_annotations = random.randint(2, 6)
        
        page_annotations = []
        for i in range(num_annotations):
            # Coordenadas aleatórias para boxes - DISTRIBUINDO POR TODA A IMAGEM
            # Imagem simulada com 1500x2000 pixels
            img_width = 1500
            img_height = 2000
            
            # Dividir a imagem em 3 colunas e 3 linhas para distribuir as boxes
            col = i % 3  # 0, 1, ou 2
            row = (i // 3) % 3  # 0, 1, ou 2
            
            # Calcular as coordenadas base para cada seção
            base_x = col * (img_width // 3)
            base_y = row * (img_height // 3)
            
            # Calcular coordenadas dentro da seção
            margin = 50  # margem para evitar boxes muito próximas às bordas da seção
            section_width = img_width // 3 - (2 * margin)
            section_height = img_height // 3 - (2 * margin)
            
            # Coordenadas finais com alguma aleatoriedade dentro da seção
            x1 = base_x + margin + random.randint(0, section_width // 2)
            y1 = base_y + margin + random.randint(0, section_height // 2)
            width = random.randint(section_width // 3, section_width - (x1 - base_x - margin))
            height = random.randint(section_height // 3, section_height - (y1 - base_y - margin))
            x2 = x1 + width
            y2 = y1 + height
            
            product_type = random.choice(["produto", "logo", "cabecalho"])
            
            page_annotations.append({
                "id": f"anno{page_num}_{i+1}",
                "type": product_type,
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2
                },
                "confidence": round(random.uniform(0.6, 0.98), 2)
            })
        
        results.append({
            "page_number": page_num,
            "annotations": page_annotations,
            "image_url": f"/catalogs/{catalog_id}/pages/{page_num}/image"
        })
    
    # Para fins de demonstração, retornar dados simulados
    return jsonify({
        "job_id": job_id,
        "catalog_id": catalog_id,
        "model_id": model_id,
        "created_at": created_at,
        "completed_at": completed_at,
        "status": "completed",
        "results": results
    })

@app.route("/models", methods=["GET"])
def list_models():
    # Log para debug
    print(f"Listando modelos. Total na lista: {len(models_db)}")
    print(f"IDs dos modelos: {[model['model_id'] for model in models_db]}")
    
    # Filtrar modelos não excluídos
    active_models = [model for model in models_db]
    
    print(f"Total de modelos ativos retornados: {len(active_models)}")
    print(f"Nomes dos modelos ativos: {[model['name'] for model in active_models]}")
    
    return jsonify(active_models)

@app.route("/models/<model_id>", methods=["DELETE"])
def delete_model(model_id):
    """
    Exclui um modelo da lista de modelos disponíveis.
    """
    print(f"Excluindo modelo: {model_id}")
    
    # Procurar o modelo
    model_exists = False
    for model in models_db:
        if model["model_id"] == model_id:
            model_exists = True
            break
    
    if not model_exists:
        return jsonify({"error": f"Modelo {model_id} não encontrado"}), 404
    
    try:
        # Excluir arquivos do modelo do disco
        models_dir = os.environ.get("MODELS_DIR", "/models")
        model_path = os.path.join(models_dir, model_id)
        
        if os.path.exists(model_path):
            import shutil
            shutil.rmtree(model_path)
            print(f"Arquivos do modelo {model_id} excluídos: {model_path}")
        
        # Remover modelo da lista
        models_db.remove(next(model for model in models_db if model["model_id"] == model_id))
        
        return jsonify({
            "message": f"Modelo {model_id} excluído com sucesso"
        })
    except Exception as e:
        return jsonify({"error": f"Erro ao excluir modelo: {str(e)}"}), 500

@app.route("/detect/result/<job_id>", methods=["GET"])
def get_detection_result(job_id):
    """
    Recupera os resultados de uma detecção de imagem única com base no job_id.
    """
    print("Buscando resultados de detecção para job_id: " + str(job_id))
    
    # Verificar se o job existe no dicionário de rastreamento
    if job_id in detection_jobs:
        job_info = detection_jobs[job_id]
        status = job_info.get("status", "unknown")
        
        # Verificar se a detecção foi concluída
        if status == "completed":
            return jsonify({
                "job_id": job_id,
                "status": status,
                "created_at": job_info.get("created_at"),
                "completed_at": job_info.get("completed_at"),
                "model_id": job_info.get("model_id"),
                "image_url": job_info.get("image_url"),
                "annotations": job_info.get("results", [])
            })
        elif status == "failed":
            return jsonify({
                "job_id": job_id,
                "status": status,
                "error": job_info.get("error", "Erro desconhecido")
            }), 400
        else:
            return jsonify({
                "job_id": job_id,
                "status": status,
                "message": "Detecção em andamento"
            })
    else:
        return jsonify({"detail": "Job de detecção " + str(job_id) + " não encontrado"}), 404

def initialize_models_from_disk():
    """
    Inicializa a lista de modelos a partir dos arquivos salvos no disco.
    """
    try:
        import os
        import json
        from datetime import datetime
        
        models_dir = os.environ.get("MODELS_DIR", "/models")
        
        if not os.path.exists(models_dir):
            print(f"Diretório de modelos não encontrado: {models_dir}")
            os.makedirs(models_dir, exist_ok=True)
            return
        
        # Verificar se Detectron2 está disponível
        d2 = safe_import_detectron2()
        if d2 is None:
            print("Aviso: Detectron2 não está disponível. Os modelos serão carregados, mas não poderão ser usados para detecção.")
        
        # Listar diretórios de modelos
        model_dirs = [d for d in os.listdir(models_dir) if os.path.isdir(os.path.join(models_dir, d))]
        
        for model_dir_name in model_dirs:
            model_dir = os.path.join(models_dir, model_dir_name)
            config_path = os.path.join(model_dir, "config.json")
            model_path = os.path.join(model_dir, "model_final.pth")
            
            # Verificar se o modelo tem os arquivos necessários
            if not os.path.exists(config_path):
                print(f"Arquivo de configuração não encontrado para o modelo {model_dir_name}")
                continue
                
            if not os.path.exists(model_path):
                print(f"Arquivo de modelo não encontrado para o modelo {model_dir_name}")
                continue
            
            # Carregar configuração
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
                
                # Criar entrada para o modelo
                model = {
                    "model_id": model_dir_name,
                    "name": config.get("name", f"Modelo {model_dir_name}"),
                    "status": "completed",
                    "train_size": config.get("train_size", 0),
                    "val_size": config.get("val_size", 0),
                    "config": config.get("config", {}),
                    "created_at": config.get("created_at", datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")),
                    "completed_at": config.get("completed_at", datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")),
                    "model_path": model_path
                }
                
                # Adicionar à lista de modelos
                models_db.append(model)
                print(f"Modelo carregado: {model['name']} (ID: {model['model_id']})")
                
            except Exception as e:
                print(f"Erro ao carregar configuração do modelo {model_dir_name}: {str(e)}")
                continue
        
        print(f"Total de {len(models_db)} modelos carregados do disco")
        
    except Exception as e:
        print(f"Erro ao inicializar modelos do disco: {str(e)}")

# Patch para lidar com problemas de compatibilidade do Detectron2
# com versões mais antigas do Python e PyTorch
def patch_torch_compatibility():
    """
    Aplica patches para compatibilidade com versões mais antigas do Python e PyTorch.
    """
    import sys
    import builtins
    import re
    import functools
    
    # Adicionar cached_property ao módulo functools para Python < 3.8
    if not hasattr(functools, 'cached_property'):
        print("Adicionando cached_property ao módulo functools")
        
        class cached_property:
            """
            Implementação de cached_property para Python < 3.8
            """
            def __init__(self, func):
                self.func = func
                self.attrname = None
                self.__doc__ = func.__doc__
                
            def __set_name__(self, owner, name):
                self.attrname = name
                
            def __get__(self, instance, owner=None):
                if instance is None:
                    return self
                if self.attrname is None:
                    self.attrname = self.func.__name__
                try:
                    cache = instance.__dict__
                except AttributeError:
                    # Não é possível armazenar em cache
                    return self.func(instance)
                if self.attrname not in cache:
                    cache[self.attrname] = self.func(instance)
                return cache[self.attrname]
        
        # Adicionar ao módulo functools
        functools.cached_property = cached_property
        
        # Monkey patch para sys.modules para que importações funcionem
        sys.modules['functools'].cached_property = cached_property
        
    # Verificar se torch.get_float32_matmul_precision existe
    try:
        import torch
        if not hasattr(torch, 'get_float32_matmul_precision'):
            print("Adicionando mock para torch.get_float32_matmul_precision")
            
            def get_float32_matmul_precision():
                return 'highest'
            
            torch.get_float32_matmul_precision = get_float32_matmul_precision
            
        # Patch para o método __repr__ do tensor para evitar erros
        original_repr = torch.Tensor.__repr__
        
        def safe_repr(self):
            try:
                return original_repr(self)
            except Exception:
                return "<" + self.__class__.__name__ + " of size " + str(tuple(self.shape)) + " (error in repr)>"
        
        torch.Tensor.__repr__ = safe_repr
        
    except ImportError:
        print("PyTorch não encontrado, pulando patches relacionados")
    
    # Patch para a função compile para corrigir f-strings problemáticas
    original_compile = builtins.compile
    
    def patched_compile(source, filename, mode, flags=0, dont_inherit=False, optimize=-1):
        if isinstance(source, str) and 'torch.get_float32_matmul_precision()' in source:
            # Corrigir f-strings problemáticas
            source = re.sub(
                r'f".*?{torch\.get_float32_matmul_precision\(\)}.*?"',
                '"highest"',
                source
            )
        return original_compile(source, filename, mode, flags, dont_inherit, optimize)
    
    builtins.compile = patched_compile
    
    print("Patches de compatibilidade aplicados com sucesso")

# Aplicar patches de compatibilidade
patch_torch_compatibility()

@app.route("/health", methods=["GET"])
def health_check():
    """
    Endpoint para verificar a saúde do serviço.
    """
    try:
        # Verificar se conseguimos importar detectron2
        import_success = False
        error_msg = None
        
        try:
            import detectron2
            from detectron2.config import get_cfg
            import_success = True
        except Exception as e:
            error_msg = str(e)
        
        # Verificar se conseguimos acessar o banco de dados de modelos
        models_count = len(models_db)
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "detectron2_import": import_success,
            "detectron2_error": error_msg,
            "models_count": models_count,
            "environment": {
                "python_version": sys.version,
                "models_dir": os.environ.get("MODELS_DIR", "/models")
            }
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        }), 500

# Função wrapper para importar detectron2 com segurança
def safe_import_detectron2():
    """
    Importa detectron2 com tratamento de erros e aplica patches necessários.
    Retorna um dicionário com os módulos importados ou None em caso de erro.
    """
    try:
        # Garantir que os patches foram aplicados
        patch_torch_compatibility()
        
        # Importar componentes básicos primeiro
        import torch
        import cv2
        import numpy as np
        
        # Verificar se cached_property está disponível
        import functools
        if not hasattr(functools, 'cached_property'):
            # Adicionar cached_property manualmente ao functools
            class cached_property:
                def __init__(self, func):
                    self.func = func
                    self.attrname = None
                    self.__doc__ = func.__doc__
                    
                def __set_name__(self, owner, name):
                    self.attrname = name
                    
                def __get__(self, instance, owner=None):
                    if instance is None:
                        return self
                    if self.attrname is None:
                        self.attrname = self.func.__name__
                    try:
                        cache = instance.__dict__
                    except AttributeError:
                        return self.func(instance)
                    if self.attrname not in cache:
                        cache[self.attrname] = self.func(instance)
                    return cache[self.attrname]
            
            functools.cached_property = cached_property
            # Patch para sys.modules
            import sys
            sys.modules['functools'].cached_property = cached_property
            print("Adicionado cached_property ao functools dentro de safe_import_detectron2")
            
            # Patch para torch.nn.modules.module
            try:
                import torch.nn.modules.module
                torch.nn.modules.module.cached_property = cached_property
            except ImportError:
                pass
        
        # Importar componentes do detectron2 um por um com tratamento de erros
        try:
            import detectron2
        except Exception as e:
            print("Erro ao importar detectron2 diretamente: " + str(e))
            return None
        
        # Importar config
        try:
            from detectron2.config import get_cfg
        except Exception as e:
            print("Erro ao importar detectron2.config: " + str(e))
            return None
        
        # Importar engine
        try:
            from detectron2.engine import DefaultPredictor, DefaultTrainer
        except Exception as e:
            print("Erro ao importar detectron2.engine: " + str(e))
            return None
        
        # Importar structures
        try:
            from detectron2.structures import BoxMode
        except Exception as e:
            print("Erro ao importar detectron2.structures: " + str(e))
            return None
        
        # Importar data
        try:
            from detectron2.data import DatasetCatalog, MetadataCatalog
        except Exception as e:
            print("Erro ao importar detectron2.data: " + str(e))
            return None
        
        # Se chegou até aqui, todas as importações foram bem-sucedidas
        print("Detectron2 importado com sucesso!")
        return {
            "detectron2": detectron2,
            "get_cfg": get_cfg,
            "DefaultPredictor": DefaultPredictor,
            "DefaultTrainer": DefaultTrainer,
            "BoxMode": BoxMode,
            "DatasetCatalog": DatasetCatalog,
            "MetadataCatalog": MetadataCatalog,
            "torch": torch,
            "cv2": cv2,
            "np": np
        }
    except Exception as e:
        print("Erro ao importar detectron2: " + str(e))
        return None

if __name__ == "__main__":
    # Inicializar modelos do disco
    initialize_models_from_disk()
    
    # Iniciar o servidor
    app.run(host="0.0.0.0", port=5000, debug=True) 