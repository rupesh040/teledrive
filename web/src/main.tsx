import React from 'react';
import ReactDOM from 'react-dom/client';
import { Gate } from './components/Gate.js';
import { LangProvider } from './i18n/lang.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <Gate />
    </LangProvider>
  </React.StrictMode>
);
