import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  CardMedia, 
  Button, 
  Paper,
  Box,
  Breadcrumbs,
  Link,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Pagination,
  IconButton,
  Tooltip
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import ModelTrainingIcon from '@mui/icons-material/Psychology';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';
import { API_URL } from '../utils/apiConfig';

// Configuração do Axios
const api = axios.create({
  baseURL: API_URL,
});

const CatalogDetail = () => {
  const navigate = useNavigate();
  const { catalogId } = useParams();
  
  const [catalog, setCatalog] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Buscar dados do catálogo
  useEffect(() => {
    const fetchCatalogData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Buscar detalhes do catálogo
        const catalogResponse = await api.get(`/catalogs/${catalogId}`);
        setCatalog(catalogResponse.data);
        
        // Buscar páginas do catálogo
        const pagesResponse = await api.get(`/catalogs/${catalogId}/pages`);
        setPages(pagesResponse.data);
        
      } catch (err) {
        console.error('Erro ao buscar detalhes do catálogo:', err);
        setError('Não foi possível carregar os detalhes do catálogo. Verifique a conexão e tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    
    if (catalogId) {
      fetchCatalogData();
    }
  }, [catalogId]);
  
  // Função para renderizar o status
  const renderStatus = (status) => {
    switch (status) {
      case 'processing':
        return <Chip label="Processando" color="warning" size="small" />;
      case 'ready':
        return <Chip label="Pronto" color="success" size="small" />;
      case 'error':
        return <Chip label="Erro" color="error" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };
  
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
  
  // Função para lidar com a mudança de página
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };
  
  // URL da imagem da página atual
  const currentImageUrl = pages.length > 0 && currentPage <= pages.length 
    ? `${api.defaults.baseURL}/catalogs/${catalogId}/pages/${currentPage}/image` 
    : null;
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Carregando detalhes do catálogo...
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
          onClick={() => navigate('/catalogs')}
          sx={{ mt: 2 }}
        >
          Voltar para Lista de Catálogos
        </Button>
      </Box>
    );
  }
  
  if (!catalog) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning">Catálogo não encontrado.</Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/catalogs')}
          sx={{ mt: 2 }}
        >
          Voltar para Lista de Catálogos
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
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer' }}
          >
            Dashboard
          </Link>
          <Link 
            underline="hover" 
            color="inherit" 
            onClick={() => navigate('/catalogs')}
            sx={{ cursor: 'pointer' }}
          >
            Catálogos
          </Link>
          <Typography color="text.primary">{catalog.filename}</Typography>
        </Breadcrumbs>
      </Grid>
      
      {/* Cabeçalho */}
      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {catalog.filename}
            <Box component="span" sx={{ ml: 2 }}>
              {renderStatus(catalog.status)}
            </Box>
            <Tooltip title={`Status: ${catalog.status}`}>
              <Box component="span" sx={{ ml: 1, cursor: 'help' }}>
                <InfoIcon fontSize="small" color="action" />
              </Box>
            </Tooltip>
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {catalog.page_count} páginas • Enviado em {formatDate(catalog.upload_date)}
          </Typography>
        </Box>
        <Box>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/annotate/${catalogId}/${currentPage}`)}
            sx={{ mr: 1 }}
            disabled={catalog.status !== 'ready'}
          >
            Anotar
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<ModelTrainingIcon />}
            onClick={() => navigate('/training', { state: { catalogs: [catalogId] } })}
            disabled={catalog.status !== 'ready'}
          >
            Treinar Modelo
          </Button>
        </Box>
      </Grid>
      
      <Grid item xs={12}>
        <Divider />
      </Grid>
      
      {/* Visualizador de página */}
      <Grid item xs={12}>
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
          {pages.length > 0 ? (
            <>
              <Box sx={{ width: '100%', overflow: 'auto', mb: 2, textAlign: 'center' }}>
                {currentImageUrl && (
                  <img 
                    src={currentImageUrl} 
                    alt={`Página ${currentPage} do catálogo`} 
                    style={{ maxWidth: '100%', maxHeight: '60vh' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjQwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjBweCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+RXJybyBhbyBjYXJyZWdhciBpbWFnZW08L3RleHQ+PC9zdmc+';
                    }}
                  />
                )}
              </Box>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                <Pagination 
                  count={pages.length} 
                  page={currentPage} 
                  onChange={handlePageChange} 
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Página {currentPage} de {pages.length}
                </Typography>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Nenhuma página disponível
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {catalog.status === 'processing' 
                  ? 'O catálogo ainda está sendo processado. Tente novamente em alguns instantes.' 
                  : 'Não foi possível carregar as páginas deste catálogo.'}
              </Typography>
            </Box>
          )}
        </Paper>
      </Grid>
      
      {/* Informações adicionais */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Detalhes do Catálogo
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  ID do Catálogo
                </Typography>
                <Typography variant="body1">
                  {catalog.catalog_id}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Nome do Arquivo
                </Typography>
                <Typography variant="body1">
                  {catalog.filename}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Número de Páginas
                </Typography>
                <Typography variant="body1">
                  {catalog.page_count}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Data de Upload
                </Typography>
                <Typography variant="body1">
                  {formatDate(catalog.upload_date)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default CatalogDetail;  