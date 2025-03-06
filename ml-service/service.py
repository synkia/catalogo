from flask import Flask, jsonify, request
import os
import time
import uuid
import json
import requests
import threading
import random
from datetime import datetime

print("=== ML SERVICE INICIALIZADO ===")
print(f"Variáveis de ambiente:")
print(f"BACKEND_URL: {os.environ.get('BACKEND_URL', 'não definido')}")
print(f"DATA_DIR: {os.environ.get('DATA_DIR', 'não definido')}")
print(f"MODELS_DIR: {os.environ.get('MODELS_DIR', 'não definido')}")

app = Flask(__name__)

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

# Configurações globais
backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
data_dir = os.environ.get("DATA_DIR", "/data")
models_dir = os.environ.get("MODELS_DIR", "/models")

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
    Endpoint para iniciar a detecção de objetos em uma imagem.
    """
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
        return jsonify({"detail": "ID do modelo é obrigatório"}), 400
        
    # Criar ID único para o job
    job_id = str(uuid.uuid4())
    
    # Registrar o job
    detection_jobs[job_id] = {
        "id": job_id,
        "image_url": image_url,
        "model_id": model_id,
        "min_confidence": min_confidence,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "results": None,
        "error": None
    }
    
    # Simulação de detecção bem-sucedida (para demonstração)
    detection_jobs[job_id]["status"] = "completed"
    detection_jobs[job_id]["results"] = {
        "objects": [
            {"class": "produto", "box": [10, 10, 100, 100], "score": 0.95}
        ],
        "processing_time": 0.5
    }
    
    return jsonify({
        "job_id": job_id,
        "status": "pending",
        "message": "Detecção iniciada com sucesso"
    })

@app.route('/detect/<catalog_id>', methods=['POST'])
def start_detection(catalog_id):
    """
    Inicia a detecção em um catálogo completo.
    """
    data = request.json
    
    if not data:
        return jsonify({"detail": "Dados inválidos"}), 400
        
    # Extrair parâmetros da requisição
    model_id = data.get("model_id")
    min_confidence = data.get("min_confidence", 0.7)
    
    if not model_id:
        return jsonify({"detail": "ID do modelo é obrigatório"}), 400
        
    # Criar ID único para o job
    job_id = str(uuid.uuid4())
    
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
            "total_pages": 10  # Valor fictício para demonstração
        },
        "detections_count": 0,
        "log": ["Iniciando processamento do catálogo"],
        "error": None,
        "results": None
    }
    
    # Simulação de processamento em background
    # Em uma implementação real, isso seria feito em uma thread ou processo separado
    catalog_jobs[job_id]["status"] = "processing"
    catalog_jobs[job_id]["progress"]["percentage"] = 10
    
    # Após um tempo, marcamos como concluído (simulação)
    catalog_jobs[job_id]["status"] = "completed"
    catalog_jobs[job_id]["progress"]["percentage"] = 100
    catalog_jobs[job_id]["progress"]["processed_pages"] = 10
    catalog_jobs[job_id]["detections_count"] = 25
    catalog_jobs[job_id]["log"].append("Processamento concluído")
    
    # Adicionar resultados simulados
    catalog_jobs[job_id]["results"] = [
        {
            "page_number": 1,
            "image_path": f"/api/catalogs/{catalog_id}/pages/1/image",
            "annotations": [
                {"type": "produto", "confidence": 0.95, "bbox": {"x1": 100, "y1": 100, "x2": 400, "y2": 500}, "id": "prod_001"},
                {"type": "produto", "confidence": 0.88, "bbox": {"x1": 450, "y1": 150, "x2": 750, "y2": 550}, "id": "prod_002"}
            ]
        },
        {
            "page_number": 2,
            "image_path": f"/api/catalogs/{catalog_id}/pages/2/image",
            "annotations": [
                {"type": "produto", "confidence": 0.92, "bbox": {"x1": 200, "y1": 200, "x2": 500, "y2": 600}, "id": "prod_003"}
            ]
        }
    ]
    
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
    Executa o treinamento em background.
    """
    try:
        training_jobs[job_id]["status"] = "em_andamento"
        training_jobs[job_id]["progresso"] = 0
        
        # Simular progresso de treinamento
        total_iters = config.get("max_iter", 1000)
        
        # Log inicial
        training_jobs[job_id]["log"].append(f"Iniciando treinamento para modelo '{model_name}'")
        training_jobs[job_id]["log"].append(f"Usando catálogos: {', '.join(catalog_ids)}")
        training_jobs[job_id]["log"].append(f"Configuração: max_iter={total_iters}")
        
        # Simular o treinamento (em uma implementação real, isso usaria PyTorch e OpenCV)
        for i in range(1, total_iters + 1):
            # Atualizar progresso a cada 10%
            if i % (total_iters // 10) == 0 or i == total_iters:
                progresso = int((i / total_iters) * 100)
                training_jobs[job_id]["progresso"] = progresso
                
                # Log a cada 10%
                loss = random.uniform(0.1, 0.5) / (i / 100 + 1)  # Simular redução de loss
                training_jobs[job_id]["log"].append(f"Iteração {i}/{total_iters} - Progresso: {progresso}% - Loss: {loss:.4f}")
                
                # Simular desempenho em validação a cada 25%
                if i % (total_iters // 4) == 0 or i == total_iters:
                    precision = min(0.95, 0.5 + (i / total_iters) * 0.4)
                    recall = min(0.9, 0.4 + (i / total_iters) * 0.45)
                    training_jobs[job_id]["log"].append(f"Validação: Precision={precision:.4f}, Recall={recall:.4f}")
            
            # Simular tempo de treinamento
            time.sleep(0.01)  # Em um ambiente real, isso não seria necessário
            
            # Verificar se o treinamento foi cancelado
            if training_jobs[job_id]["status"] == "cancelado":
                training_jobs[job_id]["log"].append("Treinamento cancelado pelo usuário")
                return

        # Treinamento concluído
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["progress"]["percentage"] = 100.0
        training_jobs[job_id]["progress"]["current_iteration"] = total_iters
        training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        training_jobs[job_id]["log"].append("Treinamento concluído com sucesso!")
        
        # Atualizar status do modelo
        for model in models_db:
            if model.get("model_id") == model_id:
                model["status"] = "ready"
                model["completed_at"] = datetime.now().isoformat()
                # Adicionar métricas calculadas
                model["metrics"] = {
                    "accuracy": 0.85 + random.random() * 0.1,
                    "precision": 0.80 + random.random() * 0.15,
                    "recall": 0.82 + random.random() * 0.12
                }
                # Salvar modelos em disco após atualização
                save_models_to_disk()
                break
    
    except Exception as e:
        # Registrar erro
        error_msg = f"Erro durante o treinamento: {str(e)}"
        print(error_msg)
        
        # Atualizar job
        if job_id in training_jobs:
            training_jobs[job_id]["status"] = "failed"
            training_jobs[job_id]["error"] = error_msg
            training_jobs[job_id]["log"].append(error_msg)
        
        # Atualizar modelo
        for model in models_db:
            if model.get("model_id") == model_id:
                model["status"] = "failed"
                model["error"] = error_msg
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