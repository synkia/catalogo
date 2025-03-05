import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Alert,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  LinearProgress,
  Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';
import { API_URL } from '../utils/apiConfig';

// Configuração do Axios
const api = axios.create({
  baseURL: API_URL,
});

const ModelList = () => {
  const navigate = useNavigate();
  
  // Estados
  const [models, setModels] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDetectDialog, setOpenDetectDialog] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [detectProgress, setDetectProgress] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);
  const [detectSuccess, setDetectSuccess] = useState(false);
  const [detectionJobId, setDetectionJobId] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [modelDetails, setModelDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Buscar modelos e catálogos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar modelos
      const modelsResponse = await api.get('/models');
      
      // Garantir que train_size e val_size sejam números
      const processedModels = modelsResponse.data.map(model => ({
        ...model,
        train_size: Number(model.train_size) || 0,
        val_size: Number(model.val_size) || 0
      }));
      
      console.log('Modelos processados:', processedModels);
      
      // Ordenar modelos por data de criação (mais recentes primeiro)
      const sortedModels = [...processedModels].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      // Verificar se há modelos em treinamento e obter progresso
      const modelsWithProgress = await Promise.all(
        sortedModels.map(async (model) => {
          // Se o modelo estiver com status "training" (assumindo que o campo status existe)
          if (model.status === 'training' && model.job_id) {
            try {
              // Buscar status do treinamento
              const trainingStatusResponse = await api.get(`/training/status/${model.job_id}`);
              return {
                ...model,
                trainingStatus: trainingStatusResponse.data
              };
            } catch (err) {
              console.error(`Erro ao buscar status do treinamento para o modelo ${model.model_id}:`, err);
              return model;
            }
          }
          return model;
        })
      );
      
      setModels(modelsWithProgress);
      
      // Buscar catálogos para uso na detecção
      const catalogsResponse = await api.get('/catalogs/');
      
      // Filtrar apenas catálogos prontos
      const readyCatalogs = catalogsResponse.data.filter(catalog => catalog.status === 'ready');
      setCatalogs(readyCatalogs);
      
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Não foi possível carregar os modelos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Limpar intervalo de polling ao desmontar o componente
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [fetchData]);

  // Formatar data
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  // Formatação de nome do modelo base (deixar mais amigável)
  const formatBaseModel = (baseModelPath) => {
    if (!baseModelPath) return '';
    
    const map = {
      'faster_rcnn': 'Faster R-CNN',
      'retinanet': 'RetinaNet',
      'mask_rcnn': 'Mask R-CNN'
    };
    
    for (const [key, value] of Object.entries(map)) {
      if (baseModelPath.includes(key)) {
        return value;
      }
    }
    
    return baseModelPath;
  };

  // Abrir diálogo de detecção
  const handleOpenDetection = (model) => {
    setSelectedModel(model);
    setSelectedCatalog('');
    setDetectError(null);
    setDetectSuccess(false);
    setDetectionJobId(null);
    setDetectionStatus(null);
    setOpenDetectDialog(true);
  };

  // Abrir diálogo de detalhes
  const handleViewDetails = async (model) => {
    setModelDetails(model);
    setLoadingDetails(true);
    setOpenDetailsDialog(true);
    
    try {
      // Se o modelo estiver em treinamento, buscar o status mais recente
      if (model.status === 'training' && model.job_id) {
        const response = await api.get(`/training/status/${model.job_id}`);
        setModelDetails({
          ...model,
          trainingDetails: response.data
        });
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes do modelo:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Iniciar detecção
  const handleStartDetection = async () => {
    if (!selectedModel || !selectedCatalog) {
      setDetectError('Selecione um catálogo para processar.');
      return;
    }

    try {
      setDetecting(true);
      setDetectError(null);
      setDetectProgress(0);
      
      console.log(`Iniciando detecção - Catálogo: ${selectedCatalog}, Modelo: ${selectedModel.model_id}`);
      const url = `/detect/${selectedCatalog}`;
      console.log(`URL da requisição: ${url}`);
      
      // Chamar a API para iniciar detecção
      const response = await api.post(url, {
        model_id: selectedModel.model_id
      });
      
      console.log('Resposta da API de detecção:', response.data);
      
      if (response.data && response.data.job_id) {
        setDetectionJobId(response.data.job_id);
        setDetectSuccess(true);
        
        // Iniciar polling para verificar status
        const interval = setInterval(() => checkDetectionStatus(response.data.job_id), 3000);
        setPollingInterval(interval);
      } else {
        throw new Error('Resposta inválida do servidor');
      }
      
    } catch (err) {
      console.error('Erro ao iniciar detecção:', err);
      setDetectError('Não foi possível iniciar a detecção. Verifique a conexão e tente novamente.');
    } finally {
      setDetecting(false);
    }
  };

  // Verificar status da detecção
  const checkDetectionStatus = async (jobId) => {
    try {
      const response = await api.get(`/detect/status/${jobId}`);
      setDetectionStatus(response.data);
      
      // Se a detecção terminou, parar o polling
      if (['completed', 'error'].includes(response.data.status)) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        
        // Se concluído com sucesso, preparar para navegação
        if (response.data.status === 'completed') {
          setTimeout(() => {
            setOpenDetectDialog(false);
            navigate(`/results/${jobId}`);
          }, 2000);
        }
      }
      
      // Atualizar progresso com base nos dados retornados pela API
      if (response.data.status === 'detecting' && response.data.progress) {
        // Se a API retornar diretamente a porcentagem, usar esse valor
        if (response.data.progress.percentage !== undefined) {
          setDetectProgress(response.data.progress.percentage);
        } 
        // Caso contrário, calcular com base nas páginas processadas
        else {
          const totalPages = response.data.progress.total_pages || 0;
          const processedPages = response.data.progress.processed_pages || 0;
          
          if (totalPages > 0) {
            const progress = Math.round((processedPages / totalPages) * 100);
            setDetectProgress(progress);
          }
        }
      }
      
    } catch (err) {
      console.error('Erro ao verificar status da detecção:', err);
    }
  };

  // Confirmar exclusão de modelo
  const handleConfirmDelete = (model) => {
    setModelToDelete(model);
    setOpenDeleteDialog(true);
  };

  // Excluir modelo
  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    
    try {
      setDeleting(true);
      
      // Fazer chamada à API para excluir o modelo
      await api.delete(`/models/${modelToDelete.model_id}`);
      
      // Atualizar a lista de modelos (remover o modelo da lista)
      setModels(models.filter(model => model.model_id !== modelToDelete.model_id));
      
      // Fechar diálogo e limpar estado
      setOpenDeleteDialog(false);
      setModelToDelete(null);
      
    } catch (err) {
      console.error('Erro ao excluir modelo:', err);
      setError(`Não foi possível excluir o modelo: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Grid container spacing={3}>
      {/* Cabeçalho */}
      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Modelos Treinados
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Gerencie seus modelos e aplique-os para detectar produtos em catálogos
          </Typography>
        </div>
        <div>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => navigate('/training')}
            sx={{ mr: 1 }}
          >
            Treinar Novo Modelo
          </Button>
          <Tooltip title="Atualizar lista">
            <span>
              <IconButton onClick={fetchData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </Grid>
      
      {/* Mensagem de erro */}
      {error && (
        <Grid item xs={12}>
          <Alert severity="error">{error}</Alert>
        </Grid>
      )}
      
      {/* Lista de modelos */}
      <Grid item xs={12}>
        <TableContainer component={Paper} elevation={2} sx={{ maxHeight: '70vh' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Nome do Modelo</TableCell>
                <TableCell>Data de Criação</TableCell>
                <TableCell>Base</TableCell>
                <TableCell>Dataset</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Carregando modelos...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1">
                      Nenhum modelo treinado encontrado.
                    </Typography>
                    <Button 
                      variant="text" 
                      color="primary" 
                      onClick={() => navigate('/training')}
                      sx={{ mt: 1 }}
                    >
                      Treinar seu primeiro modelo
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                models.map((model) => (
                  <TableRow key={model.model_id} hover>
                    <TableCell>{model.name || `Modelo ${model.model_id.slice(0, 8)}`}</TableCell>
                    <TableCell>{formatDate(model.created_at)}</TableCell>
                    <TableCell>{formatBaseModel(model.config?.base_model)}</TableCell>
                    <TableCell>{`${model.train_size} treino / ${model.val_size} validação`}</TableCell>
                    <TableCell>
                      {model.status === 'training' ? (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip 
                              label="Em Treinamento" 
                              color="warning" 
                              size="small" 
                              icon={<CircularProgress size={16} />} 
                            />
                            {model.trainingStatus?.progress && (
                              <Typography variant="caption" sx={{ ml: 1 }}>
                                {model.trainingStatus.progress.percentage}%
                              </Typography>
                            )}
                          </Box>
                          {model.trainingStatus?.progress && (
                            <Box sx={{ mt: 1, width: '100%' }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={model.trainingStatus.progress.percentage} 
                                sx={{ height: 4, borderRadius: 2 }}
                              />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                <Typography variant="caption">
                                  Iter: {model.trainingStatus.progress.current_iter}/{model.trainingStatus.progress.max_iter}
                                </Typography>
                                <Typography variant="caption">
                                  ETA: {model.trainingStatus.progress.eta}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </>
                      ) : (
                        <Chip 
                          label="Pronto" 
                          color="success" 
                          size="small" 
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ '& > button': { mx: 0.5 } }}>
                        <Tooltip title="Ver Detalhes">
                          <IconButton size="small" color="primary" onClick={() => handleViewDetails(model)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Usar para Detecção">
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={() => handleOpenDetection(model)}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir Modelo">
                          <IconButton size="small" color="error" onClick={() => handleConfirmDelete(model)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
      
      {/* Dialog de Detecção */}
      <Dialog 
        open={openDetectDialog} 
        onClose={() => !detecting && !detectionStatus && setOpenDetectDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Detectar Produtos com Modelo Treinado
        </DialogTitle>
        <DialogContent>
          {selectedModel && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Modelo Selecionado:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="body1">
                  {selectedModel.name || `Modelo ${selectedModel.model_id.substring(0, 8)}`}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {formatBaseModel(selectedModel.config?.base_model)} • 
                  Treinado em {formatDate(selectedModel.created_at)}
                </Typography>
              </Paper>
              
              {!detectionStatus ? (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    Selecione um Catálogo:
                  </Typography>
                  
                  {detectError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {detectError}
                    </Alert>
                  )}
                  
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel id="catalog-select-label">Catálogo</InputLabel>
                    <Select
                      labelId="catalog-select-label"
                      value={selectedCatalog}
                      onChange={(e) => setSelectedCatalog(e.target.value)}
                      disabled={detecting}
                    >
                      <MenuItem value="">
                        <em>Selecione um catálogo</em>
                      </MenuItem>
                      {catalogs.map((catalog) => (
                        <MenuItem key={catalog.catalog_id} value={catalog.catalog_id}>
                          {catalog.filename} ({catalog.page_count} páginas)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              ) : (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Status da Detecção:
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body1" gutterBottom>
                      <strong>ID do Job:</strong> {detectionJobId}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body1" component="span" sx={{ mr: 1 }}>
                        <strong>Status:</strong>
                      </Typography>
                      <Chip 
                        label={detectionStatus.status} 
                        color={
                          detectionStatus.status === 'completed' ? 'success' : 
                          detectionStatus.status === 'error' ? 'error' : 
                          'warning'
                        } 
                      />
                    </Box>
                  </Box>
                  
                  {detectionStatus.status === 'detecting' && (
                    <Box sx={{ width: '100%', mb: 2 }}>
                      <LinearProgress 
                        variant={detectProgress > 0 ? 'determinate' : 'indeterminate'} 
                        value={detectProgress} 
                      />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                        {detectProgress > 0 ? `${detectProgress}% concluído` : 'Processando...'}
                      </Typography>
                      
                      {detectionStatus.progress && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #eee' }}>
                          <Typography variant="body2" gutterBottom>
                            <strong>Páginas processadas:</strong> {detectionStatus.progress.processed_pages} de {detectionStatus.progress.total_pages}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Produtos detectados:</strong> {detectionStatus.progress.detections_count}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Tempo restante estimado:</strong> {detectionStatus.progress.eta}
                          </Typography>
                          
                          {detectionStatus.progress.log && detectionStatus.progress.log.length > 0 && (
                            <>
                              <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
                                <strong>Log de detecção:</strong>
                              </Typography>
                              <Box 
                                sx={{ 
                                  maxHeight: '120px', 
                                  overflowY: 'auto', 
                                  p: 1, 
                                  bgcolor: '#f5f5f5', 
                                  borderRadius: 1,
                                  fontSize: '0.8rem',
                                  fontFamily: 'monospace'
                                }}
                              >
                                {detectionStatus.progress.log.map((entry, index) => (
                                  <Box key={index} sx={{ mb: 0.5 }}>
                                    {entry}
                                  </Box>
                                ))}
                              </Box>
                            </>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                  
                  {detectionStatus.status === 'completed' && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Detecção concluída com sucesso! Redirecionando para resultados...
                    </Alert>
                  )}
                  
                  {detectionStatus.status === 'error' && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Ocorreu um erro durante a detecção: {detectionStatus.error_message || 'Erro desconhecido'}
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!detectionStatus ? (
            <>
              <Button 
                onClick={() => setOpenDetectDialog(false)} 
                disabled={detecting}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleStartDetection} 
                variant="contained" 
                color="primary"
                disabled={!selectedCatalog || detecting}
                startIcon={detecting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              >
                {detecting ? 'Iniciando...' : 'Iniciar Detecção'}
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setOpenDetectDialog(false)} 
              disabled={detectionStatus.status === 'detecting' || detectionStatus.status === 'completed'}
            >
              {detectionStatus.status === 'error' ? 'Fechar' : 'Aguarde...'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Dialog de Detalhes */}
      <Dialog 
        open={openDetailsDialog} 
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Detalhes do Modelo
        </DialogTitle>
        <DialogContent>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <CircularProgress size={40} />
            </Box>
          ) : modelDetails ? (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Informações Gerais:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" gutterBottom>
                      <strong>Nome:</strong> {modelDetails.name || `Modelo ${modelDetails.model_id.substring(0, 8)}`}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>ID:</strong> {modelDetails.model_id}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Criado em:</strong> {formatDate(modelDetails.created_at)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" gutterBottom>
                      <strong>Modelo Base:</strong> {formatBaseModel(modelDetails.config?.base_model)}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Dataset:</strong> {modelDetails.train_size} imagens (treino), {modelDetails.val_size} imagens (validação)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Typography variant="body1" component="span" sx={{ mr: 1 }}>
                        <strong>Status:</strong>
                      </Typography>
                      <Chip 
                        label={modelDetails.status === 'training' ? 'Em Treinamento' : 'Pronto'} 
                        color={modelDetails.status === 'training' ? 'warning' : 'success'} 
                        size="small"
                        icon={modelDetails.status === 'training' ? <CircularProgress size={14} /> : null}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
              
              {/* Detalhes do Treinamento */}
              {modelDetails.status === 'training' && modelDetails.trainingDetails && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    Progresso do Treinamento:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={modelDetails.trainingDetails.progress.percentage} 
                            color="primary"
                            sx={{ height: 10, borderRadius: 5 }}
                          />
                        </Box>
                        <Box sx={{ minWidth: 50 }}>
                          <Typography variant="body2" color="text.secondary">
                            {`${modelDetails.trainingDetails.progress.percentage}%`}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
                        <Typography variant="caption">
                          Iteração: {modelDetails.trainingDetails.progress.current_iter} / {modelDetails.trainingDetails.progress.max_iter}
                        </Typography>
                        <Typography variant="caption">
                          Tempo restante estimado: {modelDetails.trainingDetails.progress.eta}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Métricas de Treinamento:
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Card variant="outlined">
                          <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                            <Typography variant="caption" color="text.secondary">
                              Loss
                            </Typography>
                            <Typography variant="h5">
                              {modelDetails.trainingDetails.progress.metrics.loss}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={6}>
                        <Card variant="outlined">
                          <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                            <Typography variant="caption" color="text.secondary">
                              Acurácia
                            </Typography>
                            <Typography variant="h5">
                              {modelDetails.trainingDetails.progress.metrics.accuracy}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Paper>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Log de Treinamento:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Box 
                      sx={{ 
                        maxHeight: 200, 
                        overflow: 'auto',
                        bgcolor: 'grey.100', 
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.8rem'
                      }}
                    >
                      {modelDetails.trainingDetails.progress.log.map((entry, index) => (
                        <Box key={index} sx={{ pb: 0.5 }}>
                          {entry}
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                </>
              )}
              
              {/* Configurações do Modelo */}
              <Typography variant="subtitle1" gutterBottom>
                Configurações:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  {modelDetails.config && Object.entries(modelDetails.config).map(([key, value]) => (
                    <Grid item xs={6} key={key}>
                      <Typography variant="body2">
                        <strong>{key}:</strong> {value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Box>
          ) : (
            <Typography variant="body1">
              Nenhum modelo selecionado para visualizar detalhes.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {modelDetails && modelDetails.status === 'training' && (
            <Button 
              color="primary" 
              onClick={() => handleViewDetails(modelDetails)}
              disabled={loadingDetails}
              startIcon={<RefreshIcon />}
            >
              Atualizar Status
            </Button>
          )}
          <Button 
            onClick={() => setOpenDetailsDialog(false)}
            disabled={loadingDetails}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog de Exclusão */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Tem certeza de que deseja excluir o modelo "{modelToDelete?.name || `Modelo ${modelToDelete?.model_id.substring(0, 8)}`}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenDeleteDialog(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteModel} 
            variant="contained" 
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : null}
          >
            {deleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default ModelList;  