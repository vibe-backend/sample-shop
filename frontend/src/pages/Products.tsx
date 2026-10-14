import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import { api, formatPrice, type Product, type ProductSort } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorNote, Spinner, useAsync } from '../components/ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] sm:gap-5" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-16" />
          </div>
        </li>
      ))}
    </ul>
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
  const [draft, setDraft] = useState(q);

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

  function submit(e: FormEvent) {
    e.preventDefault();
    set('q', draft.trim());
  }

  return (
    <>
      <section className="pt-4 pb-2">
        <h1 className="mb-1 text-4xl font-semibold tracking-tight sm:text-5xl">精選好物</h1>
        <p className="mb-6 text-lg text-muted-foreground">為日常挑選的小物，簡單、耐用、好看。</p>
      </section>
      <form className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-[1fr_auto_auto_auto_auto]" onSubmit={submit} role="search">
        <div className="relative col-span-2 md:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" placeholder="搜尋商品…" aria-label="搜尋商品" className="h-10 pl-9" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <Select value={category || ALL} onValueChange={(v) => set('category', v === ALL ? '' : v)}>
          <SelectTrigger aria-label="分類" className="h-10! w-full md:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部分類</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => set('sort', v)}>
          <SelectTrigger aria-label="排序" className="h-10! w-full md:order-last md:w-36">
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
        <div className="col-span-2 flex items-center gap-1.5 md:col-span-1">
          <Input type="number" min="0" inputMode="decimal" placeholder="最低價" aria-label="最低價（HK$）" className="h-10 md:w-24" value={min} onChange={(e) => set('min', e.target.value)} />
          <span className="text-muted-foreground" aria-hidden="true">
            –
          </span>
          <Input type="number" min="0" inputMode="decimal" placeholder="最高價" aria-label="最高價（HK$）" className="h-10 md:w-24" value={max} onChange={(e) => set('max', e.target.value)} />
        </div>
        <Button type="submit" className="col-span-2 h-10 px-5 md:order-last md:col-span-1">
          搜尋
        </Button>
      </form>
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] sm:gap-5">
            {items.map((p) => (
              <li key={p.id}>
                <Link to={`/products/${p.id}`} className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <Card className="gap-0 py-0 transition-transform group-hover:-translate-y-0.5">
                    <div className="aspect-square bg-muted">
                      <img src={p.image_urls[0]} alt="" loading="lazy" className="size-full object-cover" />
                    </div>
                    <CardContent className="space-y-1 px-3 py-3 sm:px-4 sm:pb-4">
                      <span className="text-xs text-muted-foreground">{p.category}</span>
                      <h2 className="font-semibold">{p.name}</h2>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-semibold">{formatPrice(p.price_cents, p.currency)}</span>
                        <StockTag p={p} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { me, refreshCart } = useAuth();
  const nav = useNavigate();
  const [p, error, loading] = useAsync(() => api.getProduct(id), [id]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [addErr, setAddErr] = useState<unknown>(null);

  if (loading) return <Spinner />;
  if (!p) return <ErrorNote error={error} />;

  async function add() {
    if (!me) return nav(`/login?next=${encodeURIComponent(`/products/${id}`)}`);
    setBusy(true);
    setAddErr(null);
    setMsg('');
    try {
      await api.addCartItem(p!.id, qty);
      refreshCart();
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
          <img src={p.image_urls[0]} alt={p.name} className="w-full" />
        </div>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-muted-foreground">{p.category}</span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{p.name}</h1>
          </div>
          <p className="text-2xl font-semibold">{formatPrice(p.price_cents, p.currency)}</p>
          <p className="text-muted-foreground">{p.description}</p>
          <p className="flex items-center gap-2 text-sm">
            {p.in_stock ? `庫存 ${p.stock} 件` : '目前缺貨'} <StockTag p={p} />
          </p>
          <div className="flex items-end gap-3 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="qty" className="text-xs text-muted-foreground">
                數量
              </Label>
              <Input id="qty" type="number" min={1} max={99} className="h-10 w-20" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
            </div>
            <Button size="lg" className="h-10 px-6" onClick={add} disabled={busy || !p.in_stock || !p.active}>
              {busy ? '加入中…' : p.in_stock ? '加入購物車' : '已售完'}
            </Button>
          </div>
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
