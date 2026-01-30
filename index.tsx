
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  // Fix: Cast window to any to satisfy TypeScript when assigning polyfills
  (window as any).Buffer = Buffer;
  // Fix: Cast window to any to satisfy TypeScript when assigning polyfills
  (window as any).global = window;
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
