import { describe, expect, it } from 'vitest';
import { seedProducts } from '../api/seed';
import { findVariant, hasVariants, isValueAvailable, missingOptions, priceRange, skuLabel } from './sku';

const tote = seedProducts().find((p) => p.slug === 'linen-tote')!;
const pen = seedProducts().find((p) => p.slug === 'fountain-pen')!;

describe('sku helpers', () => {
  it('detects variant products', () => {
    expect(hasVariants(tote)).toBe(true);
    expect(hasVariants(pen)).toBe(false);
  });
  it('finds a SKU only when every spec is chosen', () => {
    expect(findVariant(tote, { 顏色: '黑色' })).toBeNull();
    expect(findVariant(tote, { 顏色: '黑色', 尺寸: '標準' })).toMatchObject({ price_cents: 32000, stock: 5 });
    expect(missingOptions(tote, { 顏色: '黑色' })).toEqual(['尺寸']);
  });
  it('greys out values with no in-stock combination', () => {
    expect(isValueAvailable(tote, {}, '顏色', '橄欖綠')).toBe(false);
    expect(isValueAvailable(tote, {}, '顏色', '黑色')).toBe(true);
    expect(isValueAvailable(tote, { 顏色: '黑色' }, '尺寸', '大')).toBe(false);
    expect(isValueAvailable(tote, { 顏色: '米白' }, '尺寸', '大')).toBe(true);
  });
  it('computes the in-stock price range and product totals', () => {
    expect(priceRange(tote)).toEqual([32000, 38000]); // zero-stock 橄欖綠／大 still counts
    expect(priceRange(pen)).toEqual([45000, 45000]);
    expect(tote.stock).toBe(15);
  });
  it('labels a SKU', () => {
    expect(skuLabel({ 顏色: '黑色', 尺寸: '大' })).toBe('顏色：黑色／尺寸：大');
    expect(skuLabel(null)).toBe('');
  });
});
