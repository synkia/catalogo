import React, { useState, useEffect, useRef } from 'react';
import {
  Typography,
  Grid,
  Paper,
  Box,
  Breadcrumbs,
  Link,
  Button,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Tooltip,
  Pagination,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import CodeIcon from '@mui/icons-material/Code';
import SaveIcon from '@mui/icons-material/Save';
import FilterListIcon from '@mui/icons-material/FilterList';
import ShareIcon from '@mui/icons-material/Share';
import axios from 'axios';
import { API_URL } from '../utils/apiConfig';

// Configuração do Axios
const api = axios.create({
  baseURL: API_URL,
});

// Componente de imagem com anotações
const AnnotatedImage = ({ image, annotations, onAnnotationClick, confidenceThreshold, showLabels }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgElement, setImgElement] = useState(null);
  const containerRef = useRef(null);
  
  // Ajustar as coordenadas relativas à imagem atual
  const adjustCoordinates = (bbox, img) => {
    if (!img || !imageLoaded || !containerRef.current) return bbox;
    
    // Obter as dimensões reais da imagem renderizada
    const renderedWidth = img.clientWidth;
    const renderedHeight = img.clientHeight;
    
    // Calcular escala entre as coordenadas originais e a imagem renderizada
    const scaleX = renderedWidth / img.naturalWidth;
    const scaleY = renderedHeight / img.naturalHeight;
    
    console.log('Ajustando bbox:', { 
      bbox, 
      renderedWidth, 
      renderedHeight, 
      naturalWidth: img.naturalWidth, 
      naturalHeight: img.naturalHeight,
      scaleX,
      scaleY,
      containerWidth: containerRef.current.offsetWidth,
      containerHeight: containerRef.current.offsetHeight
    });
    
    // Ajustar as coordenadas
    return {
      x1: bbox.x1 * scaleX,
      y1: bbox.y1 * scaleY,
      x2: bbox.x2 * scaleX,
      y2: bbox.y2 * scaleY
    };
  };

  // Verificar se a imagem está definida
  if (!image) {
    console.error('Propriedade image não definida:', { image, annotations });
    return (
      <Box sx={{ 
        width: '100%', 
        height: '50vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: '#f5f5f5',
        border: '1px dashed #ccc'
      }}>
        <Typography variant="body1" color="textSecondary">
          Imagem não disponível
        </Typography>
      </Box>
    );
  }

  // Construir a URL completa da imagem
  const imageUrl = image.startsWith('http') 
    ? image 
    : image.startsWith('/api/') 
      ? `${API_URL}${image.substring(4)}` // Remove a duplicação do '/api/'
      : `${API_URL}${image}`;
  console.log('URL da imagem construída:', { original: image, final: imageUrl });
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative', 
        display: 'inline-block', 
        maxWidth: '100%',
        margin: '0 auto'
      }}
    >
      {/* Imagem */}
      <img
        src={imageUrl}
        alt="Página de catálogo com detecções"
        style={{ 
          maxWidth: '100%', 
          maxHeight: '70vh', 
          display: 'block' 
        }}
        onError={(e) => {
          console.error('Erro ao carregar imagem:', imageUrl);
          e.target.onerror = null;
          // Usar uma imagem local em vez de depender de serviços externos
          e.target.src = '/placeholder-error.png';
        }}
        onLoad={(e) => {
          console.log('Imagem carregada com sucesso:', {
            url: imageUrl,
            naturalWidth: e.target.naturalWidth,
            naturalHeight: e.target.naturalHeight,
            displayWidth: e.target.width,
            displayHeight: e.target.height
          });
          setImageLoaded(true);
          setImgElement(e.target);
        }}
        ref={(el) => {
          if (el && !imgElement) setImgElement(el);
        }}
      />
      
      {/* Bounding boxes em cima da imagem */}
      {imageLoaded && imgElement && annotations && annotations.length > 0 && (
        annotations
          .filter(anno => anno.confidence >= confidenceThreshold)
          .map((anno, index) => {
            // Cores diferentes para diferentes tipos de anotação
            const getColor = (type) => {
              switch (type) {
                case 'produto': return 'rgba(76, 175, 80, 0.5)';
                case 'logo': return 'rgba(33, 150, 243, 0.5)';
                case 'cabecalho': return 'rgba(156, 39, 176, 0.5)';
                case 'decorativo': return 'rgba(255, 152, 0, 0.5)';
                default: return 'rgba(76, 175, 80, 0.5)';
              }
            };
            
            // Cores de borda mais fortes
            const getBorderColor = (type) => {
              switch (type) {
                case 'produto': return 'rgb(76, 175, 80)';
                case 'logo': return 'rgb(33, 150, 243)';
                case 'cabecalho': return 'rgb(156, 39, 176)';
                case 'decorativo': return 'rgb(255, 152, 0)';
                default: return 'rgb(76, 175, 80)';
              }
            };
            
            // Ajustar coordenadas para a imagem renderizada
            const adjustedBbox = adjustCoordinates(anno.bbox, imgElement);
            
            return (
              <div
                key={anno.id}
                onClick={() => onAnnotationClick && onAnnotationClick(anno)}
                style={{
                  position: 'absolute',
                  left: `${adjustedBbox.x1}px`,
                  top: `${adjustedBbox.y1}px`,
                  width: `${adjustedBbox.x2 - adjustedBbox.x1}px`,
                  height: `${adjustedBbox.y2 - adjustedBbox.y1}px`,
                  border: `3px solid ${getBorderColor(anno.type)}`,
                  backgroundColor: getColor(anno.type),
                  cursor: 'pointer',
                  zIndex: 10,
                  boxSizing: 'border-box'
                }}
              >
                {showLabels && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '-22px',
                      left: '0',
                      background: getBorderColor(anno.type),
                      color: 'white',
                      padding: '2px 6px',
                      fontSize: '10px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {anno.type.toUpperCase()} ({Math.round(anno.confidence * 100)}%)
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
};

const DetectionResults = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const jsonExportRef = useRef(null);
  
  // Estados
  const [results, setResults] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [showLabels, setShowLabels] = useState(true);
  const [openJsonDialog, setOpenJsonDialog] = useState(false);
  const [jsonOutput, setJsonOutput] = useState('');
  
  // Efeito para carregar os resultados
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Buscar resultados da detecção
        const resultsResponse = await api.get(`/results/${jobId}`);
        setResults(resultsResponse.data);
        
        // Buscar detalhes do catálogo
        if (resultsResponse.data.catalog_id) {
          const catalogResponse = await api.get(`/catalogs/${resultsResponse.data.catalog_id}`);
          setCatalog(catalogResponse.data);
        }
        
      } catch (err) {
        console.error('Erro ao buscar resultados:', err);
        setError('Não foi possível carregar os resultados da detecção. Verifique a conexão e tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    
    if (jobId) {
      fetchResults();
    }
  }, [jobId]);
  
  // Contagem total de produtos detectados
  const getTotalProductCount = () => {
    if (!results || !results.results) return 0;
    
    return results.results.reduce((total, page) => {
      const productAnnotations = page.annotations.filter(
        anno => anno.type === 'produto' && anno.confidence >= confidenceThreshold
      );
      return total + productAnnotations.length;
    }, 0);
  };
  
  // Manipuladores de eventos
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    setSelectedAnnotation(null);
  };
  
  const handleAnnotationClick = (annotation) => {
    setSelectedAnnotation(annotation);
  };
  
  const handleConfidenceChange = (event, newValue) => {
    setConfidenceThreshold(newValue);
  };
  
  const handleExportJson = () => {
    if (!results || !results.results) return;
    
    // Preparar dados para exportação
    const exportData = {
      job_id: jobId,
      catalog_id: results.catalog_id,
      model_id: results.model_id,
      detection_date: results.completed_at || results.created_at,
      products: []
    };
    
    // Extrair todos os produtos detectados
    results.results.forEach(page => {
      const productAnnotations = page.annotations.filter(
        anno => anno.type === 'produto' && anno.confidence >= confidenceThreshold
      );
      
      productAnnotations.forEach(anno => {
        // Construir a URL completa da imagem
        const imagePath = page.image_path || page.image_url;
        const imageUrl = imagePath.startsWith('http')
          ? imagePath
          : imagePath.startsWith('/api/')
            ? `${API_URL}${imagePath.substring(4)}` // Remove a duplicação do '/api/'
            : `${API_URL}${imagePath}`;
        
        exportData.products.push({
          id: anno.id,
          page_number: page.page_number,
          bbox: anno.bbox,
          confidence: anno.confidence,
          image_url: imageUrl,
          type: anno.type
        });
      });
    });
    
    // Converter para JSON formatado
    const jsonString = JSON.stringify(exportData, null, 2);
    setJsonOutput(jsonString);
    setOpenJsonDialog(true);
  };
  
  const handleDownloadJson = () => {
    if (!jsonOutput) return;
    
    // Criar e baixar arquivo
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo_produtos_${results.catalog_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setOpenJsonDialog(false);
  };
  
  // Renderização de guias
  const renderImageTab = () => {
    if (!results || !results.results || results.results.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Typography variant="body1">
            Nenhum resultado disponível para visualização.
          </Typography>
        </Box>
      );
    }
    
    // Encontrar a página atual nos resultados
    const currentPageResult = results.results.find(page => page.page_number === currentPage);
    
    if (!currentPageResult) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Typography variant="body1">
            Página não encontrada nos resultados.
          </Typography>
        </Box>
      );
    }

    console.log('Dados da página atual:', {
      pageNumber: currentPageResult.page_number,
      imagePath: currentPageResult.image_path || currentPageResult.image_url,
      annotations: currentPageResult.annotations?.length || 0
    });

    // Verificar se temos o caminho da imagem
    const imagePath = currentPageResult.image_path || currentPageResult.image_url;
    if (!imagePath) {
      console.error('Caminho da imagem não encontrado:', currentPageResult);
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Alert severity="error">
            Erro: Caminho da imagem não encontrado para esta página.
          </Alert>
        </Box>
      );
    }
    
    // Construir URL correta para a imagem
    const imageUrl = imagePath.startsWith('http')
      ? imagePath
      : imagePath.startsWith('/api/')
        ? `${API_URL}${imagePath.substring(4)}` // Remove a duplicação do '/api/'
        : `${API_URL}${imagePath}`;
    
    // Estatísticas da página atual
    const pageAnnotations = currentPageResult.annotations || [];
    const productCount = pageAnnotations.filter(
      anno => anno.type === 'produto' && anno.confidence >= confidenceThreshold
    ).length;
    const logoCount = pageAnnotations.filter(
      anno => anno.type === 'logo' && anno.confidence >= confidenceThreshold
    ).length;
    const headerCount = pageAnnotations.filter(
      anno => anno.type === 'cabecalho' && anno.confidence >= confidenceThreshold
    ).length;
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={9}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minHeight: '60vh'
            }}
          >
            <Box sx={{ width: '100%', overflow: 'auto', textAlign: 'center' }}>
              <AnnotatedImage 
                image={imageUrl}
                annotations={currentPageResult.annotations || []}
                onAnnotationClick={handleAnnotationClick}
                confidenceThreshold={confidenceThreshold}
                showLabels={showLabels}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <Pagination 
                count={results.results.length} 
                page={currentPage} 
                onChange={handlePageChange} 
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Página {currentPage} de {results.results.length}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Filtros
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography id="confidence-threshold-slider" gutterBottom>
                Limiar de Confiança: {confidenceThreshold * 100}%
              </Typography>
              <Slider
                value={confidenceThreshold}
                onChange={handleConfidenceChange}
                aria-labelledby="confidence-threshold-slider"
                step={0.05}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 0.5, label: '50%' },
                  { value: 1, label: '100%' },
                ]}
                min={0}
                max={1}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  color="primary"
                />
              }
              label="Mostrar rótulos"
            />
          </Paper>
          
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Estatísticas da Página
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="textSecondary">
                Produtos:
              </Typography>
              <Typography variant="h6">
                {productCount}
              </Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="textSecondary">
                Logos:
              </Typography>
              <Typography variant="h6">
                {logoCount}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">
                Cabeçalhos:
              </Typography>
              <Typography variant="h6">
                {headerCount}
              </Typography>
            </Box>
          </Paper>
          
          {selectedAnnotation && (
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Detalhes da Seleção
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Tipo:
                </Typography>
                <Chip 
                  label={selectedAnnotation.type} 
                  color={
                    selectedAnnotation.type === 'produto' ? 'success' :
                    selectedAnnotation.type === 'logo' ? 'primary' :
                    selectedAnnotation.type === 'cabecalho' ? 'secondary' :
                    'warning'
                  }
                />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Confiança:
                </Typography>
                <Typography variant="body1">
                  {Math.round(selectedAnnotation.confidence * 100)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Coordenadas:
                </Typography>
                <Typography variant="body1" sx={{ fontSize: '0.9rem' }}>
                  X1: {selectedAnnotation.bbox.x1}, Y1: {selectedAnnotation.bbox.y1}<br />
                  X2: {selectedAnnotation.bbox.x2}, Y2: {selectedAnnotation.bbox.y2}
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    );
  };
  
  const renderJsonTab = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Exportação JSON
              </Typography>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportJson}
                  sx={{ mr: 1 }}
                >
                  Gerar JSON
                </Button>
              </Box>
            </Box>
            <Typography variant="body2" paragraph>
              Exporte os dados dos produtos detectados em formato JSON para integração com outras aplicações.
              O JSON exportado conterá todos os produtos detectados acima do limiar de confiança ({confidenceThreshold * 100}%).
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Formato do JSON:</strong> O arquivo exportado inclui:
              </Typography>
              <ul>
                <li>Metadados (ID do catálogo, data de detecção)</li>
                <li>Lista de produtos com coordenadas e confiança</li>
                <li>Referências para imagens recortadas (que podem ser geradas separadamente)</li>
              </ul>
            </Alert>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Typography variant="body2" sx={{ mr: 2 }}>
                <strong>Total de produtos:</strong> {getTotalProductCount()}
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={handleExportJson}
              >
                Visualizar JSON
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Próximos Passos
            </Typography>
            <Typography variant="body2" paragraph>
              Após exportar os produtos detectados, você pode:
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" component="div" gutterBottom>
                      Integrar com APIs
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Use o JSON para integrar com APIs de Marketplaces como MercadoLivre
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" component="div" gutterBottom>
                      Extrair Imagens
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Recorte as imagens dos produtos detectados para uso em seu site ou marketplace
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" component="div" gutterBottom>
                      Análise Avançada
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Realize análises adicionais como extração de OCR para capturar preços e descrições
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    );
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Carregando resultados da detecção...
        </Typography>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => {
            console.log('Clique em Voltar (tela de erro)');
            navigate('/');
          }}
          sx={{ mt: 2 }}
        >
          Voltar para Dashboard
        </Button>
      </Box>
    );
  }
  
  if (!results) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning">Resultados não encontrados.</Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => {
            console.log('Clique em Voltar (resultados não encontrados)');
            navigate('/');
          }}
          sx={{ mt: 2 }}
        >
          Voltar para Dashboard
        </Button>
      </Box>
    );
  }
  
  return (
    <Grid container spacing={3}>
      {/* Navegação */}
      <Grid item xs={12}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link 
            underline="hover" 
            color="inherit" 
            onClick={() => {
              console.log('Clique em Dashboard no breadcrumbs');
              navigate('/');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Dashboard
          </Link>
          <Link 
            underline="hover" 
            color="inherit" 
            onClick={() => {
              console.log('Clique em Modelos no breadcrumbs');
              navigate('/models');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Modelos
          </Link>
          <Typography color="text.primary">Resultados da Detecção</Typography>
        </Breadcrumbs>
      </Grid>
      
      {/* Cabeçalho */}
      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Resultados da Detecção
            <Chip 
              label={results.status} 
              color={results.status === 'completed' ? 'success' : 'warning'}
              size="small"
              sx={{ ml: 2 }}
            />
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {catalog && `Catálogo: ${catalog.filename}`} • 
            {results.completed_at && ` Concluído em: ${new Date(results.completed_at).toLocaleDateString('pt-BR')}`}
          </Typography>
        </Box>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              console.log('Clique em Voltar (cabeçalho)');
              navigate('/');
            }}
            sx={{ mr: 1 }}
          >
            Voltar para Dashboard
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExportJson}
          >
            Exportar JSON
          </Button>
        </Box>
      </Grid>
      
      {/* Estatísticas gerais */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Total de Produtos Detectados
                </Typography>
                <Typography variant="h4">
                  {getTotalProductCount()}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Páginas Processadas
                </Typography>
                <Typography variant="h4">
                  {results.results ? results.results.length : 0}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Limiar de Confiança
                </Typography>
                <Typography variant="h4">
                  {confidenceThreshold * 100}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  ID do Job
                </Typography>
                <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                  {jobId}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
      
      {/* Abas */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            indicatorColor="primary"
            textColor="primary"
            centered
          >
            <Tab icon={<ImageIcon />} label="Visualização" />
            <Tab icon={<CodeIcon />} label="Exportação JSON" />
          </Tabs>
        </Paper>
      </Grid>
      
      {/* Conteúdo das abas */}
      <Grid item xs={12}>
        {tabValue === 0 ? renderImageTab() : renderJsonTab()}
      </Grid>
      
      {/* Diálogo de JSON */}
      <Dialog
        open={openJsonDialog}
        onClose={() => setOpenJsonDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Exportação JSON</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Abaixo está o JSON gerado com {getTotalProductCount()} produtos detectados. 
            Você pode copiar este conteúdo ou baixá-lo como arquivo.
          </DialogContentText>
          <TextField
            inputRef={jsonExportRef}
            fullWidth
            multiline
            value={jsonOutput}
            rows={20}
            variant="outlined"
            sx={{ mt: 2, fontFamily: 'monospace' }}
            InputProps={{
              readOnly: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenJsonDialog(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => {
              if (jsonExportRef.current) {
                jsonExportRef.current.select();
                document.execCommand('copy');
              }
            }}
            color="primary"
          >
            Copiar
          </Button>
          <Button
            onClick={handleDownloadJson}
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
          >
            Baixar JSON
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default DetectionResults;    