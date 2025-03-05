import React, { useState, useEffect, useCallback } from 'react';
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
  Container,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import DownloadIcon from '@mui/icons-material/Download';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import axios from 'axios';
import { API_URL } from '../utils/apiConfig';

// Configuração do Axios
const api = axios.create({
  baseURL: API_URL,
});

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

  // Verificar e corrigir duplicação de '/api/'
  let cleanImagePath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Corrigir problema de duplicação de '/api/'
  if (cleanImagePath.startsWith('/api/') && baseUrl.endsWith('/api')) {
    cleanImagePath = cleanImagePath.substring(4); // Remove o '/api/' do início
  }

  // Limpar URLs
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  
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
      const catalogErrors = [];
      
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
                      API_URL,
                      annotation.image_url,
                      catalog.catalog_id,
                      annotation.page_number
                    )
                  : null;
                  
                // 2. URL baseada na estrutura do catálogo
                const catalogPageUrl = buildImageUrl(
                  API_URL,
                  `/catalogs/${catalog.catalog_id}/pages/${annotation.page_number}/image`,
                  catalog.catalog_id,
                  annotation.page_number
                );
                
                // 3. URL de fallback para arquivo PDF
                const fallbackUrl = catalog.filename && catalog.filename.endsWith('.pdf')
                  ? buildImageUrl(
                      API_URL,
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
          catalogErrors.push({
            catalogId: catalog.catalog_id,
            catalogName: catalog.filename || 'Catálogo sem nome',
            error: err.response?.status === 404 ? 
              'Não foram encontradas detecções para este catálogo.' : 
              `Erro: ${err.response?.data?.detail || err.message || 'Erro desconhecido'}`
          });
        }
      }
      
      console.log('Total de produtos encontrados:', allProducts.length);
      setProducts(allProducts);
      
      // Mostrar um alerta se não foram encontrados produtos
      if (allProducts.length === 0) {
        setError('Não foram encontrados produtos extraídos nos catálogos. Tente executar uma detecção de produtos primeiro ou fazer anotações manuais.');
      } else if (catalogErrors.length > 0) {
        // Se houve erros, mas pelo menos alguns produtos foram encontrados
        setError(`Alguns catálogos não possuem produtos extraídos (${catalogErrors.length} catálogos com erro). Total de produtos carregados: ${allProducts.length}.`);
      } else {
        setError(null);
      }
      
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
    // Aplicar filtros aos produtos
    let filtered = [...products];
    
    // Filtrar por termo de busca
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(product => 
        product.id.toLowerCase().includes(searchLower) ||
        (product.catalogName && product.catalogName.toLowerCase().includes(searchLower))
      );
    }
    
    // Filtrar por catálogo
    if (catalog) {
      filtered = filtered.filter(product => product.catalogId === catalog);
    }
    
    // Filtrar por confiança
    filtered = filtered.filter(product => product.confidence >= confidence);
    
    // Ordenar
    switch (sort) {
      case 'confidence':
        filtered.sort((a, b) => b.confidence - a.confidence);
        break;
      case 'date':
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'catalog':
        filtered.sort((a, b) => a.catalogName.localeCompare(b.catalogName));
        break;
      default:
        filtered.sort((a, b) => b.confidence - a.confidence);
    }
    
    setFilteredProducts(filtered);
    setCurrentPage(1); // Voltar para a primeira página ao aplicar filtros
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
  
  // Paginação
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    // Rolar para o topo ao mudar de página
    window.scrollTo(0, 0);
  };
  
  // Função para navegar para os detalhes do catálogo
  const handleProductClick = (product) => {
    navigate(`/catalogs/${product.catalogId}?page=${product.pageNumber}&product=${product.id}`);
  };
  
  // Obter produtos para a página atual
  const getCurrentProducts = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, endIndex);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Produtos Extraídos
      </Typography>
      
      {/* Filtros */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Buscar produto"
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
          
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Catálogo</InputLabel>
              <Select
                value={selectedCatalog}
                onChange={handleCatalogChange}
                label="Catálogo"
              >
                <MenuItem value="">Todos os catálogos</MenuItem>
                {catalogs.map(catalog => (
                  <MenuItem key={catalog.catalog_id} value={catalog.catalog_id}>
                    {catalog.filename || `Catálogo #${catalog.catalog_id.substring(0, 6)}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Ordenar por</InputLabel>
              <Select
                value={sortOrder}
                onChange={handleSortChange}
                label="Ordenar por"
              >
                <MenuItem value="confidence">Confiança</MenuItem>
                <MenuItem value="date">Data</MenuItem>
                <MenuItem value="catalog">Catálogo</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <Box sx={{ width: '100%' }}>
              <Typography id="confidence-slider" gutterBottom>
                Confiança mínima: {confidenceFilter.toFixed(2)}
              </Typography>
              <Slider
                value={confidenceFilter}
                onChange={handleConfidenceChange}
                aria-labelledby="confidence-slider"
                step={0.05}
                marks
                min={0}
                max={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Carregando produtos...
          </Typography>
        </Box>
      ) : error ? (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {error}
          </Alert>
          
          <Typography variant="h6" gutterBottom>
            Como extrair produtos de um catálogo:
          </Typography>
          
          <Box component="ol" sx={{ ml: 2 }}>
            <Box component="li" sx={{ mb: 1 }}>
              <Typography>
                <strong>Faça upload de um catálogo</strong> na página <Link component={RouterLink} to="/catalogs">Catálogos</Link>.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              <Typography>
                <strong>Faça anotações manuais</strong> de produtos usando a <Link component={RouterLink} to="/catalogs">ferramenta de anotação</Link> (clique em um catálogo e depois no botão "Anotar").
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              <Typography>
                <strong>Treine um modelo</strong> na página <Link component={RouterLink} to="/models">Modelos</Link> usando suas anotações manuais.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              <Typography>
                <strong>Execute a detecção</strong> na página <Link component={RouterLink} to="/models">Modelos</Link> clicando no botão "Executar Detecção" e selecionando um catálogo.
              </Typography>
            </Box>
            <Box component="li">
              <Typography>
                <strong>Volte para esta página</strong> para ver os produtos extraídos.
              </Typography>
            </Box>
          </Box>
        </Paper>
      ) : products.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Alert severity="info">
            Nenhum produto encontrado com os filtros atuais.
          </Alert>
        </Paper>
      ) : (
        <>
          {/* Grid de produtos */}
          <Grid container spacing={3}>
            {getCurrentProducts().map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: 6,
                      cursor: 'pointer'
                    }
                  }}
                  onClick={() => handleProductClick(product)}
                >
                  <CardMedia
                    component="img"
                    height="200"
                    image={product.imageUrl}
                    alt={`Produto ${product.id}`}
                    sx={{ 
                      objectFit: 'contain',
                      bgcolor: '#f5f5f5',
                      borderBottom: '1px solid #eee'
                    }}
                    onError={(e) => {
                      console.error('Erro ao carregar imagem do produto:', e.target.src);
                      e.target.onerror = null;
                      e.target.src = '/placeholder-error.png';
                    }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" component="div" gutterBottom>
                      Produto #{product.id.substring(0, 8)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      <strong>Catálogo:</strong> {getCatalogName(product.catalogId, catalogs)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      <strong>Página:</strong> {product.pageNumber}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      <strong>Confiança:</strong> {(product.confidence * 100).toFixed(1)}%
                    </Typography>
                    <Box 
                      sx={{ 
                        mt: 1, 
                        width: '100%', 
                        height: 8, 
                        bgcolor: '#f0f0f0',
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}
                    >
                      <Box 
                        sx={{ 
                          width: `${product.confidence * 100}%`, 
                          height: '100%', 
                          bgcolor: product.confidence > 0.7 ? 'success.main' : 
                                  product.confidence > 0.4 ? 'warning.main' : 'error.main'
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          {/* Paginação */}
          {filteredProducts.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination 
                count={Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)} 
                page={currentPage} 
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
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
              defaultValue={`${API_URL}/catalogs/`}
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
    </Container>
  );
};

export default ExtractedProducts;      