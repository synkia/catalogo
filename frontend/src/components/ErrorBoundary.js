import React, { Component } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Atualiza o estado para que a próxima renderização mostre a UI alternativa
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Você também pode registrar o erro em um serviço de relatório de erros
    console.error("Erro capturado pelo ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI alternativa
      return (
        <Paper 
          elevation={3} 
          sx={{ 
            p: 3, 
            m: 2, 
            backgroundColor: '#fff8f8', 
            border: '1px solid #ffcdd2' 
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ErrorIcon color="error" sx={{ fontSize: 40, mr: 2 }} />
            <Typography variant="h5" color="error">
              Algo deu errado
            </Typography>
          </Box>
          
          <Typography variant="body1" gutterBottom>
            Ocorreu um erro ao renderizar este componente.
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Detalhes do erro: {this.state.error && this.state.error.toString()}
          </Typography>
          
          <Box sx={{ mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={this.handleReset}
              sx={{ mr: 2 }}
            >
              Tentar Novamente
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={() => window.location.reload()}
            >
              Recarregar Página
            </Button>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 