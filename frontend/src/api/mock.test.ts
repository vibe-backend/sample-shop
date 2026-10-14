import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from './mock';
import { formatPrice, lineTotal, subtotal } from './money';
import { ApiRequestError } from './types';

let token: string | null = null;
let api: ReturnType<typeof createMockApi>;

async function loginAs(email: string, password: string) {
  token = (await api.login({ email, password })).access_token;
}

async function expectCode(p: Promise<unknown>, status: number, code: string) {
  const e = await p.catch((x) => x);
  expect(e).toBeInstanceOf(ApiRequestError);
  expect(e).toMatchObject({ status, code });
}

beforeEach(() => {
  token = null;
  api = createMockApi({ getToken: () => token });
});

describe('money', () => {
  it('computes line totals and subtotals in cents', () => {
    expect(lineTotal(18800, 3)).toBe(56400);
    expect(subtotal([{ line_total_cents: 56400 }, { line_total_cents: 9800 }])).toBe(66200);
  });
  it('formats price from cents', () => {
    expect(formatPrice(18800, 'HKD')).toMatch(/188\.00/);
  });
});

describe('auth', () => {
  it('rejects bad credentials with 401 INVALID_CREDENTIALS', async () => {
    await expectCode(api.login({ email: 'demo@example.com', password: 'nope' }), 401, 'INVALID_CREDENTIALS');
  });
  it('returns token + expiry and /me', async () => {
    const t = await api.login({ email: 'staff@example.com', password: 'staff1234' });
    expect(Date.parse(t.expires_at)).toBeGreaterThan(Date.now());
    token = t.access_token;
    expect(await api.me()).toMatchObject({ email: 'staff@example.com', roles: ['staff'] });
  });
  it('requires a token for the cart', async () => {
    await expectCode(api.getCart(), 401, 'UNAUTHENTICATED');
  });
  it('rejects duplicate registration', async () => {
    await expectCode(api.register({ email: 'demo@example.com', password: 'longenough', display_name: 'x' }), 409, 'EMAIL_TAKEN');
  });
});

describe('catalog', () => {
  it('hides inactive products from customers but not staff', async () => {
    const pub = await api.listProducts({ limit: 100 });
    expect(pub.items.every((p) => p.active)).toBe(true);
    await loginAs('staff@example.com', 'staff1234');
    const all = await api.listProducts({ limit: 100 });
    expect(all.items.some((p) => !p.active)).toBe(true);
  });
  it('pages with next_cursor until exhausted', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await api.listProducts({ limit: 5, cursor });
      seen.push(...p.items.map((x) => x.id));
      cursor = p.next_cursor ?? undefined;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(12);
  });
  it('filters and sorts by price', async () => {
    const p = await api.listProducts({ min_price_cents: 10000, max_price_cents: 50000, sort: 'price_asc', limit: 100 });
    const prices = p.items.map((x) => x.price_cents);
    expect(prices.every((c) => c >= 10000 && c <= 50000)).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('cart and orders', () => {
  beforeEach(() => loginAs('demo@example.com', 'demo1234'));

  it('increments quantity when the same product is added again', async () => {
    await api.addCartItem('p_007', 2);
    const cart = await api.addCartItem('p_007', 1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.items[0].line_total_cents).toBe(3 * 42000);
  });

  it('keeps subtotal equal to the sum of line totals', async () => {
    await api.addCartItem('p_007', 2);
    const cart = await api.addCartItem('p_004', 3);
    expect(cart.subtotal_cents).toBe(2 * 42000 + 3 * 9800);
    const updated = await api.updateCartItem(cart.items[1].id, 1);
    expect(updated.subtotal_cents).toBe(2 * 42000 + 9800);
  });

  it('rejects out-of-stock with 409 OUT_OF_STOCK', async () => {
    await expectCode(api.addCartItem('p_005', 1), 409, 'OUT_OF_STOCK');
    await expectCode(api.addCartItem('p_008', 4), 409, 'OUT_OF_STOCK');
  });

  it('creates an order idempotently, snapshots items, clears the cart and decrements stock', async () => {
    await api.addCartItem('p_002', 2);
    const o1 = await api.createOrder('key-1');
    const o2 = await api.createOrder('key-1');
    expect(o2.id).toBe(o1.id);
    expect(o1.total_cents).toBe(2 * 68000);
    expect(o1.items[0]).toMatchObject({ name: '手沖咖啡入門組', unit_price_cents: 68000, quantity: 2 });
    expect((await api.getCart()).items).toHaveLength(0);
    expect((await api.getProduct('p_002')).stock).toBe(6);
    expect((await api.listOrders()).items).toHaveLength(1);
    await expectCode(api.createOrder('key-2'), 422, 'CART_EMPTY');
  });

  it('forbids product management for non-staff', async () => {
    await expectCode(api.deleteProduct('p_001'), 403, 'FORBIDDEN');
  });

  it('requires a SKU for products with variants (422 SKU_REQUIRED)', async () => {
    await expectCode(api.addCartItem('p_003', 1), 422, 'SKU_REQUIRED');
    await expectCode(api.addCartItem('p_003', 1, 'nope'), 404, 'SKU_NOT_FOUND');
  });

  it('lists different SKUs of one product as separate cart lines with SKU price', async () => {
    await api.addCartItem('p_003', 1, 'p_003_sku1');
    await api.addCartItem('p_003', 1, 'p_003_sku2');
    const cart = await api.addCartItem('p_003', 1, 'p_003_sku1');
    expect(cart.items).toHaveLength(2);
    expect(cart.items[0]).toMatchObject({ quantity: 2, sku: { id: 'p_003_sku1', options: { 顏色: '米白', 尺寸: '標準' } }, line_total_cents: 64000 });
    expect(cart.items[1]).toMatchObject({ quantity: 1, sku: { options: { 尺寸: '大' } }, line_total_cents: 36000 });
  });

  it('checks stock per SKU', async () => {
    await expectCode(api.addCartItem('p_003', 1, 'p_003_sku4'), 409, 'OUT_OF_STOCK');
    await expectCode(api.addCartItem('p_003', 7, 'p_003_sku1'), 409, 'OUT_OF_STOCK');
  });

  it('snapshots SKU options on orders and decrements SKU stock', async () => {
    await api.addCartItem('p_003', 2, 'p_003_sku2');
    const o = await api.createOrder('k-sku');
    expect(o.items[0]).toMatchObject({ sku_id: 'p_003_sku2', sku_options: { 顏色: '米白', 尺寸: '大' }, unit_price_cents: 36000 });
    const p = await api.getProduct('p_003');
    expect(p.variants!.find((v) => v.id === 'p_003_sku2')!.stock).toBe(2);
    expect(p.stock).toBe(13);
  });

  it('places an order without an Idempotency-Key', async () => {
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder();
    expect(o.total_cents).toBe(42000);
  });

  it('restricts the staff product list to staff', async () => {
    await expectCode(api.listStaffProducts(), 403, 'FORBIDDEN');
  });
});
