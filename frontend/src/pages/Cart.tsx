import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { api, formatPrice, type Cart } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorNote, PageTitle, Spinner, useAsync } from '../components/ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

function Summary({ label, cents, currency, children }: { label: string; cents: number; currency?: string; children: ReactNode }) {
  return (
    <Card className="md:sticky md:top-20">
      <CardContent className="flex items-center justify-between">
        <span>{label}</span>
        <strong className="text-xl">{formatPrice(cents, currency)}</strong>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 border-t bg-transparent pb-4">{children}</CardFooter>
    </Card>
  );
}

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
      <PageTitle>購物車</PageTitle>
      <div className="mb-4 empty:hidden">
        <ErrorNote error={opErr} />
      </div>
      {c.items.length === 0 ? (
        <Empty>
          <p>購物車是空的。</p>
          <Button asChild>
            <Link to="/">去逛逛</Link>
          </Button>
        </Empty>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[1fr_320px]">
          <Card className="py-0">
            <ul>
              {c.items.map((it, i) => (
                <li key={it.id}>
                  {i > 0 && <Separator />}
                  <div className="grid grid-cols-[56px_1fr_auto] items-center gap-x-3 gap-y-1.5 p-4 sm:grid-cols-[64px_1fr_auto_100px_auto] sm:gap-4">
                    {it.product.image_url ? (
                      <img src={it.product.image_url} alt="" className="row-span-3 size-14 rounded-lg object-cover sm:row-span-1 sm:size-16" />
                    ) : (
                      <div className="row-span-3 sm:row-span-1" />
                    )}
                    <div className="col-span-2 grid gap-0.5 sm:col-span-1">
                      <Link to={`/products/${it.product.id}`} className="font-semibold hover:underline">
                        {it.product.name}
                      </Link>
                      <span className="text-sm text-muted-foreground">單價 {formatPrice(it.product.price_cents, it.product.currency)}</span>
                      {!it.product.in_stock && <Badge className="bg-warning/15 text-warning">已售完</Badge>}
                    </div>
                    <div className="flex items-center justify-self-start rounded-full border" aria-label={`${it.product.name} 數量`}>
                      <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="減少" disabled={busy === it.id || it.quantity <= 1} onClick={() => op(it.id, () => api.updateCartItem(it.id, it.quantity - 1))}>
                        <Minus />
                      </Button>
                      <span className="min-w-7 text-center text-sm tabular-nums">{it.quantity}</span>
                      <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="增加" disabled={busy === it.id} onClick={() => op(it.id, () => api.updateCartItem(it.id, it.quantity + 1))}>
                        <Plus />
                      </Button>
                    </div>
                    <span className="text-right font-semibold">{formatPrice(it.line_total_cents, it.product.currency)}</span>
                    <Button variant="link" size="sm" className="col-start-2 justify-self-start px-0 text-destructive sm:col-start-auto" disabled={busy === it.id} onClick={() => op(it.id, () => api.removeCartItem(it.id))}>
                      移除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Summary label="小計" cents={c.subtotal_cents} currency={currency}>
            <p className="text-xs text-muted-foreground">運費及稅項：示範店不收取。</p>
            <Button asChild size="lg" className="h-10">
              <Link to="/checkout">前往結帳</Link>
            </Button>
          </Summary>
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
      <Empty>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">結帳</h1>
        <p>購物車是空的。</p>
        <Button variant="link" asChild>
          <Link to="/">返回商品</Link>
        </Button>
      </Empty>
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
    <section>
      <PageTitle>結帳</PageTitle>
      <div className="grid items-start gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>訂購人</CardTitle>
          </CardHeader>
          <CardContent className="-mt-2">
            {me?.display_name}
            <div className="text-muted-foreground">{me?.email}</div>
          </CardContent>
          <Separator />
          <CardHeader>
            <CardTitle>商品</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2">
              {cart.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <span>
                    {it.product.name} × {it.quantity}
                  </span>
                  <span className="tabular-nums">{formatPrice(it.line_total_cents, currency)}</span>
                </li>
              ))}
            </ul>
            <p className="pt-2 text-xs text-muted-foreground">合約暫未定義收件地址及付款欄位；示範模式下單後狀態為「待處理」。</p>
          </CardContent>
        </Card>
        <Summary label="總計" cents={cart.subtotal_cents} currency={currency}>
          <ErrorNote error={placeErr} />
          <Button size="lg" className="h-10" onClick={place} disabled={busy}>
            {busy ? '處理中…' : '確認下單'}
          </Button>
          <Button variant="link" asChild>
            <Link to="/cart">返回購物車</Link>
          </Button>
        </Summary>
      </div>
    </section>
  );
}
