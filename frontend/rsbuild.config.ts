import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'node:path';
import { checkApiMode } from './build-env';

export default defineConfig(({ command, envMode }) => {
  const { parsed, publicVars } = loadEnv({ mode: envMode, prefixes: ['VITE_'] });
  const env = { ...parsed, ...process.env };
  const problem = checkApiMode(command, env.VITE_API_MODE);
  if (problem) throw new Error(problem);

  // Keep VITE_* names for CI/deploy compatibility; shell variables win over files.
  const define = { ...publicVars };
  for (const key of new Set([
    ...Object.keys(env).filter((key) => key.startsWith('VITE_')),
    'VITE_API_MODE', 'VITE_API_BASE_URL', 'VITE_SHOP_SLUG', 'VITE_BASE',
  ])) {
    define[`import.meta.env.${key}`] = JSON.stringify(env[key]) ?? 'undefined';
  }

  return {
    plugins: [pluginReact()],
    html: { template: './index.html' },
    source: { entry: { index: './src/main.tsx' }, define },
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
    output: {
      distPath: { root: 'dist' },
      assetPrefix: command === 'build' ? env.VITE_BASE || '/sample-shop/' : '/',
    },
  };
});
