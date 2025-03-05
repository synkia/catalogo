// Utilitário para configuração dinâmica da API
export const getApiUrl = () => {
  // Se estiver definida uma variável de ambiente, use-a
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Se estiver acessando de um domínio externo, use caminhos relativos
  // para que o proxy do React possa redirecionar corretamente
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Usar caminho relativo para que o proxy funcione
    return '';
  }
  
  // Fallback para localhost
  return 'http://localhost:8001';
};

// Exportar a URL da API para uso em componentes
export const API_URL = getApiUrl();

// Log para debug
console.log('API URL configurada:', API_URL);
