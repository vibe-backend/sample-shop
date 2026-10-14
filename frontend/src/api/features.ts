import type { Me, OrderStatus, Page, Product, ProductVariant, SkuOptions } from './types';

export type ShippingMethod = 'courier' | 'pickup';
export interface Coupon {
  id: string;
  code: string;
  name: string;
  min_cents: number;
  discount_cents: number;
  expires_at: string;
  claimed?: boolean;
  used_order_id?: string | null;
}
export interface PointsEntry {
  at: string;
  amount: number;
  reason: string;
  order_id: string;
}
export interface Wallet {
  balance: number;
  entries: PointsEntry[];
}
export interface Review {
  id: string;
  product_id: string;
  order_id: string;
  item_index: number;
  author: string;
  rating: number;
  text: string;
  images: string[];
  created_at: string;
}
export interface ReviewInput {
  order_id: string;
  item_index: number;
  rating: number;
  text: string;
  images: string[];
}
export interface Question {
  id: string;
  product_id: string;
  text: string;
  author: string;
  created_at: string;
  answers: { text: string; author: string; staff: boolean; at: string }[];
}
export type ServiceStatus = 'pending' | 'approved' | 'rejected' | 'refunded';
export interface AfterSale {
  id: string;
  order_id: string;
  item_index: number;
  type: 'refund' | 'return';
  reason: string;
  description: string;
  images: string[];
  status: ServiceStatus;
  amount_cents: number;
  buyer_id: string;
  return_shipment?: { carrier: string; tracking_number: string };
  history: { at: string; status: ServiceStatus; message: string }[];
}
export interface AfterSaleInput {
  order_id: string;
  item_index: number;
  type: 'refund' | 'return';
  reason: string;
  description: string;
  images: string[];
}
export interface VariantInput {
  options: SkuOptions;
  price_cents: number;
  stock: number;
  image_url?: string | null;
  active: boolean;
}
export interface OrderQuery {
  status?: OrderStatus;
  needs_review?: boolean;
}
export interface OrderCounts {
  all: number;
  pending: number;
  paid: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  needs_review: number;
}
export interface CheckoutTotals {
  subtotal_cents: number;
  shipping_cents: number;
  promotion_cents: number;
  coupon_cents: number;
  points_cents: number;
  total_cents: number;
}
export interface ShopFeatures {
  updateMe(input: { display_name: string }): Promise<Me>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  requestPasswordReset(email: string): Promise<{ message: string; demo_code?: string }>;
  resetPassword(email: string, code: string, password: string): Promise<void>;
  listFavorites(): Promise<Product[]>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  followShop(follow: boolean): Promise<void>;
  isFollowingShop(): Promise<boolean>;
  listCoupons(): Promise<Coupon[]>;
  claimCoupon(id: string): Promise<Coupon>;
  wallet(): Promise<Wallet>;
  orderCounts(): Promise<OrderCounts>;
  hideOrder(id: string): Promise<void>;
  reorder(id: string): Promise<{ skipped: string[] }>;
  listReviews(productId: string, q?: { cursor?: string; images_only?: boolean }): Promise<Page<Review>>;
  createReview(productId: string, input: ReviewInput): Promise<Review>;
  listQuestions(productId: string): Promise<Question[]>;
  askQuestion(productId: string, text: string): Promise<Question>;
  answerQuestion(id: string, text: string): Promise<Question>;
  listAfterSales(orderId?: string): Promise<AfterSale[]>;
  createAfterSale(input: AfterSaleInput): Promise<AfterSale>;
  decideAfterSale(id: string, status: 'approved' | 'rejected' | 'refunded', reason: string): Promise<AfterSale>;
  submitReturnShipment(id: string, carrier: string, trackingNumber: string): Promise<AfterSale>;
  listVariants(productId: string): Promise<ProductVariant[]>;
  createVariant(productId: string, input: VariantInput): Promise<ProductVariant>;
  updateVariant(
    productId: string,
    skuId: string,
    input: Partial<VariantInput>,
    version: number,
  ): Promise<ProductVariant>;
}
