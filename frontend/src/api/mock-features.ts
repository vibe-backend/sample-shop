import { passwordHash, passwordMatches } from '../lib/password';
import { syncVariantTotals, type SeedUser } from './seed';
import {
  ApiRequestError,
  type Product,
  type ProductVariant,
  type ShopFeatures,
  type Review,
  type Question,
  type Coupon,
  type Wallet,
  type AfterSale,
  type VariantInput,
  type OrderCounts,
} from './types';
import type { MockState } from './mock';

export interface FeatureState {
  favorites?: Record<string, string[]>;
  following?: Record<string, boolean>;
  coupons?: Record<string, Coupon[]>;
  wallets?: Record<string, Wallet>;
  reviews?: Review[];
  questions?: Question[];
  afterSales?: AfterSale[];
}
export interface FeatureContext {
  getState(): MockState;
  run<T>(fn: () => T | Promise<T>): Promise<T>;
  currentUser(): SeedUser;
  requireStaff(): void;
  findProduct(id: string, includeInactive?: boolean): Product;
  id(prefix: string): string;
  now(): number;
}
const fail = (status: number, code: string, message: string): never => {
  throw new ApiRequestError(status, code, message);
};
const validateText = (text: string, max: number) => {
  if (!text.trim() || text.length > max) fail(422, 'VALIDATION_FAILED', `請輸入 1–${max} 字`);
};
export function validateImages(images: string[]) {
  if (
    !Array.isArray(images) ||
    images.length > 3 ||
    images.some(
      (x) =>
        typeof x !== 'string' ||
        x.length > 700_000 ||
        !(/^data:image\/(png|jpeg|webp|gif);base64,/.test(x) || /^https:\/\//.test(x)),
    )
  )
    fail(422, 'VALIDATION_FAILED', '最多 3 張圖片，每張不超過 500 KB');
}
export function couponCatalog(now: number): Coupon[] {
  return [
    {
      id: 'welcome',
      code: 'WELCOME20',
      name: '滿 HK$200 減 HK$20',
      min_cents: 20000,
      discount_cents: 2000,
      expires_at: new Date(now + 30 * 86400000).toISOString(),
    },
    {
      id: 'save50',
      code: 'SAVE50',
      name: '滿 HK$500 減 HK$50',
      min_cents: 50000,
      discount_cents: 5000,
      expires_at: new Date(now + 30 * 86400000).toISOString(),
    },
  ];
}
export function walletOf(state: MockState, uid: string): Wallet {
  return ((state.wallets ??= {})[uid] ??= { balance: 0, entries: [] });
}
export function recordPoints(
  state: MockState,
  uid: string,
  amount: number,
  reason: string,
  orderId: string,
  at: string,
) {
  if (!amount) return;
  const w = walletOf(state, uid);
  w.balance += amount;
  w.entries.unshift({ amount, reason, order_id: orderId, at });
}
export function createMockFeatures(c: FeatureContext): ShopFeatures {
  const { run, currentUser, requireStaff, findProduct, id, now } = c;
  const state = () => c.getState();
  const userOrders = () => state().orders[currentUser().id] ?? [];
  const ownOrder = (oid: string) => userOrders().find((o) => o.id === oid) ?? fail(404, 'NOT_FOUND', '找不到訂單');
  const stamp = () => new Date(now()).toISOString();
  const ownService = (sid: string): AfterSale =>
    (state().afterSales ?? []).find(
      (s) => s.id === sid && (s.buyer_id === currentUser().id || currentUser().roles.includes('staff')),
    ) ?? fail(404, 'NOT_FOUND', '找不到售後申請');
  const resets = new Map<string, { code: string; expires: number; user_id?: string; attempts: number }>();
  const couponList = (uid: string) => ((state().coupons ??= {})[uid] ??= couponCatalog(now()));
  const validateVariant = (p: Product, v: VariantInput, ignoreId?: string) => {
    if (
      !p.options?.length ||
      Object.keys(v.options).length !== p.options.length ||
      p.options.some((o) => !o.values.includes(v.options[o.name]))
    )
      fail(422, 'VALIDATION_FAILED', '規格鍵值必須符合商品選項');
    if (
      !Number.isInteger(v.price_cents) ||
      v.price_cents < 0 ||
      !Number.isInteger(v.stock) ||
      v.stock < 0 ||
      typeof v.active !== 'boolean'
    )
      fail(422, 'VALIDATION_FAILED', '價格、庫存或啟用狀態無效');
    if (p.variants?.some((x) => x.id !== ignoreId && p.options!.every((o) => x.options[o.name] === v.options[o.name])))
      fail(409, 'SKU_EXISTS', '此規格組合已存在');
  };
  return {
    updateMe: (input) =>
      run(() => {
        validateText(input.display_name, 80);
        const u = currentUser();
        u.display_name = input.display_name.trim();
        return { id: u.id, email: u.email, display_name: u.display_name, roles: u.roles };
      }),
    changePassword: (oldPassword, password) =>
      run(async () => {
        const u = currentUser();
        if (!(await passwordMatches(oldPassword, u.password_hash ?? '')))
          fail(401, 'INVALID_CREDENTIALS', '舊密碼不正確');
        if (password.length < 8) fail(422, 'WEAK_PASSWORD', '新密碼最少 8 個字元');
        u.password_hash = await passwordHash(password);
        for (const [token, session] of Object.entries(state().sessions))
          if (session.user_id === u.id) delete state().sessions[token];
      }),
    requestPasswordReset: (email) =>
      run(() => {
        const e = email.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) fail(422, 'VALIDATION_FAILED', '電郵格式不正確');
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
        resets.set(e, {
          code,
          expires: now() + 10 * 60000,
          user_id: state().users.find((u) => u.email.toLowerCase() === e)?.id,
          attempts: 0,
        });
        // Same response and mock-code display for registered and unknown addresses.
        return { message: '如電郵已註冊，會收到重設指示。', demo_code: code };
      }),
    resetPassword: (email, code, password) =>
      run(async () => {
        const e = email.trim().toLowerCase();
        const r = resets.get(e);
        if (!r || ++r.attempts > 5 || r.expires <= now() || r.code !== code)
          fail(422, 'INVALID_RESET_CODE', '驗證碼無效或已過期');
        if (password.length < 8) fail(422, 'WEAK_PASSWORD', '密碼最少 8 個字元');
        resets.delete(e);
        const hash = await passwordHash(password);
        const u = state().users.find((u) => u.id === r!.user_id);
        if (u) {
          u.password_hash = hash;
          for (const [t, s] of Object.entries(state().sessions)) if (s.user_id === u.id) delete state().sessions[t];
        }
        resets.delete(e);
      }),
    listFavorites: () =>
      run(() => {
        const ids = state().favorites?.[currentUser().id] ?? [];
        return ids.flatMap((pid) => {
          const p = state().products.find((p) => p.id === pid);
          return p ? [p] : [];
        });
      }),
    setFavorite: (pid, favorite) =>
      run(() => {
        const uid = currentUser().id;
        const p = findProduct(pid, true);
        const xs = ((state().favorites ??= {})[uid] ??= []);
        if (favorite && !xs.includes(p.id)) xs.unshift(p.id);
        if (!favorite) state().favorites![uid] = xs.filter((x) => x !== p.id);
      }),
    followShop: (follow) =>
      run(() => {
        (state().following ??= {})[currentUser().id] = follow;
      }),
    isFollowingShop: () => run(() => state().following?.[currentUser().id] ?? false),
    listCoupons: () => run(() => couponList(currentUser().id)),
    claimCoupon: (cid) =>
      run(() => {
        const co = couponList(currentUser().id).find((x) => x.id === cid) ?? fail(404, 'NOT_FOUND', '找不到優惠券');
        if (co.claimed) fail(409, 'COUPON_CLAIMED', '每張優惠券只可領取一次');
        if (Date.parse(co.expires_at) <= now()) fail(422, 'COUPON_EXPIRED', '優惠券已過期');
        co.claimed = true;
        return co;
      }),
    wallet: () => run(() => walletOf(state(), currentUser().id)),
    orderCounts: () =>
      run(() => {
        const counts: OrderCounts = {
          all: 0,
          pending: 0,
          paid: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
          needs_review: 0,
        };
        for (const o of userOrders().filter((o) => !o.hidden)) {
          counts.all++;
          counts[o.status]++;
          if (
            o.status === 'delivered' &&
            o.items.some((_, i) => !state().reviews?.some((r) => r.order_id === o.id && r.item_index === i))
          )
            counts.needs_review++;
        }
        return counts;
      }),
    hideOrder: (oid) =>
      run(() => {
        const o = ownOrder(oid);
        if (o.status !== 'delivered' && o.status !== 'cancelled')
          fail(409, 'INVALID_TRANSITION', '只可刪除已完成或已取消的訂單');
        o.hidden = true;
      }),
    reorder: (oid) =>
      run(() => {
        const o = ownOrder(oid);
        const uid = currentUser().id;
        const lines = (state().carts[uid] ??= []);
        const skipped: string[] = [];
        for (const it of o.items) {
          const p = state().products.find((p) => p.id === it.product_id);
          const v = it.sku_id ? p?.variants?.find((v) => v.id === it.sku_id && v.active !== false) : undefined;
          const existing = lines.find((l) => l.product_id === p?.id && (l.sku_id ?? null) === (it.sku_id ?? null));
          const qty = (existing?.quantity ?? 0) + it.quantity;
          if (
            !p?.active ||
            (it.sku_id && !v) ||
            (!it.sku_id && p.options?.length) ||
            qty > (v?.stock ?? p.stock) ||
            qty > 99
          ) {
            skipped.push(it.name);
            continue;
          }
          if (existing) existing.quantity = qty;
          else
            lines.push({
              id: id('ci'),
              product_id: p.id,
              sku_id: it.sku_id,
              quantity: it.quantity,
              original_price_cents: v?.price_cents ?? p.price_cents,
            });
        }
        return { skipped };
      }),
    listReviews: (pid, q = {}) =>
      run(() => {
        findProduct(pid);
        const all = (state().reviews ?? []).filter((r) => r.product_id === pid && (!q.images_only || r.images.length));
        let start = 0;
        try {
          if (q.cursor) start = Number(atob(q.cursor));
        } catch {
          fail(400, 'INVALID_CURSOR', '分頁參數無效');
        }
        if (!Number.isInteger(start) || start < 0) fail(400, 'INVALID_CURSOR', '分頁參數無效');
        return {
          items: all.slice(start, start + 5),
          next_cursor: start + 5 < all.length ? btoa(String(start + 5)) : null,
        };
      }),
    createReview: (pid, input) =>
      run(() => {
        const o = ownOrder(input.order_id);
        const it = o.items[input.item_index];
        if (o.status !== 'delivered' || !it || it.product_id !== pid)
          fail(403, 'REVIEW_NOT_ALLOWED', '只可評價已收貨的商品');
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 || input.text.length > 500)
          fail(422, 'VALIDATION_FAILED', '評分須為 1–5 星，文字上限 500 字');
        validateImages(input.images);
        const reviews = (state().reviews ??= []);
        if (reviews.some((r) => r.order_id === o.id && r.item_index === input.item_index))
          fail(409, 'REVIEW_EXISTS', '此訂單項目已評價');
        const r: Review = {
          ...input,
          text: input.text.trim(),
          id: id('review'),
          product_id: pid,
          author: currentUser().display_name,
          created_at: stamp(),
        };
        reviews.unshift(r);
        const p = findProduct(pid, true);
        const productReviews = reviews.filter((r) => r.product_id === pid);
        p.review_count = productReviews.length;
        p.rating_avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
        return r;
      }),
    listQuestions: (pid) =>
      run(() => {
        const p = findProduct(pid);
        return (state().questions ?? []).filter((q) => q.product_id === p.id);
      }),
    askQuestion: (pid, text) =>
      run(() => {
        validateText(text, 500);
        const p = findProduct(pid);
        const q: Question = {
          id: id('q'),
          product_id: p.id,
          text: text.trim(),
          author: currentUser().display_name,
          created_at: stamp(),
          answers: [],
        };
        (state().questions ??= []).unshift(q);
        return q;
      }),
    answerQuestion: (qid, text) =>
      run(() => {
        validateText(text, 500);
        const u = currentUser();
        const q = state().questions?.find((q) => q.id === qid) ?? fail(404, 'NOT_FOUND', '找不到問題');
        const staff = u.roles.includes('staff');
        if (
          !staff &&
          !userOrders().some((o) => o.status === 'delivered' && o.items.some((it) => it.product_id === q.product_id))
        )
          fail(403, 'FORBIDDEN', '只有已購買家或店務人員可以回答');
        q.answers.push({ text: text.trim(), author: u.display_name, staff, at: stamp() });
        return q;
      }),
    listAfterSales: (oid) =>
      run(() => {
        const u = currentUser();
        return (state().afterSales ?? []).filter(
          (s) => (s.buyer_id === u.id || u.roles.includes('staff')) && (!oid || s.order_id === oid),
        );
      }),
    createAfterSale: (input) =>
      run(() => {
        const o = ownOrder(input.order_id);
        const it = o.items[input.item_index];
        if (!['paid', 'shipped', 'delivered'].includes(o.status) || !it)
          fail(409, 'AFTERSALE_NOT_ALLOWED', '此訂單不可申請售後');
        if (!['refund', 'return'].includes(input.type)) fail(422, 'VALIDATION_FAILED', '售後類型無效');
        validateText(input.reason, 80);
        if (input.description.length > 500) fail(422, 'VALIDATION_FAILED', '說明上限 500 字');
        validateImages(input.images);
        if ((state().afterSales ?? []).some((s) => s.order_id === o.id && s.item_index === input.item_index))
          fail(409, 'AFTERSALE_EXISTS', '此訂單項目已有售後申請');
        if (input.reason === '無理由退貨') {
          const p = findProduct(it.product_id, true);
          const delivered = o.status_history?.find((h) => h.status === 'delivered');
          if (!p.return_days || !delivered || now() > Date.parse(delivered.at) + p.return_days * 86400000)
            fail(422, 'RETURN_WINDOW_EXPIRED', '無理由退貨期限已過或此商品不適用');
        }
        const merchandise = o.subtotal_cents ?? o.items.reduce((sum, it) => sum + it.line_total_cents, 0);
        const net = Math.max(0, o.total_cents - (o.shipping_cents ?? 0));
        // Allocate rounding to the final line so item refunds sum to the paid merchandise amount.
        const previous = o.items
          .slice(0, -1)
          .reduce((sum, it) => sum + Math.floor((net * it.line_total_cents) / Math.max(1, merchandise)), 0);
        const amount =
          input.item_index === o.items.length - 1
            ? net - previous
            : Math.floor((net * it.line_total_cents) / Math.max(1, merchandise));
        const s: AfterSale = {
          ...input,
          id: id('service'),
          status: 'pending',
          buyer_id: currentUser().id,
          amount_cents: amount,
          history: [{ at: stamp(), status: 'pending', message: input.reason }],
        };
        (state().afterSales ??= []).unshift(s);
        return s;
      }),
    decideAfterSale: (sid, status, reason) =>
      run(() => {
        requireStaff();
        validateText(reason, 500);
        const s = ownService(sid);
        if (
          !(s.status === 'pending' && (status === 'approved' || status === 'rejected')) &&
          !(s.status === 'approved' && status === 'refunded')
        )
          fail(409, 'INVALID_TRANSITION', '售後狀態不可如此變更');
        if (status === 'refunded' && s.type === 'return' && !s.return_shipment)
          fail(422, 'RETURN_SHIPMENT_REQUIRED', '請先填寫退貨物流單號');
        if (status === 'refunded') {
          const o =
            state().orders[s.buyer_id]?.find((o) => o.id === s.order_id) ?? fail(404, 'NOT_FOUND', '找不到訂單');
          o.refunded_cents = (o.refunded_cents ?? 0) + s.amount_cents;
          const w = walletOf(state(), s.buyer_id);
          const reverse = Math.min(
            w.balance,
            Math.floor(
              ((o.points_earned ?? 0) * s.amount_cents) / Math.max(1, o.total_cents - (o.shipping_cents ?? 0)),
            ),
          );
          recordPoints(state(), s.buyer_id, -reverse, '退款扣回積分', o.id, stamp());
        }
        s.status = status;
        s.history.push({ at: stamp(), status, message: reason.trim() });
        return s;
      }),
    submitReturnShipment: (sid, carrier, tracking) =>
      run(() => {
        const s = ownService(sid);
        if (s.buyer_id !== currentUser().id) fail(403, 'FORBIDDEN', '只有買家可以填寫');
        if (s.type !== 'return' || s.status !== 'approved') fail(409, 'INVALID_TRANSITION', '須先獲同意退貨');
        validateText(carrier, 80);
        validateText(tracking, 80);
        s.return_shipment = { carrier: carrier.trim(), tracking_number: tracking.trim() };
        s.history.push({ at: stamp(), status: 'approved', message: `退貨已寄出：${carrier} ${tracking}` });
        return s;
      }),
    listVariants: (pid) =>
      run(() => {
        requireStaff();
        return findProduct(pid, true).variants ?? [];
      }),
    createVariant: (pid, input) =>
      run(() => {
        requireStaff();
        const p = findProduct(pid, true);
        validateVariant(p, input);
        const v: ProductVariant = { ...input, id: id('sku'), version: 1, in_stock: input.active && input.stock > 0 };
        (p.variants ??= []).push(v);
        syncVariantTotals(p);
        return v;
      }),
    updateVariant: (pid, sid, input, version) =>
      run(() => {
        requireStaff();
        const p = findProduct(pid, true);
        const v = p.variants?.find((v) => v.id === sid) ?? fail(404, 'SKU_NOT_FOUND', '找不到規格');
        if (version !== (v.version ?? 1)) fail(412, 'PRECONDITION_FAILED', '規格已被修改，請重新載入');
        const next: VariantInput = { ...v, active: v.active !== false, ...input };
        validateVariant(p, next, v.id);
        Object.assign(v, next, { version: version + 1, in_stock: next.active && next.stock > 0 });
        syncVariantTotals(p);
        return v;
      }),
  };
}
