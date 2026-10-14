// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

async function paidOrder() {
  tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
  await api.addCartItem('p_007', 1);
  const o = await api.createOrder(crypto.randomUUID(), { address_id: 'addr_home' });
  return api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, crypto.randomUUID());
}

describe('order status flow UI (#34)', () => {
  it('shows progress with aria-current and lets the buyer cancel a paid order after confirming', async () => {
    const o = await paidOrder();
    renderAt(`/orders/${o.id}`);
    const progress = await screen.findByRole('list', { name: '訂單進度' }, { timeout: 5000 });
    expect(progress.querySelector('[aria-current="step"]')!.textContent).toContain('已付款');
    fireEvent.click(screen.getByRole('button', { name: '取消訂單' }));
    fireEvent.click(await screen.findByRole('button', { name: '確定取消' }));
    await screen.findByText('訂單已取消', { selector: 'p' }, { timeout: 5000 });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('訂單已取消'));
    await waitFor(() => expect(screen.queryByRole('button', { name: '取消訂單' })).toBeNull());
    expect((await api.getOrder(o.id)).status).toBe('cancelled');
  }, 20000);

  it('staff ships, then the buyer confirms delivery', async () => {
    const o = await paidOrder();
    tokenStore.set(await api.login({ email: 'staff@example.com', password: 'staff1234' }));
    renderAt('/staff/orders');
    fireEvent.click(await screen.findByRole('button', { name: `訂單 #${o.id} 標示出貨` }, { timeout: 5000 }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('已出貨'), { timeout: 5000 });
    cleanup();
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    expect((await api.getOrder(o.id)).status).toBe('shipped');
    renderAt(`/orders/${o.id}`);
    fireEvent.click(await screen.findByRole('button', { name: '確認收貨' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '確認收貨' }));
    await waitFor(async () => expect((await api.getOrder(o.id)).status).toBe('delivered'), { timeout: 5000 });
    expect(await screen.findByText('訂單記錄')).toBeTruthy();
  }, 20000);
});
