
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Erro crítico: Elemento raiz #root não encontrado no DOM.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Falha ao renderizar a aplicação:", error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;">Erro ao carregar aplicação. Verifique o console.</div>`;
  }
}
