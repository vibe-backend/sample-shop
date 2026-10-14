import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from './theme';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Hash routing so deep links work on static hosting (GitHub Pages) without a server fallback. */}
      <HashRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-center" richColors={false} />
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
