import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatPrice, type ProductVariant, type VariantInput } from '../api';
import { ErrorNote, PageTitle, Spinner, useAsync } from '../components/ui-helpers';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BackLink } from './Products';

export function VariantsPage() {
  const { id = '' } = useParams();
  const [product, pError, pLoading] = useAsync(() => api.getStaffProduct(id), [id]);
  const [variants, error, loading, reload] = useAsync(() => api.listVariants(id), [id]);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [form, setForm] = useState<VariantInput>({
    options: {},
    price_cents: 0,
    stock: 0,
    active: true,
    image_url: '',
  });
  const [opError, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const edit = (v: ProductVariant) => {
    setEditing(v);
    setForm({
      options: v.options,
      price_cents: v.price_cents,
      stock: v.stock,
      active: v.active !== false,
      image_url: v.image_url ?? '',
    });
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await api.updateVariant(id, editing.id, form, editing.version ?? 1);
      else await api.createVariant(id, form);
      setEditing(null);
      setForm({ options: {}, price_cents: 0, stock: 0, active: true, image_url: '' });
      reload();
    } catch (e) {
      setError(e);
      reload();
    } finally {
      setBusy(false);
    }
  }
  if (loading || pLoading) return <Spinner />;
  return (
    <section className="mx-auto max-w-3xl">
      <BackLink to={`/staff/products/${id}`}>商品管理</BackLink>
      <PageTitle>商品規格管理 · {product?.name}</PageTitle>
      <ErrorNote error={error || pError || opError} />
      <ul className="mb-5 space-y-2">
        {variants?.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
            <span>
              {Object.values(v.options).join('／')} · {formatPrice(v.price_cents)} · 庫存 {v.stock} ·{' '}
              {v.active === false ? '已停用' : '啟用'} · v{v.version ?? 1}
            </span>
            <Button size="sm" variant="outline" onClick={() => edit(v)}>
              修改
            </Button>
          </li>
        ))}
      </ul>
      {!product?.options?.length ? (
        <p>請先在商品管理設定選項。</p>
      ) : (
        <form className="grid gap-3 rounded-xl border bg-card p-4" onSubmit={submit}>
          <h2 className="font-bold">{editing ? '修改規格' : '新增規格'}</h2>
          {product.options.map((o) => (
            <label key={o.name}>
              {o.name}
              <select
                aria-label={o.name}
                required
                className="ml-2 rounded border bg-card p-2"
                value={form.options[o.name] ?? ''}
                onChange={(e) => setForm({ ...form, options: { ...form.options, [o.name]: e.target.value } })}
              >
                <option value="">請選擇</option>
                {o.values.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            價格（HK$）
            <Input
              aria-label="規格價格"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price_cents / 100}
              onChange={(e) => setForm({ ...form, price_cents: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
          <label>
            庫存
            <Input
              aria-label="規格庫存"
              type="number"
              min="0"
              step="1"
              required
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
          </label>
          <label>
            圖片網址
            <Input
              aria-label="規格圖片"
              type="url"
              value={form.image_url ?? ''}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{' '}
            啟用
          </label>
          <div className="flex gap-2">
            <Button disabled={busy}>儲存規格</Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setForm({ options: {}, price_cents: 0, stock: 0, active: true });
                }}
              >
                新增另一規格
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
