import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待處理',
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
              <Link to={`/orders/${o.id}`} className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
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
      {params.get('placed') && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-success/35 bg-success/10 p-5" role="status">
          <CircleCheck className="size-11 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">訂單已成立</h1>
            <p>感謝你的訂購！訂單編號 #{o.id}。</p>
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
