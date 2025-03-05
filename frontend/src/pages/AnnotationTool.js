import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Image, Transformer } from 'react-konva';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Button, 
  ButtonGroup, 
  FormControl, 
  FormControlLabel, 
  RadioGroup, 
  Radio,
  Snackbar,
  Alert,
  Tooltip,
  IconButton,
  CircularProgress,
  Slider,
  Stack
} from '@mui/material';
import useImage from 'use-image';
import axios from 'axios';
import { 
  Save as SaveIcon, 
  ZoomIn as ZoomInIcon, 
  ZoomOut as ZoomOutIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Delete as DeleteIcon,
  Colorize as ColorizeIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

// Componente de retângulo selecionável
const Rectangle = ({ shapeProps, isSelected, onSelect, onChange, annotationType }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected) {
      // Anexar transformer
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  // Cores para cada tipo de anotação
  const colors = {
    produto: 'green',
    logo: 'blue',
    cabecalho: 'purple',
    decorativo: 'orange'
  };

  return (
    <>
      <Rect
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        {...shapeProps}
        draggable
        stroke={colors[annotationType] || 'green'}
        strokeWidth={2}
        dash={isSelected ? undefined : [5, 5]}
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          // Obter posição e tamanho após transformação
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          // Resetar escala e atualizar tamanho
          node.scaleX(1);
          node.scaleY(1);
          
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Validar para não permitir tamanho menor que 5
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

// Componente principal de anotação
const AnnotationTool = () => {
  const { catalogId, pageNumber } = useParams();
  const navigate = useNavigate();
  
  // Estados
  const [image, setImage] = useState(null);
  const [loadImage, imageStatus] = useImage(`${API_URL}/catalogs/${catalogId}/pages/${pageNumber}/image`);
  const [annotations, setAnnotations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [annotationType, setAnnotationType] = useState('produto');
  const [drawing, setDrawing] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState(null);
  const [nextCatalogId, setNextCatalogId] = useState(null);
  
  const stageRef = useRef();

  // Efeito para carregar a imagem
  useEffect(() => {
    if (imageStatus === 'loaded') {
      setImage(loadImage);
      setLoading(false);
    } else if (imageStatus === 'failed') {
      setSnackbar({
        open: true,
        message: 'Erro ao carregar imagem. Verifique se o catálogo e página existem.',
        severity: 'error'
      });
      setLoading(false);
    }
  }, [loadImage, imageStatus]);

  // Efeito para carregar anotações existentes
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        const response = await axios.get(`${API_URL}/annotations/${catalogId}/${pageNumber}`);
        
        if (response.data.annotations) {
          // Converter formato da API para formato do Konva
          const formattedAnnotations = response.data.annotations.map(anno => ({
            id: anno.id,
            x: anno.bbox.x1,
            y: anno.bbox.y1,
            width: anno.bbox.x2 - anno.bbox.x1,
            height: anno.bbox.y2 - anno.bbox.y1,
            type: anno.type,
            metadata: anno.metadata,
            confidence: anno.confidence
          }));
          
          setAnnotations(formattedAnnotations);
          // Inicializar histórico
          setHistory([formattedAnnotations]);
          setHistoryStep(0);
        }
      } catch (error) {
        console.error('Erro ao carregar anotações:', error);
        // Se não houver anotações, inicializar com array vazio
        setHistory([[]]);
      }
    };

    if (catalogId && pageNumber) {
      fetchAnnotations();
    }
  }, [catalogId, pageNumber]);

  // Buscar informações do catálogo atual e o próximo catálogo disponível
  useEffect(() => {
    const fetchCatalogInfo = async () => {
      try {
        // Buscar informações do catálogo atual
        const catalogResponse = await axios.get(`${API_URL}/catalogs/${catalogId}`);
        setCatalogInfo(catalogResponse.data);
        
        // Buscar lista de catálogos para encontrar o próximo
        const catalogsResponse = await axios.get(`${API_URL}/catalogs/`);
        const catalogs = catalogsResponse.data;
        
        // Ordenar catálogos por data de upload (mais recentes primeiro)
        const sortedCatalogs = [...catalogs].sort((a, b) => {
          return new Date(b.upload_date) - new Date(a.upload_date);
        });
        
        // Encontrar o índice do catálogo atual
        const currentIndex = sortedCatalogs.findIndex(cat => cat.catalog_id === catalogId);
        
        // Se há um próximo catálogo, guardar seu ID
        if (currentIndex >= 0 && currentIndex < sortedCatalogs.length - 1) {
          setNextCatalogId(sortedCatalogs[currentIndex + 1].catalog_id);
        }
      } catch (error) {
        console.error('Erro ao buscar informações do catálogo:', error);
      }
    };
    
    fetchCatalogInfo();
  }, [catalogId]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }
      if (e.ctrlKey || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        setIsCtrlPressed(true);
      }
      
      // Implementação de Ctrl+Z (desfazer)
      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault(); // Impedir comportamento padrão do navegador
        handleUndo();
      }
      
      // Implementação de Ctrl+Shift+Z (refazer)
      if (e.ctrlKey && e.code === 'KeyZ' && e.shiftKey) {
        e.preventDefault(); // Impedir comportamento padrão do navegador
        handleRedo();
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (!e.ctrlKey || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        setIsCtrlPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [historyStep, history]); // Adicionados historyStep e history como dependências

  // Manipuladores para desenho
  const handleMouseDown = (e) => {
    if (isSpacePressed || isCtrlPressed) {
      // Se a tecla espaço ou control estiver pressionada, permite arrastar o catálogo
      setIsDragging(true);
      return;
    }

    // Impede o comportamento padrão do Konva de arrastar o Stage
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    const { x, y } = stage.getRelativePointerPosition();

    setIsDrawing(true);
    setNewAnnotation({
      type: annotationType,
      x: x,
      y: y,
      width: 0,
      height: 0,
      id: uuidv4(),
    });
  };

  const handleMouseMove = (e) => {
    if (isSpacePressed || isCtrlPressed) {
      // Se a tecla espaço ou control estiver pressionada, permite arrastar o catálogo
      return;
    }
    
    // Se não estiver desenhando, não faz nada
    if (!isDrawing) {
      return;
    }

    e.evt.preventDefault();
    
    const stage = stageRef.current;
    const { x, y } = stage.getRelativePointerPosition();
    
    setNewAnnotation({
      ...newAnnotation,
      width: x - newAnnotation.x,
      height: y - newAnnotation.y,
    });
  };

  const handleMouseUp = () => {
    if (isSpacePressed || isCtrlPressed) {
      // Se a tecla espaço ou control estiver pressionada, termina de arrastar o catálogo
      setIsDragging(false);
      return;
    }
    
    if (!isDrawing) {
      return;
    }
    
    setIsDrawing(false);
    
    // Só adiciona a anotação se tiver tamanho mínimo
    if (Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
      const correctDimensions = {
        ...newAnnotation,
        x: newAnnotation.width < 0 ? newAnnotation.x + newAnnotation.width : newAnnotation.x,
        y: newAnnotation.height < 0 ? newAnnotation.y + newAnnotation.height : newAnnotation.y,
        width: Math.abs(newAnnotation.width),
        height: Math.abs(newAnnotation.height),
      };
      
      setAnnotations([...annotations, correctDimensions]);
      setHistory([...history.slice(0, historyStep + 1), [...annotations, correctDimensions]]);
      setHistoryStep(historyStep + 1);
    }
    
    setNewAnnotation(null);
  };

  // Manipuladores de seleção
  const checkDeselect = (e) => {
    // Desselecionar ao clicar em área vazia
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  // Zoom e navegação
  const handleZoomIn = () => {
    setScale(scale * 1.2);
  };

  const handleZoomOut = () => {
    setScale(scale / 1.2);
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    
    const pointerPos = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale
    };
    
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    setScale(newScale);
    
    setPosition({
      x: -(pointerPos.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(pointerPos.y - stage.getPointerPosition().y / newScale) * newScale
    });
  };

  // Gerenciamento de histórico
  const handleUndo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setAnnotations(history[historyStep - 1]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setAnnotations(history[historyStep + 1]);
    }
  };

  // Navegação de páginas
  const handlePrevPage = () => {
    if (parseInt(pageNumber) > 1) {
      navigate(`/annotate/${catalogId}/${parseInt(pageNumber) - 1}`);
    }
  };

  const handleNextPage = () => {
    const nextPageNumber = parseInt(pageNumber) + 1;
    
    // Verificar se o catálogo tem essa página
    if (catalogInfo && nextPageNumber <= catalogInfo.page_count) {
      navigate(`/annotate/${catalogId}/${nextPageNumber}`);
    } else {
      // Se não tem mais páginas e existe um próximo catálogo, ir para ele
      if (nextCatalogId) {
        // Mostrar mensagem informando a navegação para o próximo catálogo
        setSnackbar({
          open: true,
          message: 'Último catálogo finalizado. Navegando para o próximo catálogo...',
          severity: 'info'
        });
        
        // Redirecionar para a primeira página do próximo catálogo
        navigate(`/annotate/${nextCatalogId}/1`);
      } else {
        // Se não tem próximo catálogo, mostrar mensagem
        setSnackbar({
          open: true,
          message: 'Este é o último catálogo disponível',
          severity: 'warning'
        });
      }
    }
  };

  // Manipuladores de anotações
  const handleAnnotationChange = (id, newProps) => {
    const updatedAnnotations = annotations.map(anno => 
      anno.id === id ? { ...anno, ...newProps } : anno
    );
    setAnnotations(updatedAnnotations);
    
    // Atualizar histórico
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(updatedAnnotations);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleDeleteSelected = () => {
    if (selectedId) {
      const updatedAnnotations = annotations.filter(anno => anno.id !== selectedId);
      setAnnotations(updatedAnnotations);
      setSelectedId(null);
      
      // Atualizar histórico
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(updatedAnnotations);
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
    }
  };
  
  // Salvar anotações
  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Converter anotações para o formato da API
      const apiAnnotations = annotations.map(anno => ({
        id: anno.id,
        type: anno.type,
        bbox: {
          x1: Math.round(anno.x),
          y1: Math.round(anno.y),
          x2: Math.round(anno.x + anno.width),
          y2: Math.round(anno.y + anno.height)
        },
        metadata: anno.metadata,
        confidence: anno.confidence
      }));
      
      // Enviar para a API
      await axios.post(`${API_URL}/annotations/`, {
        catalog_id: catalogId,
        page_number: parseInt(pageNumber),
        annotations: apiAnnotations
      });
      
      setSnackbar({
        open: true,
        message: 'Anotações salvas com sucesso!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erro ao salvar anotações:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao salvar anotações. Tente novamente.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // Renderizar UI
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5">
              Ferramenta de Anotação - Catálogo {catalogId} - Página {pageNumber}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ButtonGroup variant="outlined" sx={{ mr: 1 }}>
              <Tooltip title="Página Anterior">
                <IconButton onClick={handlePrevPage} disabled={parseInt(pageNumber) <= 1}>
                  <PrevIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Próxima Página">
                <IconButton onClick={handleNextPage}>
                  <NextIcon />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
            
            <ButtonGroup variant="outlined" sx={{ mr: 1 }}>
              <Tooltip title="Desfazer">
                <IconButton onClick={handleUndo} disabled={historyStep === 0}>
                  <UndoIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refazer">
                <IconButton onClick={handleRedo} disabled={historyStep === history.length - 1}>
                  <RedoIcon />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
            
            <ButtonGroup variant="outlined" sx={{ mr: 1 }}>
              <Tooltip title="Zoom In">
                <IconButton onClick={handleZoomIn}>
                  <ZoomInIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton onClick={handleZoomOut}>
                  <ZoomOutIcon />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
            
            <Tooltip title="Excluir Selecionado">
              <span>
                <IconButton 
                  onClick={handleDeleteSelected} 
                  disabled={!selectedId}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
            
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />} 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={9}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 1, 
              width: '100%',
              height: '70vh',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: '#f5f5f5'
            }}
          >
            <Stage
              width={window.innerWidth * 0.7}
              height={window.innerHeight * 0.7}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={checkDeselect}
              onWheel={handleWheel}
              ref={stageRef}
              scaleX={scale}
              scaleY={scale}
              x={position.x}
              y={position.y}
              draggable={isSpacePressed || isCtrlPressed}
              className="annotation-canvas"
              style={{ cursor: (isSpacePressed || isCtrlPressed) ? 'grab' : 'crosshair' }}
            >
              <Layer>
                {image && <Image image={image} />}
                
                {annotations.map((annotation, i) => (
                  <Rectangle
                    key={annotation.id}
                    shapeProps={{
                      x: annotation.x,
                      y: annotation.y,
                      width: annotation.width,
                      height: annotation.height,
                      id: annotation.id
                    }}
                    annotationType={annotation.type}
                    isSelected={annotation.id === selectedId}
                    onSelect={() => setSelectedId(annotation.id)}
                    onChange={(newAttrs) => handleAnnotationChange(annotation.id, newAttrs)}
                  />
                ))}
                
                {newAnnotation && (
                  <Rect
                    x={newAnnotation.x}
                    y={newAnnotation.y}
                    width={newAnnotation.width}
                    height={newAnnotation.height}
                    stroke="red"
                    strokeWidth={2}
                    dash={[5, 5]}
                  />
                )}
              </Layer>
            </Stage>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Paper elevation={3} sx={{ p: 2, height: '70vh', overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Controles de Anotação
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Tipo de Anotação
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  value={annotationType}
                  onChange={(e) => setAnnotationType(e.target.value)}
                >
                  <FormControlLabel 
                    value="produto" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 16, 
                          height: 16, 
                          backgroundColor: 'green', 
                          mr: 1, 
                          borderRadius: '50%' 
                        }} />
                        Produto
                      </Box>
                    } 
                  />
                  <FormControlLabel 
                    value="logo" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 16, 
                          height: 16, 
                          backgroundColor: 'blue', 
                          mr: 1, 
                          borderRadius: '50%' 
                        }} />
                        Logo
                      </Box>
                    } 
                  />
                  <FormControlLabel 
                    value="cabecalho" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 16, 
                          height: 16, 
                          backgroundColor: 'purple', 
                          mr: 1, 
                          borderRadius: '50%' 
                        }} />
                        Cabeçalho
                      </Box>
                    } 
                  />
                  <FormControlLabel 
                    value="decorativo" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 16, 
                          height: 16, 
                          backgroundColor: 'orange', 
                          mr: 1, 
                          borderRadius: '50%' 
                        }} />
                        Elemento Decorativo
                      </Box>
                    } 
                  />
                </RadioGroup>
              </FormControl>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Zoom
              </Typography>
              <Stack spacing={2} direction="row" alignItems="center">
                <ZoomOutIcon />
                <Slider
                  value={scale * 100}
                  min={20}
                  max={300}
                  onChange={(e, value) => setScale(value / 100)}
                  aria-labelledby="zoom-slider"
                />
                <ZoomInIcon />
              </Stack>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Estatísticas
              </Typography>
              <Typography variant="body2">
                <strong>Total de anotações:</strong> {annotations.length}
              </Typography>
              <Typography variant="body2">
                <strong>Produtos:</strong> {annotations.filter(a => a.type === 'produto').length}
              </Typography>
              <Typography variant="body2">
                <strong>Logos:</strong> {annotations.filter(a => a.type === 'logo').length}
              </Typography>
              <Typography variant="body2">
                <strong>Cabeçalhos:</strong> {annotations.filter(a => a.type === 'cabecalho').length}
              </Typography>
              <Typography variant="body2">
                <strong>Decorativos:</strong> {annotations.filter(a => a.type === 'decorativo').length}
              </Typography>
            </Box>
            
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
              Dicas:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Clique e arraste para desenhar um retângulo<br />
              • Clique em uma anotação para selecioná-la<br />
              • Use a roda do mouse para zoom<br />
              • Clique e arraste a imagem para mover<br />
              • Pressione Delete para excluir uma anotação selecionada
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AnnotationTool; 