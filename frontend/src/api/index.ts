import { createMockApi } from './mock';
import { createRealApi } from './real';
import type { ShopApi } from './types';

export * from './types';
export { formatPrice } from './money';
export { tokenStore } from './token';

// Builds require VITE_API_MODE (see build-env.ts); only the dev server falls back to mock.
export const API_MODE: 'mock' | 'real' = import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock';
/** {slug} is a per-deployment shop constant. */
export const SHOP_SLUG: string = import.meta.env.VITE_SHOP_SLUG || 'main';

const mock = API_MODE === 'mock' ? createMockApi({ latency: [150, 450], persist: true }) : null;

export const api: ShopApi =
  mock ?? createRealApi(import.meta.env.VITE_API_BASE_URL || '/api', SHOP_SLUG);

/** Mock mode only: wipe local demo data. */
export const resetMockData = mock ? () => mock.reset() : null;
