import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api, formatPrice, type Product, type ProductSort } from '../api';
import { findVariant, hasVariants, isValueAvailable, missingOptions, priceRange, type Selection } from '@/lib/sku';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth';
import { Empty, ErrorNote, Spinner, useAsync } from '../components/ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export const CATEGORIES = ['廚房', '配件', '文具', '家居', '電子', '食品'];

const SORTS: [ProductSort, string][] = [
  ['created_at_desc', '最新上架'],
  ['created_at_asc', '最早上架'],
  ['price_asc', '價格：低至高'],
  ['price_desc', '價格：高至低'],
];

/** Radix Select cannot use an empty value, so "all categories" uses a sentinel. */
const ALL = '__all';

const toCents = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Math.round(Number(v) * 100) : undefined);

export function StockTag({ p }: { p: Pick<Product, 'in_stock' | 'stock' | 'active'> }) {
  if (!p.active) return <Badge variant="outline" className="text-muted-foreground">已下架</Badge>;
  if (!p.in_stock) return <Badge className="bg-warning/15 text-warning">已售完</Badge>;
  if (p.stock <= 5) return <Badge variant="secondary">剩 {p.stock} 件</Badge>;
  return null;
}

const GRID = 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5';

function GridSkeleton() {
  return (
    <ul className={GRID} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-lg bg-card">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-2 p-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-16" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Our own generated banner art: gradient + emoji, no third-party images or marks. */
const SLIDES = [
  { title: '秋日家居節', sub: '香氛、燈具、毛毯 精選推介', emoji: '🕯️', from: '#ff9000', to: '#ff5000' },
  { title: '文具新學期', sub: '筆記本、鋼筆 一站買齊', emoji: '📓', from: '#ff4d6a', to: '#ff7a00' },
  { title: '咖啡生活', sub: '手沖入門組 新手必備', emoji: '☕', from: '#ffb000', to: '#ff6a1f' },
];

export function Carousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const sl = SLIDES[i];
  return (
    <div className="relative overflow-hidden rounded-xl" role="region" aria-roledescription="carousel" aria-label="推介">
      <div key={i} className="flex h-40 items-center justify-between px-6 text-white motion-safe:animate-[tb-fade_.5s_ease] sm:h-full sm:min-h-64 sm:px-10" style={{ background: `linear-gradient(120deg, ${sl.from}, ${sl.to})` }} aria-live="polite">
        <div>
          <p className="text-2xl font-bold sm:text-4xl">{sl.title}</p>
          <p className="mt-1 text-sm opacity-90 sm:text-lg">{sl.sub}</p>
        </div>
        <span className="text-6xl sm:text-8xl" aria-hidden="true">
          {sl.emoji}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {SLIDES.map((x, j) => (
          <button key={x.title} type="button" aria-label={`第 ${j + 1} 張`} aria-current={j === i} onClick={() => setI(j)} className={cn('h-1.5 rounded-full bg-white/60 transition-all', j === i ? 'w-5 bg-white' : 'w-1.5')} />
        ))}
      </div>
    </div>
  );
}

/** Red, large price; "起" when the product has a price range. */
export function Price({ p, className }: { p: Product; className?: string }) {
  const [lo, hi] = priceRange(p);
  return (
    <span className={cn('font-bold text-price', className)}>
      <span className="text-xs">HK$</span>
      <span className="text-lg">{(lo / 100).toFixed(2)}</span>
      {hi > lo && <span className="text-xs font-normal"> 起</span>}
    </span>
  );
}

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link to={`/products/${p.id}`} className="group block h-full overflow-hidden rounded-lg bg-card ring-1 ring-transparent transition hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <div className="aspect-square bg-muted">
        <img src={p.image_urls[0]} alt="" loading="lazy" className="size-full object-cover" />
      </div>
      <div className="space-y-1 p-2.5">
        <h2 className="line-clamp-2 min-h-10 text-sm leading-5">{p.name}</h2>
        <div className="flex flex-wrap items-baseline justify-between gap-x-1">
          <Price p={p} />
          {p.sold_count !== undefined && <span className="text-xs text-muted-foreground">已售 {p.sold_count}</span>}
        </div>
        <StockTag p={p} />
      </div>
    </Link>
  );
}

