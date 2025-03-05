// Utilitário para configuração dinâmica da API
export const getApiUrl = () => {
  // Se estiver definida uma variável de ambiente, use-a
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Se estiver acessando de um domínio externo, use a URL do navegador
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Usar a URL do navegador para acessar o backend
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // Extrair o domínio base e substituir o subdomínio
    // De: catalog-list-app-tunnel-xxx.devinapps.com
    // Para: backend-app-tunnel-xxx.devinapps.com
    const domainParts = hostname.split('.');
    const subdomain = domainParts[0].replace('catalog-list-app', 'backend-app');
    const newHostname = [subdomain, ...domainParts.slice(1)].join('.');
    
    console.log(`Usando URL dinâmica para API em domínio externo: ${protocol}//${newHostname}`);
    return `${protocol}//${newHostname}`;
  }
  
  // Verificar se estamos em ambiente de desenvolvimento com Docker
  if (process.env.NODE_ENV === 'development') {
    // No ambiente Docker, usar o nome do serviço como hostname
    return '/api';
  }
  
  // Fallback para localhost
  return 'http://localhost:8001';
};

// Exportar a URL da API para uso em componentes
export const API_URL = getApiUrl();

// Log para debug
console.log('API URL configurada:', API_URL, 'Ambiente:', process.env.NODE_ENV);
