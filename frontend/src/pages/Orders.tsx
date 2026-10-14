import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, formatPrice, type Order, type OrderStatus } from '../api';
import { ErrorNote, Spinner, useAsync } from '../components/ui';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待處理',
  paid: '已付款',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('zh-Hant', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

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
      <h1>我的訂單</h1>
      <ErrorNote error={error} />
      {!loading && orders.length === 0 && !error ? (
        <div className="empty">
          <p>還沒有訂單。</p>
          <Link to="/" className="btn">
            去逛逛
          </Link>
        </div>
      ) : (
        <ul className="orders">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="order-row">
                <div>
                  <strong>#{o.id}</strong>
                  <span className="muted">{formatDate(o.created_at)}</span>
                </div>
                <span className={`status s-${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                <span className="muted">{o.items.reduce((s, i) => s + i.quantity, 0)} 件</span>
                <strong>{formatPrice(o.total_cents, o.currency)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {loading && <Spinner />}
      {cursor && !loading && (
        <div className="center">
          <button className="btn secondary" onClick={() => load(cursor)}>
            載入更多
          </button>
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
    <section className="order-detail">
      {params.get('placed') && (
        <div className="confirm" role="status">
          <span className="check" aria-hidden="true">
            ✓
          </span>
          <div>
            <h1>訂單已成立</h1>
            <p>感謝你的訂購！訂單編號 #{o.id}。</p>
          </div>
        </div>
      )}
      <Link to="/orders" className="back">
        ‹ 所有訂單
      </Link>
      <div className="panel">
        <div className="row">
          <h2>訂單 #{o.id}</h2>
          <span className={`status s-${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
        </div>
        <p className="muted">下單時間：{formatDate(o.created_at)}</p>
        <table className="items">
          <thead>
            <tr>
              <th>商品</th>
              <th>單價</th>
              <th>數量</th>
              <th>小計</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.product_id}>
                <td>{it.name}</td>
                <td>{formatPrice(it.unit_price_cents, o.currency)}</td>
                <td>{it.quantity}</td>
                <td>{formatPrice(it.line_total_cents, o.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>總計</td>
              <td>{formatPrice(o.total_cents, o.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
