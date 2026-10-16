export const API_MODES = ['mock', 'real'] as const;

/**
 * Production builds must choose the API mode explicitly, so a deploy can never
 * silently ship mock mode (which bundles demo credentials). Dev servers default to mock.
 * Returns an error message, or null when the environment is acceptable.
 */
export function checkApiMode(command: string, mode: string | undefined): string | null {
  if (command !== 'build') return null;
  if (mode === undefined || mode === '') {
    return 'VITE_API_MODE is not set. Production builds must set it explicitly: VITE_API_MODE=real (with VITE_API_BASE_URL) or VITE_API_MODE=mock for a demo build.';
  }
  if (!(API_MODES as readonly string[]).includes(mode)) {
    return `VITE_API_MODE="${mode}" is invalid. Use "real" or "mock".`;
  }
  return null;
}
