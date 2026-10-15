// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { api, tokenStore, resetMockData } from './api';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';
import App from './App';
import { Carousel } from './pages/Products';
import { recordSearch } from './lib/browsing';
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
beforeEach(() => {
  tokenStore.clear();
  resetMockData?.();
});
afterEach(() => {
  cleanup();
  tokenStore.clear();
});
describe('shopping draft flows', () => {
  it('keeps buy-now checkout separate from an existing cart through order placement', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    const before = await api.addCartItem('p_010', 2);
    renderAt('/products/p_007');
    await screen.findByRole('button', { name: '帳戶' }, { timeout: 5000 });
    fireEvent.click(await screen.findByRole('button', { name: '立即購買' }));
    const submit = await screen.findByRole('button', { name: '確認下單' });
    expect(screen.queryByText('鋁合金手機架')).toBeNull();
    fireEvent.click(submit);
    await screen.findByRole('button', { name: '模擬付款成功' }, { timeout: 5000 });
    const o = (await api.listOrders()).items[0];
    expect(o.items).toHaveLength(1);
    expect(o.items[0].product_id).toBe('p_007');
    expect(await api.getCart()).toEqual(before);
  }, 15000);
  it('selects partial checkout and leaves unchecked items in the cart', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    await api.addCartItem('p_007', 1);
    await api.addCartItem('p_010', 1);
    renderAt('/cart');
    await screen.findByRole('button', { name: '帳戶' }, { timeout: 5000 });
    const check = await screen.findByRole('checkbox', { name: '選擇 鋁合金手機架' }, { timeout: 5000 });
    fireEvent.click(check);
    fireEvent.click(screen.getByRole('button', { name: '前往結帳' }));
    const submit = await screen.findByRole('button', { name: '確認下單' });
    fireEvent.click(submit);
    await screen.findByRole('button', { name: '模擬付款成功' }, { timeout: 5000 });
    expect((await api.getCart()).items.map((it) => it.product.id)).toEqual(['p_010']);
  }, 15000);
  it('keeps guest selected checkout working after merging into an existing account line', async () => {
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    await api.addCartItem('p_007', 1);
    tokenStore.clear();
    const guest = await api.addCartItem('p_007', 2);
    tokenStore.set(await api.login({ email: 'demo@example.com', password: 'demo1234' }));
    renderAt(`/checkout?items=${guest.items[0].id}`);
    const submit = await screen.findByRole('button', { name: '確認下單' }, { timeout: 5000 });
    fireEvent.click(submit);
    await screen.findByRole('button', { name: '模擬付款成功' }, { timeout: 5000 });
    expect((await api.listOrders()).items[0].items[0].quantity).toBe(3);
  }, 15000);
  it('allows gallery switching and supports a direct category URL with a 404 for unknown slugs', async () => {
    const { unmount } = renderAt('/products/p_001');
    const image = await screen.findByRole('img', { name: '手工陶瓷馬克杯' }, { timeout: 5000 });
    const first = image.getAttribute('src');
    fireEvent.click(screen.getByRole('button', { name: '商品圖片 2' }));
    expect(image.getAttribute('src')).not.toBe(first);
    unmount();
    const { unmount: second } = renderAt('/category/kitchen');
    await screen.findByRole('navigation', { name: '麵包屑' });
    await waitFor(() => expect(screen.getByRole('heading', { name: '廚房', level: 1 })).toBeTruthy());
    second();
    renderAt('/category/unknown');
    expect(screen.getByRole('heading', { name: '找不到分類（404）' })).toBeTruthy();
  }, 15000);
});

describe('discovery acceptance criteria', () => {
  it('moves banners in both directions and keeps the focused link attached after a keyboard change', () => {
    render(
      <MemoryRouter>
        <Carousel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '下一張推介' }));
    expect(screen.getByRole('link', { name: '文具新學期' }).getAttribute('href')).toBe('/category/stationery');
    fireEvent.click(screen.getByRole('button', { name: '上一張推介' }));
    const banner = screen.getByRole('link', { name: '秋日家居節' });
    banner.focus();
    fireEvent.keyDown(banner, { key: 'ArrowLeft' });
    expect(screen.getByRole('link', { name: '咖啡生活' })).toBe(banner);
    expect(document.activeElement).toBe(banner);
  });
  it('selects a suggestion from the search input with arrows and Enter', async () => {
    localStorage.removeItem('shop.searches.v1');
    recordSearch('文具');
    recordSearch('咖啡');
    renderAt('/');
    const input = screen.getAllByRole('searchbox', { name: '搜尋商品' })[0];
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByText('「文具」的搜尋結果');
    expect(input.getAttribute('value')).toBe('文具');
  });
  it('does not show recommendations as search results when no product matches', async () => {
    renderAt('/?q=%E5%AE%8C%E5%85%A8%E4%B8%8D%E5%AD%98%E5%9C%A8ZZZ');

    await screen.findByText('找不到符合條件的商品。');
    expect(screen.queryByRole('heading', { name: '猜你喜歡' })).toBeNull();
    expect(screen.queryByRole('link', { name: /A5 點格筆記本/ })).toBeNull();
  });

  it('clears the category route along with all query filters', async () => {
    renderAt('/category/kitchen?brand=Sample+Select');
    await screen.findByRole('heading', { name: '廚房', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: '清除所有篩選' }));
    await screen.findByRole('heading', { name: '精選好物', level: 1 });
    await screen.findAllByText('鋁合金手機架', {}, { timeout: 5000 });
  });
});
