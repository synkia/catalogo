// Utilitário para configuração dinâmica da API
export const getApiUrl = () => {
  // Se estiver definida uma variável de ambiente, use-a
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Usar caminho relativo para que o proxy do Nginx funcione
  return '/api';
};

// Exportar a URL da API para uso em componentes
export const API_URL = getApiUrl();

// Log para debug
console.log('API URL configurada:', API_URL, 'Ambiente:', process.env.NODE_ENV);
