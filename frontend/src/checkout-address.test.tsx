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
