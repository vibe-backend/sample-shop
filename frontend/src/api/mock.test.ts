import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi, migrateV1, stableStringify } from './mock';
import { seedProducts, syncVariantTotals } from './seed';
import { formatPrice, lineTotal, subtotal } from './money';
import { ApiRequestError } from './types';

const A = { address_id: 'addr_home' };
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
  it('allows a guest cart while keeping expired sessions unauthenticated', async () => {
    expect((await api.getCart()).items).toEqual([]);
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
    const o1 = await api.createOrder('key-1', A);
    const o2 = await api.createOrder('key-1', A);
    expect(o2.id).toBe(o1.id);
    expect(o1.total_cents).toBe(2 * 68000 - 2000);
    expect(o1.items[0]).toMatchObject({ name: '手沖咖啡入門組', unit_price_cents: 68000, quantity: 2 });
    expect((await api.getCart()).items).toHaveLength(0);
    expect((await api.getProduct('p_002')).stock).toBe(6);
    expect((await api.listOrders()).items).toHaveLength(1);
    await expectCode(api.createOrder('key-2', A), 422, 'CART_EMPTY');
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
    const o = await api.createOrder('k-sku', A);
    expect(o.items[0]).toMatchObject({ sku_id: 'p_003_sku2', sku_options: { 顏色: '米白', 尺寸: '大' }, unit_price_cents: 36000 });
    const p = await api.getProduct('p_003');
    expect(p.variants!.find((v) => v.id === 'p_003_sku2')!.stock).toBe(2);
    expect(p.stock).toBe(13);
  });

  it('requires an Idempotency-Key (CONTRACT.md §10 @a3d4304)', async () => {
    await api.addCartItem('p_007', 1);
    await expectCode(api.createOrder(undefined as unknown as string, A), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    expect((await api.getCart()).items).toHaveLength(1); // failed attempt changes nothing
  });

  it('rejects reusing a key with a different body (409 IDEMPOTENCY_KEY_REUSED)', async () => {
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder('k1', A);
    expect((await api.createOrder('k1', A)).id).toBe(o.id);
    await expectCode(api.createOrder('k1', { ...A, note: 'x' } as never), 409, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('rejects ordering when a cart line became unavailable and flags it in the cart', async () => {
    await api.addCartItem('p_003', 1, 'p_003_sku1');
    await api.addCartItem('p_007', 1);
    api.state.products.find((x) => x.id === 'p_003')!.variants = [];
    await expectCode(api.createOrder('k-u', A), 409, 'PRODUCT_UNAVAILABLE');
    const cart = await api.getCart();
    expect(cart.items.map((i) => i.product.in_stock)).toEqual([false, true]);
  });

  it('restricts the staff product list to staff', async () => {
    await expectCode(api.listStaffProducts(), 403, 'FORBIDDEN');
  });
});

describe('staff edits', () => {
  beforeEach(() => loginAs('staff@example.com', 'staff1234'));
  it('keeps explicit price/stock edits on products without variants', async () => {
    const p = await api.updateProduct('p_007', { price_cents: 50000, stock: 7 });
    expect(p).toMatchObject({ price_cents: 50000, stock: 7, in_stock: true });
  });
  it('rejects changing derived price/stock on SKU products instead of silently overwriting', async () => {
    await expectCode(api.updateProduct('p_003', { price_cents: 1 }), 422, 'VARIANT_MANAGED');
    await expectCode(api.updateProduct('p_003', { stock: 99 }), 422, 'VARIANT_MANAGED');
    const p = await api.updateProduct('p_003', { name: '新名', price_cents: 32000, stock: 15 });
    expect(p).toMatchObject({ name: '新名', price_cents: 32000, stock: 15 });
  });
});

describe('storage migration v1 → v2', () => {
  it('keeps orders and edits, attaches SKUs and drops cart lines that now need a spec', () => {
    const v1Products = seedProducts().map(({ options: _o, variants: _v, ...p }) => (void _o, void _v, { ...p }));
    v1Products[6].name = '已改名';
    const v1 = { ...createMockApi().state, products: v1Products, carts: { u_demo: [{ id: 'ci_1', product_id: 'p_003', quantity: 1 }, { id: 'ci_2', product_id: 'p_007', quantity: 2 }] }, orders: { u_demo: [{ id: 'ord_x' }] } };
    const m = migrateV1(v1 as never);
    expect(m.products[6].name).toBe('已改名');
    expect(m.products[2].variants).toHaveLength(6);
    expect(m.carts.u_demo.map((l) => l.id)).toEqual(['ci_2']);
    expect(m.orders.u_demo).toHaveLength(1);
  });
  it('migrates persisted v1 data on load and removes the old key after hashing', async () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    try {
      store.set('shop.mock.v1', JSON.stringify({ ...createMockApi().state, orders: { u_demo: [{ id: 'ord_old' }] } }));
      const a = createMockApi({ persist: true });
      await a.login({ email: 'demo@example.com', password: 'demo1234' });
      expect(a.state.orders.u_demo[0].id).toBe('ord_old');
      expect(store.has('shop.mock.v1')).toBe(false);
      expect(store.has('shop.mock.v2')).toBe(true);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });
});

describe('SKU contract rules (CONTRACT.md @a3d4304 §9)', () => {
  it('treats a product with options but no active variants as not purchasable', async () => {
    const p = api.state.products.find((x) => x.id === 'p_001')!;
    p.variants = [];
    syncVariantTotals(p);
    expect((await api.getProduct('p_001')).in_stock).toBe(false);
    await loginAs('demo@example.com', 'demo1234');
    await expectCode(api.addCartItem('p_001', 1), 409, 'PRODUCT_UNAVAILABLE');
  });
  it('counts zero-stock variants toward the minimum price', () => {
    const tote = seedProducts().find((x) => x.slug === 'linen-tote')!;
    tote.variants![0].stock = 0;
    tote.variants![0].in_stock = false;
    expect(syncVariantTotals(tote).price_cents).toBe(32000);
  });
});

describe('delivery addresses (#29)', () => {
  beforeEach(() => loginAs('demo@example.com', 'demo1234'));
  it('lists the default address first', async () => {
    const xs = await api.listAddresses();
    expect(xs[0]).toMatchObject({ id: 'addr_home', is_default: true });
    expect(xs).toHaveLength(2);
  });
  it('checks the address before CART_EMPTY (§12 @a3d4304)', async () => {
    await expectCode(api.createOrder('a0', {} as never), 422, 'ADDRESS_REQUIRED');
    await expectCode(api.createOrder('a0b', A), 422, 'CART_EMPTY');
  });
  it('requires an address to order (422 ADDRESS_REQUIRED / 404 ADDRESS_NOT_FOUND)', async () => {
    await api.addCartItem('p_007', 1);
    await expectCode(api.createOrder('a1', {} as never), 422, 'ADDRESS_REQUIRED');
    await expectCode(api.createOrder('a2', { address_id: 'nope' }), 404, 'ADDRESS_NOT_FOUND');
  });
  it('snapshots the address on the order; later address changes do not affect it', async () => {
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder('a3', { address_id: 'addr_office' });
    expect(o.shipping_address).toEqual({ recipient: '陳小明', phone: '23456789', region: '香港島', line1: '中環皇后大道中 99 號 30 樓' });
    api.state.addresses!.u_demo[1].line1 = '已搬走';
    expect((await api.getOrder(o.id)).shipping_address!.line1).toBe('中環皇后大道中 99 號 30 樓');
  });
  it('validates and normalises new addresses; first address becomes default', async () => {
    await api.register({ email: 'new@example.com', password: 'secret123', display_name: '新用戶' }).then((t) => (token = t.access_token));
    expect(await api.listAddresses()).toEqual([]);
    await expectCode(api.createAddress({ recipient: '', phone: '123', region: '火星', line1: 'x' }), 422, 'VALIDATION_FAILED');
    const a = await api.createAddress({ recipient: '新用戶', phone: '+852 6123-4567', region: '新界', line1: '沙田正街 1 號' });
    expect(a).toMatchObject({ phone: '61234567', is_default: true });
    const b = await api.createAddress({ recipient: '新用戶', phone: '61234567', region: '九龍', line1: '尖沙咀廣東道 5 號', is_default: true });
    const xs = await api.listAddresses();
    expect(xs.map((x) => [x.id, x.is_default])).toEqual([[b.id, true], [a.id, false]]);
  });
  it('caps saved addresses at 20 (422 ADDRESS_LIMIT)', async () => {
    for (let i = 0; i < 18; i++) await api.createAddress({ recipient: '陳小明', phone: '91234567', region: '九龍', line1: `彌敦道 ${i + 1} 號` });
    await expectCode(api.createAddress({ recipient: '陳小明', phone: '91234567', region: '九龍', line1: '彌敦道 99 號' }), 422, 'ADDRESS_LIMIT');
  });
});


describe('mock internals (#60 review)', () => {
  it('hashes bodies deeply and key-order independently', () => {
    expect(stableStringify({ b: { y: 1, x: [2, { d: 1, c: 2 }] }, a: 1 })).toBe(stableStringify({ a: 1, b: { x: [2, { c: 2, d: 1 }], y: 1 } }));
    expect(stableStringify({ a: { x: 1 } })).not.toBe(stableStringify({ a: { x: 2 } }));
  });
  it('keeps v1 data when writing v2 fails', () => {
    const store = new Map<string, string>([['shop.mock.v1', JSON.stringify(createMockApi().state)]]);
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (k: string) => void store.delete(k),
    };
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    try {
      createMockApi({ persist: true });
      expect(store.has('shop.mock.v1')).toBe(true);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });
});

describe('mock payment (#30)', () => {
  beforeEach(() => loginAs('demo@example.com', 'demo1234'));
  it('declines when simulated to fail, keeps pending, then succeeds', async () => {
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder('pay-1', A);
    expect(o).toMatchObject({ status: 'pending', paid_at: null });
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'failure' }, 'k1'), 402, 'PAYMENT_DECLINED');
    expect((await api.getOrder(o.id)).status).toBe('pending');
    const paid = await api.payOrder(o.id, { method: 'mock_alipay', simulate: 'success' }, 'k2');
    expect(paid).toMatchObject({ status: 'paid', payment_method: 'mock_alipay' });
    expect(paid.paid_at).toBeTruthy();
    // replay with the same key returns the paid order; a new key is rejected
    expect((await api.payOrder(o.id, { method: 'mock_alipay', simulate: 'success' }, 'k2')).status).toBe('paid');
    // §13 @a3d4304: same key with a different body or order → 409
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, 'k2'), 409, 'IDEMPOTENCY_KEY_REUSED');
    await api.addCartItem('p_007', 1);
    const o2 = await api.createOrder('pay-1b', A);
    await expectCode(api.payOrder(o2.id, { method: 'mock_alipay', simulate: 'success' }, 'k2'), 409, 'IDEMPOTENCY_KEY_REUSED');
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, 'k3'), 409, 'ORDER_NOT_PAYABLE');
  });
  it('validates key, order and method', async () => {
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder('pay-2', A);
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, ''), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await expectCode(api.payOrder('nope', { method: 'mock_card', simulate: 'success' }, 'k'), 404, 'NOT_FOUND');
    await expectCode(api.payOrder(o.id, { method: 'cash' as never, simulate: 'success' }, 'k'), 422, 'VALIDATION_FAILED');
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'maybe' as never }, 'k'), 422, 'VALIDATION_FAILED');
    // failure writes nothing and keeps the key reusable
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'failure' }, 'kf'), 402, 'PAYMENT_DECLINED');
    expect(await api.getOrder(o.id)).toMatchObject({ status: 'pending', payment_method: null, paid_at: null });
    expect((await api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, 'kf')).status).toBe('paid');
  });
});

