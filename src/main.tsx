import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import AppWrapper from './AppWrapper.tsx';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

postMessage({ payload: 'removeLoading' }, '*');
