import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealApi, setRetrySleep } from './real';

const order = {
  id: 'ord_1',
  status: 'pending',
  items: [],
  total_cents: 0,
  currency: 'HKD',
  created_at: '2026-10-14T00:00:00Z',
};
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

afterEach(() => vi.unstubAllGlobals());

describe('real adapter createOrder (CONTRACT.md §10 @a3d4304)', () => {
  it('always sends Idempotency-Key and retries 503 TX_CONFLICT with the same key after Retry-After', async () => {
    const waits: number[] = [];
    setRetrySleep(async (ms) => void waits.push(ms));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(503, { error: { code: 'TX_CONFLICT', message: 'busy', retryable: true } }, { 'Retry-After': '1' }),
      )
      .mockResolvedValueOnce(json(201, order));
    vi.stubGlobal('fetch', fetch);
    const o = await createRealApi('http://x', 'main').createOrder('key-123', { address_id: 'a1' });
    expect(o.id).toBe('ord_1');
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls) expect(init.headers['Idempotency-Key']).toBe('key-123');
    expect(waits).toEqual([1000]);
  });

  it('gives up after two retries and surfaces the wrapped error code', async () => {
    setRetrySleep(async () => {});
    const fetch = vi
      .fn()
      .mockImplementation(async () => json(503, { error: { code: 'TX_CONFLICT', message: 'busy' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(createRealApi('http://x', 'main').createOrder('k', { address_id: 'a1' })).rejects.toMatchObject({
      status: 503,
      code: 'TX_CONFLICT',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(409, { error: { code: 'PRODUCT_UNAVAILABLE', message: '部分商品已無法購買' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(createRealApi('http://x', 'main').createOrder('k', { address_id: 'a1' })).rejects.toMatchObject({
      code: 'PRODUCT_UNAVAILABLE',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('real adapter payOrder (#30)', () => {
  it('POSTs the payment with an Idempotency-Key and surfaces PAYMENT_DECLINED', async () => {
    const fetch = vi.fn().mockResolvedValue(json(402, { error: { code: 'PAYMENT_DECLINED', message: '付款失敗' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(
      createRealApi('http://x', 'main').payOrder('ord_1', { method: 'mock_card', simulate: 'failure' }, 'pk'),
    ).rejects.toMatchObject({ status: 402, code: 'PAYMENT_DECLINED' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://x/shop/v1/orders/ord_1/payments');
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe('pk');
    expect(JSON.parse(init.body)).toEqual({ method: 'mock_card', simulate: 'failure' });
  });
});

describe('real adapter payOrder — CONTRACT.md §13 @a3d4304', () => {
  it('returns the paid order on 200', async () => {
    const paid = { ...order, status: 'paid', payment_method: 'mock_card', paid_at: '2026-10-14T11:00:00Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, paid)));
    await expect(
      createRealApi('http://x', 'main').payOrder('ord_1', { method: 'mock_card', simulate: 'success' }, 'k'),
    ).resolves.toMatchObject({ status: 'paid', payment_method: 'mock_card' });
  });
  it('retries 503 TX_CONFLICT with the same key', async () => {
    setRetrySleep(async () => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(503, { error: { code: 'TX_CONFLICT', message: 'busy' } }, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(json(200, { ...order, status: 'paid' }));
    vi.stubGlobal('fetch', fetch);
    await createRealApi('http://x', 'main').payOrder('ord_1', { method: 'mock_alipay', simulate: 'success' }, 'same');
    expect(fetch.mock.calls.map(([, i]) => i.headers['Idempotency-Key'])).toEqual(['same', 'same']);
  });
  it('surfaces 409 IDEMPOTENCY_KEY_REUSED / ORDER_NOT_PAYABLE without retrying', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'reused' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(
      createRealApi('http://x', 'main').payOrder('ord_1', { method: 'mock_card', simulate: 'success' }, 'k'),
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('real adapter order status endpoints (#34, proposed — not yet in CONTRACT.md)', () => {
  it('uses the proposed routes and methods', async () => {
    const fetch = vi.fn().mockImplementation(async () => json(200, { ...order, status: 'cancelled' }));
    vi.stubGlobal('fetch', fetch);
    const r = createRealApi('http://x', 'main');
    await r.cancelOrder('ord_1');
    await r.confirmDelivery('ord_1');
    await r.updateStaffOrderStatus('ord_1', 'shipped');
    fetch.mockImplementation(async () => json(200, { items: [], next_cursor: null }));
    await r.listStaffOrders({ status: 'paid' });
    expect(fetch.mock.calls.map(([u, i]) => `${i.method} ${String(u).replace('http://x', '')}`)).toEqual([
      'POST /shop/v1/orders/ord_1/cancel',
      'POST /shop/v1/orders/ord_1/confirm-delivery',
      'PUT /shop/v1/staff/orders/ord_1/status',
      'GET /shop/v1/staff/orders?status=paid',
    ]);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ status: 'shipped' });
  });
});

describe('real adapter address book (#44, §12 @a3d4304 planned routes, unverified)', () => {
  it('uses PUT / DELETE / POST …/default', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async (_u: string, i: { method: string }) =>
        i.method === 'DELETE' ? new Response(null, { status: 204 }) : json(200, { id: 'a1' }),
      );
    vi.stubGlobal('fetch', fetch);
    const r = createRealApi('http://x', 'main');
    const input = { recipient: 'a', phone: '91234567', region: '九龍', line1: '旺角彌敦道 1 號' };
    await r.updateAddress('a1', input);
    await expect(r.deleteAddress('a1')).resolves.toBeUndefined();
    await r.setDefaultAddress('a1');
    expect(fetch.mock.calls.map(([u, i]) => `${i.method} ${String(u).replace('http://x', '')}`)).toEqual([
      'PUT /shop/v1/addresses/a1',
      'DELETE /shop/v1/addresses/a1',
      'POST /shop/v1/addresses/a1/default',
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
  });
});

describe('staff product and SKU contract integration', () => {
  it('reads an inactive product through the staff route and preserves its ETag on save', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { id: 'p/1', active: false }, { ETag: '"7"' }));
    vi.stubGlobal('fetch', fetch);
    const r = createRealApi('http://x', 'my shop');
    const p = await r.getStaffProduct('p/1');
    expect(p.etag).toBe('"7"');
    await r.updateProduct(p.id, { active: true }, p.etag);
    expect(fetch.mock.calls[0][0]).toBe('http://x/catalog/v1/my%20shop/staff/products/p%2F1');
    expect(fetch.mock.calls[1][1].headers['If-Match']).toBe('"7"');
    await expect(r.updateProduct(p.id, { active: false })).rejects.toMatchObject({ status: 428 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('uses dedicated SKU routes and sends a quoted optimistic version', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, {}));
    vi.stubGlobal('fetch', fetch);
    const r = createRealApi('http://x', 'main');
    await r.listVariants('p/1');
    await r.createVariant('p/1', { options: { color: 'red' }, price_cents: 100, stock: 2, active: true });
    await r.updateVariant('p/1', 'sku/1', { active: false }, 9);
    expect(fetch.mock.calls.map(([u, i]) => `${i.method} ${u}`)).toEqual([
      'GET http://x/catalog/v1/main/staff/products/p%2F1/variants',
      'POST http://x/catalog/v1/main/products/p%2F1/variants',
      'PUT http://x/catalog/v1/main/products/p%2F1/variants/sku%2F1',
    ]);
    expect(fetch.mock.calls[2][1].headers['If-Match']).toBe('"9"');
  });
});
