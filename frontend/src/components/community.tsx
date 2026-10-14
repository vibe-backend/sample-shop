import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, API_MODE, formatPrice, type AfterSale, type Order, type Product, type Review } from '../api';
import { toast } from 'sonner';
import { useAuth } from '../auth';
import { ErrorNote, Spinner, useAsync } from './ui-helpers';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ProductImage } from './shopping';
import { SHIPPING_LABEL, SHOP_INFO } from '../lib/commerce';
import { CouponsPage } from '../pages/AccountFeatures';

export function ImageUploads({ value, onChange }: { value: string[]; onChange: (images: string[]) => void }) {
  const [error, setError] = useState('');
  return (
    <div>
      <label className="text-sm">
        憑證圖片（最多 3 張，每張 500 KB）
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (
              files.length + value.length > 3 ||
              files.some((f) => !/^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.size > 500000)
            ) {
              setError('請選擇最多 3 張圖片，每張不超過 500 KB');
              e.target.value = '';
              return;
            }
            setError('');
            const images = await Promise.all(
              files.map(
                (f) =>
                  new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(f);
                  }),
              ),
            ).catch(() => {
              setError('無法讀取圖片');
              return [];
            });
            onChange([...value, ...images]);
            e.target.value = '';
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        {value.map((src, i) => (
          <button
            key={i}
            type="button"
            aria-label={`移除圖片 ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <ProductImage src={src} alt={`憑證 ${i + 1}`} className="size-16 rounded" />
          </button>
        ))}
      </div>
    </div>
  );
}
export function ProductCommunity({ product }: { product: Product }) {
  const { me } = useAuth();
  const [imagesOnly, setImagesOnly] = useState(false);
  const [page, error, loading] = useAsync(
    () => api.listReviews(product.id, { images_only: imagesOnly }),
    [product.id, imagesOnly],
  );
  const [more, setMore] = useState<Review[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>();
  const [moreBusy, setBusy] = useState(false);
  const [opError, setError] = useState<unknown>(null);
  const [questions, qError, qLoading, reloadQuestions] = useAsync(() => api.listQuestions(product.id), [product.id]);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (API_MODE !== 'mock') return null;
  const nextCursor = cursor === undefined ? page?.next_cursor : cursor;
  async function ask(e: FormEvent) {
    e.preventDefault();
    try {
      await api.askQuestion(product.id, text);
      setText('');
      reloadQuestions();
    } catch (e) {
      setError(e);
    }
  }
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-bold">
          買家評價 · {product.rating_avg ? `★ ${product.rating_avg.toFixed(1)}` : '尚無評分'}（
          {product.review_count ?? 0}）
        </h2>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={imagesOnly}
            onChange={(e) => {
              setImagesOnly(e.target.checked);
              setMore([]);
              setCursor(undefined);
            }}
          />{' '}
          只看有圖評價
        </label>
        <ErrorNote error={error} />
        {loading && <Spinner />}
        <ul className="mt-3 space-y-3">
          {[...(page?.items ?? []), ...more].map((r) => (
            <li key={r.id} className="rounded-lg bg-muted p-3">
              <p className="text-sm">
                {r.author} · {'★'.repeat(r.rating)} · {new Date(r.created_at).toLocaleDateString('zh-Hant')}
              </p>
              <p className="mt-1">{r.text}</p>
              <div className="mt-2 flex gap-2">
                {r.images.map((src, i) => (
                  <ProductImage key={i} src={src} alt="買家評價圖片" className="size-20 rounded" />
                ))}
              </div>
            </li>
          ))}
        </ul>
        {nextCursor && (
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            disabled={moreBusy}
            onClick={async () => {
              setBusy(true);
              try {
                const page = await api.listReviews(product.id, { cursor: nextCursor, images_only: imagesOnly });
                setMore((xs) => [...xs, ...page.items]);
                setCursor(page.next_cursor);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            載入更多評價
          </Button>
        )}
        <p className="mt-3 text-xs text-muted-foreground">收貨後可於訂單詳情評價。</p>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-bold">問大家</h2>
        <ErrorNote error={qError || opError} />
        {qLoading && <Spinner />}
        <ul className="space-y-3">
          {questions?.map((q) => (
            <li key={q.id} className="rounded-lg bg-muted p-3">
              <strong className="text-sm">{q.text}</strong>
              <p className="text-xs text-muted-foreground">
                {q.author} · {q.answers.length} 個回答
              </p>
              {q.answers.map((a, i) => (
                <p key={i} className="mt-2 text-sm">
                  {a.staff ? '店家回覆' : a.author}：{a.text}
                </p>
              ))}
              {me && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.answerQuestion(q.id, answers[q.id] ?? '');
                      setAnswers((xs) => ({ ...xs, [q.id]: '' }));
                      reloadQuestions();
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  <Input
                    aria-label={`回答：${q.text}`}
                    maxLength={500}
                    required
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((xs) => ({ ...xs, [q.id]: e.target.value }))}
                  />
                  <Button type="submit" size="sm">
                    回答
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {me ? (
          <form className="mt-3 grid gap-2" onSubmit={ask}>
            <Textarea
              aria-label="問題"
              placeholder="向買家或店家提問…"
              maxLength={500}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button disabled={!text.trim()}>提問</Button>
          </form>
        ) : (
          <Link
            className="mt-3 block text-sm underline"
            to={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}
          >
            登入後提問
          </Link>
        )}
      </section>
      {me && <CouponsPage compact />}
    </div>
  );
}
const SERVICE_LABEL = { pending: '處理中', approved: '已同意', rejected: '已拒絕', refunded: '已退款' };
export function AfterSaleCard({ service, staff, reload }: { service: AfterSale; staff?: boolean; reload: () => void }) {
  const [carrier, setCarrier] = useState(service.return_shipment?.carrier ?? '');
  const [tracking, setTracking] = useState(service.return_shipment?.tracking_number ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <strong>
        售後 #{service.id} · {SERVICE_LABEL[service.status]} · {formatPrice(service.amount_cents)}
      </strong>
      <p className="text-sm">
        訂單 #{service.order_id} · 項目 {service.item_index + 1} · {service.type === 'return' ? '退貨退款' : '僅退款'} ·{' '}
        {service.reason}
      </p>
      <p>{service.description}</p>
      <div className="flex gap-2">
        {service.images.map((src, i) => (
          <ProductImage key={i} src={src} alt="售後憑證" className="size-20 rounded" />
        ))}
      </div>
      <ol className="text-sm">
        {service.history.map((h, i) => (
          <li key={i}>
            {new Date(h.at).toLocaleString('zh-Hant')} · {SERVICE_LABEL[h.status]} · {h.message}
          </li>
        ))}
      </ol>
      {service.return_shipment && (
        <p className="text-sm">
          退貨物流：{service.return_shipment.carrier} {service.return_shipment.tracking_number}
        </p>
      )}
      {!staff && service.type === 'return' && service.status === 'approved' && !service.return_shipment && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api.submitReturnShipment(service.id, carrier, tracking));
          }}
        >
          <Input
            aria-label="退貨承運商"
            required
            maxLength={80}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          />
          <Input
            aria-label="退貨物流單號"
            required
            maxLength={80}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
          />
          <Button disabled={busy}>提交退貨單號</Button>
        </form>
      )}
      {staff && ['pending', 'approved'].includes(service.status) && (
        <>
          <Textarea
            aria-label="售後處理原因"
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="處理原因…"
          />
          <div className="flex gap-2">
            {service.status === 'pending' ? (
              <>
                <Button
                  disabled={busy || !reason.trim()}
                  onClick={() => act(() => api.decideAfterSale(service.id, 'approved', reason))}
                >
                  同意
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !reason.trim()}
                  onClick={() => act(() => api.decideAfterSale(service.id, 'rejected', reason))}
                >
                  拒絕
                </Button>
              </>
            ) : (
              <Button
                disabled={busy || !reason.trim() || (service.type === 'return' && !service.return_shipment)}
                onClick={() => act(() => api.decideAfterSale(service.id, 'refunded', reason))}
              >
                完成模擬退款
              </Button>
            )}
          </div>
        </>
      )}
      <ErrorNote error={error} />
    </section>
  );
}
export function OrderExtras({ order, reload }: { order: Order; reload: () => void }) {
  const { refreshCart } = useAuth();
  const nav = useNavigate();
  const [services, error, , reloadServices] = useAsync(
    () => (API_MODE === 'mock' ? api.listAfterSales(order.id) : Promise.resolve([])),
    [order.id],
  );
  const [action, setAction] = useState<'review' | 'service' | null>(null);
  const [item, setItem] = useState(0);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [type, setType] = useState<'refund' | 'return'>('refund');
  const [reason, setReason] = useState('商品問題');
  const [opError, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (action === 'review')
        await api.createReview(order.items[item].product_id, {
          order_id: order.id,
          item_index: item,
          rating,
          text,
          images,
        });
      else await api.createAfterSale({ order_id: order.id, item_index: item, type, reason, description: text, images });
      setAction(null);
      setText('');
      setImages([]);
      setMessage(action === 'review' ? '評價已提交' : '售後申請已提交');
      reloadServices();
      reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 grid gap-4">
      <div className="rounded-xl border bg-card p-4 text-sm">
        <p>
          聯絡賣家：
          <a
            href={`mailto:${SHOP_INFO.email}?subject=${encodeURIComponent(`訂單 #${order.id}`)}`}
            className="underline"
          >
            {SHOP_INFO.email} · 訂單 #{order.id}
          </a>
        </p>
        {order.note && <p className="mt-2">買家留言：{order.note}</p>}
        {order.cancellation_reason && <p>取消原因：{order.cancellation_reason}</p>}
        {order.status === 'pending' && order.reservation_expires_at && (
          <p>庫存保留至 {new Date(order.reservation_expires_at).toLocaleString('zh-Hant')}，逾時自動取消。</p>
        )}
        <p>
          配送：{SHIPPING_LABEL[order.shipping_method ?? 'pickup']} · 運費 {formatPrice(order.shipping_cents ?? 0)}
        </p>
        <p>
          優惠：滿減 {formatPrice(order.promotion_cents ?? 0)} · 優惠券 {formatPrice(order.coupon_cents ?? 0)} · 積分{' '}
          {formatPrice(order.points_cents ?? 0)}
        </p>
        {!!order.refunded_cents && <p className="text-primary">已退款 {formatPrice(order.refunded_cents)}</p>}
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-bold">物流追蹤</h2>
        {order.shipment ? (
          <>
            <p className="text-sm">
              {order.shipment.carrier} · {order.shipment.tracking_number}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(order.shipment!.tracking_number);
                  setMessage('已複製單號');
                } catch {
                  setMessage('無法複製，請手動選取單號');
                }
              }}
            >
              複製單號
            </Button>
            <ol className="text-sm">
              {[...order.shipment.events].reverse().map((e, i) => (
                <li key={i}>
                  {new Date(e.at).toLocaleString('zh-Hant')} · {e.description}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{order.status === 'cancelled' ? '訂單已取消' : '等待發貨'}</p>
        )}
      </section>
      {API_MODE === 'mock' && (
        <>
          <div className="flex flex-wrap gap-2">
            {order.status === 'delivered' && (
              <Button
                variant="outline"
                onClick={() => {
                  setAction('review');
                  setText('');
                  setImages([]);
                }}
              >
                評價
              </Button>
            )}
            {['paid', 'shipped', 'delivered'].includes(order.status) && (
              <Button
                variant="outline"
                onClick={() => {
                  setAction('service');
                  setText('');
                  setImages([]);
                }}
              >
                申請售後
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api.reorder(order.id);
                  refreshCart();
                  toast.success(
                    result.skipped.length ? `已加入可購買商品，略過：${result.skipped.join('、')}` : '已加入購物車',
                  );
                  nav('/cart');
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              再買一次
            </Button>
            {['delivered', 'cancelled'].includes(order.status) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('確定刪除此訂單紀錄？')) return;
                  setBusy(true);
                  try {
                    await api.hideOrder(order.id);
                    nav('/orders');
                  } catch (e) {
                    setError(e);
                    setBusy(false);
                  }
                }}
              >
                刪除訂單
              </Button>
            )}
          </div>
          {message.includes('加入') && (
            <Link className="text-sm underline" to="/cart">
              前往購物車
            </Link>
          )}
          {action && (
            <form className="grid gap-3 rounded-xl border bg-card p-4" onSubmit={submit}>
              <h2 className="font-bold">{action === 'review' ? '評價商品' : '申請退款／退貨'}</h2>
              <label>
                訂單商品
                <select
                  aria-label="訂單商品"
                  className="ml-2 rounded border bg-card p-2"
                  value={item}
                  onChange={(e) => setItem(Number(e.target.value))}
                >
                  {order.items.map((it, i) => (
                    <option key={i} value={i}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </label>
              {action === 'review' ? (
                <label>
                  評分
                  <select
                    aria-label="評分"
                    className="ml-2 rounded border bg-card p-2"
                    required
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option value={r} key={r}>
                        {r} 星
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    類型
                    <select
                      aria-label="售後類型"
                      className="ml-2 rounded border bg-card p-2"
                      value={type}
                      onChange={(e) => setType(e.target.value as 'refund' | 'return')}
                    >
                      <option value="refund">僅退款</option>
                      <option value="return">退貨退款</option>
                    </select>
                  </label>
                  <label>
                    原因
                    <select
                      aria-label="售後原因"
                      className="ml-2 rounded border bg-card p-2"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      {['商品問題', '與描述不符', '物流問題', '無理由退貨'].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <Textarea
                aria-label={action === 'review' ? '評價文字' : '售後說明'}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <ImageUploads value={images} onChange={setImages} />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  提交
                </Button>
                <Button type="button" variant="outline" onClick={() => setAction(null)}>
                  返回
                </Button>
              </div>
            </form>
          )}
          {services?.length ? (
            <section>
              <h2 className="mb-2 font-bold">售後進度</h2>
              <div className="grid gap-3">
                {services.map((s) => (
                  <AfterSaleCard
                    key={s.id}
                    service={s}
                    reload={() => {
                      reloadServices();
                      reload();
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
      <ErrorNote error={error || opError} />
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function StaffAfterSalesPage() {
  const [services, error, loading, reload] = useAsync(() => api.listAfterSales(), []);
  return (
    <section>
      <h1 className="mb-5 text-3xl font-bold">售後管理</h1>
      <ErrorNote error={error} />
      {loading && <Spinner />}
      <div className="grid gap-3">
        {services?.map((s) => (
          <AfterSaleCard key={s.id} service={s} staff reload={reload} />
        ))}
      </div>
      {!loading && !services?.length && <p>沒有售後申請。</p>}
    </section>
  );
}
