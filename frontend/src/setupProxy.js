const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Determinar o target do proxy com base no ambiente
  let target = process.env.REACT_APP_API_URL || 'http://backend:8001';
  
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
