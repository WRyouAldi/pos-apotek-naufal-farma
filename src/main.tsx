import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GlassEnhancer } from './glass-enhancer';
import './design-system.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlassEnhancer>
      <App />
    </GlassEnhancer>
  </React.StrictMode>,
);
