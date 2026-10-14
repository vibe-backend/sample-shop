import { createMockFeatures, recordPoints, walletOf, type FeatureState } from './mock-features';
import { checkoutTotals, campaignActive, sellingPrice } from '../lib/commerce';
import { passwordHash, passwordMatches } from '../lib/password';
import { lineTotal, subtotal } from './money';
import { DEMO_USERS, type SeedUser, seedProducts, syncVariantTotals, withVariants } from './seed';
import {
  ApiRequestError,
  type Address,
  type AuthToken,
  type Cart,
  type Order,
  type OrderStatus,
  type StaffOrder,
  type Page,
  type Product,
  type ProductQuery,
  type ProductVariant,
  type ShopApi,
} from './types';
import { tokenStore } from './token';
import { MAX_ADDRESSES, normalisePhone, validateAddress } from '../lib/address';
import { canTransition, STATUS_LABEL, type Actor } from '../lib/orderStatus';

interface StoredCartLine {
  id: string;
  product_id: string;
  sku_id?: string | null;
  quantity: number;
  original_price_cents?: number;
}

export interface MockState extends FeatureState {
  users: SeedUser[];
  products: Product[];
  carts: Record<string, StoredCartLine[]>;
  orders: Record<string, Order[]>;
  /** #29: saved delivery addresses per user (absent in older saved data). */
  addresses?: Record<string, Address[]>;
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
  const carts = Object.fromEntries(
    Object.entries(v1.carts ?? {}).map(([uid, lines]) => [uid, lines.filter((l) => !needsSku.has(l.product_id))]),
  );
  return { ...v1, products, carts, sessions: {} };
}
const TOKEN_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 8;
const MAX_QTY = 99;

function seedAddresses(): Record<string, Address[]> {
  const at = new Date(Date.UTC(2026, 8, 1)).toISOString();
  return {
    u_demo: [
      {
        id: 'addr_home',
        recipient: '陳小明',
        phone: '91234567',
        region: '九龍',
        line1: '旺角彌敦道 688 號 12 樓 B 室',
        is_default: true,
        created_at: at,
      },
      {
        id: 'addr_office',
        recipient: '陳小明',
        phone: '23456789',
        region: '香港島',
        line1: '中環皇后大道中 99 號 30 樓',
        is_default: false,
        created_at: at,
      },
    ],
  };
}

export function freshState(): MockState {
  return {
    users: DEMO_USERS.map((u) => ({ ...u })),
    products: seedProducts(),
    carts: {},
    orders: {},
    addresses: seedAddresses(),
    idempotency: {},
    sessions: {},
    seq: 1000,
  };
}

/** Deep, key-order-independent JSON for idempotency body comparison (CONTRACT.md §10 normalised hash). */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v ?? null);
}

const err = (status: number, code: string, message: string) => new ApiRequestError(status, code, message);

