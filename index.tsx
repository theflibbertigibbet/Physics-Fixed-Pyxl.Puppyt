import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Root container missing in index.html');
}

// AI Studio always uses an `index.tsx` file for all project types.
