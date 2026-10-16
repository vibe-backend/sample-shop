import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import {
  api,
  API_MODE,
  ApiRequestError,
  formatPrice,
  type Address,
  type Cart,
  type CreateOrderInput,
  type PaymentMethod,
  type ShippingMethod,
} from '../api';
import { AddAddressButton, AddressDialog, AddressPicker } from '../components/address';
import { PaymentPicker } from '../components/payment';
import { useAuth } from '../auth';
import { Empty, ErrorNote, PageTitle, Spinner, useAsync, useDepsChanged, useNow } from '../components/ui-helpers';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { skuLabel } from '../lib/sku';
import { checkoutTotals, SHOP_INFO, SHIPPING_LABEL } from '../lib/commerce';
import { ProductImage, Promotion } from '../components/shopping';

function Summary({
  label,
  cents,
  currency,
  children,
}: {
  label: string;
  cents: number;
  currency?: string;
  children: ReactNode;
}) {
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
const invalid = (it: Cart['items'][number]) =>
  it.unavailable || !it.product.in_stock || it.quantity > (it.stock ?? Infinity);
export function CartPage() {
  const { me, ready, setCartCount } = useAuth();
  const nav = useNavigate();
  const [loaded, error, loading] = useAsync(() => api.getCart(), [me?.id]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [opErr, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  if (useDepsChanged([me?.id])) {
    setCart(null);
    setPicked(null);
  }
  const c = cart ?? loaded;
  async function op(fn: () => Promise<Cart>) {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setCart(next);
      setCartCount(next.items.reduce((s, i) => s + i.quantity, 0));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!ready || loading) return <Spinner />;
  if (!c) return <ErrorNote error={error} />;
  const selected = (
    API_MODE === 'real'
      ? c.items.map((it) => it.id)
      : (picked ?? c.items.filter((it) => !invalid(it)).map((it) => it.id))
  ).filter((id) => c.items.some((it) => it.id === id));
  const total = c.items.filter((it) => selected.includes(it.id)).reduce((sum, it) => sum + it.line_total_cents, 0);
  const blocked = c.items.some((it) => selected.includes(it.id) && invalid(it));
  async function clearInvalid() {
    await op(async () => {
      for (const it of c!.items.filter(invalid)) await api.removeCartItem(it.id);
      return api.getCart();
    });
  }
  return (
    <section>
      <PageTitle>購物車</PageTitle>
      {!me && <p className="mb-3 text-sm">訪客購物車 · 登入後會合併到帳戶，結帳時需登入。</p>}
      <ErrorNote error={opErr} />
      {!c.items.length ? (
        <Empty>
          <p>購物車是空的。</p>
          <Button asChild>
            <Link to="/">去逛逛</Link>
          </Button>
        </Empty>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[1fr_320px]">
          <Card className="py-0">
            <div className="flex items-center justify-between border-b p-4">
              <label className="text-sm">
                <input
                  type="checkbox"
                  aria-label="全選商品"
                  checked={selected.length === c.items.length}
                  onChange={(e) => setPicked(e.target.checked ? c.items.map((it) => it.id) : [])}
                />{' '}
                全選
              </label>
              <strong>{SHOP_INFO.name}</strong>
              <Button variant="link" size="sm" disabled={busy} onClick={clearInvalid}>
                清除失效商品
              </Button>
            </div>
            <ul>
              {c.items.map((it, i) => (
                <li key={it.id}>
                  {i > 0 && <Separator />}
                  <div className="grid grid-cols-[auto_56px_1fr] items-center gap-3 p-4">
                    <input
                      type="checkbox"
                      aria-label={`選擇 ${it.product.name}${it.sku ? ` ${skuLabel(it.sku.options)}` : ''}`}
                      checked={selected.includes(it.id)}
                      onChange={(e) =>
                        setPicked(e.target.checked ? [...selected, it.id] : selected.filter((id) => id !== it.id))
                      }
                    />
                    <ProductImage src={it.product.image_url} alt="" className="size-14 rounded-lg object-cover" />
                    <div className="grid gap-1">
                      <Link to={`/products/${it.product.id}`} className="font-semibold hover:underline">
                        {it.product.name}
                      </Link>
                      {it.sku && <span className="text-sm text-muted-foreground">{skuLabel(it.sku.options)}</span>}
                      <span className="text-sm">單價 {formatPrice(it.product.price_cents, it.product.currency)}</span>
                      {it.unavailable ? (
                        <Badge variant="destructive">已下架，請移除</Badge>
                      ) : it.quantity > (it.stock ?? Infinity) ? (
                        <p role="alert" className="text-sm text-destructive">
                          庫存只剩 {it.stock} 件
                        </p>
                      ) : !it.product.in_stock ? (
                        <Badge variant="secondary">已售完</Badge>
                      ) : null}
                      {it.price_changed && (
                        <p className="text-sm text-primary">
                          價格已由 {formatPrice(it.original_price_cents ?? 0)} 更新為{' '}
                          {formatPrice(it.product.price_cents)}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-full border" aria-label={`${it.product.name} 數量`}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="減少"
                            disabled={busy || it.quantity <= 1}
                            onClick={() => op(() => api.updateCartItem(it.id, it.quantity - 1))}
                          >
                            <Minus />
                          </Button>
                          <span className="min-w-7 text-center text-sm">{it.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="增加"
                            disabled={busy || it.quantity >= (it.stock ?? 99) || invalid(it)}
                            onClick={() => op(() => api.updateCartItem(it.id, it.quantity + 1))}
                          >
                            <Plus />
                          </Button>
                        </div>
                        <strong>{formatPrice(it.line_total_cents)}</strong>
                        <Button
                          variant="link"
                          size="sm"
                          disabled={busy}
                          onClick={() => op(() => api.removeCartItem(it.id))}
                        >
                          移除
                        </Button>
                        {API_MODE === 'mock' && (
                          <Button
                            variant="link"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              if (!me) return nav('/login?next=/cart');
                              void op(async () => {
                                await api.setFavorite(it.product.id, true);
                                return api.removeCartItem(it.id);
                              });
                            }}
                          >
                            移入收藏
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Summary label="小計" cents={total}>
            <p className="text-xs text-muted-foreground">快遞 HK$30，滿 HK$300 免運；自提免費。</p>
            <Promotion subtotal={total} />
            <p className="text-sm">已選 {selected.length} 項</p>
            {blocked && (
              <p role="alert" className="text-sm text-destructive">
                請移除失效商品或調整庫存不足的數量後結帳。
              </p>
            )}
            <Button
              size="lg"
              disabled={!selected.length || blocked || busy}
              onClick={() =>
                nav(API_MODE === 'real' ? '/checkout' : `/checkout?items=${encodeURIComponent(selected.join(','))}`)
              }
            >
              前往結帳
            </Button>
          </Summary>
        </div>
      )}
    </section>
  );
}
export async function checkoutCart(params: URLSearchParams): Promise<Cart> {
  const buy = params.get('buy');
  if (API_MODE === 'real' && (buy || params.has('items')))
    throw new ApiRequestError(501, 'FEATURE_NOT_AVAILABLE', '立即購買及部分結帳目前只支援示範模式');
  if (buy) {
    const p = await api.getProduct(buy);
    const skuId = params.get('sku');
    const v = skuId ? p.variants?.find((v) => v.id === skuId) : undefined;
    if ((p.options?.length && !v) || (skuId && !v))
      throw new ApiRequestError(422, 'SKU_REQUIRED', '請重新選擇商品規格');
    const quantity = Number(params.get('qty') ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      throw new ApiRequestError(422, 'VALIDATION_FAILED', '數量無效');
    const price = v?.price_cents ?? p.price_cents;
    return {
      subtotal_cents: price * quantity,
      items: [
        {
          id: 'buy_now',
          product: {
            id: p.id,
            slug: p.slug,
            name: p.name,
            price_cents: price,
            currency: p.currency,
            image_url: v?.image_url ?? p.image_urls[0] ?? null,
            in_stock: v?.in_stock ?? p.in_stock,
          },
          sku: v ? { id: v.id, options: v.options } : null,
          quantity,
          line_total_cents: price * quantity,
          stock: v?.stock ?? p.stock,
          unavailable: !p.active,
        },
      ],
    };
  }
  const c = await api.getCart();
  const picked = params.get('items');
  if (picked !== null) {
    const ids = picked.split(',');
    c.items = c.items.filter((it) => ids.includes(it.id) || it.merged_from_ids?.some((id) => ids.includes(id)));
    c.subtotal_cents = c.items.reduce((sum, it) => sum + it.line_total_cents, 0);
  }
  return c;
}
export function CheckoutPage() {
  const now = useNow();
  const { me, refreshCart } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const query = params.toString();
  const [cart, error, loading, reloadCart] = useAsync(() => checkoutCart(new URLSearchParams(query)), [query]);
  const [loadedAddrs, addrErr, addrLoading] = useAsync(() => api.listAddresses(), []);
  const [addrs, setAddrs] = useState<Address[] | null>(null);
  const addresses = addrs ?? loadedAddrs ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const addressId = picked ?? addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;
  const [addOpen, setAddOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('mock_card');
  const [shipping, setShipping] = useState<ShippingMethod>('courier');
  const [note, setNote] = useState('');
  const [couponId, setCoupon] = useState('');
  const [points, setPoints] = useState(0);
  const [coupons] = useAsync(() => (API_MODE === 'mock' ? api.listCoupons() : Promise.resolve([])), []);
  const [wallet] = useAsync(
    () => (API_MODE === 'mock' ? api.wallet() : Promise.resolve({ balance: 0, entries: [] })),
    [],
  );
  const [busy, setBusy] = useState(false);
  const [placeErr, setPlaceErr] = useState<unknown>(null);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  if (loading || addrLoading) return <Spinner />;
  if (!cart) return <ErrorNote error={error} />;
  if (!cart.items.length)
    return (
      <Empty>
        <h1 className="text-3xl font-semibold">結帳</h1>
        <p>購物車是空的。</p>
        <Link to="/">返回商品</Link>
      </Empty>
    );
  const coupon = coupons?.find((c) => c.id === couponId || c.code === couponId);
  const usableCoupon =
    coupon?.claimed &&
    !coupon.used_order_id &&
    Date.parse(coupon.expires_at) > now &&
    cart.subtotal_cents >= coupon.min_cents
      ? coupon
      : undefined;
  const totals =
    API_MODE === 'mock'
      ? checkoutTotals(cart.subtotal_cents, shipping, usableCoupon, points)
      : {
          subtotal_cents: cart.subtotal_cents,
          total_cents: cart.subtotal_cents,
          shipping_cents: 0,
          promotion_cents: 0,
          coupon_cents: 0,
          points_cents: 0,
        };
  const blocked = cart.items.some(invalid);
  const maxPoints = Math.min(
    wallet?.balance ?? 0,
    Math.floor((Math.max(0, cart.subtotal_cents - totals.promotion_cents - totals.coupon_cents) * 0.1) / 100),
  );
  async function place() {
    if (!addressId || !cart) return;
    setBusy(true);
    setPlaceErr(null);
    const body: CreateOrderInput = { address_id: addressId };
    if (API_MODE === 'mock') {
      body.shipping_method = shipping;
      body.note = note;
      if (couponId) body.coupon_id = couponId;
      if (points) body.points = points;
      if (params.has('buy'))
        body.buy_now = {
          product_id: params.get('buy')!,
          sku_id: params.get('sku'),
          quantity: Number(params.get('qty') ?? 1),
        };
      else if (params.has('items')) body.item_ids = cart.items.map((it) => it.id);
    }
    const bodyString = JSON.stringify(body);
    if (attempt.current?.body !== bodyString) attempt.current = { body: bodyString, key: crypto.randomUUID() };
    try {
      const o = await api.createOrder(attempt.current.key, body);
      refreshCart();
      nav(`/orders/${o.id}/pay?placed=1&method=${method}`, { replace: true });
    } catch (e) {
      setPlaceErr(e);
      if (e instanceof ApiRequestError && e.status >= 400 && e.status < 500 && e.status !== 408) attempt.current = null;
      reloadCart();
    } finally {
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
          <CardContent>
            {me?.display_name}
            <div className="text-muted-foreground">{me?.email}</div>
          </CardContent>
          <Separator />
          <CardHeader>
            <CardTitle>收貨地址</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ErrorNote error={addrErr} />
            {!addresses.length ? (
              <div role="status">
                <p className="mb-2 text-sm text-muted-foreground">你還沒有收貨地址，請先新增才可下單。</p>
                <AddAddressButton onClick={() => setAddOpen(true)} label="新增收貨地址" />
              </div>
            ) : (
              <>
                <AddressPicker addresses={addresses} value={addressId} onChange={setPicked} />
                <AddAddressButton onClick={() => setAddOpen(true)} />
              </>
            )}
          </CardContent>
          <Separator />
          <CardHeader>
            <CardTitle>付款方式</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentPicker value={method} onChange={setMethod} />
          </CardContent>
          {API_MODE === 'mock' && (
            <>
              <Separator />
              <CardHeader>
                <CardTitle>配送及優惠</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <fieldset>
                  <legend className="mb-2 text-sm">配送方式</legend>
                  {(['courier', 'pickup'] as const).map((s) => (
                    <label key={s} className="mr-3 text-sm">
                      <input type="radio" name="shipping" checked={shipping === s} onChange={() => setShipping(s)} />{' '}
                      {SHIPPING_LABEL[s]}
                    </label>
                  ))}
                </fieldset>
                <label className="text-sm">
                  優惠券
                  <select
                    aria-label="優惠券"
                    className="ml-2 rounded border bg-card p-2"
                    value={coupons?.some((c) => c.id === couponId) ? couponId : ''}
                    onChange={(e) => setCoupon(e.target.value)}
                  >
                    <option value="">不使用</option>
                    {coupons
                      ?.filter((c) => c.claimed && !c.used_order_id && Date.parse(c.expires_at) > now)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <Input
                  aria-label="優惠碼"
                  placeholder="輸入優惠碼"
                  value={couponId}
                  onChange={(e) => setCoupon(e.target.value)}
                />
                {couponId && !usableCoupon && (
                  <p role="alert" className="text-sm text-destructive">
                    優惠券未領取、已使用、已過期或未滿門檻。
                  </p>
                )}
                <label className="text-sm">
                  使用積分（餘額 {wallet?.balance ?? 0}，本單上限 {maxPoints}）
                  <Input
                    aria-label="使用積分"
                    type="number"
                    min={0}
                    max={maxPoints}
                    value={points}
                    onChange={(e) =>
                      setPoints(Math.max(0, Math.min(maxPoints, Math.floor(Number(e.target.value) || 0))))
                    }
                  />
                </label>
                <label className="text-sm">
                  買家留言（選填，上限 200 字）
                  <Textarea
                    aria-label="買家留言"
                    maxLength={200}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </CardContent>
            </>
          )}
          <Separator />
          <CardHeader>
            <CardTitle>商品</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {cart.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <span>
                    {invalid(it) && <Badge variant="destructive">已無法購買／庫存不足</Badge>}
                    {it.product.name}
                    {it.sku && <span className="text-muted-foreground">（{skuLabel(it.sku.options)}）</span>} ×{' '}
                    {it.quantity}
                  </span>
                  <span>{formatPrice(it.line_total_cents)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">示範模式：下單後進入模擬付款頁，不會收取真實款項。</p>
          </CardContent>
        </Card>
        <Summary label="總計" cents={totals.total_cents}>
          <div className="space-y-1 text-sm">
            <p>商品小計 {formatPrice(totals.subtotal_cents)}</p>
            <p>運費 {formatPrice(totals.shipping_cents)}</p>
            <p>滿減 −{formatPrice(totals.promotion_cents)}</p>
            <p>優惠券 −{formatPrice(totals.coupon_cents)}</p>
            <p>積分 −{formatPrice(totals.points_cents)}</p>
          </div>
          <ErrorNote error={placeErr} />
          {!addressId && (
            <p id="need-address" className="text-sm text-destructive">
              請先新增收貨地址
            </p>
          )}
          {blocked && (
            <p role="alert" className="text-sm text-destructive">
              請返回購物車處理無法購買的商品。
            </p>
          )}
          <Button
            size="lg"
            aria-describedby={addressId ? undefined : 'need-address'}
            onClick={place}
            disabled={busy || !addressId || blocked || (!!couponId && !usableCoupon)}
          >
            {busy ? '處理中…' : '確認下單'}
          </Button>
          <Button variant="link" asChild>
            <Link to="/cart">返回購物車</Link>
          </Button>
        </Summary>
      </div>
      <AddressDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultName={me?.display_name ?? ''}
        forceDefault={!addresses.length}
        onCreated={(a) => {
          const rest = a.is_default ? addresses.map((x) => ({ ...x, is_default: false })) : addresses;
          setAddrs([...rest, a].sort((x, y) => Number(y.is_default) - Number(x.is_default)));
          setPicked(a.id);
        }}
      />
    </section>
  );
}
