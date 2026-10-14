import { lineTotal, subtotal } from './money';
import { DEMO_USERS, type SeedUser, seedProducts, syncVariantTotals, withVariants } from './seed';
import {
  ApiRequestError,
  type AuthToken,
  type Cart,
  type Order,
  type Page,
  type Product,
  type ProductQuery,
  type ProductVariant,
  type ShopApi,
} from './types';
import { tokenStore } from './token';

interface StoredCartLine {
  id: string;
  product_id: string;
  sku_id?: string | null;
  quantity: number;
}

export interface MockState {
  users: SeedUser[];
  products: Product[];
  carts: Record<string, StoredCartLine[]>;
  orders: Record<string, Order[]>;
  idempotency: Record<string, string>;
  /** Normalised body per idempotency key (CONTRACT.md §10). */
  idempotency_body?: Record<string, string>;
  sessions: Record<string, { user_id: string; expires_at: string }>;
  seq: number;
}

export interface MockOptions {
  /** [min, max] artificial latency in ms. */
  latency?: [number, number];
  /** Persist demo data (products, carts, orders; never tokens or sessions) to localStorage. */
  persist?: boolean;
  /** Supplies the bearer token; defaults to the shared token store. */
  getToken?: () => string | null;
  now?: () => number;
}

// v2: products carry SKU variants (#17).
const STORAGE_KEY = 'shop.mock.v2';
const LEGACY_KEY = 'shop.mock.v1';

/**
 * v1 → v2: keep users, orders, carts and staff product edits; attach demo SKUs to seeded
 * slugs and drop cart lines that now need a spec (they cannot be bought without one).
 */
export function migrateV1(v1: MockState): MockState {
  const products = v1.products.map((p) => withVariants({ ...p }));
  const needsSku = new Set(products.filter((p) => p.variants?.length).map((p) => p.id));
  const carts = Object.fromEntries(Object.entries(v1.carts ?? {}).map(([uid, lines]) => [uid, lines.filter((l) => !needsSku.has(l.product_id))]));
  return { ...v1, products, carts, sessions: {} };
}
const TOKEN_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 8;
const MAX_QTY = 99;

export function freshState(): MockState {
  return { users: DEMO_USERS.map((u) => ({ ...u })), products: seedProducts(), carts: {}, orders: {}, idempotency: {}, sessions: {}, seq: 1000 };
}

const err = (status: number, code: string, message: string) => new ApiRequestError(status, code, message);

