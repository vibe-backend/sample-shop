// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { api, tokenStore } from './api';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';

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

describe('mock payment (#30)', () => {
  it('checkout → choose 模擬支付寶 → failure keeps 待付款 and allows retry → success marks 已付款', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    await api.addCartItem('p_007', 1);
    renderAt('/checkout');
    fireEvent.click(await screen.findByRole('radio', { name: /模擬支付寶/ }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: '確認下單' }));
    await screen.findByText('訂單已成立', undefined, { timeout: 5000 });
    expect(screen.getByRole('radio', { name: /模擬支付寶/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '模擬付款失敗' }));
    expect((await screen.findByRole('alert', undefined, { timeout: 5000 })).textContent).toContain('付款失敗');
    const orders = await api.listOrders();
    expect(orders.items[0].status).toBe('pending');

    fireEvent.click(screen.getByRole('button', { name: '重試：模擬付款成功' }));
    await screen.findByText('付款成功', undefined, { timeout: 5000 });
    expect(screen.getByText('已付款')).toBeTruthy();
    expect(screen.getByText(/以模擬支付寶付款/)).toBeTruthy();
  }, 25000);

  it('pending orders show 去付款 on the order detail page', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder(crypto.randomUUID(), { address_id: 'addr_home' });
    renderAt(`/orders/${o.id}`);
    const link = await screen.findByRole('link', { name: '去付款' }, { timeout: 5000 });
    expect(link.getAttribute('href')).toBe(`/orders/${o.id}/pay`);
    expect(screen.getByText('待付款')).toBeTruthy();
  }, 15000);
});
