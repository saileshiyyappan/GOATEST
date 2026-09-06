import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CribPermissionManager } from './services/crib/events/cribPermissionManager';

// Catch benign development container HMR WebSocket failures gracefully
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || '');
    if (
      message.includes('WebSocket') ||
      message.includes('websocket') ||
      message.includes('WebSocket closed without opened') ||
      message.includes('failed to connect to websocket')
    ) {
      // Prevent benign dev-server HMR proxy disconnection from throwing unhandled error
      event.preventDefault();
      console.warn('[CRIB_RUNTIME] Development HMR WebSocket closed (benign dev container proxy behavior - CRIB production runs independently).');
    }
  });

  // Initialize permission manager capabilities
  CribPermissionManager.detectInitialCapabilities();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

