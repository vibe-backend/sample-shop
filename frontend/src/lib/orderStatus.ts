import type { OrderStatus } from '../api/types';

/** Who may perform a transition. */
export type Actor = 'buyer' | 'staff' | 'system';

/**
 * Order state machine (#34): pending → paid → shipped → delivered; pending/paid → cancelled.
 * `system` = payment gateway result.
 */
export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>> = {
  pending: { paid: ['system'], cancelled: ['buyer', 'staff'] },
  paid: { shipped: ['staff'], cancelled: ['buyer', 'staff'] },
  shipped: { delivered: ['buyer'] },
  delivered: {},
  cancelled: {},
};

export const canTransition = (from: OrderStatus, to: OrderStatus, actor: Actor): boolean => !!TRANSITIONS[from]?.[to]?.includes(actor);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
};

/** Buyer-facing next step, Taobao style. */
export const STATUS_HINT: Record<OrderStatus, string> = {
  pending: '請盡快完成付款。',
  paid: '賣家準備發貨中。',
  shipped: '商品運送中，收到後請確認收貨。',
  delivered: '交易完成，多謝惠顧！',
  cancelled: '訂單已取消。',
};

/** Happy-path steps for the progress indicator. */
export const STEPS: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered'];
