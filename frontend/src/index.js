import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Definir variável de ambiente pública para os recursos estáticos
window.PUBLIC_URL = '';

// Adicionar um tratamento de erros global
window.addEventListener('error', (event) => {
  console.error('Erro global capturado:', event.error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; background-color: #ffebee; border: 1px solid #f44336; border-radius: 4px; margin: 20px;">
      <h2>Erro na Aplicação</h2>
      <p>Ocorreu um erro ao carregar a aplicação. Detalhes:</p>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${event.error?.message || 'Erro desconhecido'}</pre>
      <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Recarregar Página</button>
    </div>
  `;
});

try {
  // Usando ReactDOM.render para React 17 em vez de createRoot (React 18)
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
} catch (error) {
  console.error('Erro ao renderizar a aplicação:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; background-color: #ffebee; border: 1px solid #f44336; border-radius: 4px; margin: 20px;">
      <h2>Erro na Inicialização</h2>
      <p>Não foi possível inicializar a aplicação React. Detalhes:</p>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error.message}</pre>
      <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Recarregar Página</button>
    </div>
  `;
} 