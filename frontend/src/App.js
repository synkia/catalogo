import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ptBR } from '@mui/material/locale';

// Componentes
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import CatalogList from './pages/CatalogList';
import CatalogDetail from './pages/CatalogDetail';
import AnnotationTool from './pages/AnnotationTool';
import TrainingDashboard from './pages/TrainingDashboard';
import DetectionResults from './pages/DetectionResults';
import ModelList from './pages/ModelList';
import ErrorBoundary from './components/ErrorBoundary';
import ExtractedProducts from './pages/ExtractedProducts';

// Tema personalizado
const theme = createTheme({
  palette: {
    primary: {
      main: '#2D4B73',
    },
    secondary: {
      main: '#FFA500',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
}, ptBR);

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="catalogs" element={<CatalogList />} />
              <Route path="catalogs/:catalogId" element={<CatalogDetail />} />
              <Route path="annotation/:catalogId" element={<AnnotationTool />} />
              <Route path="annotation/:catalogId/:pageNumber" element={<AnnotationTool />} />
              <Route path="annotate/:catalogId" element={<AnnotationTool />} />
              <Route path="annotate/:catalogId/:pageNumber" element={<AnnotationTool />} />
              <Route path="training" element={<TrainingDashboard />} />
              <Route path="models" element={<ModelList />} />
              <Route path="results/:jobId" element={<DetectionResults />} />
              <Route path="products" element={<ExtractedProducts />} />
            </Route>
          </Routes>
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App; 