import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import './index.css'

function isCapacitor() {
  return typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform);
}

async function initApp() {
  if (isCapacitor()) {
    try {
      const { default: MobileApp } = await import('./mobile/MobileApp.jsx');
      await import('./mobile/MobileApp.css');

      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#4361ee' });
      } catch (e) {
        console.warn('[APP] StatusBar plugin no disponible:', e.message);
      }

      createRoot(document.getElementById('root')).render(
        <StrictMode>
          <AuthProvider>
            <MobileApp />
          </AuthProvider>
        </StrictMode>,
      );
    } catch (e) {
      console.error('[APP] Error al inicializar Capacitor, usando desktop:', e);
      const { default: App } = await import('./App.jsx');
      createRoot(document.getElementById('root')).render(
        <StrictMode>
          <AuthProvider>
            <App />
          </AuthProvider>
        </StrictMode>,
      );
    }
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
