// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { api, tokenStore } from './api';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';
import { Carousel, ProductCard } from './pages/Products';
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
    const { unmount } = render(<MemoryRouter><AuthProvider><ProductCard p={p} /></AuthProvider></MemoryRouter>);
    expect(screen.getByText(`已售 ${p.sold_count}`)).toBeTruthy();
    expect(screen.getByText('420.00').parentElement!.className).toContain('text-price');
    unmount();
    render(<MemoryRouter><AuthProvider><ProductCard p={{ ...p, sold_count: undefined }} /></AuthProvider></MemoryRouter>);
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

  it('立即購買 goes to an isolated checkout', async () => {
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

describe('carousel a11y (WCAG 2.2.2)', () => {
  it('has a pause/play control and switches aria-live when paused', () => {
    render(<MemoryRouter><Carousel /></MemoryRouter>);
    const slide = screen.getByRole('region', { name: '推介' }).querySelector('[aria-roledescription="slide"]')!;
    expect(slide.getAttribute('aria-live')).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: '暫停輪播' }));
    expect(screen.getByRole('button', { name: '播放輪播' })).toBeTruthy();
    expect(slide.getAttribute('aria-live')).toBe('polite');
  });
  it('pauses while hovered', () => {
    render(<MemoryRouter><Carousel /></MemoryRouter>);
    const region = screen.getByRole('region', { name: '推介' });
    fireEvent.mouseEnter(region);
    expect(region.querySelector('[aria-roledescription="slide"]')!.getAttribute('aria-live')).toBe('polite');
  });
});
