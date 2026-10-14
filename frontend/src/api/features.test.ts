import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from './mock';
import { checkoutTotals } from '../lib/commerce';
import { ApiRequestError, type CreateOrderInput } from './types';
let token: string | null;
let time: number;
let api: ReturnType<typeof createMockApi>;
const address = { address_id: 'addr_home' };
const customer = () => login('demo@example.com', 'demo1234');
const staff = () => login('staff@example.com', 'staff1234');
async function login(email: string, password: string) {
  token = (await api.login({ email, password })).access_token;
}
async function order(body: Partial<CreateOrderInput> = {}) {
  await api.addCartItem('p_007', 1);
  return api.createOrder(crypto.randomUUID(), { ...address, ...body });
}
async function delivered() {
  await customer();
  const o = await order();
  await api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, crypto.randomUUID());
  await staff();
  await api.updateStaffOrderStatus(o.id, 'shipped');
  await customer();
  return api.confirmDelivery(o.id);
}
async function code(p: Promise<unknown>, expected: string) {
  await expect(p).rejects.toMatchObject({ code: expected });
}
beforeEach(() => {
  token = null;
  time = Date.UTC(2026, 9, 14, 12);
  api = createMockApi({ getToken: () => token, now: () => time });
});

describe('checkout and inventory', () => {
  it('merges guest quantities into the account once, preserving SKUs', async () => {
    await customer();
    await api.addCartItem('p_001', 2, 'p_001_sku1');
    token = null;
    await api.addCartItem('p_001', 3, 'p_001_sku1');
    await api.addCartItem('p_001', 1, 'p_001_sku2');
    await customer();
    const c = await api.getCart();
    expect(c.items.map((i) => i.quantity)).toEqual([5, 1]);
    await customer();
    expect((await api.getCart()).items.map((i) => i.quantity)).toEqual([5, 1]);
  });
  it('buy now leaves the existing cart intact and validates the selected SKU', async () => {
    await customer();
    const before = await api.addCartItem('p_007', 2);
    const o = await api.createOrder('buy', {
      ...address,
      buy_now: { product_id: 'p_001', sku_id: 'p_001_sku1', quantity: 1 },
    });
    expect(o.items).toHaveLength(1);
    expect(o.items[0].sku_id).toBe('p_001_sku1');
    expect(await api.getCart()).toEqual(before);
    await code(
      api.createOrder('no-sku', { ...address, buy_now: { product_id: 'p_001', quantity: 1 } }),
      'SKU_REQUIRED',
    );
  });
  it('checks out only selected lines, rejects invalid selections and replays the order', async () => {
    await customer();
    await api.addCartItem('p_007', 1);
    const c = await api.addCartItem('p_010', 1);
    const body = { ...address, item_ids: [c.items[1].id] };
    const o = await api.createOrder('selected', body);
    expect(o.items[0].product_id).toBe('p_010');
    expect((await api.getCart()).items[0].product.id).toBe('p_007');
    expect((await api.createOrder('selected', body)).id).toBe(o.id);
    await code(api.createOrder('invalid', { ...address, item_ids: ['wrong'] }), 'VALIDATION_FAILED');
  });
  it('reserves pending stock, commits it on payment, restores it once on cancellation', async () => {
    await customer();
    const stock = api.state.products[6].stock;
    const a = await order();
    const b = await order();
    expect(api.state.products[6].reserved_stock).toBe(2);
    await api.payOrder(a.id, { method: 'mock_card', simulate: 'success' }, 'pay');
    expect(api.state.products[6].reserved_stock).toBe(1);
    await api.cancelOrder(a.id);
    expect(api.state.products[6].reserved_stock).toBe(1);
    await api.cancelOrder(b.id);
    expect(api.state.products[6].stock).toBe(stock);
    expect(api.state.products[6].reserved_stock).toBe(0);
    await code(api.cancelOrder(b.id), 'INVALID_TRANSITION');
  });
  it('expires unpaid orders before payment and makes simultaneous cancellation/payment exclusive', async () => {
    await customer();
    const o = await order();
    time += 30 * 60000;
    await code(api.payOrder(o.id, { method: 'mock_card', simulate: 'success' }, 'late'), 'ORDER_NOT_PAYABLE');
    expect((await api.getOrder(o.id)).status).toBe('cancelled');
    expect(api.state.products[6].reserved_stock).toBe(0);
    const live = await order();
    const results = await Promise.allSettled([
      api.cancelOrder(live.id),
      api.payOrder(live.id, { method: 'mock_card', simulate: 'success' }, 'race'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('reports stock and price changes without removing the cart line', async () => {
    await customer();
    await api.addCartItem('p_007', 2);
    api.state.products[6].stock = 1;
    api.state.products[6].price_cents += 500;
    const c = await api.getCart();
    expect(c.items[0]).toMatchObject({ stock: 1, price_changed: true, original_price_cents: 42000 });
    await code(api.createOrder('stock', address), 'OUT_OF_STOCK');
    api.state.products[6].active = false;
    expect((await api.getCart()).items[0].unavailable).toBe(true);
  });
  it('applies shipping, promotion, coupon and points using integer cents', async () => {
    await customer();
    await api.claimCoupon('save50');
    await api.addCartItem('p_002', 1);
    api.state.wallets = { u_demo: { balance: 100, entries: [] } };
    const coupon = (await api.listCoupons()).find((c) => c.id === 'save50')!;
    const o = await api.createOrder('totals', {
      ...address,
      shipping_method: 'courier',
      coupon_id: 'save50',
      points: 10,
      note: '請在下午送貨',
    });
    expect(o).toMatchObject(checkoutTotals(68000, 'courier', coupon, 10));
    expect(o.note).toBe('請在下午送貨');
    expect((await api.wallet()).balance).toBe(90);
    await api.addCartItem('p_010', 2);
    await code(api.createOrder('reuse', { ...address, coupon_id: 'save50' }), 'COUPON_INVALID');
    await api.cancelOrder(o.id);
    expect((await api.wallet()).balance).toBe(100);
  });
  it('rejects expired/unclaimed coupons and excessive points without writing orders', async () => {
    await customer();
    await api.addCartItem('p_007', 1);
    await code(api.createOrder('claim', { ...address, coupon_id: 'welcome' }), 'COUPON_INVALID');
    await api.claimCoupon('welcome');
    time += 31 * 86400000;
    await customer();
    await code(api.createOrder('expiry', { ...address, coupon_id: 'welcome' }), 'COUPON_INVALID');
    api.state.wallets = { u_demo: { balance: 100, entries: [] } };
    await code(api.createOrder('points', { ...address, points: 100 }), 'POINTS_LIMIT');
    expect((await api.listOrders()).items).toHaveLength(0);
  });
  it('shows timed campaigns, limits quantities and returns to the base price at expiry', async () => {
    await customer();
    expect((await api.getProduct('p_006')).price_cents).toBe(99000);
    await code(api.addCartItem('p_006', 4), 'OUT_OF_STOCK');
    await api.addCartItem('p_006', 3);
    await api.createOrder('campaign', address);
    expect((await api.getProduct('p_006')).in_stock).toBe(false);
    time += 3 * 86400000;
    expect((await api.getProduct('p_006')).price_cents).toBe(128000);
  });
});

describe('buyer account and community', () => {
  it('stores only salted password verifiers and changes credentials', async () => {
    await customer();
    expect(api.state.users[0].password).toBeUndefined();
    expect(api.state.users[0].password_hash).toMatch(/^pbkdf2\$/);
    await code(api.changePassword('wrong', 'newpass123'), 'INVALID_CREDENTIALS');
    await api.changePassword('demo1234', 'newpass123');
    await code(api.login({ email: 'demo@example.com', password: 'demo1234' }), 'INVALID_CREDENTIALS');
    await login('demo@example.com', 'newpass123');
    await api.updateMe({ display_name: '新名字' });
    expect((await api.me()).display_name).toBe('新名字');
  });
  it('resets with a single-use expiring code and hides account existence', async () => {
    const known = await api.requestPasswordReset('demo@example.com');
    const unknown = await api.requestPasswordReset('absent@example.com');
    expect(unknown.message).toBe(known.message);
    expect(unknown.demo_code).toHaveLength(6);
    await code(api.resetPassword('demo@example.com', 'invalid', 'reset1234'), 'INVALID_RESET_CODE');
    await api.resetPassword('demo@example.com', known.demo_code!, 'reset1234');
    await login('demo@example.com', 'reset1234');
    await code(api.resetPassword('demo@example.com', known.demo_code!, 'other1234'), 'INVALID_RESET_CODE');
    const expired = await api.requestPasswordReset('demo@example.com');
    time += 11 * 60000;
    await code(api.resetPassword('demo@example.com', expired.demo_code!, 'next1234'), 'INVALID_RESET_CODE');
  });
  it('keeps favorites and coupons isolated per user and exposes inactive favorites', async () => {
    await customer();
    await api.setFavorite('p_007', true);
    await api.claimCoupon('welcome');
    await code(api.claimCoupon('welcome'), 'COUPON_CLAIMED');
    api.state.products[6].active = false;
    expect((await api.listFavorites())[0].active).toBe(false);
    await staff();
    expect(await api.listFavorites()).toEqual([]);
    expect((await api.listCoupons())[0].claimed).toBeUndefined();
  });
  it('requires delivered ownership for reviews, prevents duplicates and updates rating sort', async () => {
    const o = await delivered();
    await code(
      api.createReview('p_010', { order_id: o.id, item_index: 0, rating: 5, text: '', images: [] }),
      'REVIEW_NOT_ALLOWED',
    );
    const input = { order_id: o.id, item_index: 0, rating: 4, text: '實用', images: [] };
    await api.createReview('p_007', input);
    await code(api.createReview('p_007', input), 'REVIEW_EXISTS');
    expect((await api.getProduct('p_007')).rating_avg).toBe(4);
    expect((await api.listProducts({ sort: 'rating_desc' })).items[0].id).toBe('p_007');
    expect((await api.orderCounts()).needs_review).toBe(0);
    await staff();
    await code(api.createReview('p_007', input), 'NOT_FOUND');
  });
  it('paginates reviews and filters image reviews', async () => {
    api.state.reviews = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      product_id: 'p_007',
      order_id: String(i),
      item_index: 0,
      rating: 4,
      text: '',
      images: i % 2 ? ['https://example.com/image.png'] : [],
      author: '買家',
      created_at: new Date(time).toISOString(),
    }));
    const page = await api.listReviews('p_007');
    expect(page.items).toHaveLength(5);
    expect((await api.listReviews('p_007', { cursor: page.next_cursor! })).items).toHaveLength(2);
    expect((await api.listReviews('p_007', { images_only: true })).items).toHaveLength(3);
  });
  it('allows questions from buyers and answers only from staff or delivered buyers', async () => {
    await customer();
    await code(api.askQuestion('p_007', ' '), 'VALIDATION_FAILED');
    const q = await api.askQuestion('p_007', '幾大？');
    await code(api.answerQuestion(q.id, '大'), 'FORBIDDEN');
    await staff();
    const answered = await api.answerQuestion(q.id, '約 10 cm');
    expect(answered.answers[0].staff).toBe(true);
  });
  it('awards points once on delivery and hides completed orders only for their buyer', async () => {
    const o = await delivered();
    expect((await api.wallet()).balance).toBe(420);
    await code(api.confirmDelivery(o.id), 'INVALID_TRANSITION');
    const pending = await order();
    await code(api.hideOrder(pending.id), 'INVALID_TRANSITION');
    await api.hideOrder(o.id);
    expect((await api.listOrders()).items.map((o) => o.id)).not.toContain(o.id);
    await staff();
    expect((await api.listStaffOrders()).items.map((o) => o.id)).toContain(o.id);
  });
});

describe('after-sales and SKU permissions', () => {
  it('requires approval before a return shipment, enforces ownership and refunds once', async () => {
    const o = await delivered();
    const s = await api.createAfterSale({
      order_id: o.id,
      item_index: 0,
      type: 'return',
      reason: '無理由退貨',
      description: '',
      images: [],
    });
    await code(api.submitReturnShipment(s.id, '快遞', '123'), 'INVALID_TRANSITION');
    await code(api.decideAfterSale(s.id, 'approved', '同意'), 'FORBIDDEN');
    await staff();
    await api.decideAfterSale(s.id, 'approved', '同意退貨');
    await code(api.decideAfterSale(s.id, 'refunded', '退款'), 'RETURN_SHIPMENT_REQUIRED');
    await customer();
    await api.submitReturnShipment(s.id, '示範快遞', '123');
    await code(
      api.createAfterSale({
        order_id: o.id,
        item_index: 0,
        type: 'return',
        reason: '商品問題',
        description: '',
        images: [],
      }),
      'AFTERSALE_EXISTS',
    );
    await staff();
    await api.decideAfterSale(s.id, 'refunded', '已收退件');
    await code(api.decideAfterSale(s.id, 'refunded', '重試'), 'INVALID_TRANSITION');
    await customer();
    expect((await api.getOrder(o.id)).refunded_cents).toBe(42000);
  });
  it('rejects no-reason returns after seven days and refunds discounted merchandise correctly', async () => {
    const o = await delivered();
    time += 8 * 86400000;
    await customer();
    await code(
      api.createAfterSale({
        order_id: o.id,
        item_index: 0,
        type: 'return',
        reason: '無理由退貨',
        description: '',
        images: [],
      }),
      'RETURN_WINDOW_EXPIRED',
    );
    await api.addCartItem('p_002', 1);
    const discounted = await api.createOrder('refund', { ...address, shipping_method: 'courier' });
    await api.payOrder(discounted.id, { method: 'mock_card', simulate: 'success' }, 'pay');
    const s = await api.createAfterSale({
      order_id: discounted.id,
      item_index: 0,
      type: 'refund',
      reason: '商品問題',
      description: '',
      images: [],
    });
    expect(s.amount_cents).toBe(66000);
  });
  it('validates SKU options and optimistic versions, and hides inactive variants from buyers', async () => {
    await customer();
    await code(api.listVariants('p_001'), 'FORBIDDEN');
    await staff();
    const v = (await api.listVariants('p_001'))[0];
    await code(api.updateVariant('p_001', v.id, { stock: 10 }, 99), 'PRECONDITION_FAILED');
    await code(
      api.createVariant('p_001', { options: { 顏色: '紫色' }, price_cents: 10, stock: 1, active: true }),
      'VALIDATION_FAILED',
    );
    const changed = await api.updateVariant('p_001', v.id, { active: false }, 1);
    expect(changed.version).toBe(2);
    await customer();
    expect((await api.getProduct('p_001')).variants?.some((x) => x.id === v.id)).toBe(false);
    await code(api.addCartItem('p_001', 1, v.id), 'SKU_NOT_FOUND');
  });
  it('rejects options that invalidate active SKUs and preserves order snapshots', async () => {
    await customer();
    await api.addCartItem('p_001', 1, 'p_001_sku1');
    const o = await api.createOrder('sku', address);
    await staff();
    await code(api.updateProduct('p_001', { options: [{ name: '顏色', values: ['墨黑'] }] }), 'OPTIONS_IN_USE');
    await api.updateVariant('p_001', 'p_001_sku1', { price_cents: 99999 }, 1);
    await customer();
    expect((await api.getOrder(o.id)).items[0].unit_price_cents).toBe(18800);
  });
});

it('rejects invalid cursors as API errors', async () => {
  await expect(api.listReviews('p_007', { cursor: 'bad!' })).rejects.toBeInstanceOf(ApiRequestError);
});

it('migrates persisted plaintext credentials without storing passwords or sessions', async () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    store.set('shop.mock.v2', JSON.stringify({ ...api.state, sessions: {} }));
    const persisted = createMockApi({ persist: true });
    await persisted.register({ email: 'registered@example.com', display_name: 'New', password: 'secret123' });
    const data = JSON.parse(store.get('shop.mock.v2')!);
    expect(data.users.every((u: { password?: string; password_hash?: string }) => !u.password && u.password_hash)).toBe(
      true,
    );
    expect(data.sessions).toEqual({});
    expect(store.get('shop.mock.v2')).not.toContain('secret123');
    const reloaded = createMockApi({ persist: true });
    await expect(reloaded.login({ email: 'registered@example.com', password: 'secret123' })).resolves.toHaveProperty(
      'access_token',
    );
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});
