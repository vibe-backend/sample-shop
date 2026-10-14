import type { Product, ProductVariant, SkuOptions } from '../api/types';

/** Partial selection: spec name → chosen value. */
export type Selection = Record<string, string | undefined>;

export const hasVariants = (p: Pick<Product, 'options' | 'variants'>): boolean => !!p.options?.length && !!p.variants?.length;

const matches = (v: ProductVariant, sel: Selection) => Object.entries(sel).every(([k, val]) => val === undefined || v.options[k] === val);

/** The SKU for a complete selection, or null while any spec is still unpicked. */
export function findVariant(p: Pick<Product, 'options' | 'variants'>, sel: Selection): ProductVariant | null {
  if (!hasVariants(p)) return null;
  if (p.options!.some((o) => !sel[o.name])) return null;
  return p.variants!.find((v) => p.options!.every((o) => v.options[o.name] === sel[o.name])) ?? null;
}

/** Specs not yet chosen, in display order. */
export const missingOptions = (p: Pick<Product, 'options'>, sel: Selection): string[] => (p.options ?? []).filter((o) => !sel[o.name]).map((o) => o.name);

/**
 * Whether `value` can be picked for spec `name` given the other picks: some in-stock SKU
 * must combine it with every other currently chosen value (Taobao-style greying-out).
 */
export function isValueAvailable(p: Pick<Product, 'variants'>, sel: Selection, name: string, value: string): boolean {
  const probe = { ...sel, [name]: value };
  return (p.variants ?? []).some((v) => v.in_stock && matches(v, probe));
}

/** [min, max] price over all listed SKUs, zero-stock included (CONTRACT.md @dd5bf0b §9). */
export function priceRange(p: Pick<Product, 'price_cents' | 'variants'>): [number, number] {
  if (!p.variants?.length) return [p.price_cents, p.price_cents];
  const prices = p.variants.map((v) => v.price_cents);
  return [Math.min(...prices), Math.max(...prices)];
}

/** "顏色：黑色／尺寸：大" */
export const skuLabel = (o: SkuOptions | null | undefined): string =>
  o ? Object.entries(o).map(([k, v]) => `${k}：${v}`).join('／') : '';