export function ProductListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';
  const sort = (params.get('sort') as ProductSort) || 'created_at_desc';

  const [items, setItems] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const query = { q: q || undefined, category: category || undefined, min_price_cents: toCents(min), max_price_cents: toCents(max), sort };
  const key = JSON.stringify(query);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api
      .listProducts(JSON.parse(key))
      .then((p) => {
        if (!live) return;
        setItems(p.items);
        setCursor(p.next_cursor);
      })
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [key]);

  function loadMore() {
    if (!cursor) return;
    setMore(true);
    api
      .listProducts({ ...query, cursor })
      .then((p) => {
        setItems((xs) => [...xs, ...p.items]);
        setCursor(p.next_cursor);
      })
      .catch(setError)
      .finally(() => setMore(false));
  }

  function set(k: string, v: string) {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  }

  const catClass = (on: boolean) => cn('rounded-md px-3 py-2 text-left text-sm transition-colors', on ? 'bg-secondary font-medium text-primary' : 'hover:bg-muted');

  return (
    <>
      <section className="mb-4 grid gap-3 sm:grid-cols-[180px_1fr]">
        <nav aria-label="商品分類" className="hidden flex-col gap-0.5 rounded-xl bg-card p-2 sm:flex">
          <span className="px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground">商品分類</span>
          <button type="button" className={catClass(!category)} onClick={() => set('category', '')}>
            全部分類
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={catClass(category === c)} aria-current={category === c || undefined} onClick={() => set('category', c)}>
              {c}
            </button>
          ))}
        </nav>
        <Carousel />
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 sm:hidden" aria-label="商品分類（手機）">
          {['', ...CATEGORIES].map((c) => (
            <button key={c || ALL} type="button" onClick={() => set('category', c)} className={cn('shrink-0 rounded-full px-3 py-1 text-sm', category === c ? 'bg-primary text-primary-foreground' : 'bg-card')}>
              {c || '全部'}
            </button>
          ))}
        </div>
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">
          精選好物
          {q && <span className="ml-2 text-sm font-normal text-muted-foreground">「{q}」的搜尋結果</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Input type="number" min="0" inputMode="decimal" placeholder="最低價" aria-label="最低價（HK$）" className="h-8 w-20 bg-card" value={min} onChange={(e) => set('min', e.target.value)} />
            <span className="text-muted-foreground" aria-hidden="true">
              –
            </span>
            <Input type="number" min="0" inputMode="decimal" placeholder="最高價" aria-label="最高價（HK$）" className="h-8 w-20 bg-card" value={max} onChange={(e) => set('max', e.target.value)} />
          </div>
          <Select value={sort} onValueChange={(v) => set('sort', v)}>
            <SelectTrigger aria-label="排序" className="h-8! w-32 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ErrorNote error={error} />
      {loading ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <Empty>
          <p>找不到符合條件的商品。</p>
          <Button variant="link" onClick={() => setParams({})}>
            清除篩選
          </Button>
        </Empty>
      ) : (
        <>
          <ul className={GRID}>
            {items.map((p) => (
              <li key={p.id}>
                <ProductCard p={p} />
              </li>
            ))}
          </ul>
          {cursor && (
            <div className="mt-6 text-center">
              <Button variant="outline" size="lg" onClick={loadMore} disabled={more}>
                {more ? '載入中…' : '載入更多'}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Button variant="link" asChild className="mb-3 h-auto px-0">
      <Link to={to}>
        <ChevronLeft /> {children}
      </Link>
    </Button>
  );
}

/** Taobao-style spec picker: one toggle-button group per spec; unbuyable values are disabled. */
export function SkuSelector({ product, selection, onChange }: { product: Product; selection: Selection; onChange: (s: Selection) => void }) {
  return (
    <div className="space-y-3">
      {product.options!.map((o) => (
        <div key={o.name} role="radiogroup" aria-label={o.name} className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">{o.name}</span>
          <div className="flex flex-wrap gap-2">
            {o.values.map((v) => {
              const selected = selection[o.name] === v;
              const available = isValueAvailable(product, selection, o.name, v);
              return (
                <Button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  disabled={!available && !selected}
                  title={available ? undefined : '缺貨'}
                  className={cn('min-w-14', !available && 'line-through')}
                  onClick={() => onChange({ ...selection, [o.name]: selected ? undefined : v })}
                >
                  {v}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { me, refreshCart } = useAuth();
  const nav = useNavigate();
  const [p, error, loading] = useAsync(() => api.getProduct(id), [id]);
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Selection>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [hint, setHint] = useState('');
  const [addErr, setAddErr] = useState<unknown>(null);

  if (loading) return <Spinner />;
  if (!p) return <ErrorNote error={error} />;

  const multi = hasVariants(p);
  const sku = multi ? findVariant(p, sel) : null;
  const missing = multi ? missingOptions(p, sel) : [];
  const [lo, hi] = priceRange(p);
  const price = sku ? formatPrice(sku.price_cents, p.currency) : lo === hi ? formatPrice(lo, p.currency) : `${formatPrice(lo, p.currency)} – ${formatPrice(hi, p.currency)}`;
  const stock = sku ? sku.stock : p.stock;
  const inStock = sku ? sku.in_stock : p.in_stock;
  const image = sku?.image_url || p.image_urls[0];

  function pick(next: Selection) {
    setSel(next);
    setHint('');
    setMsg('');
  }

  async function add(buyNow = false) {
    if (multi && !sku) {
      setHint(`請選擇${missing.join('、')}`);
      return;
    }
    if (!me) return nav(`/login?next=${encodeURIComponent(`/products/${id}`)}`);
    setBusy(true);
    setAddErr(null);
    setMsg('');
    try {
      await api.addCartItem(p!.id, qty, sku?.id ?? null);
      refreshCart();
      // 立即購買: same add-to-cart, then straight to checkout.
      if (buyNow) return nav('/checkout');
      setMsg('已加入購物車');
    } catch (e) {
      setAddErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article>
      <BackLink to="/">返回商品</BackLink>
      <div className="grid items-start gap-6 md:grid-cols-[1.1fr_1fr] md:gap-12">
        <div className="overflow-hidden rounded-3xl bg-muted">
          <img src={image} alt={p.name} className="w-full" />
        </div>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-muted-foreground">{p.category}</span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{p.name}</h1>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-lg bg-secondary/70 px-4 py-3">
            <p className="text-3xl font-bold text-price" data-testid="price" aria-live="polite">
              {price}
            </p>
            {p.sold_count !== undefined && <span className="text-sm text-muted-foreground">已售 {p.sold_count}</span>}
          </div>
          <p className="text-muted-foreground">{p.description}</p>
          {multi && <SkuSelector product={p} selection={sel} onChange={pick} />}
          <p className="flex items-center gap-2 text-sm" data-testid="stock" aria-live="polite">
            {!inStock ? '目前缺貨' : multi && !sku ? `請選擇${missing.join('、')}（共 ${stock} 件）` : `庫存 ${stock} 件`}{' '}
            <StockTag p={{ active: p.active, in_stock: inStock, stock }} />
          </p>
          <div className="flex items-end gap-3 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="qty" className="text-xs text-muted-foreground">
                數量
              </Label>
              <Input id="qty" type="number" min={1} max={99} className="h-10 w-20" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <div className="flex gap-0 overflow-hidden rounded-full sm:max-w-md">
            <Button size="lg" className="tb-btn-cart h-11 flex-1 rounded-none text-base hover:opacity-90" onClick={() => add()} disabled={busy || !inStock || !p.active}>
              {busy ? '處理中…' : inStock ? '加入購物車' : '已售完'}
            </Button>
            <Button size="lg" className="tb-btn-buy h-11 flex-1 rounded-none text-base hover:opacity-90" onClick={() => add(true)} disabled={busy || !inStock || !p.active}>
              立即購買
            </Button>
          </div>
          {hint && (
            <p className="text-sm text-destructive" role="alert">
              {hint}
            </p>
          )}
          {msg && (
            <p className="text-sm text-success" role="status">
              {msg}・
              <Link to="/cart" className="text-primary hover:underline">
                查看購物車
              </Link>
            </p>
          )}
          <ErrorNote error={addErr} />
        </div>
      </div>
    </article>
  );
}
