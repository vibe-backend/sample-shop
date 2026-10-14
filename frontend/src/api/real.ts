import {
  ApiRequestError,
  type AuthToken,
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
      const code = (data && typeof data.code === 'string' && data.code) || `HTTP_${res.status}`;
      const message = (data && typeof data.message === 'string' && data.message) || res.statusText;
      throw new ApiRequestError(res.status, code, message);
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
    login: (c) => req<AuthToken>('POST', '/users/v1/login', c),
    register: (r) => req<AuthToken>('POST', '/users/v1/register', r),
    me: () => req<Me>('GET', '/users/v1/me'),
    listProducts: (q = {}) => {
      const { sort, ...rest } = q;
      return req<Page<Product>>('GET', cat + qs({ ...rest, ...sortParam(sort) }));
    },
    getProduct: (id) => req<Product>('GET', `${cat}/${encodeURIComponent(id)}`),
    getCart: () => req<Cart>('GET', '/shop/v1/cart-items'),
    addCartItem: (product_id, quantity) => req<Cart>('POST', '/shop/v1/cart-items', { product_id, quantity }),
    updateCartItem: (id, quantity) => req<Cart>('PATCH', `/shop/v1/cart-items/${encodeURIComponent(id)}`, { quantity }),
    removeCartItem: (id) => req<Cart>('DELETE', `/shop/v1/cart-items/${encodeURIComponent(id)}`),
    createOrder: (key) => req<Order>('POST', '/shop/v1/orders', {}, { 'Idempotency-Key': key }),
    listOrders: (cursor) => req<Page<Order>>('GET', '/shop/v1/orders' + qs({ cursor })),
    getOrder: (id) => req<Order>('GET', `/shop/v1/orders/${encodeURIComponent(id)}`),
    createProduct: (p: ProductInput) => req<Product>('POST', cat, p),
    updateProduct: (id, p) => req<Product>('PATCH', `${cat}/${encodeURIComponent(id)}`, p),
    deleteProduct: (id) => req<void>('DELETE', `${cat}/${encodeURIComponent(id)}`),
  };
}
