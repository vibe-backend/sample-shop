import {
  ApiRequestError,
  type AuthToken,
  type Address,
  type Cart,
  type Me,
  type Order,
  type Page,
  type Product,
  type ProductInput,
  type ProductQuery,
  type ShopApi,
} from './types';
import { tokenStore } from './token';

export const ORDER_RETRIES = 2;
let sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Test hook: replace the retry delay. */
export function setRetrySleep(fn: (ms: number) => Promise<void>) {
  sleep = fn;
}

/** Fetch adapter implemented against the contract. Not exercised yet (no backend). */
export function createRealApi(baseUrl: string, slug: string): ShopApi {
  const base = baseUrl.replace(/\/$/, '');

  async function req<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const h: Record<string, string> = { Accept: 'application/json', ...headers };
    const token = tokenStore.get();
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiRequestError(0, 'NETWORK_ERROR', '無法連線到伺服器');
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // CONTRACT.md §11 @47bc45e wraps errors as { error: { code, message } }; accept a flat body too.
      const e = data && typeof data.error === 'object' && data.error ? data.error : data;
      const code = (e && typeof e.code === 'string' && e.code) || `HTTP_${res.status}`;
      const message = (e && typeof e.message === 'string' && e.message) || res.statusText;
      const ra = Number(res.headers.get('Retry-After'));
      throw new ApiRequestError(res.status, code, message, Number.isFinite(ra) && ra > 0 ? ra : undefined);
    }
    return data as T;
  }

  const qs = (o: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const sortParam = (s?: ProductQuery['sort']) => {
    if (!s) return {};
    const i = s.lastIndexOf('_');
    return { sort: s.slice(0, i), order: s.slice(i + 1) };
  };

  const cat = `/catalog/v1/${encodeURIComponent(slug)}/products`;

  return {
    login: (c) => req<AuthToken>('POST', `/users/v1/${encodeURIComponent(slug)}/login`, c),
    register: (r) => req<AuthToken>('POST', `/users/v1/${encodeURIComponent(slug)}/register`, r),
    me: () => req<Me>('GET', '/users/v1/me'),
    listProducts: (q = {}) => {
      const { sort, ...rest } = q;
      return req<Page<Product>>('GET', cat + qs({ ...rest, ...sortParam(sort) }));
    },
    listStaffProducts: (q = {}) => {
      const { sort, ...rest } = q;
      return req<Page<Product>>('GET', `/catalog/v1/${encodeURIComponent(slug)}/staff/products` + qs({ ...rest, ...sortParam(sort) }));
    },
    getProduct: (id) => req<Product>('GET', `${cat}/${encodeURIComponent(id)}`),
    getCart: () => req<Cart>('GET', '/shop/v1/cart-items'),
    addCartItem: (product_id, quantity, sku_id) =>
      req<Cart>('POST', '/shop/v1/cart-items', sku_id ? { product_id, sku_id, quantity } : { product_id, quantity }),
    updateCartItem: (id, quantity) => req<Cart>('PUT', `/shop/v1/cart-items/${encodeURIComponent(id)}`, { quantity }),
    removeCartItem: (id) => req<Cart>('DELETE', `/shop/v1/cart-items/${encodeURIComponent(id)}`),
    // CONTRACT.md §10 @47bc45e (backend/markdown-v1): Idempotency-Key is required; on 503 TX_CONFLICT or a
    // network error, wait Retry-After (default 1s) and retry with the SAME key, at most twice.
    createOrder: async (key, body) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await req<Order>('POST', '/shop/v1/orders', body, { 'Idempotency-Key': key });
        } catch (e) {
          const retryable = e instanceof ApiRequestError && (e.code === 'TX_CONFLICT' || e.code === 'NETWORK_ERROR');
          if (!retryable || attempt >= ORDER_RETRIES) throw e;
          await sleep((e.retryAfter ?? 1) * 1000);
        }
      }
    },
    listOrders: (cursor) => req<Page<Order>>('GET', '/shop/v1/orders' + qs({ cursor })),
    getOrder: (id) => req<Order>('GET', `/shop/v1/orders/${encodeURIComponent(id)}`),
    // §2 #17/#18, §12 @aec9631
    listAddresses: () => req<Address[]>('GET', '/shop/v1/addresses'),
    createAddress: (a) => req<Address>('POST', '/shop/v1/addresses', a),
    createProduct: (p: ProductInput) => req<Product>('POST', cat, p),
    updateProduct: (id, p) => req<Product>('PUT', `${cat}/${encodeURIComponent(id)}`, p),
    deleteProduct: (id) => req<void>('DELETE', `${cat}/${encodeURIComponent(id)}`),
  };
}
