
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/global.css';

import { i18nReady } from './app/providers/i18n';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('React root element was not found.');
}

void i18nReady
  .then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((error: unknown) => {
    console.error('AgriVoice initialization failed:', error);
  });
