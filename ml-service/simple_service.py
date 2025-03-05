from flask import Flask, jsonify, request
import os
import time
import uuid
from datetime import datetime

app = Flask(__name__)

# Armazenamento em memória para jobs de detecção e treinamento
detection_jobs = {}
training_jobs = {}
models_db = []  # Lista para armazenar informações de modelos
catalog_jobs = {}  # Jobs para processamento de catálogos completos

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
        "error": None
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
            
        # Simulação de resultados para o catálogo
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
            "pages": [
                {
                    "page_number": 1,
                    "objects": [
                        {"class": "produto", "box": [10, 10, 100, 100], "score": 0.95},
                        {"class": "produto", "box": [150, 150, 250, 250], "score": 0.88}
                    ]
                },
                {
                    "page_number": 2,
                    "objects": [
                        {"class": "produto", "box": [20, 20, 120, 120], "score": 0.92}
                    ]
                }
                # Na implementação real, incluiria todas as páginas e objetos detectados
            ]
        })
    else:
        return jsonify({"detail": f"Job de detecção {job_id} não encontrado"}), 404

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
    
    if not catalog_ids:
        return jsonify({"detail": "IDs de catálogo são obrigatórios para treinamento"}), 400
        
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
        "error": None
    }
    
    # Adicionar modelo à lista de modelos
    models_db.append({
        "id": model_id,
        "name": model_name,
        "job_id": job_id,
        "created_at": datetime.now().isoformat(),
        "status": "training",
        "config": config
    })
    
    # Simulação de treinamento bem-sucedido (para demonstração)
    training_jobs[job_id]["status"] = "completed"
    training_jobs[job_id]["progress"]["percentage"] = 100
    training_jobs[job_id]["progress"]["current_iteration"] = config.get("max_iter", 1000)
    
    # Atualizar o status do modelo
    for model in models_db:
        if model["id"] == model_id:
            model["status"] = "ready"
    
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
    
    return jsonify({
        "job_id": job_id,
        "model_id": job_info["model_id"],
        "name": job_info["name"],
        "status": job_info["status"],
        "created_at": job_info["created_at"],
        "updated_at": job_info["updated_at"],
        "progress": job_info["progress"],
        "error": job_info.get("error")
    })

@app.route('/models', methods=['GET'])
def list_models():
    """
    Lista todos os modelos treinados.
    """
    return jsonify({"models": models_db})

@app.route('/models/<model_id>', methods=['DELETE'])
def delete_model(model_id):
    """
    Exclui um modelo pelo seu ID.
    """
    # Verificar se o modelo existe
    model_exists = False
    for i, model in enumerate(models_db):
        if model["id"] == model_id:
            models_db.pop(i)
            model_exists = True
            break
    
    if not model_exists:
        return jsonify({"detail": f"Modelo {model_id} não encontrado"}), 404
    
    # Remover arquivos do modelo (apenas simulação)
    print(f"Modelo {model_id} removido com sucesso")
    
    return jsonify({"detail": f"Modelo {model_id} excluído com sucesso"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 