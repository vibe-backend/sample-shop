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

export type ProductInput = Omit<Product, 'id' | 'in_stock' | 'created_at'>;

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

export interface Order {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  total_cents: number;
  currency: string;
  created_at: string;
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
  /** Idempotency-Key is recommended, not required. */
  createOrder(idempotencyKey?: string): Promise<Order>;
  listOrders(cursor?: string): Promise<Page<Order>>;
  getOrder(id: string): Promise<Order>;
  createProduct(p: ProductInput): Promise<Product>;
  updateProduct(id: string, p: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
}
