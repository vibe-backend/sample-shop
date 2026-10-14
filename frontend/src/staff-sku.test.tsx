// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { api, tokenStore } from './api';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';

// Radix Select needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

async function renderAsStaff(path: string) {
  tokenStore.set(await api.login({ email: 'staff@example.com', password: 'staff1234' }));
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  tokenStore.clear();
});

describe('staff edit form (mock mode)', () => {
  it('makes price/stock read-only for SKU products with a 由規格計算 note', async () => {
    await renderAsStaff('/staff/products/p_003');
    await waitFor(() => expect(screen.getByText(/由規格計算/, { selector: 'p' })).toBeTruthy(), { timeout: 5000 });
    expect((document.getElementById('price') as HTMLInputElement).readOnly).toBe(true);
    expect((document.getElementById('stock') as HTMLInputElement).readOnly).toBe(true);
  }, 15000);
  it('keeps price/stock editable for products without variants', async () => {
    await renderAsStaff('/staff/products/p_007');
    await waitFor(() => expect((document.getElementById('price') as HTMLInputElement).value).toBe('420'), { timeout: 5000 });
    expect((document.getElementById('price') as HTMLInputElement).readOnly).toBe(false);
    expect((document.getElementById('stock') as HTMLInputElement).readOnly).toBe(false);
    expect(screen.queryByText(/由規格計算/)).toBeNull();
  }, 15000);
});