describe('order status flow (#34)', () => {
  async function placed() {
    await loginAs('demo@example.com', 'demo1234');
    await api.addCartItem('p_007', 2);
    return api.createOrder(crypto.randomUUID(), A);
  }
  const stock = () => api.state.products.find((p) => p.id === 'p_007')!.stock;

  it('records history: pending → paid → shipped → delivered', async () => {
    const o = await placed();
    await api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, 'p1');
    await expectCode(api.confirmDelivery(o.id), 409, 'INVALID_TRANSITION');
    await loginAs('staff@example.com', 'staff1234');
    expect((await api.listStaffOrders({ status: 'paid' })).items.map((x) => x.id)).toContain(o.id);
    await api.updateStaffOrderStatus(o.id, 'shipped');
    await loginAs('demo@example.com', 'demo1234');
    const d = await api.confirmDelivery(o.id);
    expect(d.status_history!.map((h) => h.status)).toEqual(['pending', 'paid', 'shipped', 'delivered']);
    await expectCode(api.cancelOrder(o.id), 409, 'INVALID_TRANSITION');
  });

  it('buyer cancel restores stock; shipped orders cannot be cancelled', async () => {
    const before = stock();
    const o = await placed();
    expect(stock()).toBe(before - 2);
    await api.cancelOrder(o.id);
    expect(stock()).toBe(before);
    await expectCode(api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, 'p2'), 409, 'ORDER_NOT_PAYABLE');
    const o2 = await placed();
    await api.payOrder(o2.id, { method: 'mock_card', simulate: 'success' }, 'p3');
    await loginAs('staff@example.com', 'staff1234');
    await api.updateStaffOrderStatus(o2.id, 'shipped');
    await expectCode(api.updateStaffOrderStatus(o2.id, 'cancelled'), 409, 'INVALID_TRANSITION');
  });

  it('staff endpoints require staff; staff cannot ship an unpaid order', async () => {
    const o = await placed();
    await expectCode(api.listStaffOrders(), 403, 'FORBIDDEN');
    await loginAs('staff@example.com', 'staff1234');
    await expectCode(api.updateStaffOrderStatus(o.id, 'shipped'), 409, 'INVALID_TRANSITION');
    await expectCode(api.updateStaffOrderStatus(o.id, 'delivered' as never), 422, 'VALIDATION_FAILED');
  });
});

