import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiRequestError, formatPrice, type OrderStatus, type StaffOrder } from '../api';
import { Empty, ErrorNote, PageTitle, Spinner, useAsync } from '../components/ui-helpers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATUS_LABEL, canTransition } from '@/lib/orderStatus';
import { StatusBadge, formatDate } from './Orders';

const ALL = 'all';

/** Staff order list (#34): filter by status, mark paid orders shipped, or cancel. */
export function StaffOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | typeof ALL>(ALL);
  const [page, error, loading, reload] = useAsync(() => api.listStaffOrders(status === ALL ? {} : { status }), [status]);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState('');

  async function move(o: StaffOrder, to: 'shipped' | 'cancelled') {
    if (to === 'cancelled' && !window.confirm(`確定取消訂單 #${o.id}？庫存會歸還。`)) return;
    setBusy(o.id);
    setLive('處理中…');
    try {
      await api.updateStaffOrderStatus(o.id, to);
      const msg = `訂單 #${o.id} 已${to === 'shipped' ? '標示為已出貨' : '取消'}`;
      setLive(msg);
      toast.success(msg);
    } catch (e) {
      setLive('');
      toast.error(e instanceof ApiRequestError ? e.message : '操作失敗');
    } finally {
      setBusy(null);
      reload();
    }
  }

  return (
    <section>
      <PageTitle>訂單管理</PageTitle>
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="staff-status" className="text-sm text-muted-foreground">
          狀態
        </label>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | typeof ALL)}>
          <SelectTrigger id="staff-status" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部</SelectItem>
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loading && !page ? (
        <Spinner />
      ) : !page ? (
        <ErrorNote error={error} />
      ) : page.items.length === 0 ? (
        <Empty>沒有訂單</Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>訂單</TableHead>
                <TableHead>買家</TableHead>
                <TableHead>下單時間</TableHead>
                <TableHead>總計</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.id}</TableCell>
                  <TableCell>{o.buyer.display_name}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(o.created_at)}</TableCell>
                  <TableCell>{formatPrice(o.total_cents, o.currency)}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {canTransition(o.status, 'shipped', 'staff') && (
                      <Button size="sm" disabled={busy === o.id} onClick={() => move(o, 'shipped')} aria-label={`訂單 #${o.id} 標示出貨`}>
                        標示出貨
                      </Button>
                    )}
                    {canTransition(o.status, 'cancelled', 'staff') && (
                      <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => move(o, 'cancelled')} aria-label={`取消訂單 #${o.id}`}>
                        取消
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        付款由模擬付款閘道處理（<Link to="/orders" className="underline">買家訂單</Link>）；買家收貨後自行確認送達。
      </p>
    </section>
  );
}
