import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { api, formatPrice, type Order, type OrderStatus } from '../api';
import { Empty, ErrorNote, PageTitle, Spinner, useAsync } from '../components/ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { skuLabel } from '@/lib/sku';
import { cn } from '@/lib/utils';
import { BackLink } from './Products';
import { AddressLines } from '../components/address';
import { PAYMENT_LABEL, PaymentPicker } from '../components/payment';
import { ApiRequestError, type PaymentMethod } from '../api';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('zh-Hant', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === 'pending' ? 'bg-warning/15 text-warning' : status === 'cancelled' ? '' : 'bg-success/15 text-success';
  return (
    <Badge variant={status === 'cancelled' ? 'secondary' : 'default'} className={cn(tone)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  function load(c?: string) {
    setLoading(true);
    api
      .listOrders(c)
      .then((p) => {
        setOrders((xs) => (c ? [...xs, ...p.items] : p.items));
        setCursor(p.next_cursor);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }
  useEffect(() => load(), []);

  return (
    <section>
      <PageTitle>我的訂單</PageTitle>
      <ErrorNote error={error} />
      {!loading && orders.length === 0 && !error ? (
        <Empty>
          <p>還沒有訂單。</p>
          <Button asChild>
            <Link to="/">去逛逛</Link>
          </Button>
        </Empty>
      ) : (
        <ul className="grid gap-2.5">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none">
                <Card className="py-0 transition-colors group-hover:ring-primary/60">
                  <CardContent className="grid grid-cols-[1fr_auto] items-center gap-4 py-3.5 sm:grid-cols-[1fr_auto_60px_120px]">
                    <div className="grid">
                      <strong>#{o.id}</strong>
                      <span className="text-muted-foreground">{formatDate(o.created_at)}</span>
                    </div>
                    <StatusBadge status={o.status} />
                    <span className="hidden text-muted-foreground sm:block">{o.items.reduce((s, i) => s + i.quantity, 0)} 件</span>
                    <strong className="col-span-2 text-right sm:col-span-1">{formatPrice(o.total_cents, o.currency)}</strong>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {loading && <Spinner />}
      {cursor && !loading && (
        <div className="mt-6 text-center">
          <Button variant="outline" size="lg" onClick={() => load(cursor)}>
            載入更多
          </Button>
        </div>
      )}
    </section>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const [o, error, loading] = useAsync(() => api.getOrder(id), [id]);
  if (loading) return <Spinner />;
  if (!o) return <ErrorNote error={error} />;
  return (
    <section>
      {params.get('paid') && o.status === 'paid' && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-success/35 bg-success/10 p-5" role="status">
          <CircleCheck className="size-11 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">付款成功</h1>
            <p>感謝你的訂購！訂單編號 #{o.id}，我們會盡快安排發貨。</p>
          </div>
        </div>
      )}
      <BackLink to="/orders">所有訂單</BackLink>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">訂單 #{o.id}</CardTitle>
          <CardDescription>下單時間：{formatDate(o.created_at)}</CardDescription>
          <CardAction>
            <StatusBadge status={o.status} />
          </CardAction>
        </CardHeader>
        {o.status === 'pending' && (
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning/10 p-3">
              <span className="text-sm">此訂單尚未付款。</span>
              <Button asChild>
                <Link to={`/orders/${o.id}/pay`}>去付款</Link>
              </Button>
            </div>
          </CardContent>
        )}
        {o.status === 'paid' && o.paid_at && (
          <CardContent className="text-sm text-muted-foreground">
            已於 {formatDate(o.paid_at)} 以{o.payment_method ? PAYMENT_LABEL[o.payment_method] : '模擬付款'}付款
          </CardContent>
        )}
        {o.shipping_address && (
          <CardContent>
            <h2 className="mb-1.5 text-sm font-medium text-muted-foreground">收貨地址</h2>
            <AddressLines a={o.shipping_address} />
          </CardContent>
        )}
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>單價</TableHead>
                <TableHead>數量</TableHead>
                <TableHead className="text-right">小計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.items.map((it) => (
                <TableRow key={`${it.product_id}:${it.sku_id ?? ''}`}>
                  <TableCell>
                    <div>{it.name}</div>
                    {it.sku_options && <div className="text-xs text-muted-foreground">{skuLabel(it.sku_options)}</div>}
                  </TableCell>
                  <TableCell>{formatPrice(it.unit_price_cents, o.currency)}</TableCell>
                  <TableCell>{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatPrice(it.line_total_cents, o.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>總計</TableCell>
                <TableCell className="text-right">{formatPrice(o.total_cents, o.currency)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

/** Simulated payment page (#30): choose a demo method, then force success or failure. */
/** A payment error that ends this attempt for sure (vs. timeouts / conflicts that may have succeeded server-side). */
const isDefinitive = (e: unknown) => e instanceof ApiRequestError && e.status >= 400 && e.status < 500 && e.status !== 409 && e.status !== 408;

export function PayPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [o, error, loading, reload] = useAsync(() => api.getOrder(id), [id]);
  const [picked, setPicked] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [payErr, setPayErr] = useState<unknown>(null);
  // One Idempotency-Key per payment attempt: reused for retries after an uncertain error,
  // replaced after a definitive failure or when the method changes (CONTRACT.md §10/§13 @a3d4304).
  const keyRef = useRef<string | null>(null);
  const errRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (payErr) errRef.current?.focus();
  }, [payErr]);
  if (loading) return <Spinner />;
  if (!o) return <ErrorNote error={error} />;
  const fromCheckout = params.get('method');
  const method: PaymentMethod = picked ?? (fromCheckout === 'mock_alipay' || fromCheckout === 'mock_card' ? fromCheckout : 'mock_card');

  function changeMethod(m: PaymentMethod) {
    if (m !== method) keyRef.current = null;
    setPicked(m);
  }

  async function pay(simulate: 'success' | 'failure') {
    setBusy(true);
    setPayErr(null);
    keyRef.current ??= crypto.randomUUID();
    try {
      await api.payOrder(o!.id, { method, simulate }, keyRef.current);
      nav(`/orders/${o!.id}?paid=1`, { replace: true });
    } catch (e) {
      if (isDefinitive(e)) keyRef.current = null;
      // 409 (already paid / key reused): the server state moved on — reload the order.
      if (e instanceof ApiRequestError && e.status === 409) {
        keyRef.current = null;
        reload();
      }
      setPayErr(e);
      setBusy(false);
    }
  }

  if (o.status !== 'pending')
    return (
      <section>
        <BackLink to={`/orders/${o.id}`}>訂單詳情</BackLink>
        <p>此訂單{STATUS_LABEL[o.status]}，毋須付款。</p>
      </section>
    );

  const declined = payErr instanceof ApiRequestError && payErr.code === 'PAYMENT_DECLINED';
  return (
    <section className="mx-auto max-w-xl">
      {params.get('placed') && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-success/35 bg-success/10 p-4" role="status">
          <CircleCheck className="size-9 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">訂單已成立</h1>
            <p className="text-sm">訂單編號 #{o.id}，請完成付款。</p>
          </div>
        </div>
      )}
      <BackLink to={`/orders/${o.id}`}>訂單詳情</BackLink>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">付款</CardTitle>
          <CardDescription>訂單 #{o.id}</CardDescription>
          <CardAction>
            <span className="text-2xl font-bold text-price">{formatPrice(o.total_cents, o.currency)}</span>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PaymentPicker value={method} onChange={changeMethod} />
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">示範付款：不會收取真實款項，亦毋須輸入卡號。請選擇模擬結果。</p>
          <p className="sr-only" role="status" aria-live="polite">
            {busy ? '處理中…' : ''}
          </p>
          {payErr != null && (
            <div ref={errRef} tabIndex={-1} className="outline-none">
              {declined ? (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  付款失敗（模擬）。訂單仍為「待付款」，你可以重試或更換付款方式。
                </div>
              ) : (
                <ErrorNote error={payErr} />
              )}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="lg" className="h-11" onClick={() => pay('success')} disabled={busy}>
              {busy ? '處理中…' : declined ? '重試：模擬付款成功' : '模擬付款成功'}
            </Button>
            <Button size="lg" variant="outline" className="h-11" onClick={() => pay('failure')} disabled={busy}>
              模擬付款失敗
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