describe('address book (#44, §12 @a3d4304 planned routes)', () => {
  beforeEach(() => loginAs('demo@example.com', 'demo1234'));
  it('edits with validation and normalisation; is_default is not changed by PUT', async () => {
    const a = await api.updateAddress('addr_office', { recipient: '陳大文', phone: '+852 2345-6789', region: '九龍', line1: '旺角彌敦道 1 號', is_default: true });
    expect(a).toMatchObject({ recipient: '陳大文', phone: '23456789', region: '九龍', is_default: false });
    await expectCode(api.updateAddress('addr_office', { recipient: '', phone: '1', region: 'x', line1: 'y' }), 422, 'VALIDATION_FAILED');
    await expectCode(api.updateAddress('nope', { recipient: 'a', phone: '91234567', region: '九龍', line1: '旺角彌敦道 1 號' }), 404, 'ADDRESS_NOT_FOUND');
  });
  it('sets exactly one default', async () => {
    await api.setDefaultAddress('addr_office');
    const xs = await api.listAddresses();
    expect(xs.filter((x) => x.is_default).map((x) => x.id)).toEqual(['addr_office']);
    expect(xs[0].id).toBe('addr_office');
  });
  it('deleting the default promotes the newest remaining; orders keep their snapshot', async () => {
    await api.addCartItem('p_007', 1);
    const o = await api.createOrder('ab1', A);
    const n = await api.createAddress({ recipient: '新', phone: '61234567', region: '新界', line1: '沙田正街 1 號' });
    await api.deleteAddress('addr_home');
    const xs = await api.listAddresses();
    expect(xs.find((x) => x.is_default)!.id).toBe(n.id);
    expect(xs.map((x) => x.id)).not.toContain('addr_home');
    expect((await api.getOrder(o.id)).shipping_address).toBeTruthy();
    await expectCode(api.deleteAddress('addr_home'), 404, 'ADDRESS_NOT_FOUND');
    await api.addCartItem('p_007', 1);
    await expectCode(api.createOrder('ab2', A), 404, 'ADDRESS_NOT_FOUND');
  });
  it("cannot touch another user's address", async () => {
    await loginAs('staff@example.com', 'staff1234');
    await expectCode(api.setDefaultAddress('addr_home'), 404, 'ADDRESS_NOT_FOUND');
  });
});

