#!/bin/bash
echo "Instalando Detectron2..."
pip install --no-cache-dir git+https://github.com/facebookresearch/detectron2.git@v0.6
echo "Configurando ambiente para Detectron2..."
export PYTHONPATH=$PYTHONPATH:/app
export CUDA_VISIBLE_DEVICES=""
python service.py
