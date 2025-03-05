import React, { useState, useEffect, useRef } from 'react';
import { 
  Typography, 
  Grid, 
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  TextField,
  Slider,
  Box,
  Divider,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SettingsIcon from '@mui/icons-material/Settings';
import DatasetIcon from '@mui/icons-material/Dataset';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import axios from 'axios';
import { API_URL } from '../utils/apiConfig';

// Configuração do Axios
const api = axios.create({
  baseURL: API_URL,
});

const TrainingDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isFirstRender = useRef(true);
  
  // Estados
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalogs, setSelectedCatalogs] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [trainingConfig, setTrainingConfig] = useState({
    validation_split: 0.2,
    max_iter: 5000,
    batch_size: 2,
    learning_rate: 0.00025,
    model_name: '',
    base_model: 'COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml'
  });
  const [activeStep, setActiveStep] = useState(0);
  const [jobStatus, setJobStatus] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [error, setError] = useState(null);
  
  // Monitorar mudanças no jobStatus
  useEffect(() => {
    if (jobStatus) {
      console.log('jobStatus atualizado:', jobStatus);
      console.log('Valores de train_size e val_size:', jobStatus.train_size, jobStatus.val_size);
    }
  }, [jobStatus]);
  
  // Passos do processo de treinamento
  const steps = ['Selecionar Catálogos', 'Configurar Treinamento', 'Executar e Monitorar'];
  
  // Modelos base disponíveis
  const baseModels = [
    { value: 'COCO-Detection/faster_rcnn_R_50_FPN_3x.yaml', label: 'Faster R-CNN (Recomendado)' },
    { value: 'COCO-Detection/retinanet_R_50_FPN_3x.yaml', label: 'RetinaNet' },
    { value: 'COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml', label: 'Mask R-CNN' }
  ];
  
  // Buscar catálogos disponíveis ao carregar a página
  useEffect(() => {
    // Evitar execução em atualizações de estado que não sejam a primeira renderização
    if (!isFirstRender.current) {
      return;
    }
    
    isFirstRender.current = false;
    
    const fetchCatalogs = async () => {
      try {
        setLoadingCatalogs(true);
        
        const response = await api.get('/catalogs/');
        console.log('Catálogos recebidos:', response.data);
        
        // Filtrar apenas catálogos prontos e com páginas
        const readyCatalogs = response.data.filter(catalog => 
          catalog.status === 'ready' && catalog.page_count > 0
        );
        
        console.log('Catálogos filtrados e prontos:', readyCatalogs);
        
        setCatalogs(readyCatalogs);
        
        // Se vier com catálogos pré-selecionados da tela anterior
        if (location.state && location.state.catalogs) {
          const preSelectedCatalogs = location.state.catalogs;
          console.log('Catálogos pré-selecionados:', preSelectedCatalogs);
          
          // Verificar se todos os catálogos pré-selecionados são válidos
          const validCatalogs = preSelectedCatalogs.filter(id => 
            readyCatalogs.some(c => c.catalog_id === id)
          );
          
          if (validCatalogs.length > 0) {
            setSelectedCatalogs(validCatalogs);
            setActiveStep(1); // Pular direto para a etapa de configuração
          } else {
            console.error('Nenhum catálogo pré-selecionado válido');
            setError('Os catálogos selecionados são inválidos ou não estão prontos para uso.');
          }
        }
      } catch (err) {
        console.error('Erro ao buscar catálogos:', err);
        setError('Não foi possível carregar os catálogos. Tente novamente mais tarde.');
      } finally {
        setLoadingCatalogs(false);
      }
    };
    
    fetchCatalogs();
  }, []); // Removendo location.state da dependência para evitar re-renderizações
  
  // Limpar intervalo de polling ao desmontar o componente
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);
  
  // Inicia o treinamento
  const startTraining = async () => {
    try {
      setError(null);
      
      if (!selectedCatalogs || selectedCatalogs.length === 0) {
        setError('Selecione pelo menos um catálogo para treinamento.');
        return;
      }
      
      // Validação adicional: verificar se todos os catálogos selecionados existem
      const selectedCatalogObjects = selectedCatalogs.map(id => catalogs.find(c => c.catalog_id === id));
      
      console.log('Verificando catálogos antes de iniciar treinamento:', selectedCatalogObjects);
      
      // Verificar se todos os catálogos selecionados existem
      if (selectedCatalogObjects.some(cat => !cat)) {
        console.error('Alguns catálogos não foram encontrados');
        setError('Um ou mais catálogos selecionados não foram encontrados. Recarregue a página e tente novamente.');
        return;
      }
      
      // Verificar se os catálogos selecionados contêm páginas
      const catalogsWithPages = selectedCatalogObjects.filter(cat => cat.page_count > 0);
      if (catalogsWithPages.length !== selectedCatalogObjects.length) {
        console.error('Alguns catálogos não têm páginas');
        setError('Um ou mais catálogos selecionados não possuem páginas para treinar.');
        return;
      }
      
      // Preparar payload para a API
      const payload = {
        ...trainingConfig,
        catalog_ids: selectedCatalogs.length > 0 ? selectedCatalogs : ["simulate_annotations"]
      };
      
      console.log('Enviando payload para API:', payload);
      
      // Enviar requisição de treinamento
      try {
        const response = await api.post('/train', payload);
        
        if (response && response.data && response.data.job_id) {
          console.log('Treinamento iniciado com sucesso:', response.data);
          setJobId(response.data.job_id);
          
          // Iniciar polling para verificar status
          const interval = setInterval(() => checkTrainingStatus(response.data.job_id), 5000);
          setPollingInterval(interval);
          
          // Avançar para próximo passo
          setActiveStep(2);
        } else {
          console.error('Resposta inválida do servidor:', response);
          throw new Error('Resposta inválida do servidor');
        }
      } catch (apiError) {
        console.error('Erro na API de treinamento:', apiError);
        throw apiError;
      }
    } catch (err) {
      console.error('Erro ao iniciar treinamento:', err);
      
      // Mensagem de erro amigável
      if (err.response && err.response.data) {
        console.log('Detalhes do erro da API:', err.response.data);
        setError(err.response.data.detail || 'Erro desconhecido na resposta do servidor');
      } else {
        setError('Não foi possível iniciar o treinamento. Verifique a conexão e tente novamente.');
      }
    }
  };
  
  // Verificar status do treinamento
  const checkTrainingStatus = async (id) => {
    try {
      const response = await api.get(`/train/status/${id}`);
      
      if (response && response.data) {
        console.log('Dados recebidos da API:', response.data);
        console.log('Valores específicos - train_size:', response.data.train_size, 'val_size:', response.data.val_size);
        console.log('Tipo de dados - train_size:', typeof response.data.train_size, 'val_size:', typeof response.data.val_size);
        
        // Processar os dados para garantir que train_size e val_size sejam números
        const processedData = {
          ...response.data,
          train_size: Number(response.data.train_size) || 0,
          val_size: Number(response.data.val_size) || 0
        };
        
        console.log('Dados processados:', processedData);
        setJobStatus(processedData);
        
        // Se o treinamento terminou (completado, com erro ou falhou), parar o polling
        if (['completed', 'error', 'failed'].includes(response.data.status)) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          // Se falhou, mostrar mensagem de erro
          if (response.data.status === 'failed') {
            const errorMsg = response.data.error || 'Ocorreu um erro durante o treinamento.';
            setError(`O treinamento falhou: ${errorMsg}`);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status do treinamento:', err);
      
      // Se ocorrer um erro, exibir mensagem e parar o polling após várias tentativas
      setError('Erro ao verificar status do treinamento. Recarregue a página e tente novamente.');
      
      // Parar o polling após erros para evitar sobrecarga no servidor
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  };
  
  // Manipuladores de mudança de estado
  const handleCatalogSelect = (event) => {
    const selectedValues = event.target.value;
    console.log('Catálogos selecionados:', selectedValues);
    
    if (selectedValues.length === 0) {
      setSelectedCatalogs([]);
      setError(null);
      return;
    }
    
    // Verificar se existe mais de um catálogo selecionado e se todos são válidos
    const selectedCatalogObjects = selectedValues.map(id => catalogs.find(c => c.catalog_id === id));
    console.log('Objetos dos catálogos selecionados:', selectedCatalogObjects);
    
    // Verificar se todos os catálogos selecionados existem
    if (selectedCatalogObjects.some(cat => !cat)) {
      console.error('Alguns catálogos selecionados não foram encontrados');
      setError('Um ou mais catálogos selecionados não foram encontrados.');
      return;
    }
    
    // Verificar se todos os catálogos têm páginas suficientes
    if (selectedCatalogObjects.some(cat => cat.page_count < 1)) {
      console.error('Alguns catálogos não têm páginas suficientes');
      setError('Um ou mais catálogos selecionados não contêm páginas.');
      return;
    }
    
    // Se chegar aqui, a seleção é válida
    console.log('Validação bem-sucedida, atualizando selectedCatalogs');
    setError(null);
    setSelectedCatalogs(selectedValues);
  };
  
  const handleConfigChange = (name) => (event) => {
    setTrainingConfig({
      ...trainingConfig,
      [name]: event.target.value
    });
  };
  
  // Manipuladores para sliders
  const handleSliderChange = (name) => (event, newValue) => {
    setTrainingConfig({
      ...trainingConfig,
      [name]: newValue
    });
  };
  
  // Navegar entre os passos
  const handleNext = () => {
    if (activeStep === 1) {
      startTraining();
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };
  
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Renderizar conteúdo de cada passo
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Selecione os Catálogos para Treinamento
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Escolha os catálogos que contêm anotações para treinar o modelo. Recomendamos selecionar catálogos com pelo menos 50 anotações.
            </Typography>
            
            {loadingCatalogs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : catalogs.length === 0 ? (
              <Alert severity="warning" sx={{ my: 2 }}>
                Nenhum catálogo disponível para treinamento. Faça upload de catálogos e anote-os primeiro.
              </Alert>
            ) : (
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel id="catalogs-select-label">Catálogos</InputLabel>
                <Select
                  labelId="catalogs-select-label"
                  multiple
                  value={selectedCatalogs}
                  onChange={(event) => {
                    console.log('Catálogos selecionados:', event.target.value);
                    setSelectedCatalogs(event.target.value);
                    setError(null);
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const catalog = catalogs.find(c => c.catalog_id === value);
                        return (
                          <Chip 
                            key={value} 
                            label={catalog ? catalog.filename : value}
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {catalogs.map((catalog) => (
                    <MenuItem key={catalog.catalog_id} value={catalog.catalog_id}>
                      {catalog.filename} ({catalog.page_count} páginas)
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Selecione um ou mais catálogos para treinamento.
                </FormHelperText>
              </FormControl>
            )}
          </Paper>
        );
      
      case 1:
        return (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configure os Parâmetros de Treinamento
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Ajuste os parâmetros abaixo para otimizar o treinamento do modelo. Para iniciantes, recomendamos manter os valores padrão.
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nome do Modelo"
                  value={trainingConfig.model_name}
                  onChange={handleConfigChange('model_name')}
                  helperText="Nome personalizado para identificar este modelo (opcional)"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="base-model-label">Modelo Base</InputLabel>
                  <Select
                    labelId="base-model-label"
                    value={trainingConfig.base_model}
                    onChange={handleConfigChange('base_model')}
                  >
                    {baseModels.map((model) => (
                      <MenuItem key={model.value} value={model.value}>
                        {model.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Modelo pré-treinado usado como ponto de partida
                  </FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Typography id="validation-split-slider" gutterBottom>
                  Divisão de Validação: {trainingConfig.validation_split * 100}%
                </Typography>
                <Slider
                  value={trainingConfig.validation_split}
                  onChange={handleSliderChange('validation_split')}
                  aria-labelledby="validation-split-slider"
                  step={0.05}
                  marks={[
                    { value: 0.1, label: '10%' },
                    { value: 0.2, label: '20%' },
                    { value: 0.3, label: '30%' },
                  ]}
                  min={0.1}
                  max={0.3}
                />
                <FormHelperText>
                  Porcentagem dos dados usados para validação durante o treinamento
                </FormHelperText>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Iterações Máximas"
                  value={trainingConfig.max_iter}
                  onChange={handleConfigChange('max_iter')}
                  inputProps={{ min: 1000, max: 20000, step: 1000 }}
                  helperText="Número de iterações de treinamento"
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tamanho do Batch"
                  value={trainingConfig.batch_size}
                  onChange={handleConfigChange('batch_size')}
                  inputProps={{ min: 1, max: 8, step: 1 }}
                  helperText="Imagens processadas de cada vez"
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Taxa de Aprendizado"
                  value={trainingConfig.learning_rate}
                  onChange={handleConfigChange('learning_rate')}
                  inputProps={{ min: 0.00001, max: 0.001, step: 0.00001 }}
                  helperText="Tamanho dos passos de aprendizado"
                />
              </Grid>
            </Grid>
            
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Informações Avançadas</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  <strong>Divisão de Validação:</strong> Porcentagem dos dados reservados para validar o modelo durante o treinamento. Valores entre 10% e 30% são recomendados.
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Iterações Máximas:</strong> Número total de etapas de treinamento. Mais iterações podem melhorar a precisão, mas aumentam o tempo de treinamento e o risco de overfitting.
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Tamanho do Batch:</strong> Número de imagens processadas em cada iteração. Valores maiores são mais eficientes, mas consomem mais memória da GPU.
                </Typography>
                <Typography variant="body2">
                  <strong>Taxa de Aprendizado:</strong> Controla o tamanho dos ajustes feitos aos pesos do modelo em cada iteração. Valores muito grandes podem causar instabilidade, valores muito pequenos podem tornar o treinamento muito lento.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Paper>
        );
      
      case 2:
        return (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Monitoramento do Treinamento
            </Typography>
            
            {!jobStatus && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
                <CircularProgress size={40} />
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Carregando status do treinamento...
                </Typography>
              </Box>
            )}
            
            {jobStatus && (
              <>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" gutterBottom>
                    <strong>ID do Job:</strong> {jobId}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body1" component="span">
                      <strong>Status:</strong>{' '}
                    </Typography>
                    <Chip 
                      label={jobStatus.status} 
                      color={
                        jobStatus.status === 'completed' ? 'success' : 
                        jobStatus.status === 'failed' || jobStatus.status === 'error' ? 'error' : 
                        'warning'
                      }
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  
                  {jobStatus.status === 'training' && jobStatus.progress && (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={jobStatus.progress.percentage || 0} 
                            color="primary"
                            sx={{ height: 10, borderRadius: 5 }}
                          />
                        </Box>
                        <Box sx={{ minWidth: 50 }}>
                          <Typography variant="body2" color="text.secondary">
                            {`${jobStatus.progress.percentage || 0}%`}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, mb: 2 }}>
                        <Typography variant="caption">
                          Iteração: {jobStatus.progress.current_iter || 0} / {jobStatus.progress.max_iter || '?'}
                        </Typography>
                        <Typography variant="caption">
                          Tempo restante estimado: {jobStatus.progress.eta || 'Calculando...'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mt: 3, mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Métricas de Treinamento
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Card variant="outlined">
                              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                                <Typography variant="caption" color="text.secondary">
                                  Loss
                                </Typography>
                                <Typography variant="h5">
                                  {jobStatus.progress.metrics && jobStatus.progress.metrics.loss !== undefined ? 
                                    jobStatus.progress.metrics.loss : 'N/A'}
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
                                  {jobStatus.progress.metrics && jobStatus.progress.metrics.accuracy !== undefined ? 
                                    jobStatus.progress.metrics.accuracy : 'N/A'}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Box>
                      
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Log de Treinamento
                        </Typography>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 1, 
                            maxHeight: 200, 
                            overflow: 'auto',
                            bgcolor: 'grey.100', 
                            fontFamily: 'monospace',
                            fontSize: '0.8rem'
                          }}
                        >
                          {jobStatus.progress.log && jobStatus.progress.log.length > 0 ? (
                            jobStatus.progress.log.map((entry, index) => (
                              <Box key={index} sx={{ pb: 0.5 }}>
                                {entry}
                              </Box>
                            ))
                          ) : (
                            <Box sx={{ py: 1 }}>
                              Aguardando logs de treinamento...
                            </Box>
                          )}
                        </Paper>
                      </Box>
                    </Box>
                  )}
                  
                  {jobStatus.status === 'training' && !jobStatus.progress && (
                    <Box sx={{ mt: 2 }}>
                      <LinearProgress />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                        O treinamento pode levar vários minutos ou horas, dependendo do tamanho do dataset e da configuração.
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Detalhes do Treinamento
                </Typography>
                
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <DatasetIcon />
                    </ListItemIcon>
                    {console.log('Valores antes de renderizar:', jobStatus)}
                    <ListItemText 
                      primary="Dataset" 
                      secondary={`${jobStatus.train_size >= 0 ? jobStatus.train_size : '?'} imagens para treino, ${jobStatus.val_size >= 0 ? jobStatus.val_size : '?'} para validação`} 
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Configuração" 
                      secondary={
                        jobStatus.config ? 
                        `Modelo base: ${jobStatus.config.base_model}, Iterações: ${jobStatus.config.max_iter}` : 
                        'Configuração não disponível'
                      } 
                    />
                  </ListItem>
                </List>
                
                {jobStatus.status === 'completed' && (
                  <Box sx={{ mt: 3 }}>
                    <Alert 
                      severity="success"
                      icon={<CheckCircleIcon fontSize="inherit" />}
                    >
                      Treinamento concluído com sucesso! O modelo está pronto para uso.
                    </Alert>
                    <Button
                      variant="contained"
                      color="primary"
                      sx={{ mt: 2 }}
                      onClick={() => navigate('/models')}
                    >
                      Ver Modelos Treinados
                    </Button>
                  </Box>
                )}
                
                {jobStatus.status === 'failed' && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle1">Treinamento falhou</Typography>
                      <Typography variant="body2">
                        {jobStatus.error || 'Ocorreu um erro durante o treinamento. Verifique os logs do sistema.'}
                      </Typography>
                    </Alert>
                    
                    <Box sx={{ mt: 2 }}>
                      <Button 
                        variant="outlined" 
                        color="primary" 
                        onClick={() => setActiveStep(0)}
                        startIcon={<ArrowBackIcon />}
                      >
                        Iniciar novo treinamento
                      </Button>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Paper>
        );
      
      default:
        return null;
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          Treinamento de Modelo
        </Typography>
        <Typography variant="subtitle1" color="textSecondary" paragraph>
          Treine um modelo de detecção de produtos a partir de suas anotações
        </Typography>
      </Grid>
      
      {error && (
        <Grid item xs={12}>
          <Alert severity="error">{error}</Alert>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Grid>
      
      <Grid item xs={12}>
        {renderStepContent(activeStep)}
      </Grid>
      
      {activeStep !== 2 && (
        <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Voltar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={
              (activeStep === 0 && (!selectedCatalogs || selectedCatalogs.length === 0)) ||
              (loadingCatalogs)
            }
          >
            {activeStep === 1 ? 'Iniciar Treinamento' : 'Próximo'}
          </Button>
        </Grid>
      )}
    </Grid>
  );
};

export default TrainingDashboard;  