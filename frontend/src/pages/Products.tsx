import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, formatPrice, type Product, type ProductSort } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, Spinner, useAsync } from '../components/ui';

export const CATEGORIES = ['廚房', '配件', '文具', '家居', '電子', '食品'];

const SORTS: [ProductSort, string][] = [
  ['created_at_desc', '最新上架'],
  ['created_at_asc', '最早上架'],
  ['price_asc', '價格：低至高'],
  ['price_desc', '價格：高至低'],
];

const toCents = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Math.round(Number(v) * 100) : undefined);

export function StockTag({ p }: { p: Pick<Product, 'in_stock' | 'stock' | 'active'> }) {
  if (!p.active) return <span className="tag muted">已下架</span>;
  if (!p.in_stock) return <span className="tag warn">已售完</span>;
  if (p.stock <= 5) return <span className="tag">剩 {p.stock} 件</span>;
  return null;
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
      <section className="hero">
        <h1>精選好物</h1>
        <p>為日常挑選的小物，簡單、耐用、好看。</p>
      </section>
      <form className="filters" onSubmit={submit} role="search">
        <input type="search" placeholder="搜尋商品…" aria-label="搜尋商品" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <select aria-label="分類" value={category} onChange={(e) => set('category', e.target.value)}>
          <option value="">全部分類</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="price-range">
          <input type="number" min="0" inputMode="decimal" placeholder="最低價" aria-label="最低價（HK$）" value={min} onChange={(e) => set('min', e.target.value)} />
          <span aria-hidden="true">–</span>
          <input type="number" min="0" inputMode="decimal" placeholder="最高價" aria-label="最高價（HK$）" value={max} onChange={(e) => set('max', e.target.value)} />
        </div>
        <select aria-label="排序" value={sort} onChange={(e) => set('sort', e.target.value)}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          搜尋
        </button>
      </form>
      <ErrorNote error={error} />
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <section className="empty">
          <p>找不到符合條件的商品。</p>
          <button className="link-btn" onClick={() => setParams({})}>
            清除篩選
          </button>
        </section>
      ) : (
        <>
          <ul className="grid">
            {items.map((p) => (
              <li key={p.id}>
                <Link to={`/products/${p.id}`} className="card">
                  <div className="thumb">
                    <img src={p.image_urls[0]} alt="" loading="lazy" />
                  </div>
                  <div className="card-body">
                    <span className="cat">{p.category}</span>
                    <h2>{p.name}</h2>
                    <div className="row">
                      <span className="price">{formatPrice(p.price_cents, p.currency)}</span>
                      <StockTag p={p} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {cursor && (
            <div className="center">
              <button className="btn secondary" onClick={loadMore} disabled={more}>
                {more ? '載入中…' : '載入更多'}
              </button>
            </div>
          )}
        </>
      )}
    </>
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
    <article className="detail">
      <Link to="/" className="back">
        ‹ 返回商品
      </Link>
      <div className="detail-grid">
        <div className="detail-img">
          <img src={p.image_urls[0]} alt={p.name} />
        </div>
        <div className="detail-info">
          <span className="cat">{p.category}</span>
          <h1>{p.name}</h1>
          <p className="price big">{formatPrice(p.price_cents, p.currency)}</p>
          <p className="desc">{p.description}</p>
          <p className="stock">
            {p.in_stock ? `庫存 ${p.stock} 件` : '目前缺貨'} <StockTag p={p} />
          </p>
          <div className="buy">
            <label className="qty">
              數量
              <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
            </label>
            <button className="btn" onClick={add} disabled={busy || !p.in_stock || !p.active}>
              {busy ? '加入中…' : p.in_stock ? '加入購物車' : '已售完'}
            </button>
          </div>
          {msg && (
            <p className="ok" role="status">
              {msg}・<Link to="/cart">查看購物車</Link>
            </p>
          )}
          <ErrorNote error={addErr} />
        </div>
      </div>
    </article>
  );
}
