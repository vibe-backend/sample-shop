import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { checkApiMode } from './build-env';

// Production builds are served from GitHub Pages at /sample-shop/ (override with VITE_BASE).
export default defineConfig(({ command, mode }) => {
  // process.env wins over .env files, matching how Vite exposes VITE_* to the app.
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const problem = checkApiMode(command, env.VITE_API_MODE);
  if (problem) throw new Error(problem);
  return {
    base: command === 'build' ? env.VITE_BASE || '/sample-shop/' : '/',
    plugins: [react()],
  };
});
