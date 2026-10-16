import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // UI tests opt into jsdom with per-file environment comments.
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
});
