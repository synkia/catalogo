import React, { useState, useEffect } from 'react';
import {
  Typography,
  Grid,
  Paper,
  Box,
  Breadcrumbs,
  Link,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  Pagination,
  Slider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import DownloadIcon from '@mui/icons-material/Download';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import axios from 'axios';

// Configuração do Axios
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
});

// Log da URL da API para depuração
console.log('API URL (ExtractedProducts):', process.env.REACT_APP_API_URL || 'http://localhost:8001');

// Função para validar e construir URLs de imagem
const buildImageUrl = (baseUrl, imagePath, catalogId, pageNumber) => {
  if (!imagePath) {
    console.log('Caminho da imagem não fornecido');
    return null;
  }

  // Se já for uma URL completa, retornar
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Limpar URLs
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanImagePath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;

  // Construir URL final
  const finalUrl = `${cleanBaseUrl}${cleanImagePath}`;
  
  console.log('URL construída:', {
    baseUrl: cleanBaseUrl,
    imagePath: cleanImagePath,
    catalogId,
    pageNumber,
    finalUrl
  });

  return finalUrl;
};

// Teste de uma URL para verificar se ela funciona
const testImageUrl = async (url) => {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return response.ok;
  } catch (error) {
    console.error(`Erro ao testar URL da imagem: ${url}`, error);
    return false;
  }
};

// Componente de teste de disponibilidade de imagem
const ImageAvailabilityTest = ({ url }) => {
  const [status, setStatus] = useState('loading');
  
  useEffect(() => {
    const testImageUrl = async () => {
      if (!url) {
        setStatus('invalid_url');
        return;
      }
      
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          setStatus('available');
        } else {
          setStatus(`unavailable: ${response.status}`);
        }
      } catch (error) {
        setStatus(`error: ${error.message}`);
      }
    };
    
    testImageUrl();
  }, [url]);
  
  return (
    <Typography variant="caption" color={
      status === 'available' ? 'success.main' :
      status === 'loading' ? 'info.main' : 'error.main'
    }>
      {status}
    </Typography>
  );
};

