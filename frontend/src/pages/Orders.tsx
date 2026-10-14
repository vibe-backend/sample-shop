import { OrderExtras } from '../components/community';
import { ChatButton } from '../components/shopping';
import { API_MODE } from '../api';
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
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { STATUS_HINT, STATUS_LABEL, STEPS } from '@/lib/orderStatus';

export { STATUS_LABEL };

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('zh-Hant', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === 'pending'
      ? 'bg-warning/15 text-warning'
      : status === 'paid' || status === 'shipped'
        ? 'bg-secondary text-secondary-foreground'
        : status === 'cancelled'
          ? ''
          : 'bg-success/15 text-success';
  return (
    <Badge variant={status === 'cancelled' ? 'secondary' : 'default'} className={cn(tone)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('status') ?? 'all';
  const [counts] = useAsync(() => (API_MODE === 'mock' ? api.orderCounts() : Promise.resolve(null)), [selected]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  function load(c?: string, isLive: () => boolean = () => true) {
    setLoading(true);
    api
      .listOrders(
        c,
        selected === 'needs_review'
          ? { needs_review: true }
          : selected !== 'all'
            ? { status: selected as OrderStatus }
            : {},
      )
      .then((p) => {
        if (!isLive()) return;
        setOrders((xs) => (c ? [...xs, ...p.items] : p.items));
        setCursor(p.next_cursor);
      })
      .catch((e) => isLive() && setError(e))
      .finally(() => isLive() && setLoading(false));
  }
  useEffect(() => {
    let live = true;
    setError(null);
    load(undefined, () => live);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <section>
      <PageTitle>我的訂單</PageTitle>
      <nav aria-label="訂單狀態" className="mb-4 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">
        {(
          [
            ['all', '全部'],
            ['pending', '待付款'],
            ['paid', '待發貨'],
            ['shipped', '待收貨'],
            ['needs_review', '待評價'],
            ['delivered', '已完成'],
            ['cancelled', '已取消'],
          ] as const
        ).map(([s, name]) => (
          <Button
            key={s}
            size="sm"
            className="shrink-0"
            variant={selected === s ? 'default' : 'outline'}
            aria-pressed={selected === s}
            onClick={() => setParams(s === 'all' ? {} : { status: s })}
          >
            {name}
            {counts ? ` (${counts[s]})` : ''}
          </Button>
        ))}
      </nav>
      <ErrorNote error={error} />
      {!loading && orders.length === 0 && !error ? (
        <Empty>
          <p>{selected === 'all' ? '還沒有訂單。' : '這個狀態暫時沒有訂單。'}</p>
          <Button asChild>
            <Link to="/">去逛逛</Link>
          </Button>
        </Empty>
      ) : (
        <ul className="grid gap-2.5">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/orders/${o.id}`}
                className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className="py-0 transition-colors group-hover:ring-primary/60">
                  <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_60px_120px]">
                    <div className="grid min-w-0 gap-1">
                      <strong className="break-all text-sm">#{o.id}</strong>
                      <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {o.items.map((item) => item.name).join('、')}
                      </span>
                    </div>
                    <StatusBadge status={o.status} />
                    <span className="hidden text-muted-foreground sm:block">
                      {o.items.reduce((s, i) => s + i.quantity, 0)} 件
                    </span>
                    <strong className="col-span-2 text-right sm:col-span-1">
                      {formatPrice(o.total_cents, o.currency)}
                    </strong>
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
  const [o, error, loading, reload] = useAsync(() => api.getOrder(id), [id]);
  const [ask, setAsk] = useState<'cancel' | 'deliver' | null>(null);
  const [cancelReason, setCancelReason] = useState('不想購買');
  useEffect(() => {
    if (o?.status !== 'pending') return;
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [o?.status, reload]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  if (loading && !o) return <Spinner />;
  if (!o) return <ErrorNote error={error} />;

  async function act(kind: 'cancel' | 'deliver') {
    setBusy(true);
    setLive('處理中…');
    try {
      await (kind === 'cancel' ? api.cancelOrder(o!.id, cancelReason) : api.confirmDelivery(o!.id));
      const msg = kind === 'cancel' ? '訂單已取消' : '已確認收貨';
      setLive(msg);
      toast.success(msg);
    } catch (e) {
      setLive('');
      toast.error(e instanceof ApiRequestError ? e.message : '操作失敗');
    } finally {
      setBusy(false);
      setAsk(null);
      reload(); // 409 INVALID_TRANSITION: someone else moved it — show the current state
    }
  }

  return (
    <section>
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
      {params.get('paid') && o.status === 'paid' && (
        <div
          className="mb-5 flex items-center gap-4 rounded-xl border border-success/35 bg-success/10 p-5"
          role="status"
        >
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
        <CardContent>
          <StatusProgress order={o} />
          <p className="mt-3 text-sm text-muted-foreground">{STATUS_HINT[o.status]}</p>
        </CardContent>
        {(o.status === 'pending' || o.status === 'paid' || o.status === 'shipped') && (
          <CardContent>
            <div
              className={cn(
                'flex flex-wrap items-center justify-end gap-3 rounded-lg p-3',
                o.status === 'pending' ? 'bg-warning/10' : 'bg-muted',
              )}
            >
              {o.status === 'pending' && <span className="mr-auto text-sm">此訂單尚未付款。</span>}
              {(o.status === 'pending' || o.status === 'paid') && (
                <Button variant="outline" disabled={busy} onClick={() => setAsk('cancel')}>
                  取消訂單
                </Button>
              )}
              {o.status === 'pending' && (
                <Button asChild>
                  <Link to={`/orders/${o.id}/pay`}>去付款</Link>
                </Button>
              )}
              {o.status === 'shipped' && (
                <Button disabled={busy} onClick={() => setAsk('deliver')}>
                  確認收貨
                </Button>
              )}
            </div>
          </CardContent>
        )}
        {o.status_history && o.status_history.length > 0 && (
          <CardContent>
            <h2 className="mb-1.5 text-sm font-medium text-muted-foreground">訂單記錄</h2>
            <ol className="grid gap-1 text-sm">
              {[...o.status_history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3">
                  <time
                    className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums sm:w-48"
                    dateTime={h.at}
                  >
                    {formatDate(h.at)}
                  </time>
                  <span>{STATUS_LABEL[h.status]}</span>
                </li>
              ))}
            </ol>
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
      <div className="mt-3">
        <ChatButton orderId={o.id} />
      </div>
      <OrderExtras key={o.id} order={o} reload={reload} />
      <AlertDialog open={ask !== null} onOpenChange={(v) => !v && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask === 'cancel' ? '確定取消此訂單？' : '確認已收到商品？'}</AlertDialogTitle>
            <AlertDialogDescription>
              {ask === 'cancel'
                ? o.status === 'paid'
                  ? '取消後款項將按原付款方式退回（模擬），庫存會歸還。'
                  : '取消後庫存會歸還，此操作無法復原。'
                : '確認後訂單將標示為已送達，此操作無法復原。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {ask === 'cancel' && (
            <label className="text-sm">
              取消原因
              <select
                aria-label="取消原因"
                className="ml-2 rounded border bg-card p-2"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                {['不想購買', '買錯商品', '需要修改地址', '其他'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>返回</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void act(ask!);
              }}
            >
              {busy ? '處理中…' : ask === 'cancel' ? '確定取消' : '確認收貨'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Taobao-style progress: 待付款 → 已付款 → 已出貨 → 已送達 (cancelled shown as a terminal note). */
export function StatusProgress({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <p className="flex items-center gap-2 text-sm font-medium">
        <X className="size-4" aria-hidden="true" /> 訂單已取消
      </p>
    );
  }
  const cur = STEPS.indexOf(order.status);
  return (
    <ol aria-label="訂單進度" className="grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => {
        const done = i < cur;
        const now = i === cur;
        return (
          <li
            key={s}
            aria-current={now ? 'step' : undefined}
            className="flex flex-col items-center gap-1 text-center text-xs"
          >
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full border-2 text-xs font-semibold',
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : now
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(now ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground')}
            >
              {STATUS_LABEL[s]}
              {done && <span className="sr-only">（已完成）</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Simulated payment page (#30): choose a demo method, then force success or failure. */
/** A payment error that ends this attempt for sure (vs. timeouts / conflicts that may have succeeded server-side). */
const isDefinitive = (e: unknown) =>
  e instanceof ApiRequestError && e.status >= 400 && e.status < 500 && e.status !== 409 && e.status !== 408;

export function PayPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [o, error, loading, reload] = useAsync(() => api.getOrder(id), [id]);
  useEffect(() => {
    if (o?.status !== 'pending') return;
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [o?.status, reload]);
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
  const method: PaymentMethod =
    picked ?? (fromCheckout === 'mock_alipay' || fromCheckout === 'mock_card' ? fromCheckout : 'mock_card');

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
        <div
          className="mb-5 flex items-center gap-4 rounded-xl border border-success/35 bg-success/10 p-4"
          role="status"
        >
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
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            示範付款：不會收取真實款項，亦毋須輸入卡號。請選擇模擬結果。
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {busy ? '處理中…' : ''}
          </p>
          {payErr != null && (
            <div ref={errRef} tabIndex={-1} className="outline-none">
              {declined ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
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
