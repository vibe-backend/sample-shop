import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatPrice, type Cart } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, Spinner, useAsync } from '../components/ui';

export function CartPage() {
  const { setCartCount } = useAuth();
  const [loaded, error, loading] = useAsync(() => api.getCart(), []);
  const [cart, setCart] = useState<Cart | null>(null);
  const [opErr, setOpErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const c = cart ?? loaded;

  async function op(itemId: string, fn: () => Promise<Cart>) {
    setBusy(itemId);
    setOpErr(null);
    try {
      const next = await fn();
      setCart(next);
      setCartCount(next.items.reduce((s, i) => s + i.quantity, 0));
    } catch (e) {
      setOpErr(e);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;
  if (!c) return <ErrorNote error={error} />;
  const currency = c.items[0]?.product.currency;

  return (
    <section>
      <h1>購物車</h1>
      <ErrorNote error={opErr} />
      {c.items.length === 0 ? (
        <div className="empty">
          <p>購物車是空的。</p>
          <Link to="/" className="btn">
            去逛逛
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <ul className="lines">
            {c.items.map((it) => (
              <li key={it.id} className="line">
                {it.product.image_url && <img src={it.product.image_url} alt="" />}
                <div className="line-info">
                  <Link to={`/products/${it.product.id}`}>{it.product.name}</Link>
                  <span className="muted">單價 {formatPrice(it.product.price_cents, it.product.currency)}</span>
                  {!it.product.in_stock && <span className="tag warn">已售完</span>}
                </div>
                <div className="stepper" aria-label={`${it.product.name} 數量`}>
                  <button aria-label="減少" disabled={busy === it.id || it.quantity <= 1} onClick={() => op(it.id, () => api.updateCartItem(it.id, it.quantity - 1))}>
                    −
                  </button>
                  <span>{it.quantity}</span>
                  <button aria-label="增加" disabled={busy === it.id} onClick={() => op(it.id, () => api.updateCartItem(it.id, it.quantity + 1))}>
                    +
                  </button>
                </div>
                <span className="line-total">{formatPrice(it.line_total_cents, it.product.currency)}</span>
                <button className="link-btn danger" disabled={busy === it.id} onClick={() => op(it.id, () => api.removeCartItem(it.id))}>
                  移除
                </button>
              </li>
            ))}
          </ul>
          <aside className="summary">
            <div className="row">
              <span>小計</span>
              <strong>{formatPrice(c.subtotal_cents, currency)}</strong>
            </div>
            <p className="muted small">運費及稅項：示範店不收取。</p>
            <Link to="/checkout" className="btn block">
              前往結帳
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}

export function CheckoutPage() {
  const { me, setCartCount } = useAuth();
  const nav = useNavigate();
  const [cart, error, loading] = useAsync(() => api.getCart(), []);
  // One key per checkout visit, so a double-click or retry cannot create two orders.
  const idemKey = useMemo(() => crypto.randomUUID(), []);
  const [busy, setBusy] = useState(false);
  const [placeErr, setPlaceErr] = useState<unknown>(null);

  if (loading) return <Spinner />;
  if (!cart) return <ErrorNote error={error} />;
  if (cart.items.length === 0)
    return (
      <section className="empty">
        <h1>結帳</h1>
        <p>購物車是空的。</p>
        <Link to="/">返回商品</Link>
      </section>
    );
  const currency = cart.items[0].product.currency;

  async function place() {
    setBusy(true);
    setPlaceErr(null);
    try {
      const o = await api.createOrder(idemKey);
      setCartCount(0);
      nav(`/orders/${o.id}?placed=1`, { replace: true });
    } catch (e) {
      setPlaceErr(e);
      setBusy(false);
    }
  }

  return (
    <section className="checkout">
      <h1>結帳</h1>
      <div className="cart-layout">
        <div className="panel">
          <h2>訂購人</h2>
          <p>
            {me?.display_name}
            <br />
            <span className="muted">{me?.email}</span>
          </p>
          <h2>商品</h2>
          <ul className="plain">
            {cart.items.map((it) => (
              <li key={it.id} className="row">
                <span>
                  {it.product.name} × {it.quantity}
                </span>
                <span>{formatPrice(it.line_total_cents, currency)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">合約暫未定義收件地址及付款欄位；示範模式下單後狀態為「待處理」。</p>
        </div>
        <aside className="summary">
          <div className="row">
            <span>總計</span>
            <strong>{formatPrice(cart.subtotal_cents, currency)}</strong>
          </div>
          <ErrorNote error={placeErr} />
          <button className="btn block" onClick={place} disabled={busy}>
            {busy ? '處理中…' : '確認下單'}
          </button>
          <Link to="/cart" className="link-btn block center">
            返回購物車
          </Link>
        </aside>
      </div>
    </section>
  );
}