const ExtractedProducts = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [error, setError] = useState(null);
  const [catalogs, setCatalogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(12);
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState(0.5);
  const [sortOrder, setSortOrder] = useState('confidence');
  
  // Função para buscar todos os produtos
  const fetchAllProducts = async () => {
    try {
      setLoading(true);
      
      // 1. Buscar todos os catálogos para referência
      const catalogsResponse = await api.get('/catalogs/');
      console.log('Catálogos encontrados:', catalogsResponse.data);
      setCatalogs(catalogsResponse.data);
      
      // 2. Para cada catálogo, buscar suas páginas e produtos
      const allProducts = [];
      
      for (const catalog of catalogsResponse.data) {
        console.log('Processando catálogo:', catalog.catalog_id);
        
        try {
          // Buscar detecções do catálogo
            const detectionResponse = await api.get(`/catalogs/${catalog.catalog_id}/detection`);
            console.log('Resposta completa da API:', {
              catalog_id: catalog.catalog_id,
              data: detectionResponse.data,
              status: detectionResponse.status
            });
            
            if (detectionResponse.data && detectionResponse.data.annotations) {
              // Processar as anotações em paralelo com promessas
              const productPromises = detectionResponse.data.annotations
                .filter(annotation => annotation.type === 'produto')
                .map(async (annotation, index) => {
                  // Gerar URLs possíveis para a imagem
                  
                  // 1. URL direta da anotação (se disponível)
                  const annotationUrl = annotation.image_url 
                    ? buildImageUrl(
                        process.env.REACT_APP_API_URL || 'http://localhost:8001',
                        annotation.image_url,
                        catalog.catalog_id,
                        annotation.page_number
                      )
                    : null;
                    
                  // 2. URL baseada na estrutura do catálogo
                  const catalogPageUrl = buildImageUrl(
                    process.env.REACT_APP_API_URL || 'http://localhost:8001',
                    `/catalogs/${catalog.catalog_id}/pages/${annotation.page_number}/image`,
                    catalog.catalog_id,
                    annotation.page_number
                  );
                  
                  // 3. URL de fallback para arquivo PDF
                  const fallbackUrl = catalog.filename && catalog.filename.endsWith('.pdf')
                    ? buildImageUrl(
                        process.env.REACT_APP_API_URL || 'http://localhost:8001',
                        `/files/${catalog.filename.replace('.pdf', '')}_page_${annotation.page_number}.jpg`,
                        catalog.catalog_id,
                        annotation.page_number
                      )
                    : null;
                  
                  // Testar todas as URLs e usar a primeira válida
                  let workingImageUrl = null;
                  
                  // Primeiro, tente a URL da anotação
                  if (annotationUrl && await testImageUrl(annotationUrl)) {
                    workingImageUrl = annotationUrl;
                    console.log('URL da anotação funcionando:', annotationUrl);
                  } 
                  // Em seguida, tente a URL da página do catálogo
                  else if (await testImageUrl(catalogPageUrl)) {
                    workingImageUrl = catalogPageUrl;
                    console.log('URL da página do catálogo funcionando:', catalogPageUrl);
                  }
                  // Por último, tente a URL de fallback
                  else if (fallbackUrl && await testImageUrl(fallbackUrl)) {
                    workingImageUrl = fallbackUrl;
                    console.log('URL de fallback funcionando:', fallbackUrl);
                  }
                  // Se nenhuma funcionar, use o placeholder
                  else {
                    workingImageUrl = '/assets/placeholder-product.png';
                    console.log('Nenhuma URL funcionou, usando placeholder');
                  }
                  
                  return {
                    id: `${catalog.catalog_id}_${annotation.page_number}_${index}`,
                    catalogId: catalog.catalog_id,
                    catalogName: catalog.filename || 'Catálogo sem nome',
                    pageNumber: annotation.page_number,
                    confidence: annotation.confidence,
                    bbox: annotation.bbox,
                    imageUrl: workingImageUrl,
                    date: catalog.created_at
                  };
                });
                
              // Aguardar todas as promessas e adicionar os produtos à lista
              const catalogProducts = await Promise.all(productPromises);
              allProducts.push(...catalogProducts);
              
              console.log(`Encontrados ${catalogProducts.length} produtos no catálogo ${catalog.catalog_id}`);
            }
          } catch (err) {
            console.error(`Erro ao buscar detecções do catálogo ${catalog.catalog_id}:`, err);
          }
        }
        
        console.log('Total de produtos encontrados:', allProducts.length);
        setProducts(allProducts);
        applyFilters(allProducts, searchTerm, selectedCatalog, confidenceFilter, sortOrder);
        
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        setError('Não foi possível carregar os produtos. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };
    
  // Buscar dados iniciais
  useEffect(() => {
    fetchAllProducts();
  }, []); // Sem dependências para carregar apenas uma vez

  // Aplicar filtros quando os critérios mudarem
  useEffect(() => {
    if (products.length > 0) {
      applyFilters(products, searchTerm, selectedCatalog, confidenceFilter, sortOrder);
    }
  }, [products, searchTerm, selectedCatalog, confidenceFilter, sortOrder]);
  
  // Função para obter o nome do catálogo a partir do ID
  const getCatalogName = (catalogId, catalogsList) => {
    const catalog = catalogsList.find(cat => cat.catalog_id === catalogId);
    return catalog ? catalog.filename : catalogId;
  };
  
  // Função para aplicar filtros e busca
  const applyFilters = (products, search, catalog, confidence, sort) => {
    let filtered = [...products];
    
    // Filtrar por termo de busca
    if (search) {
      filtered = filtered.filter(product => 
        product.catalogName.toLowerCase().includes(search.toLowerCase()) || 
        product.id.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Filtrar por catálogo
    if (catalog) {
      filtered = filtered.filter(product => product.catalogId === catalog);
    }
    
    // Filtrar por confiança
    filtered = filtered.filter(product => product.confidence >= confidence);
    
    // Ordenar os resultados
    switch (sort) {
      case 'confidence':
        filtered.sort((a, b) => b.confidence - a.confidence);
        break;
      case 'date':
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'area':
        filtered.sort((a, b) => b.bbox.x2 - b.bbox.x1);
        break;
      default:
        break;
    }
    
    setFilteredProducts(filtered);
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    setPage(1); // Voltar para a primeira página ao aplicar filtros
  };
  
  // Handlers para os filtros
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    applyFilters(products, value, selectedCatalog, confidenceFilter, sortOrder);
  };
  
  const handleCatalogChange = (event) => {
    const value = event.target.value;
    setSelectedCatalog(value);
    applyFilters(products, searchTerm, value, confidenceFilter, sortOrder);
  };
  
  const handleConfidenceChange = (event) => {
    const value = event.target.value;
    setConfidenceFilter(value);
    applyFilters(products, searchTerm, selectedCatalog, value, sortOrder);
  };
  
  const handleSortChange = (event) => {
    const value = event.target.value;
    setSortOrder(value);
    applyFilters(products, searchTerm, selectedCatalog, confidenceFilter, value);
  };
  
  // Handler para paginação
  const handlePageChange = (event, value) => {
    setPage(value);
  };
  
  // Função para navegar para os detalhes do catálogo
  const handleProductClick = (product) => {
    navigate(`/catalogs/${product.catalogId}?page=${product.pageNumber}&product=${product.id}`);
  };
  
  // Calcular os produtos a serem exibidos na página atual
  const getCurrentProducts = () => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredProducts.slice(start, end);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link color="inherit" onClick={() => navigate('/')}>
            Dashboard
          </Link>
          <Typography color="textPrimary">Produtos Extraídos</Typography>
        </Breadcrumbs>
        
        <Typography variant="h4" gutterBottom>
          Biblioteca de Produtos Extraídos
        </Typography>
        <Typography variant="subtitle1" color="textSecondary" paragraph>
          Visualize e gerencie todos os produtos detectados nos seus catálogos
        </Typography>
      </Grid>
      
      {/* Filtros e busca */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Buscar produtos"
                variant="outlined"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="catalog-filter-label">Catálogo</InputLabel>
                <Select
                  labelId="catalog-filter-label"
                  value={selectedCatalog}
                  onChange={handleCatalogChange}
                  label="Catálogo"
                >
                  <MenuItem value="">Todos os Catálogos</MenuItem>
                  {catalogs.map((catalog) => (
                    <MenuItem key={catalog.catalog_id} value={catalog.catalog_id}>
                      {catalog.filename}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="sort-filter-label">Ordenar por</InputLabel>
                <Select
                  labelId="sort-filter-label"
                  value={sortOrder}
                  onChange={handleSortChange}
                  label="Ordenar por"
                >
                  <MenuItem value="confidence">Confiança (Maior primeiro)</MenuItem>
                  <MenuItem value="date">Data de Detecção (Recentes primeiro)</MenuItem>
                  <MenuItem value="area">Tamanho do Produto (Maior primeiro)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 1, minWidth: '100px' }}>
                  Confiança mínima: {confidenceFilter.toFixed(2)}
                </Typography>
                <Slider
                  value={confidenceFilter}
                  onChange={(e, value) => handleConfidenceChange({ target: { value } })}
                  step={0.05}
                  min={0}
                  max={1}
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
      
      {/* Status e contagem */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">
            {filteredProducts.length} produtos encontrados
          </Typography>
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => alert('Funcionalidade para exportar resultados em desenvolvimento')}
          >
            Exportar Resultados
          </Button>
        </Box>
      </Grid>
      
      {/* Mensagem de carregamento */}
      {loading && (
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        </Grid>
      )}
      
      {/* Mensagem de erro */}
      {error && (
        <Grid item xs={12}>
          <Alert severity="error">{error}</Alert>
        </Grid>
      )}
      
      {/* Sem resultados */}
      {!loading && filteredProducts.length === 0 && (
        <Grid item xs={12}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Nenhum produto encontrado
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Tente ajustar os filtros ou realizar novas detecções nos seus catálogos.
            </Typography>
          </Paper>
        </Grid>
      )}
      
      {/* Grid de produtos */}
      {!loading && filteredProducts.length > 0 && (
        <>
          <Grid item xs={12}>
            <Grid container spacing={3}>
              {getCurrentProducts().map((product) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'scale(1.02)',
                        boxShadow: 6,
                        cursor: 'pointer'
                      }
                    }}
                    onClick={() => handleProductClick(product)}
                  >
                    <Box sx={{ position: 'relative', pt: '100%', overflow: 'hidden', bgcolor: '#f5f5f5' }}>
                      <CardMedia
                        component="img"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          objectPosition: 'center',
                          bgcolor: '#f5f5f5'
                        }}
                        image={product.imageUrl}
                        alt={`Produto ${product.id}`}
                        onError={(e) => {
                          const placeholder = '/assets/placeholder-product.png';
                          console.error('Erro ao carregar imagem do produto:', {
                            src: e.target.src,
                            produto: product.id,
                            catálogo: product.catalogId
                          });

                          // Evitar loop infinito
                          if (!e.target.src.includes(placeholder)) {
                            console.log('Usando imagem placeholder para o produto');
                            e.target.src = placeholder;
                          }
                          e.target.onerror = null; // Evitar novos erros
                        }}
                      />
                      <Box position="absolute" bottom={2} left={2} zIndex={1}>
                        <ImageAvailabilityTest url={product.imageUrl} />
                      </Box>
                      
                      <Chip
                        label={`${(product.confidence * 100).toFixed(0)}%`}
                        color={product.confidence > 0.8 ? 'success' : product.confidence > 0.6 ? 'primary' : 'warning'}
                        size="small"
                        sx={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8,
                          fontWeight: 'bold'
                        }}
                      />
                    </Box>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" component="div" noWrap>
                        ID: {product.id}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" noWrap>
                        Catálogo: {product.catalogName}
                      </Typography>
                      
                      <Typography variant="caption" color="text.secondary" display="block">
                        Página {product.pageNumber}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <ShoppingCartIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(product.date).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
          
          {/* Paginação */}
          {totalPages > 1 && (
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={handlePageChange} 
                color="primary" 
                showFirstButton 
                showLastButton
              />
            </Grid>
          )}
        </>
      )}

      {/* Painel de depuração - remover após resolver o problema */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Painel de Depuração
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Testar URL da imagem"
              variant="outlined"
              size="small"
              id="debug-url"
              defaultValue={`${process.env.REACT_APP_API_URL || 'http://localhost:8001'}/catalogs/`}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <Button 
              variant="contained" 
              color="info"
              onClick={() => {
                const url = document.getElementById('debug-url').value;
                if (url) {
                  window.open(url, '_blank');
                }
              }}
              sx={{ mr: 1 }}
            >
              Abrir no navegador
            </Button>
            <Button 
              variant="outlined" 
              color="secondary"
              onClick={async () => {
                const url = document.getElementById('debug-url').value;
                if (!url) return;
                
                try {
                  const response = await fetch(url);
                  const text = await response.text();
                  console.log('Resposta da API:', {
                    url,
                    status: response.status,
                    headers: Object.fromEntries([...response.headers.entries()]),
                    body: text.substring(0, 1000) + (text.length > 1000 ? '...' : '')
                  });
                  alert(`Status: ${response.status}\nTipo: ${response.headers.get('content-type')}\nTamanho: ${text.length} caracteres`);
                } catch (error) {
                  console.error('Erro ao testar URL:', error);
                  alert(`Erro: ${error.message}`);
                }
              }}
              sx={{ mr: 1 }}
            >
              Testar API
            </Button>
            <Button 
              variant="outlined" 
              color="error"
              onClick={() => {
                setProducts([]);
                fetchAllProducts();
              }}
            >
              Recarregar Dados
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Grid>
  );
};

export default ExtractedProducts; 