export function createMockApi(opts: MockOptions = {}): ShopApi & { state: MockState; reset(): void } {
  const latency = opts.latency ?? [0, 0];
  const now = opts.now ?? Date.now;
  const getToken = opts.getToken ?? (() => tokenStore.get());
  let state = load();

  function load(): MockState {
    if (opts.persist) {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (raw) {
        try {
          // Sessions are never persisted, so a reload signs the user out (same as real mode).
          return { ...(JSON.parse(raw) as MockState), sessions: {} };
        } catch {
          /* fall through to a fresh seed */
        }
      }
      const legacy = globalThis.localStorage?.getItem(LEGACY_KEY);
      if (legacy) {
        globalThis.localStorage?.removeItem(LEGACY_KEY);
        try {
          const migrated = migrateV1(JSON.parse(legacy) as MockState);
          globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        } catch {
          /* corrupt v1 data: start fresh */
        }
      }
    }
    return freshState();
  }
  function save() {
    if (opts.persist) globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...state, sessions: {} }));
  }
  const id = (prefix: string) => `${prefix}_${(++state.seq).toString(36)}`;

  async function run<T>(fn: () => T): Promise<T> {
    const [a, b] = latency;
    if (b > 0) await new Promise((r) => setTimeout(r, a + Math.random() * (b - a)));
    const out = fn();
    save();
    // Return copies so callers cannot mutate mock state.
    return out === undefined ? out : structuredClone(out);
  }

  function currentUser(): SeedUser {
    const token = getToken();
    const s = token ? state.sessions[token] : undefined;
    if (!s || Date.parse(s.expires_at) <= now()) throw err(401, 'UNAUTHENTICATED', '請先登入');
    const u = state.users.find((x) => x.id === s.user_id);
    if (!u) throw err(401, 'UNAUTHENTICATED', '請先登入');
    return u;
  }
  function isStaff(): boolean {
    try {
      return currentUser().roles.includes('staff');
    } catch {
      return false;
    }
  }
  function requireStaff() {
    if (!currentUser().roles.includes('staff')) throw err(403, 'FORBIDDEN', '只有店務人員可以執行此操作');
  }
  function issue(u: SeedUser): AuthToken {
    const access_token = `mock.${u.id}.${Math.random().toString(36).slice(2)}`;
    const expires_at = new Date(now() + TOKEN_TTL_MS).toISOString();
    state.sessions[access_token] = { user_id: u.id, expires_at };
    return { access_token, expires_at };
  }
  function findProduct(pid: string, includeInactive = isStaff()): Product {
    const p = state.products.find((x) => x.id === pid || x.slug === pid);
    if (!p || (!p.active && !includeInactive)) throw err(404, 'NOT_FOUND', '找不到商品');
    return p;
  }
  /** CONTRACT.md §11: product inactive/deleted, SKU gone, or every variant inactive. */
  function isUnavailable(l: StoredCartLine): boolean {
    const p = state.products.find((x) => x.id === l.product_id);
    if (!p || !p.active) return true;
    if (p.options?.length && !p.variants?.length) return true;
    return !!l.sku_id && !p.variants?.some((x) => x.id === l.sku_id);
  }
  function cartOf(uid: string): Cart {
    const lines = state.carts[uid] ?? [];
    const items = lines.flatMap((l) => {
      const p = state.products.find((x) => x.id === l.product_id);
      if (!p) return [];
      const v = l.sku_id ? p.variants?.find((x) => x.id === l.sku_id) : undefined;
      // Lines stay visible when their SKU disappeared or the product went inactive, flagged in_stock: false.
      const usable = !isUnavailable(l);
      const price = v?.price_cents ?? p.price_cents;
      return [
        {
          id: l.id,
          quantity: l.quantity,
          line_total_cents: lineTotal(price, l.quantity),
          sku: v ? { id: v.id, options: v.options } : null,
          product: { id: p.id, slug: p.slug, name: p.name, price_cents: price, currency: p.currency, image_url: v?.image_url ?? p.image_urls[0] ?? null, in_stock: usable && (v ? v.in_stock : p.in_stock) },
        },
      ];
    });
    return { items, subtotal_cents: subtotal(items) };
  }
  function checkQty(q: number) {
    if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) throw err(422, 'VALIDATION_ERROR', `數量必須介乎 1 至 ${MAX_QTY}`);
  }
  function checkStock(p: Product, q: number, v?: ProductVariant | null) {
    if (!p.active || (p.options?.length && !p.variants?.length)) throw err(409, 'PRODUCT_UNAVAILABLE', `「${p.name}」已無法購買`);
    const stock = v ? v.stock : p.stock;
    const label = v ? `「${p.name}」（${Object.values(v.options).join('／')}）` : `「${p.name}」`;
    if (stock < q) throw err(409, 'OUT_OF_STOCK', stock === 0 ? `${label}已售完` : `${label}庫存只剩 ${stock} 件`);
  }
  /** Resolves the SKU for a cart add: required iff the product has variants. */
  function resolveSku(p: Product, skuId?: string | null): ProductVariant | null {
    if (!p.options?.length) {
      if (skuId) throw err(404, 'SKU_NOT_FOUND', '找不到此規格');
      return null;
    }
    // CONTRACT.md §11 @47bc45e: all variants inactive → variants [] → 409 PRODUCT_UNAVAILABLE.
    if (!p.variants?.length) throw err(409, 'PRODUCT_UNAVAILABLE', `「${p.name}」已無法購買`);
    if (!skuId) throw err(422, 'SKU_REQUIRED', '請先選擇商品規格');
    const v = (p.variants ?? []).find((x) => x.id === skuId);
    if (!v) throw err(404, 'SKU_NOT_FOUND', '找不到此規格');
    return v;
  }
  const skuOf = (p: Product, skuId?: string | null) => (skuId ? (p.variants?.find((x) => x.id === skuId) ?? null) : null);
  function paginate<T>(all: T[], cursor?: string, limit = PAGE_SIZE): Page<T> {
    const start = cursor ? Number.parseInt(atob(cursor), 10) : 0;
    if (Number.isNaN(start) || start < 0) throw err(400, 'INVALID_CURSOR', '分頁參數無效');
    const end = start + limit;
    return { items: all.slice(start, end), next_cursor: end < all.length ? btoa(String(end)) : null };
  }
  function validateProduct(p: Partial<Product>) {
    if (p.name !== undefined && !p.name.trim()) throw err(422, 'VALIDATION_ERROR', '請輸入商品名稱');
    if (p.slug !== undefined && !/^[a-z0-9-]+$/.test(p.slug)) throw err(422, 'VALIDATION_ERROR', 'slug 只可包含小寫英文、數字及連字號');
    if (p.price_cents !== undefined && (!Number.isInteger(p.price_cents) || p.price_cents < 0)) throw err(422, 'VALIDATION_ERROR', '價格必須是非負整數');
    if (p.stock !== undefined && (!Number.isInteger(p.stock) || p.stock < 0)) throw err(422, 'VALIDATION_ERROR', '庫存必須是非負整數');
  }

  const api: ShopApi = {
    login: ({ email, password }) =>
      run(() => {
        const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u || u.password !== password) throw err(401, 'INVALID_CREDENTIALS', '電郵或密碼不正確');
        return issue(u);
      }),
    register: ({ email, password, display_name }) =>
      run(() => {
        const e = email.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw err(422, 'VALIDATION_ERROR', '電郵格式不正確');
        if (password.length < 8) throw err(422, 'WEAK_PASSWORD', '密碼最少 8 個字元');
        if (!display_name.trim()) throw err(422, 'VALIDATION_ERROR', '請輸入顯示名稱');
        if (state.users.some((x) => x.email === e)) throw err(409, 'EMAIL_TAKEN', '此電郵已被註冊');
        const u: SeedUser = { id: id('u'), email: e, password, display_name: display_name.trim(), roles: [] };
        state.users.push(u);
        return issue(u);
      }),
    me: () =>
      run(() => {
        const u = currentUser();
        return { id: u.id, email: u.email, display_name: u.display_name, roles: u.roles };
      }),
    listStaffProducts: (q: ProductQuery = {}) => {
      try {
        requireStaff();
      } catch (e) {
        return Promise.reject(e);
      }
      return api.listProducts(q);
    },
    listProducts: (q: ProductQuery = {}) =>
      run(() => {
        const staff = isStaff();
        const term = q.q?.trim().toLowerCase();
        let list = state.products.filter(
          (p) =>
            (staff || p.active) &&
            (!term || p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term) || p.slug.includes(term)) &&
            (!q.category || p.category === q.category) &&
            (q.min_price_cents === undefined || p.price_cents >= q.min_price_cents) &&
            (q.max_price_cents === undefined || p.price_cents <= q.max_price_cents),
        );
        const sort = q.sort ?? 'created_at_desc';
        const key = sort.startsWith('price') ? (p: Product) => p.price_cents : (p: Product) => Date.parse(p.created_at);
        const dir = sort.endsWith('asc') ? 1 : -1;
        list = [...list].sort((a, b) => (key(a) - key(b)) * dir || a.id.localeCompare(b.id));
        return paginate(list, q.cursor, q.limit);
      }),
    getProduct: (pid) => run(() => findProduct(pid)),
    getCart: () => run(() => cartOf(currentUser().id)),
    addCartItem: (pid, quantity, skuId) =>
      run(() => {
        const u = currentUser();
        checkQty(quantity);
        const p = findProduct(pid, false);
        const v = resolveSku(p, skuId);
        const lines = (state.carts[u.id] ??= []);
        // Same product + same SKU accumulates; a different SKU is its own line.
        const existing = lines.find((l) => l.product_id === p.id && (l.sku_id ?? null) === (v?.id ?? null));
        const next = (existing?.quantity ?? 0) + quantity;
        checkQty(next);
        checkStock(p, next, v);
        if (existing) existing.quantity = next;
        else lines.push({ id: id('ci'), product_id: p.id, sku_id: v?.id ?? null, quantity });
        return cartOf(u.id);
      }),
    updateCartItem: (itemId, quantity) =>
      run(() => {
        const u = currentUser();
        checkQty(quantity);
        const line = (state.carts[u.id] ?? []).find((l) => l.id === itemId);
        if (!line) throw err(404, 'NOT_FOUND', '購物車沒有此項目');
        const lp = findProduct(line.product_id, true);
        checkStock(lp, quantity, skuOf(lp, line.sku_id));
        line.quantity = quantity;
        return cartOf(u.id);
      }),
    removeCartItem: (itemId) =>
      run(() => {
        const u = currentUser();
        const lines = state.carts[u.id] ?? [];
        if (!lines.some((l) => l.id === itemId)) throw err(404, 'NOT_FOUND', '購物車沒有此項目');
        state.carts[u.id] = lines.filter((l) => l.id !== itemId);
        return cartOf(u.id);
      }),
    createOrder: (key, body = {}) =>
      run(() => {
        const u = currentUser();
        // CONTRACT.md §10 @47bc45e (branch backend/markdown-v1): key required; same key + same body replays
        // the original order; different body → 409; failed attempts don't retain the key.
        if (!key) throw err(400, 'IDEMPOTENCY_KEY_REQUIRED', '缺少 Idempotency-Key');
        const ik = `${u.id}:${key}`;
        const bodyHash = JSON.stringify(body, Object.keys(body).sort());
        const prev = state.idempotency[ik];
        if (prev) {
          if ((state.idempotency_body?.[ik] ?? '{}') !== bodyHash) throw err(409, 'IDEMPOTENCY_KEY_REUSED', '此 Idempotency-Key 已用於另一個請求');
          return (state.orders[u.id] ?? []).find((o) => o.id === prev)!;
        }
        const cart = cartOf(u.id);
        if (!cart.items.length) throw err(422, 'CART_EMPTY', '購物車是空的');
        if ((state.carts[u.id] ?? []).some(isUnavailable)) throw err(409, 'PRODUCT_UNAVAILABLE', '部分商品已無法購買');
        for (const it of cart.items) {
          const p = findProduct(it.product.id, true);
          checkStock(p, it.quantity, skuOf(p, it.sku?.id));
        }
        for (const it of cart.items) {
          const p = findProduct(it.product.id, true);
          const v = skuOf(p, it.sku?.id);
          if (v) {
            v.stock -= it.quantity;
            v.in_stock = v.stock > 0;
            syncVariantTotals(p);
          } else {
            p.stock -= it.quantity;
            p.in_stock = p.stock > 0;
          }
        }
        const order: Order = {
          id: id('ord'),
          status: 'pending',
          currency: cart.items[0].product.currency,
          items: cart.items.map((it) => ({ product_id: it.product.id, sku_id: it.sku?.id ?? null, sku_options: it.sku?.options ?? null, name: it.product.name, unit_price_cents: it.product.price_cents, quantity: it.quantity, line_total_cents: it.line_total_cents })),
          total_cents: cart.subtotal_cents,
          created_at: new Date(now()).toISOString(),
        };
        (state.orders[u.id] ??= []).unshift(order);
        state.idempotency[ik] = order.id;
        (state.idempotency_body ??= {})[ik] = bodyHash;
        state.carts[u.id] = [];
        return order;
      }),
    listOrders: (cursor) => run(() => paginate(state.orders[currentUser().id] ?? [], cursor, 10)),
    getOrder: (oid) =>
      run(() => {
        const o = (state.orders[currentUser().id] ?? []).find((x) => x.id === oid);
        if (!o) throw err(404, 'NOT_FOUND', '找不到訂單');
        return o;
      }),
    createProduct: (input) =>
      run(() => {
        requireStaff();
        validateProduct(input);
        if (state.products.some((p) => p.slug === input.slug)) throw err(409, 'SLUG_TAKEN', '此 slug 已被使用');
        const p: Product = { ...input, id: id('p'), in_stock: input.stock > 0, created_at: new Date(now()).toISOString() };
        state.products.push(p);
        return p;
      }),
    updateProduct: (pid, patch) =>
      run(() => {
        requireStaff();
        validateProduct(patch);
        const p = findProduct(pid, true);
        if (p.options?.length) {
          // Price/stock of a SKU product are derived from its variants; an explicit change would be lost.
          if ((patch.price_cents !== undefined && patch.price_cents !== p.price_cents) || (patch.stock !== undefined && patch.stock !== p.stock))
            throw err(422, 'VARIANT_MANAGED', '此商品設有規格，價格及庫存須按規格修改');
        }
        if (patch.slug && state.products.some((x) => x.slug === patch.slug && x.id !== p.id)) throw err(409, 'SLUG_TAKEN', '此 slug 已被使用');
        Object.assign(p, patch);
        p.in_stock = p.stock > 0;
        syncVariantTotals(p);
        return p;
      }),
    deleteProduct: (pid) =>
      run(() => {
        requireStaff();
        const p = findProduct(pid, true);
        state.products = state.products.filter((x) => x.id !== p.id);
        for (const uid of Object.keys(state.carts)) state.carts[uid] = state.carts[uid].filter((l) => l.product_id !== p.id);
      }),
  };

  return {
    ...api,
    get state() {
      return state;
    },
    reset() {
      state = freshState();
      save();
    },
  };
}
