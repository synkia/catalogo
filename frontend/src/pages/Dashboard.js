import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button,
  Paper,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ModelTrainingIcon from '@mui/icons-material/Psychology';
import AssessmentIcon from '@mui/icons-material/Assessment';
import axios from 'axios';

// Configuração do Axios
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
});

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCatalogs: 0,
    totalPages: 0,
    totalAnnotations: 0,
    totalModels: 0,
  });
  const [recentCatalogs, setRecentCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Função para carregar dados
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Buscar catálogos
        const catalogsResponse = await api.get('/catalogs/');
        const catalogs = catalogsResponse.data;
        
        // Calcular estatísticas
        const totalCatalogs = catalogs.length;
        const totalPages = catalogs.reduce((acc, catalog) => acc + catalog.page_count, 0);
        
        // Buscar modelos treinados (simulado por enquanto)
        const totalModels = 0; // Será implementado quando a API estiver pronta
        
        // Calcular total de anotações (simulado por enquanto)
        const totalAnnotations = 0; // Será implementado quando a API estiver pronta
        
        setStats({
          totalCatalogs,
          totalPages,
          totalAnnotations,
          totalModels
        });
        
        // Ordenar catálogos por data de upload (mais recentes primeiro)
        const sortedCatalogs = [...catalogs].sort((a, b) => {
          return new Date(b.upload_date) - new Date(a.upload_date);
        });
        
        // Pegar os 5 mais recentes
        setRecentCatalogs(sortedCatalogs.slice(0, 5));
        
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        // Usar dados de exemplo em caso de erro
        setStats({
          totalCatalogs: 0,
          totalPages: 0,
          totalAnnotations: 0,
          totalModels: 0,
        });
        setRecentCatalogs([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const actionCards = [
    {
      title: 'Adicionar Catálogo',
      description: 'Faça upload de um novo catálogo em PDF para processamento',
      icon: <UploadFileIcon fontSize="large" color="primary" />,
      action: () => navigate('/catalogs')
    },
    {
      title: 'Anotar Produtos',
      description: 'Marque produtos e elementos em catálogos processados',
      icon: <AutoFixHighIcon fontSize="large" color="primary" />,
      action: () => navigate('/catalogs')
    },
    {
      title: 'Treinar Modelo',
      description: 'Treine um modelo de IA com suas anotações',
      icon: <ModelTrainingIcon fontSize="large" color="primary" />,
      action: () => navigate('/training')
    },
    {
      title: 'Extrair Produtos',
      description: 'Detecte produtos automaticamente em novos catálogos',
      icon: <AssessmentIcon fontSize="large" color="primary" />,
      action: () => navigate('/models')
    }
  ];

  return (
    <Grid container spacing={3}>
      {/* Cabeçalho */}
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="subtitle1" color="textSecondary" paragraph>
          Bem-vindo ao sistema de extração e análise de produtos em catálogos
        </Typography>
      </Grid>
      
      {/* Cartões de estatísticas */}
      <Grid item xs={12}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography variant="h6" color="textSecondary">
                Catálogos
              </Typography>
              <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
                {stats.totalCatalogs}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography variant="h6" color="textSecondary">
                Páginas
              </Typography>
              <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
                {stats.totalPages}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography variant="h6" color="textSecondary">
                Anotações
              </Typography>
              <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
                {stats.totalAnnotations}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography variant="h6" color="textSecondary">
                Modelos
              </Typography>
              <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
                {stats.totalModels}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Grid>
      
      {/* Ações rápidas */}
      <Grid item xs={12}>
        <Typography variant="h5" gutterBottom>
          Ações Rápidas
        </Typography>
        <Grid container spacing={3}>
          {actionCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card elevation={3}>
                <CardContent sx={{ textAlign: 'center', height: '180px', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    {card.icon}
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, flexGrow: 1 }}>
                    {card.description}
                  </Typography>
                  <Button variant="contained" color="primary" onClick={card.action}>
                    Iniciar
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Grid>
      
      {/* Catálogos recentes */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Catálogos Recentes
          </Typography>
          {recentCatalogs.length > 0 ? (
            <List>
              {recentCatalogs.map((catalog, index) => (
                <React.Fragment key={catalog.catalog_id}>
                  <ListItem 
                    button 
                    onClick={() => navigate(`/catalogs/${catalog.catalog_id}`)}
                    secondaryAction={
                      <Typography variant="caption" color="textSecondary">
                        {new Date(catalog.upload_date).toLocaleDateString('pt-BR')}
                      </Typography>
                    }
                  >
                    <ListItemText 
                      primary={catalog.filename} 
                      secondary={`${catalog.page_count} páginas • Status: ${catalog.status}`} 
                    />
                  </ListItem>
                  {index < recentCatalogs.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="textSecondary">
              Nenhum catálogo encontrado. Adicione seu primeiro catálogo!
            </Typography>
          )}
        </Paper>
      </Grid>
      
      {/* Guia rápido */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Guia Rápido
          </Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="1. Faça upload de um catálogo em PDF" 
                secondary="Use a opção 'Adicionar Catálogo' para iniciar"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText 
                primary="2. Anote produtos e elementos" 
                secondary="Desenhe retângulos ao redor dos produtos e classifique-os"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText 
                primary="3. Treine um modelo de IA" 
                secondary="Use suas anotações para treinar um modelo Detectron2"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText 
                primary="4. Extraia produtos automaticamente" 
                secondary="Processe novos catálogos e exporte os resultados em JSON"
              />
            </ListItem>
          </List>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Dashboard; 