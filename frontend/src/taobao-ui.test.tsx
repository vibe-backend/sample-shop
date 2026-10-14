// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { api, tokenStore } from './api';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';
import { ProductCard } from './pages/Products';
import { seedProducts } from './api/seed';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const renderAt = (path: string) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  tokenStore.clear();
});

describe('Taobao-style layout', () => {
  it('product card shows a red price and 已售 N; hides sold count when absent', () => {
    const p = seedProducts()[6];
    const { unmount } = render(<MemoryRouter><ProductCard p={p} /></MemoryRouter>);
    expect(screen.getByText(`已售 ${p.sold_count}`)).toBeTruthy();
    expect(screen.getByText('420.00').parentElement!.className).toContain('text-price');
    unmount();
    render(<MemoryRouter><ProductCard p={{ ...p, sold_count: undefined }} /></MemoryRouter>);
    expect(screen.queryByText(/已售/)).toBeNull();
  });

  it('has the header search, category nav, carousel and mobile tab bar', async () => {
    renderAt('/');
    expect(screen.getAllByRole('search').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: '商品分類' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '推介' })).toBeTruthy();
    const tabs = screen.getByRole('navigation', { name: '底部分頁' });
    expect(within(tabs).getByText('購物車')).toBeTruthy();
  });

  it('立即購買 adds to cart and goes straight to checkout', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    renderAt('/products/p_007');
    // Wait for the session to resolve (header account menu); clicking earlier would correctly send a guest to /login.
    await screen.findByRole('button', { name: '帳戶' }, { timeout: 5000 });
    const buy = await screen.findByRole('button', { name: '立即購買' }, { timeout: 5000 });
    await waitFor(() => expect((buy as HTMLButtonElement).disabled).toBe(false), { timeout: 5000 });
    fireEvent.click(buy);
    await waitFor(() => expect(screen.getByRole('heading', { name: '結帳' })).toBeTruthy(), { timeout: 5000 });
  }, 15000);
});
