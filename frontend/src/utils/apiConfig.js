// Utilitário para configuração dinâmica da API
export const getApiUrl = () => {
  // Se estiver definida uma variável de ambiente, use-a
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Se estiver acessando de um domínio externo, use o mesmo domínio para a API
  // mas com a porta 8001 (porta do backend)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Extrair o protocolo e o hostname
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // Construir a URL da API usando o mesmo domínio, mas com a porta do backend
    return `${protocol}//${hostname}:8001`;
  }
  
  // Fallback para localhost
  return 'http://localhost:8001';
};

// Exportar a URL da API para uso em componentes
export const API_URL = getApiUrl();
