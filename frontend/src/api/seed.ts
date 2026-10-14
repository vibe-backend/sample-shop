import type { Product, ProductOption, ProductVariant, Role } from './types';

export interface SeedUser {
  id: string;
  email: string;
  password: string;
  display_name: string;
  roles: Role[];
}

/** Demo accounts for mock mode only. */
export const DEMO_USERS: SeedUser[] = [
  { id: 'u_demo', email: 'demo@example.com', password: 'demo1234', display_name: '陳小明', roles: [] },
  { id: 'u_staff', email: 'staff@example.com', password: 'staff1234', display_name: '店務 Amy', roles: ['staff'] },
];

/** Placeholder product art: a soft gradient SVG with an emoji, as a data URL. */
export function placeholderImage(emoji: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 88%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 70% 72%)"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="235" font-size="150" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type SeedRow = [slug: string, name: string, category: string, price: number, stock: number, emoji: string, hue: number, desc: string, active?: boolean];

const ROWS: SeedRow[] = [
  ['ceramic-mug', '手工陶瓷馬克杯', '廚房', 18800, 24, '☕', 30, '台灣窯燒手工陶瓷，容量 350ml，可微波及洗碗機清洗。'],
  ['pour-over-set', '手沖咖啡入門組', '廚房', 68000, 8, '🫖', 20, '包含濾杯、玻璃分享壺與 100 張濾紙，適合初學者。'],
  ['linen-tote', '亞麻帆布托特包', '配件', 32000, 15, '👜', 90, '厚磅亞麻混紡，內附拉鍊小袋，可放 14 吋筆電。'],
  ['notebook-a5', 'A5 點格筆記本', '文具', 9800, 60, '📓', 210, '120 頁 100gsm 無酸紙，平攤設計，書寫不透墨。'],
  ['fountain-pen', '入門鋼筆（F 尖）', '文具', 45000, 0, '🖋️', 250, '不鏽鋼 F 尖，附吸墨器，墨水另售。'],
  ['desk-lamp', '極簡 LED 檯燈', '家居', 128000, 5, '💡', 50, '三段色溫與無段調光，USB-C 供電。'],
  ['scented-candle', '檜木香氛蠟燭', '家居', 42000, 30, '🕯️', 35, '大豆蠟搭配台灣檜木精油，燃燒約 40 小時。'],
  ['wool-throw', '羊毛混紡毯', '家居', 158000, 3, '🧶', 340, '70% 羊毛，130×170cm，適合沙發與午睡。'],
  ['wireless-earbuds', '無線降噪耳機', '電子', 249000, 12, '🎧', 200, '主動降噪、續航 30 小時（含充電盒）。'],
  ['phone-stand', '鋁合金手機架', '電子', 26000, 40, '📱', 180, '可調角度，適用 4 至 7 吋裝置。'],
  ['green-tea', '高山烏龍茶 150g', '食品', 38000, 50, '🍵', 110, '梨山產區，春茶，真空包裝。'],
  ['granola', '楓糖堅果燕麥脆片', '食品', 15800, 0, '🥣', 40, '無精製糖，每包 400g。'],
  ['old-poster', '2025 限定海報', '配件', 9900, 10, '🖼️', 300, '已下架的限定商品（示範：只有店務人員看得到）。', false],
];

export function seedProducts(now = Date.UTC(2026, 9, 1)): Product[] {
  return ROWS.map(([slug, name, category, price, stock, emoji, hue, description, active = true], i) => ({
    id: `p_${String(i + 1).padStart(3, '0')}`,
    slug,
    name,
    description,
    price_cents: price,
    currency: 'HKD',
    image_urls: [placeholderImage(emoji, hue)],
    category,
    stock,
    in_stock: stock > 0,
    active,
    created_at: new Date(now - (ROWS.length - i) * 86_400_000).toISOString(),
  })).map(withVariants);
}

type VariantSeed = { options: ProductOption[]; rows: [values: string[], price: number, stock: number][] };

/** Demo SKUs (#17), keyed by slug. Stock 0 rows show as unselectable. */
const VARIANTS: Record<string, VariantSeed> = {
  'linen-tote': {
    options: [
      { name: '顏色', values: ['米白', '黑色', '橄欖綠'] },
      { name: '尺寸', values: ['標準', '大'] },
    ],
    rows: [
      [['米白', '標準'], 32000, 6],
      [['米白', '大'], 36000, 4],
      [['黑色', '標準'], 32000, 5],
      [['黑色', '大'], 36000, 0],
      [['橄欖綠', '標準'], 34000, 0],
      [['橄欖綠', '大'], 38000, 0],
    ],
  },
  'ceramic-mug': {
    options: [{ name: '顏色', values: ['霧白', '墨黑', '青瓷'] }],
    rows: [
      [['霧白'], 18800, 12],
      [['墨黑'], 18800, 12],
      [['青瓷'], 21800, 0],
    ],
  },
};

function withVariants(p: Product): Product {
  const seed = VARIANTS[p.slug];
  if (!seed) return p;
  const variants: ProductVariant[] = seed.rows.map(([vals, price, stock], i) => ({
    id: `${p.id}_sku${i + 1}`,
    options: Object.fromEntries(seed.options.map((o, j) => [o.name, vals[j]])),
    price_cents: price,
    stock,
    in_stock: stock > 0,
  }));
  return syncVariantTotals({ ...p, options: seed.options, variants });
}

/** Product-level price/stock mirror the SKUs: lowest price, summed stock. */
export function syncVariantTotals(p: Product): Product {
  if (!p.variants?.length) return p;
  p.stock = p.variants.reduce((s, v) => s + v.stock, 0);
  p.in_stock = p.stock > 0;
  p.price_cents = Math.min(...p.variants.map((v) => v.price_cents));
  return p;
}
