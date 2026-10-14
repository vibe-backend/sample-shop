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

async function open() {
  tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
  renderAt('/account/addresses');
  return screen.findByRole('list', { name: '收貨地址' }, { timeout: 5000 });
}

describe('address book page (#44)', () => {
  it('sets default, edits and deletes with confirmation', async () => {
    const list = await open();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /設為預設/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('已設為預設地址'));
    expect((await api.listAddresses())[0].id).toBe('addr_office');

    fireEvent.click(screen.getByRole('button', { name: /^編輯 陳小明 中環/ }));
    const line1 = await screen.findByLabelText('詳細地址');
    expect((line1 as HTMLInputElement).value).toBe('中環皇后大道中 99 號 30 樓');
    fireEvent.change(line1, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存地址' }));
    expect(await screen.findByText('詳細地址最少 5 字')).toBeTruthy();
    expect(line1.getAttribute('aria-describedby')).toBe('addr-line1-err');
    fireEvent.change(line1, { target: { value: '中環德輔道中 8 號' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存地址' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('地址已更新'));
    expect((await api.listAddresses()).find((a) => a.id === 'addr_office')!.line1).toBe('中環德輔道中 8 號');

    fireEvent.click(screen.getByRole('button', { name: /^刪除 陳小明 中環德輔道/ }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg.textContent).toContain('這是預設地址');
    fireEvent.click(within(dlg).getByRole('button', { name: '刪除' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('地址已刪除'));
    const xs = await api.listAddresses();
    expect(xs).toHaveLength(1);
    expect(xs[0].is_default).toBe(true);
  }, 20000);

  it('hides 新增 and explains the limit at 20 addresses', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    for (let i = (await api.listAddresses()).length; i < 20; i++) await api.createAddress({ recipient: '測試', phone: '91234567', region: '九龍', line1: `測試街 ${i} 號地舖` });
    renderAt('/account/addresses');
    expect(await screen.findByText(/已達上限 20 個地址/, undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('20 / 20')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /新增地址/ })).toBeNull();
  }, 20000);
});
