import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkApiMode } from './build-env';

describe('checkApiMode', () => {
  it('allows dev without a mode', () => {
    expect(checkApiMode('dev', undefined)).toBeNull();
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

describe('rsbuild build', () => {
  it(
    'fails with a clear error when VITE_API_MODE is unset',
    () => {
      const env = { ...process.env };
      delete env.VITE_API_MODE;
      const output = mkdtempSync(path.join(tmpdir(), 'rsbuild-unset-'));
      try {
        const r = spawnSync(process.execPath, ['node_modules/@rsbuild/core/bin/rsbuild.js', 'build', '--distPath', output], { env, encoding: 'utf8' });
        expect(r.status).not.toBe(0);
        expect(r.stdout + r.stderr).toMatch(/VITE_API_MODE is not set/);
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
