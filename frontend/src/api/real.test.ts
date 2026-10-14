import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealApi, setRetrySleep } from './real';

const order = { id: 'ord_1', status: 'pending', items: [], total_cents: 0, currency: 'HKD', created_at: '2026-10-14T00:00:00Z' };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

afterEach(() => vi.unstubAllGlobals());

describe('real adapter createOrder (CONTRACT.md §10 @47bc45e)', () => {
  it('always sends Idempotency-Key and retries 503 TX_CONFLICT with the same key after Retry-After', async () => {
    const waits: number[] = [];
    setRetrySleep(async (ms) => void waits.push(ms));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(503, { error: { code: 'TX_CONFLICT', message: 'busy', retryable: true } }, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(json(201, order));
    vi.stubGlobal('fetch', fetch);
    const o = await createRealApi('http://x', 'main').createOrder('key-123');
    expect(o.id).toBe('ord_1');
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls) expect(init.headers['Idempotency-Key']).toBe('key-123');
    expect(waits).toEqual([1000]);
  });

  it('gives up after two retries and surfaces the wrapped error code', async () => {
    setRetrySleep(async () => {});
    const fetch = vi.fn().mockImplementation(async () => json(503, { error: { code: 'TX_CONFLICT', message: 'busy' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(createRealApi('http://x', 'main').createOrder('k')).rejects.toMatchObject({ status: 503, code: 'TX_CONFLICT' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const fetch = vi.fn().mockResolvedValue(json(409, { error: { code: 'PRODUCT_UNAVAILABLE', message: '部分商品已無法購買' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(createRealApi('http://x', 'main').createOrder('k')).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
