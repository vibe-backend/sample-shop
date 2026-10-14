import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatPrice, type Product, type ProductInput } from '../api';
import { ErrorNote, Spinner } from '../components/ui';
import { CATEGORIES, StockTag } from './Products';

export function StaffProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        // Staff see inactive products too; walk every page.
        const all: Product[] = [];
        let cursor: string | undefined;
        do {
          const p = await api.listProducts({ cursor, limit: 50, sort: 'created_at_desc' });
          all.push(...p.items);
          cursor = p.next_cursor ?? undefined;
        } while (cursor);
        if (live) setItems(all);
      } catch (e) {
        if (live) setError(e);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [tick]);

  async function remove(p: Product) {
    if (!confirm(`確定刪除「${p.name}」？此操作無法復原。`)) return;
    try {
      await api.deleteProduct(p.id);
      setTick((t) => t + 1);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <section>
      <div className="row head">
        <h1>商品管理</h1>
        <Link to="/staff/products/new" className="btn">
          新增商品
        </Link>
      </div>
      <ErrorNote error={error} />
      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table className="items staff">
            <thead>
              <tr>
                <th>商品</th>
                <th>分類</th>
                <th>價格</th>
                <th>庫存</th>
                <th>狀態</th>
                <th>
                  <span className="sr">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'inactive'}>
                  <td>
                    <div className="cell-product">
                      <img src={p.image_urls[0]} alt="" />
                      <div>
                        {p.name}
                        <br />
                        <span className="muted small">{p.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td>{formatPrice(p.price_cents, p.currency)}</td>
                  <td>{p.stock}</td>
                  <td>{p.active ? <span className="tag ok-tag">上架中</span> : <StockTag p={p} />}</td>
                  <td className="nowrap">
                    <Link to={`/staff/products/${p.id}`}>編輯</Link>
                    <button className="link-btn danger" onClick={() => remove(p)}>
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const EMPTY: ProductInput = { slug: '', name: '', description: '', price_cents: 0, currency: 'HKD', image_urls: [], category: CATEGORIES[0], stock: 0, active: true };

export function StaffEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState<ProductInput>(EMPTY);
  const [price, setPrice] = useState('0');
  const [imageText, setImageText] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getProduct(id)
      .then((p) => {
        setF({ slug: p.slug, name: p.name, description: p.description, price_cents: p.price_cents, currency: p.currency, image_urls: p.image_urls, category: p.category, stock: p.stock, active: p.active });
        setPrice((p.price_cents / 100).toString());
        setImageText(p.image_urls.filter((u) => !u.startsWith('data:')).join('\n'));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const typed = imageText.split('\n').map((u) => u.trim()).filter(Boolean);
    const image_urls = typed.length ? typed : f.image_urls.filter((u) => u.startsWith('data:'));
    const body = { ...f, image_urls, price_cents: Math.round(Number(price) * 100) };
    try {
      if (id) await api.updateProduct(id, body);
      else await api.createProduct(body);
      nav('/staff/products');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <section className="auth wide">
      <Link to="/staff/products" className="back">
        ‹ 商品管理
      </Link>
      <h1>{id ? '編輯商品' : '新增商品'}</h1>
      <form className="panel form two" onSubmit={submit}>
        <label>
          名稱
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label>
          Slug
          <input required pattern="[a-z0-9-]+" title="小寫英文、數字及連字號" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
        </label>
        <label>
          價格（HK$）
          <input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          庫存
          <input type="number" min="0" step="1" required value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} />
        </label>
        <label>
          分類
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          上架（顧客可見）
        </label>
        <label className="full">
          描述
          <textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <label className="full">
          圖片網址（每行一個；示範圖片不會顯示在此）
          <textarea
            rows={2}
            value={imageText}
            onChange={(e) => setImageText(e.target.value)}
          />
        </label>
        <div className="full">
          <ErrorNote error={error} />
          <button className="btn" disabled={busy}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </section>
  );
}
