import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from GitHub Pages at /sample-shop/ (override with VITE_BASE).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE || '/sample-shop/' : '/',
  plugins: [react()],
}));
