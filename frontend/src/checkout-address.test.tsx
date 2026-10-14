// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const radio = (re: RegExp) => screen.getByRole('radio', { name: re });

describe('checkout delivery address (#29)', () => {
  it('preselects the default address, can switch, and snapshots it on the order', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    await api.addCartItem('p_007', 1);
    renderAt('/checkout');
    await screen.findByRole('radiogroup', { name: '收貨地址' }, { timeout: 5000 });
    expect(radio(/旺角/).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio(/中環/));
    expect(radio(/中環/).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '確認下單' }));
    await screen.findByText('訂單已成立', undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: '模擬付款成功' }));
    await screen.findByText('付款成功', undefined, { timeout: 5000 });
    expect(screen.getByText(/中環皇后大道中 99 號 30 樓/)).toBeTruthy();
  }, 20000);

  it('blocks ordering until an address is added, with field validation', async () => {
    tokenStore.set(await api.register({ email: `n${Date.now()}@example.com`, password: 'secret123', display_name: '新客' }));
    await api.addCartItem('p_007', 1);
    renderAt('/checkout');
    await screen.findByText('你還沒有收貨地址，請先新增才可下單。', undefined, { timeout: 5000 });
    expect((screen.getByRole('button', { name: '確認下單' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '新增收貨地址' }));
    const phone = await screen.findByLabelText('電話');
    fireEvent.change(phone, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存地址' }));
    expect(screen.getByText('請輸入 8 位香港電話號碼')).toBeTruthy();
    expect(document.getElementById('addr-region-err')?.textContent).toBe('請選擇地區');
    expect(screen.getByText('請輸入詳細地址')).toBeTruthy();
    expect(screen.queryByText('請輸入收件人')).toBeNull(); // prefilled with display name
  }, 20000);
});

describe('address radiogroup keyboard (#29 a11y)', () => {
  it('uses roving tabindex and arrow keys', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    await api.addCartItem('p_007', 1);
    renderAt('/checkout');
    const group = await screen.findByRole('radiogroup', { name: '收貨地址' }, { timeout: 5000 });
    const [home, office] = within(group).getAllByRole('radio');
    expect([home.tabIndex, office.tabIndex]).toEqual([0, -1]);
    fireEvent.keyDown(home, { key: 'ArrowDown' });
    expect(office.getAttribute('aria-checked')).toBe('true');
    expect([home.tabIndex, office.tabIndex]).toEqual([-1, 0]);
    expect(document.activeElement).toBe(office);
    fireEvent.keyDown(office, { key: 'Home' });
    expect(home.getAttribute('aria-checked')).toBe('true');
  }, 20000);

  it('links the missing-address hint to the order button', async () => {
    tokenStore.set(await api.register({ email: `m${Date.now()}@example.com`, password: 'secret123', display_name: '新客' }));
    await api.addCartItem('p_007', 1);
    renderAt('/checkout');
    const btn = await screen.findByRole('button', { name: '確認下單' }, { timeout: 5000 });
    expect(btn.getAttribute('aria-describedby')).toBe('need-address');
    expect(document.getElementById('need-address')?.textContent).toBe('請先新增收貨地址');
  }, 20000);
});