export function createMockApi(opts: MockOptions = {}): ShopApi & { state: MockState; reset(): void } {
  const latency = opts.latency ?? [0, 0];
  const now = opts.now ?? Date.now;
  const getToken = opts.getToken ?? (() => tokenStore.get());
  const storage = opts.persist ? globalThis.localStorage : undefined;
  let state = load();
  let ready = migratePasswords();
  async function migratePasswords() {
    const target = state;
    await Promise.all(
      target.users.map(async (u) => {
        if (u.password !== undefined) {
          u.password_hash = await passwordHash(u.password);
          delete u.password;
        }
      }),
    );
    if (target === state) save();
  }

  function load(): MockState {
    if (opts.persist) {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        try {
          // Sessions are never persisted, so a reload signs the user out (same as real mode).
          return { ...(JSON.parse(raw) as MockState), sessions: {} };
        } catch {
          /* fall through to a fresh seed */
        }
      }
      const legacy = storage?.getItem(LEGACY_KEY);
      if (legacy) {
        let migrated: MockState | null = null;
        try {
          migrated = migrateV1(JSON.parse(legacy) as MockState);
        } catch {
          /* corrupt v1 data: start fresh (and drop it below) */
        }
        try {
          // Only drop v1 once v2 is safely written (or v1 is unreadable anyway).
          if (!migrated) storage?.removeItem(LEGACY_KEY);
        } catch {
          /* quota/full storage: keep v1 so nothing is lost; retry next load */
        }
        if (migrated) return migrated;
      }
    }
    const initial = freshState();
    const featured = initial.products.find((p) => p.id === 'p_006')!;
    featured.campaign = {
      starts_at: new Date(now() - 86400000).toISOString(),
      ends_at: new Date(now() + 2 * 86400000).toISOString(),
      price_cents: 99000,
      limit: 3,
      sold: 0,
    };
    featured.compare_at_price_cents = featured.price_cents;
    return initial;
  }
  function save() {
    if (opts.persist) {
      try {
        storage?.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...state,
            users: state.users.map((u) => {
              const copy = { ...u };
              delete copy.password;
              return copy;
            }),
            sessions: {},
          }),
        );
        storage?.removeItem(LEGACY_KEY);
      } catch {
        /* Full/unavailable storage must not fail a successful mutation. */
      }
    }
  }
  function expireReservations() {
    for (const [uid, orders] of Object.entries(state.orders)) {
      for (const o of orders)
        if (o.status === 'pending' && o.reservation_expires_at && Date.parse(o.reservation_expires_at) <= now()) {
          transition(o, 'cancelled', 'system');
          o.cancellation_reason = '付款逾時';
          restock(o, uid);
          save();
        }
    }
  }
  function releaseReservation(o: Order) {
    if (!o.reservation_expires_at || o.reservation_active === false) return;
    o.reservation_active = false;
    for (const it of o.items) {
      const p = state.products.find((p) => p.id === it.product_id);
      if (!p) continue;
      const v = it.sku_id ? p.variants?.find((v) => v.id === it.sku_id) : undefined;
      const target = v ?? p;
      target.reserved_stock = Math.max(0, (target.reserved_stock ?? 0) - it.quantity);
    }
  }
  /** #34 state machine; illegal moves → 409 INVALID_TRANSITION. */
  function transition(o: Order, to: OrderStatus, actor: Actor): Order {
    if (!canTransition(o.status, to, actor))
      throw err(409, 'INVALID_TRANSITION', `訂單狀態「${STATUS_LABEL[o.status]}」不可轉為「${STATUS_LABEL[to]}」`);
    o.status = to;
    (o.status_history ??= []).push({ status: to, at: new Date(now()).toISOString() });
    return o;
  }
  function ownAddress(aid: string): Address {
    const a = addressesOf(currentUser().id).find((x) => x.id === aid);
    if (!a) throw err(404, 'ADDRESS_NOT_FOUND', '找不到收貨地址');
    return a;
  }
  function ownOrder(oid: string): Order {
    const o = (state.orders[currentUser().id] ?? []).find((x) => x.id === oid);
    if (!o) throw err(404, 'NOT_FOUND', '找不到訂單');
    return o;
  }
  function allOrders(): StaffOrder[] {
    return Object.entries(state.orders).flatMap(([uid, os]) => {
      const u = state.users.find((x) => x.id === uid);
      const buyer = { id: uid, display_name: u?.display_name ?? uid, email: u?.email ?? '' };
      return os.map((o) => ({ ...o, buyer }));
    });
  }
  /** Cancelling returns stock (and sold_count) taken at order time. */
  function restock(o: Order, uid?: string) {
    releaseReservation(o);
    if (uid && o.points_used)
      recordPoints(state, uid, o.points_used, '取消訂單退回積分', o.id, new Date(now()).toISOString());
    if (o.paid_at) o.refunded_cents = o.total_cents;
    for (const it of o.items) {
      const p = state.products.find((x) => x.id === it.product_id);
      if (!p) continue;
      if (p.campaign) p.campaign.sold = Math.max(0, p.campaign.sold - it.quantity);
      p.sold_count = Math.max(0, (p.sold_count ?? 0) - it.quantity);
      const v = it.sku_id ? p.variants?.find((x) => x.id === it.sku_id) : undefined;
      if (v) {
        v.stock += it.quantity;
        v.in_stock = v.stock > 0;
        syncVariantTotals(p);
      } else if (!it.sku_id) {
        p.stock += it.quantity;
        p.in_stock = p.stock > 0;
      }
    }
  }
  const addressesOf = (uid: string) => ((state.addresses ??= {})[uid] ??= []);
  // §12 @a3d4304: default first, then newest first.
  const sortAddresses = (xs: Address[]) =>
    [...xs].sort(
      (a, b) =>
        Number(b.is_default) - Number(a.is_default) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
  const id = (prefix: string) => `${prefix}_${(++state.seq).toString(36)}`;

  async function run<T>(fn: () => T | Promise<T>): Promise<T> {
    await ready;
    const [a, b] = latency;
    if (b > 0) await new Promise((r) => setTimeout(r, a + Math.random() * (b - a)));
    expireReservations();
    const out = await fn();
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
    const guest = state.carts.guest ?? [];
    const account = (state.carts[u.id] ??= []);
    for (const line of guest) {
      const existing = account.find(
        (x) => x.product_id === line.product_id && (x.sku_id ?? null) === (line.sku_id ?? null),
      );
      if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + line.quantity);
      else account.push({ ...line, id: id('ci') });
    }
    state.carts.guest = [];
    state.sessions[access_token] = { user_id: u.id, expires_at };
    return { access_token, expires_at };
  }
  function cartUserId(): string {
    if (!getToken()) return 'guest';
    return currentUser().id;
  }
  function publicProduct(p: Product): Product {
    const out = structuredClone(p);
    if (!isStaff() && out.variants) out.variants = out.variants.filter((v) => v.active !== false);
    out.price_cents = sellingPrice(out, now());
    if (campaignActive(out, now()) && out.campaign!.sold >= out.campaign!.limit) out.in_stock = false;
    return out;
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
    return !!l.sku_id && !p.variants?.some((x) => x.id === l.sku_id && x.active !== false);
  }
  function cartOf(uid: string): Cart {
    const lines = state.carts[uid] ?? [];
    const items = lines.flatMap((l) => {
      const p = state.products.find((x) => x.id === l.product_id);
      if (!p) return [];
      const v = l.sku_id ? p.variants?.find((x) => x.id === l.sku_id) : undefined;
      // Lines stay visible when their SKU disappeared or the product went inactive, flagged in_stock: false.
      const usable = !isUnavailable(l);
      const price = v?.price_cents ?? sellingPrice(p, now());
      return [
        {
          id: l.id,
          stock: v?.stock ?? p.stock,
          unavailable: !usable,
          original_price_cents: l.original_price_cents,
          price_changed: l.original_price_cents !== undefined && l.original_price_cents !== price,
          quantity: l.quantity,
          line_total_cents: lineTotal(price, l.quantity),
          sku: v ? { id: v.id, options: v.options } : null,
          product: {
            id: p.id,
            slug: p.slug,
            name: p.name,
            price_cents: price,
            currency: p.currency,
            image_url: v?.image_url ?? p.image_urls[0] ?? null,
            in_stock: usable && (v ? v.in_stock : p.in_stock),
          },
        },
      ];
    });
    return { items, subtotal_cents: subtotal(items) };
  }
  function checkQty(q: number) {
    if (!Number.isInteger(q) || q < 1 || q > MAX_QTY)
      throw err(422, 'VALIDATION_FAILED', `數量必須介乎 1 至 ${MAX_QTY}`);
  }
  function checkStock(p: Product, q: number, v?: ProductVariant | null) {
    if (!p.active || (p.options?.length && !p.variants?.length))
      throw err(409, 'PRODUCT_UNAVAILABLE', `「${p.name}」已無法購買`);
    const stock = v ? v.stock : p.stock;
    const label = v ? `「${p.name}」（${Object.values(v.options).join('／')}）` : `「${p.name}」`;
    if ((!v && campaignActive(p, now()) && p.campaign!.sold + q > p.campaign!.limit) || v?.active === false)
      throw err(409, 'OUT_OF_STOCK', '限量商品已搶光或規格已停用');
    if (stock < q) throw err(409, 'OUT_OF_STOCK', stock === 0 ? `${label}已售完` : `${label}庫存只剩 ${stock} 件`);
  }
  /** Resolves the SKU for a cart add: required iff the product has variants. */
  function resolveSku(p: Product, skuId?: string | null): ProductVariant | null {
    if (!p.options?.length) {
      if (skuId) throw err(404, 'SKU_NOT_FOUND', '找不到此規格');
      return null;
    }
    // CONTRACT.md §11 @a3d4304: all variants inactive → variants [] → 409 PRODUCT_UNAVAILABLE.
    if (!p.variants?.length) throw err(409, 'PRODUCT_UNAVAILABLE', `「${p.name}」已無法購買`);
    if (!skuId) throw err(422, 'SKU_REQUIRED', '請先選擇商品規格');
    const v = (p.variants ?? []).find((x) => x.id === skuId && x.active !== false);
    if (!v) throw err(404, 'SKU_NOT_FOUND', '找不到此規格');
    return v;
  }
  const skuOf = (p: Product, skuId?: string | null) =>
    skuId ? (p.variants?.find((x) => x.id === skuId) ?? null) : null;
  function paginate<T>(all: T[], cursor?: string, limit = PAGE_SIZE): Page<T> {
    let start = 0;
    try {
      if (cursor) start = Number(atob(cursor));
    } catch {
      throw err(400, 'INVALID_CURSOR', '分頁參數無效');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw err(422, 'VALIDATION_FAILED', '分頁數量須介乎 1–100');
    if (!Number.isInteger(start) || start < 0) throw err(400, 'INVALID_CURSOR', '分頁參數無效');
    const end = start + limit;
    return { items: all.slice(start, end), next_cursor: end < all.length ? btoa(String(end)) : null };
  }
  function validateProduct(p: Partial<Product>) {
    if (
      p.options &&
      (p.options.length > 8 ||
        new Set(p.options.map((o) => o.name)).size !== p.options.length ||
        p.options.some(
          (o) =>
            !o.name.trim() ||
            !o.values.length ||
            o.values.some((v) => !v.trim()) ||
            new Set(o.values).size !== o.values.length,
        ))
    )
      throw err(422, 'VALIDATION_FAILED', '選項名稱及值不可空白或重複');
    if (p.name !== undefined && !p.name.trim()) throw err(422, 'VALIDATION_FAILED', '請輸入商品名稱');
    if (p.slug !== undefined && !/^[a-z0-9-]+$/.test(p.slug))
      throw err(422, 'VALIDATION_FAILED', 'slug 只可包含小寫英文、數字及連字號');
    if (p.price_cents !== undefined && (!Number.isInteger(p.price_cents) || p.price_cents < 0))
      throw err(422, 'VALIDATION_FAILED', '價格必須是非負整數');
    if (p.stock !== undefined && (!Number.isInteger(p.stock) || p.stock < 0))
      throw err(422, 'VALIDATION_FAILED', '庫存必須是非負整數');
  }

  const api: ShopApi = {
    ...createMockFeatures({ getState: () => state, run, currentUser, requireStaff, findProduct, id, now }),
    login: ({ email, password }) =>
      run(async () => {
        const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u || !(await passwordMatches(password, u.password_hash ?? '')))
          throw err(401, 'INVALID_CREDENTIALS', '電郵或密碼不正確');
        return issue(u);
      }),
    register: ({ email, password, display_name }) =>
      run(async () => {
        const e = email.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw err(422, 'VALIDATION_FAILED', '電郵格式不正確');
        if (password.length < 8) throw err(422, 'WEAK_PASSWORD', '密碼最少 8 個字元');
        if (!display_name.trim()) throw err(422, 'VALIDATION_FAILED', '請輸入顯示名稱');
        if (state.users.some((x) => x.email === e)) throw err(409, 'EMAIL_TAKEN', '此電郵已被註冊');
        const hash = await passwordHash(password);
        if (state.users.some((x) => x.email === e)) throw err(409, 'EMAIL_TAKEN', '此電郵已被註冊');
        const u: SeedUser = {
          id: id('u'),
          email: e,
          password_hash: hash,
          display_name: display_name.trim(),
          roles: [],
        };
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
            (!term ||
              p.name.toLowerCase().includes(term) ||
              p.description.toLowerCase().includes(term) ||
              p.slug.includes(term)) &&
            (!q.category || p.category === q.category) &&
            (!q.subcategory || p.subcategory === q.subcategory) &&
            (!q.brands?.length || q.brands.includes(p.brand ?? '')) &&
            (!q.attributes ||
              Object.entries(q.attributes).every(
                ([k, values]) => !values.length || values.includes(p.attributes?.[k] ?? ''),
              )) &&
            (q.min_price_cents === undefined || p.price_cents >= q.min_price_cents) &&
            (q.max_price_cents === undefined || p.price_cents <= q.max_price_cents),
        );
        const sort = q.sort ?? 'created_at_desc';
        const key = sort.startsWith('price')
          ? (p: Product) => sellingPrice(p, now())
          : sort === 'sales_desc'
            ? (p: Product) => p.sold_count ?? 0
            : sort === 'rating_desc'
              ? (p: Product) => p.rating_avg ?? 0
              : sort === 'relevance_desc'
                ? (p: Product) => (p.rating_avg ?? 0) * 100 + Math.log1p(p.sold_count ?? 0) * 10 + (p.in_stock ? 50 : 0)
                : (p: Product) => Date.parse(p.created_at);
        const dir = sort.endsWith('asc') ? 1 : -1;
        list = [...list].sort((a, b) => (key(a) - key(b)) * dir || a.id.localeCompare(b.id));
        return paginate(list.map(publicProduct), q.cursor, q.limit);
      }),
    getProduct: (pid) => run(() => publicProduct(findProduct(pid))),
    getCart: () => run(() => cartOf(cartUserId())),
    addCartItem: (pid, quantity, skuId) =>
      run(() => {
        const u = { id: cartUserId() };
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
        else
          lines.push({
            id: id('ci'),
            product_id: p.id,
            sku_id: v?.id ?? null,
            quantity,
            original_price_cents: v?.price_cents ?? sellingPrice(p, now()),
          });
        return cartOf(u.id);
      }),
    updateCartItem: (itemId, quantity) =>
      run(() => {
        const u = { id: cartUserId() };
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
        const u = { id: cartUserId() };
        const lines = state.carts[u.id] ?? [];
        if (!lines.some((l) => l.id === itemId)) throw err(404, 'NOT_FOUND', '購物車沒有此項目');
        state.carts[u.id] = lines.filter((l) => l.id !== itemId);
        return cartOf(u.id);
      }),
    createOrder: (key, body) =>
      run(() => {
        const u = currentUser();
        // CONTRACT.md §10 @a3d4304 (branch backend/markdown-v1): key required; same key + same body replays
        // the original order; different body → 409; failed attempts don't retain the key.
        if (!key) throw err(400, 'IDEMPOTENCY_KEY_REQUIRED', '缺少 Idempotency-Key');
        const ik = `${u.id}:${key}`;
        const bodyHash = stableStringify(body ?? {});
        const prev = state.idempotency[ik];
        if (prev) {
          if ((state.idempotency_body?.[ik] ?? '{}') !== bodyHash)
            throw err(409, 'IDEMPOTENCY_KEY_REUSED', '此 Idempotency-Key 已用於另一個請求');
          return (state.orders[u.id] ?? []).find((o) => o.id === prev)!;
        }
        let cart = cartOf(u.id);
        if (body?.buy_now && body.item_ids) throw err(422, 'VALIDATION_FAILED', '立即購買不可同時選擇購物車項目');
        if (body?.buy_now) {
          const p = findProduct(body.buy_now.product_id, false);
          const v = resolveSku(p, body.buy_now.sku_id);
          checkQty(body.buy_now.quantity);
          checkStock(p, body.buy_now.quantity, v);
          const price = v?.price_cents ?? sellingPrice(p, now());
          cart = {
            items: [
              {
                id: 'buy_now',
                product: {
                  id: p.id,
                  slug: p.slug,
                  name: p.name,
                  price_cents: price,
                  currency: p.currency,
                  image_url: p.image_urls[0] ?? null,
                  in_stock: true,
                },
                sku: v ? { id: v.id, options: v.options } : null,
                quantity: body.buy_now.quantity,
                line_total_cents: price * body.buy_now.quantity,
              },
            ],
            subtotal_cents: price * body.buy_now.quantity,
          };
        } else if (body?.item_ids) {
          if (
            !body.item_ids.length ||
            new Set(body.item_ids).size !== body.item_ids.length ||
            body.item_ids.some((cid) => !cart.items.some((it) => it.id === cid))
          )
            throw err(422, 'VALIDATION_FAILED', '結帳項目無效');
          cart.items = cart.items.filter((it) => body.item_ids!.includes(it.id));
          cart.subtotal_cents = subtotal(cart.items);
        }
        // §12 @a3d4304: address checks come before CART_EMPTY; address_id is snapshotted onto the order.
        if (!body?.address_id) throw err(422, 'ADDRESS_REQUIRED', '請選擇收貨地址');
        const addr = addressesOf(u.id).find((a) => a.id === body.address_id);
        if (!addr) throw err(404, 'ADDRESS_NOT_FOUND', '找不到收貨地址');
        if (!cart.items.length) throw err(422, 'CART_EMPTY', '購物車是空的');
        if (
          !body.buy_now &&
          (state.carts[u.id] ?? []).filter((l) => !body.item_ids || body.item_ids.includes(l.id)).some(isUnavailable)
        )
          throw err(409, 'PRODUCT_UNAVAILABLE', '部分商品已無法購買');
        for (const it of cart.items) {
          const p = findProduct(it.product.id, true);
          checkStock(p, it.quantity, skuOf(p, it.sku?.id));
        }
        const method = body.shipping_method ?? 'pickup';
        if (method !== 'courier' && method !== 'pickup') throw err(422, 'VALIDATION_FAILED', '配送方式無效');
        if ((body.note?.length ?? 0) > 200) throw err(422, 'VALIDATION_FAILED', '留言上限 200 字');
        const coupon = body.coupon_id
          ? state.coupons?.[u.id]?.find((c) => c.id === body.coupon_id || c.code === body.coupon_id)
          : undefined;
        if (
          body.coupon_id &&
          (!coupon?.claimed ||
            coupon.used_order_id ||
            Date.parse(coupon.expires_at) <= now() ||
            cart.subtotal_cents < coupon.min_cents)
        )
          throw err(422, 'COUPON_INVALID', '優惠券未領取、已使用、已過期或未滿使用門檻');
        const points = body.points ?? 0;
        if (!Number.isInteger(points) || points < 0 || points > walletOf(state, u.id).balance)
          throw err(422, 'POINTS_INVALID', '積分餘額不足或數量無效');
        const totals = checkoutTotals(cart.subtotal_cents, method, coupon, points);
        if (points * 100 !== totals.points_cents) throw err(422, 'POINTS_LIMIT', '積分最多抵扣商品淨額 10%');
        for (const it of cart.items) {
          const p = findProduct(it.product.id, true);
          const v = skuOf(p, it.sku?.id);
          const target = v ?? p;
          target.reserved_stock = (target.reserved_stock ?? 0) + it.quantity;
          if (!v && campaignActive(p, now())) p.campaign!.sold += it.quantity;
          p.sold_count = (p.sold_count ?? 0) + it.quantity; // §12 @a3d4304
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
          ...totals,
          shipping_method: method,
          note: body.note?.trim() ?? '',
          points_used: points,
          reservation_expires_at: new Date(now() + 30 * 60000).toISOString(),
          reservation_active: true,
          status_history: [{ status: 'pending', at: new Date(now()).toISOString() }],
          payment_method: null,
          paid_at: null,
          shipping_address: { recipient: addr.recipient, phone: addr.phone, region: addr.region, line1: addr.line1 },
          currency: cart.items[0].product.currency,
          items: cart.items.map((it) => ({
            product_id: it.product.id,
            sku_id: it.sku?.id ?? null,
            sku_options: it.sku?.options ?? null,
            name: it.product.name,
            unit_price_cents: it.product.price_cents,
            quantity: it.quantity,
            line_total_cents: it.line_total_cents,
          })),
          total_cents: totals.total_cents,
          created_at: new Date(now()).toISOString(),
        };
        (state.orders[u.id] ??= []).unshift(order);
        state.idempotency[ik] = order.id;
        (state.idempotency_body ??= {})[ik] = bodyHash;
        if (coupon) coupon.used_order_id = order.id;
        recordPoints(state, u.id, -points, '結帳積分抵扣', order.id, order.created_at);
        if (!body.buy_now)
          state.carts[u.id] = (state.carts[u.id] ?? []).filter((l) => !cart.items.some((it) => it.id === l.id));
        return order;
      }),
    listOrders: (cursor, q = {}) =>
      run(() =>
        paginate(
          (state.orders[currentUser().id] ?? []).filter(
            (o) =>
              !o.hidden &&
              (!q.status || o.status === q.status) &&
              (!q.needs_review ||
                (o.status === 'delivered' &&
                  o.items.some((_, i) => !state.reviews?.some((r) => r.order_id === o.id && r.item_index === i)))),
          ),
          cursor,
          10,
        ),
      ),
    getOrder: (oid) =>
      run(() => {
        const o = (state.orders[currentUser().id] ?? []).find((x) => x.id === oid);
        if (!o) throw err(404, 'NOT_FOUND', '找不到訂單');
        return o;
      }),
    payOrder: (oid, pay, key) =>
      run(() => {
        // CONTRACT.md §13 @a3d4304 check order: order exists → replay → validation → pending → simulate.
        const u = currentUser();
        if (!key) throw err(400, 'IDEMPOTENCY_KEY_REQUIRED', '缺少 Idempotency-Key');
        const o = (state.orders[u.id] ?? []).find((x) => x.id === oid);
        if (!o) throw err(404, 'NOT_FOUND', '找不到訂單');
        const ik = `${u.id}:pay:${key}`;
        const hash = stableStringify(pay);
        const prev = state.idempotency[ik];
        if (prev) {
          // §10/§13: only successful payments keep the key.
          if (prev !== o.id || state.idempotency_body?.[ik] !== hash)
            throw err(409, 'IDEMPOTENCY_KEY_REUSED', '此 Idempotency-Key 已用於另一個請求');
          return o;
        }
        if (pay.method !== 'mock_card' && pay.method !== 'mock_alipay')
          throw err(422, 'VALIDATION_FAILED', '付款方式無效');
        if (pay.simulate !== 'success' && pay.simulate !== 'failure')
          throw err(422, 'VALIDATION_FAILED', '模擬結果無效');
        if (o.status !== 'pending')
          throw err(409, 'ORDER_NOT_PAYABLE', o.status === 'paid' ? '此訂單已付款' : '此訂單不可付款');
        if (pay.simulate === 'failure') throw err(402, 'PAYMENT_DECLINED', '付款失敗（模擬），請重試或更換付款方式');
        releaseReservation(o);
        o.payment_method = pay.method;
        transition(o, 'paid', 'system');
        o.paid_at = o.status_history!.at(-1)!.at;
        state.idempotency[ik] = o.id;
        (state.idempotency_body ??= {})[ik] = hash;
        return o;
      }),
    cancelOrder: (oid, reason = '買家取消') =>
      run(() => {
        if (!reason.trim() || reason.length > 200) throw err(422, 'VALIDATION_FAILED', '請選擇取消原因');
        const o = ownOrder(oid);
        o.cancellation_reason = reason.trim();
        transition(o, 'cancelled', 'buyer');
        restock(o, currentUser().id);
        return o;
      }),
    confirmDelivery: (oid) =>
      run(() => {
        const o = transition(ownOrder(oid), 'delivered', 'buyer');
        o.points_earned = Math.floor(Math.max(0, o.total_cents - (o.shipping_cents ?? 0)) / 100);
        recordPoints(state, currentUser().id, o.points_earned, '完成訂單獲得積分', o.id, new Date(now()).toISOString());
        o.shipment?.events.push({ at: new Date(now()).toISOString(), description: '買家已確認收貨' });
        return o;
      }),
    listStaffOrders: (q = {}) =>
      run(() => {
        requireStaff();
        const all = allOrders()
          .filter((o) => !q.status || o.status === q.status)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return paginate(all, q.cursor, 20);
      }),
    updateStaffOrderStatus: (oid, status) =>
      run(() => {
        // Error order: 403/422 → 404 → 409 INVALID_TRANSITION.
        requireStaff();
        if (status !== 'shipped' && status !== 'cancelled') throw err(422, 'VALIDATION_FAILED', '狀態無效');
        const o = allOrders().find((x) => x.id === oid);
        if (!o) throw err(404, 'NOT_FOUND', '找不到訂單');
        const live = (state.orders[o.buyer.id] ?? []).find((x) => x.id === oid)!;
        transition(live, status, 'staff');
        if (status === 'cancelled') restock(live, o.buyer.id);
        if (status === 'shipped')
          live.shipment = {
            carrier: '示範快遞',
            tracking_number: `MOCK${live.id.toUpperCase()}`,
            events: [{ at: new Date(now()).toISOString(), description: '賣家已交寄，快遞已收件（模擬）' }],
          };
        return { ...live, buyer: o.buyer };
      }),
    listAddresses: () => run(() => sortAddresses(addressesOf(currentUser().id))),
    createAddress: (input) =>
      run(() => {
        const u = currentUser();
        const errors = validateAddress(input);
        const first = Object.values(errors)[0];
        if (first) throw err(422, 'VALIDATION_FAILED', first);
        const list = addressesOf(u.id);
        if (list.length >= MAX_ADDRESSES) throw err(422, 'ADDRESS_LIMIT', `最多只可儲存 ${MAX_ADDRESSES} 個地址`);
        const makeDefault = !!input.is_default || list.length === 0;
        if (makeDefault) for (const a of list) a.is_default = false;
        const a: Address = {
          id: id('addr'),
          recipient: input.recipient.trim(),
          phone: normalisePhone(input.phone),
          region: input.region,
          line1: input.line1.trim(),
          is_default: makeDefault,
          created_at: new Date(now()).toISOString(),
        };
        list.push(a);
        return a;
      }),
    // §12 @a3d4304 planned routes (#44). Deleted addresses are removed from the book; orders keep their snapshot.
    updateAddress: (aid, input) =>
      run(() => {
        const a = ownAddress(aid);
        const first = Object.values(validateAddress(input))[0];
        if (first) throw err(422, 'VALIDATION_FAILED', first);
        Object.assign(a, {
          recipient: input.recipient.trim(),
          phone: normalisePhone(input.phone),
          region: input.region,
          line1: input.line1.trim(),
        });
        return a;
      }),
    deleteAddress: (aid) =>
      run(() => {
        const a = ownAddress(aid);
        const list = addressesOf(currentUser().id);
        list.splice(list.indexOf(a), 1);
        if (a.is_default && list.length) {
          const newest = [...list].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
          newest.is_default = true;
        }
      }),
    setDefaultAddress: (aid) =>
      run(() => {
        const a = ownAddress(aid);
        for (const x of addressesOf(currentUser().id)) x.is_default = x === a;
        return a;
      }),
    createProduct: (input) =>
      run(() => {
        requireStaff();
        validateProduct(input);
        if (state.products.some((p) => p.slug === input.slug)) throw err(409, 'SLUG_TAKEN', '此 slug 已被使用');
        const p: Product = {
          ...input,
          id: id('p'),
          in_stock: input.stock > 0,
          created_at: new Date(now()).toISOString(),
        };
        syncVariantTotals(p);
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
          if (
            (patch.price_cents !== undefined && patch.price_cents !== p.price_cents) ||
            (patch.stock !== undefined && patch.stock !== p.stock)
          )
            throw err(422, 'VARIANT_MANAGED', '此商品設有規格，價格及庫存須按規格修改');
        }
        if (patch.slug && state.products.some((x) => x.slug === patch.slug && x.id !== p.id))
          throw err(409, 'SLUG_TAKEN', '此 slug 已被使用');
        if (
          patch.options &&
          p.variants?.some(
            (v) =>
              v.active !== false &&
              (patch.options!.length !== Object.keys(v.options).length ||
                patch.options!.some((o) => !o.values.includes(v.options[o.name]))),
          )
        )
          throw err(422, 'OPTIONS_IN_USE', '既有規格仍使用這些選項，請先停用或更新規格');
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
        for (const uid of Object.keys(state.carts))
          state.carts[uid] = state.carts[uid].filter((l) => l.product_id !== p.id);
      }),
  };

  return {
    ...api,
    get state() {
      return state;
    },
    reset() {
      storage?.removeItem(STORAGE_KEY);
      storage?.removeItem(LEGACY_KEY);
      state = freshState();
      ready = migratePasswords();
    },
  };
}
