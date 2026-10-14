// Types mirroring the agreed sample-shop API contract.
// Timestamps are ISO 8601 UTC strings; money is integer minor units (*_cents).

export type Role = 'staff';

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error implements ApiError {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Seconds from a Retry-After header, when the server sent one. */
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** POST /users/v1/login and /users/v1/register */
export interface AuthToken {
  access_token: string;
  /** ISO 8601 UTC expiry */
  expires_at: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterInput extends Credentials {
  display_name: string;
}

/** GET /users/v1/me */
export interface Me {
  id: string;
  email: string;
  display_name: string;
  roles: Role[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_urls: string[];
  category: string;
  stock: number;
  in_stock: boolean;
  active: boolean;
  created_at: string;
  /** Optional display field (「已售 N」); hidden when absent, e.g. real mode until the contract adds it. */
  sold_count?: number;
  /**
   * Contract addition (#17): spec groups, e.g. [{ name: '顏色', values: ['黑色', '米白'] }].
   * Absent/empty → product has no variants. When present, price_cents is the lowest SKU price
   * and stock is the sum of SKU stock.
   */
  options?: ProductOption[];
  /** Contract addition (#17): one entry per purchasable spec combination. */
  variants?: ProductVariant[];
}

/** spec name → value, e.g. { 顏色: '黑色', 尺寸: '大' } */
export type SkuOptions = Record<string, string>;

export interface ProductOption {
  name: string;
  values: string[];
}

export interface ProductVariant {
  /** sku_id */
  id: string;
  options: SkuOptions;
  price_cents: number;
  stock: number;
  in_stock: boolean;
  image_url?: string | null;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export type ProductSort = 'price_asc' | 'price_desc' | 'created_at_asc' | 'created_at_desc';

export interface ProductQuery {
  q?: string;
  category?: string;
  min_price_cents?: number;
  max_price_cents?: number;
  sort?: ProductSort;
  cursor?: string;
  limit?: number;
}

/** CONTRACT.md §3 @a3d4304: `sold_count` is server-maintained and never part of the input. */
export type ProductInput = Omit<Product, 'id' | 'in_stock' | 'created_at' | 'sold_count'>;

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  in_stock: boolean;
}

/** Contract addition (#17): the chosen SKU of a cart line / order item. */
export interface SkuRef {
  id: string;
  options: SkuOptions;
}

export interface CartItem {
  id: string;
  /** For SKU lines, price_cents / in_stock / image_url describe the chosen SKU. */
  product: ProductSummary;
  sku?: SkuRef | null;
  quantity: number;
  line_total_cents: number;
}

export interface Cart {
  items: CartItem[];
  subtotal_cents: number;
}

/** Contract gap: the status values are not fixed; these are assumed. */
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  product_id: string;
  /** Contract addition (#17) */
  sku_id?: string | null;
  /** Contract addition (#17): snapshot of the chosen spec at order time. */
  sku_options?: SkuOptions | null;
  name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

/**
 * Saved delivery address — CONTRACT.md §12 @a3d4304 (backend/markdown-v1), reusable by #44.
 * GET/POST /shop/v1/addresses (§2 #17/#18; JWT, own addresses only).
 */
export interface Address {
  id: string;
  recipient: string;
  /** 8-digit HK number, stored normalised (no +852 / spaces). */
  phone: string;
  /** One of 香港島 / 九龍 / 新界 / 離島 */
  region: string;
  /** 詳細地址 */
  line1: string;
  is_default: boolean;
  created_at: string;
}

export interface AddressInput {
  recipient: string;
  phone: string;
  region: string;
  line1: string;
  is_default?: boolean;
}

/** Copied onto the order at placement; later address-book edits never change it. */
export type AddressSnapshot = Pick<Address, 'recipient' | 'phone' | 'region' | 'line1'>;

/** CONTRACT.md §13 @a3d4304: demo payment methods; no real money moves. */
export type PaymentMethod = 'mock_card' | 'mock_alipay';

/** §13 @a3d4304: POST /shop/v1/orders/{id}/payments body (both fields validated → 422 VALIDATION_FAILED). */
export interface PaymentInput {
  method: PaymentMethod;
  /** Demo only: forces the simulated gateway result. */
  simulate: 'success' | 'failure';
}

export interface Order {
  id: string;
  status: OrderStatus;
  /** §13 @a3d4304: always present; null until paid. */
  payment_method: PaymentMethod | null;
  /** §13 @a3d4304: ISO 8601 UTC; always present, null until paid. */
  paid_at: string | null;
  /** §12 @a3d4304: snapshot written at order time; null/absent only for legacy orders placed before addresses existed. */
  shipping_address?: AddressSnapshot | null;
  items: OrderItem[];
  total_cents: number;
  currency: string;
  created_at: string;
}

/** POST /shop/v1/orders body — §2 #14 / §12 @a3d4304: `address_id` required (422 ADDRESS_REQUIRED, 404 ADDRESS_NOT_FOUND). */
export interface CreateOrderInput {
  address_id: string;
}

export interface ShopApi {
  login(c: Credentials): Promise<AuthToken>;
  register(r: RegisterInput): Promise<AuthToken>;
  me(): Promise<Me>;
  listProducts(q?: ProductQuery): Promise<Page<Product>>;
  /** Staff only; includes inactive products. GET /catalog/v1/{slug}/staff/products */
  listStaffProducts(q?: ProductQuery): Promise<Page<Product>>;
  getProduct(id: string): Promise<Product>;
  getCart(): Promise<Cart>;
  addCartItem(productId: string, quantity: number, skuId?: string | null): Promise<Cart>;
  updateCartItem(itemId: string, quantity: number): Promise<Cart>;
  removeCartItem(itemId: string): Promise<Cart>;
  /**
   * Idempotency-Key is required (CONTRACT.md §10 @a3d4304, backend/markdown-v1). Same key + same
   * body replays the original order; same key + different body → 409 IDEMPOTENCY_KEY_REUSED.
   */
  createOrder(idempotencyKey: string, body: CreateOrderInput): Promise<Order>;
  listOrders(cursor?: string): Promise<Page<Order>>;
  getOrder(id: string): Promise<Order>;
  /**
   * §13 @a3d4304: simulated payment for a pending order. Success → 200 `paid`; failure → 402
   * PAYMENT_DECLINED, nothing written, key not kept. Same key + different order/body → 409 IDEMPOTENCY_KEY_REUSED.
   */
  payOrder(orderId: string, p: PaymentInput, idempotencyKey: string): Promise<Order>;
  /** §2 #17 / §12 @a3d4304: GET /shop/v1/addresses → Address[] (not paged), default first, then newest first. */
  listAddresses(): Promise<Address[]>;
  /** §2 #18 / §12 @a3d4304: POST /shop/v1/addresses → 201; 422 VALIDATION_FAILED, 422 ADDRESS_LIMIT. */
  createAddress(a: AddressInput): Promise<Address>;
  createProduct(p: ProductInput): Promise<Product>;
  updateProduct(id: string, p: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
}
