import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './app/globals.css';
import { queryClient } from './lib/query-client';

const chunkReloadKey = 'thokstore:chunk-reload-at';
const chunkReloadCooldownMs = 30_000;

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  const lastReloadAt = Number(sessionStorage.getItem(chunkReloadKey));
  if (lastReloadAt && Date.now() - lastReloadAt < chunkReloadCooldownMs) return;

  sessionStorage.setItem(chunkReloadKey, String(Date.now()));
  window.location.reload();
});

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}