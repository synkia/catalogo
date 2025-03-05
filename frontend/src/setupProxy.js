const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Determinar o target do proxy com base no ambiente
  let target = process.env.REACT_APP_API_URL || 'http://backend:8001';
  
  // Se estiver em ambiente de produção ou acessando de um domínio externo
  if (process.env.NODE_ENV === 'production' || 
      (typeof window !== 'undefined' && 
       window.location.hostname !== 'localhost' && 
       window.location.hostname !== '127.0.0.1')) {
    // Usar a URL do backend exposta
    target = 'http://localhost:8001';
  }
  
  console.log('Proxy configurado para:', target);
  
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // remove /api prefix when forwarding to backend
      },
    })
  );
};
