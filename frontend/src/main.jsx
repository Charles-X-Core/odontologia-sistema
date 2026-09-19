import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import './index.css'

function isCapacitor() {
  return typeof window !== 'undefined' && window.__CAPACITOR__ !== undefined;
}

async function initApp() {
  if (isCapacitor()) {
    const { Capacitor } = await import('@capacitor/core');
    const { default: MobileApp } = await import('./mobile/MobileApp.jsx');
    await import('./mobile/MobileApp.css');

    const { StatusBar, Style } = await import('@capacitor/status-bar');
    StatusBar.setStyle({ style: Style.Dark });
    StatusBar.setBackgroundColor({ color: '#4361ee' });

    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <AuthProvider>
          <MobileApp />
        </AuthProvider>
      </StrictMode>,
    );
  } else {
    const { default: App } = await import('./App.jsx');
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StrictMode>,
    );
  }
}

initApp();
