import type { CheckoutTotals, Coupon, Product, ShippingMethod } from '../api/types';

export const FREE_SHIPPING_CENTS = 30000;
export const PROMOTION_THRESHOLD_CENTS = 50000;
export const PROMOTION_DISCOUNT_CENTS = 2000;
export const SHIPPING_LABEL = { courier: '快遞配送', pickup: '門市自提' };
export function shippingCost(subtotal: number, method: ShippingMethod): number {
  return method === 'pickup' || subtotal >= FREE_SHIPPING_CENTS ? 0 : 3000;
}
export function checkoutTotals(subtotal: number, method: ShippingMethod, coupon?: Coupon, points = 0): CheckoutTotals {
  const promotion = subtotal >= PROMOTION_THRESHOLD_CENTS ? PROMOTION_DISCOUNT_CENTS : 0;
  const couponCents =
    coupon && subtotal >= coupon.min_cents ? Math.min(coupon.discount_cents, Math.max(0, subtotal - promotion)) : 0;
  const pointsCents = Math.min(
    Math.max(0, points) * 100,
    Math.floor((Math.max(0, subtotal - promotion - couponCents) * 0.1) / 100) * 100,
  );
  const shipping = shippingCost(subtotal, method);
  return {
    subtotal_cents: subtotal,
    shipping_cents: shipping,
    promotion_cents: promotion,
    coupon_cents: couponCents,
    points_cents: pointsCents,
    total_cents: Math.max(0, subtotal + shipping - promotion - couponCents - pointsCents),
  };
}
export function campaignActive(p: Product, now = Date.now()): boolean {
  const c = p.campaign;
  return !!c && Date.parse(c.starts_at) <= now && now < Date.parse(c.ends_at);
}
export function sellingPrice(p: Product, now = Date.now()): number {
  return campaignActive(p, now) && p.campaign!.sold < p.campaign!.limit ? p.campaign!.price_cents : p.price_cents;
}
export const CATEGORY_TREE = [
  { slug: 'kitchen', name: '廚房', icon: '☕', children: ['咖啡', '餐具'] },
  { slug: 'accessories', name: '配件', icon: '👜', children: ['手袋', '裝飾'] },
  { slug: 'stationery', name: '文具', icon: '📓', children: ['紙品', '書寫'] },
  { slug: 'home', name: '家居', icon: '💡', children: ['燈具', '香氛', '寢具'] },
  { slug: 'electronics', name: '電子', icon: '🎧', children: ['音訊', '支架'] },
  { slug: 'food', name: '食品', icon: '🍵', children: ['茶葉', '零食'] },
];
export const categorySlug = (name: string) => CATEGORY_TREE.find((c) => c.name === name)?.slug ?? '';
export const SHOP_INFO = {
  name: 'Sample Shop',
  description: '香港生活選物示範店',
  rating: 4.8,
  email: 'support@example.com',
  origin: '香港',
  dispatch: '1–2 個工作天',
};