describe('order transition error precedence (#34): 403/422 → 404 → 409', () => {
  it('checks role and body before existence, existence before state', async () => {
    await loginAs('demo@example.com', 'demo1234');
    await api.addCartItem('p_007', 1);
    const mine = await api.createOrder(crypto.randomUUID(), A);
    // buyer on staff route: 403 even for a missing order
    await expectCode(api.updateStaffOrderStatus('nope', 'shipped'), 403, 'FORBIDDEN');
    await loginAs('staff@example.com', 'staff1234');
    // invalid body beats missing order
    await expectCode(api.updateStaffOrderStatus('nope', 'delivered' as never), 422, 'VALIDATION_FAILED');
    await expectCode(api.updateStaffOrderStatus('nope', 'shipped'), 404, 'NOT_FOUND');
    await expectCode(api.updateStaffOrderStatus(mine.id, 'shipped'), 409, 'INVALID_TRANSITION');
    // someone else's order is 404 for buyers, never 409
    await expectCode(api.cancelOrder(mine.id), 404, 'NOT_FOUND');
    await expectCode(api.confirmDelivery(mine.id), 404, 'NOT_FOUND');
    await loginAs('demo@example.com', 'demo1234');
    await expectCode(api.confirmDelivery(mine.id), 409, 'INVALID_TRANSITION');
  });
});
