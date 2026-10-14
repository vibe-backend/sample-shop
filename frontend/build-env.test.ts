import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { checkApiMode } from './build-env';

describe('checkApiMode', () => {
  it('allows dev without a mode', () => {
    expect(checkApiMode('serve', undefined)).toBeNull();
  });
  it('rejects a build without a mode', () => {
    expect(checkApiMode('build', undefined)).toMatch(/VITE_API_MODE is not set/);
    expect(checkApiMode('build', '')).toMatch(/VITE_API_MODE is not set/);
  });
  it('rejects an unknown mode', () => {
    expect(checkApiMode('build', 'prod')).toMatch(/invalid/);
  });
  it('accepts mock and real builds', () => {
    expect(checkApiMode('build', 'mock')).toBeNull();
    expect(checkApiMode('build', 'real')).toBeNull();
  });
});

describe('vite build', () => {
  it(
    'fails with a clear error when VITE_API_MODE is unset',
    () => {
      const env = { ...process.env };
      delete env.VITE_API_MODE;
      const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'node_modules/.tmp-unset-build'], { env, encoding: 'utf8' });
      expect(r.status).not.toBe(0);
      expect(r.stdout + r.stderr).toMatch(/VITE_API_MODE is not set/);
    },
    30_000,
  );
});
