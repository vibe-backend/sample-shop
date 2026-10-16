import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useEffect, useState, useImperativeHandle, forwardRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, API_MODE, formatPrice, type Product } from '../api';
import { useAuth } from '../auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ErrorNote, useAsync, useDepsChanged } from './ui-helpers';
import { placeholderImage } from '../api/seed';
import { CATEGORY_TREE, SHOP_INFO, campaignActive } from '../lib/commerce';
import { readLocal, writeLocal, searches, removeSearch, recordSearch, visits, removeVisit } from '../lib/browsing';

export function ProductImage({
  src,
  alt,
  className,
  loading,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const fallback = placeholderImage('🛍️', 30);
  const [failed, setFailed] = useState(false);
  if (useDepsChanged([src])) setFailed(false);
  return (
    <img
      loading={loading}
      src={!src || failed ? fallback : src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
export function Gallery({ product, skuImage }: { product: Product; skuImage?: string | null }) {
  const [index, setIndex] = useState(0);
  const [touch, setTouch] = useState<number | null>(null);
  if (useDepsChanged([product.id, skuImage])) setIndex(0);
  const images = skuImage ? [skuImage, ...product.image_urls.filter((url) => url !== skuImage)] : product.image_urls;
  const move = (n: number) => setIndex((i) => (i + n + Math.max(1, images.length)) % Math.max(1, images.length));
  return (
    <div
      aria-label="商品圖片"
      tabIndex={0}
      className="space-y-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          move(e.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      onTouchStart={(e) => setTouch(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch !== null && Math.abs(e.changedTouches[0].clientX - touch) > 40)
          move(e.changedTouches[0].clientX > touch ? -1 : 1);
        setTouch(null);
      }}
    >
      <ProductImage src={images[index]} alt={product.name} className="aspect-square w-full rounded-3xl object-cover" />
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, i) => (
            <button
              key={i}
              type="button"
              aria-label={`商品圖片 ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={`w-16 overflow-hidden rounded-lg border-2 ${i === index ? 'border-primary' : 'border-transparent'}`}
            >
              <ProductImage src={image} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function FavoriteButton({ productId }: { productId: string }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [favorites, , , reload] = useAsync(
    () => (me && API_MODE === 'mock' ? api.listFavorites() : Promise.resolve([])),
    [me?.id],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('shop:favorites', handler);
    return () => window.removeEventListener('shop:favorites', handler);
  }, [reload]);
  const selected = !!favorites?.some((p) => p.id === productId);
  if (API_MODE !== 'mock') return null;
  return (
    <span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        aria-label={selected ? '取消收藏' : '收藏商品'}
        aria-pressed={selected}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!me) return nav(`/login?next=${encodeURIComponent(`/products/${productId}`)}`);
          setBusy(true);
          try {
            await api.setFavorite(productId, !selected);
            window.dispatchEvent(new Event('shop:favorites'));
            reload();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {selected ? '♥ 已收藏' : '♡ 收藏'}
      </Button>
      <ErrorNote error={error} />
    </span>
  );
}
export function ShareButton({ p }: { p: Product }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const url = `${location.href.split('#')[0]}#/products/${encodeURIComponent(p.id)}`;
        try {
          if (navigator.share) await navigator.share({ title: p.name, url });
          else {
            await navigator.clipboard.writeText(url);
            toast.success('已複製');
          }
        } catch (e) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) toast.error('無法分享，請複製瀏覽器網址');
        }
      }}
    >
      分享商品
    </Button>
  );
}
export function StoreCard() {
  const { me } = useAuth();
  const nav = useNavigate();
  const [following, , , reload] = useAsync(
    () => (me && API_MODE === 'mock' ? api.isFollowingShop() : Promise.resolve(false)),
    [me?.id],
  );
  return (
    <aside className="mt-5 grid gap-2 rounded-xl border bg-card p-4">
      <strong>
        {SHOP_INFO.name} · ★ {SHOP_INFO.rating}
      </strong>
      <p className="text-sm text-muted-foreground">{SHOP_INFO.description}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/shop">進入店舖</Link>
        </Button>
        {API_MODE === 'mock' && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!me) return nav('/login?next=/shop');
              try {
                await api.followShop(!following);
                reload();
              } catch {
                toast.error('關注失敗');
              }
            }}
          >
            {following ? '已關注店舖' : '關注店舖'}
          </Button>
        )}
        <ChatButton />
      </div>
    </aside>
  );
}
export function Promotion({ subtotal }: { subtotal: number }) {
  return (
    <p className="text-sm text-primary">
      {subtotal >= 50000 ? '已滿 HK$500，結帳自動減 HK$20' : `再買 ${formatPrice(50000 - subtotal)} 減 HK$20`}
    </p>
  );
}
export function Campaign({ p }: { p: Product }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!p.campaign) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [p.campaign]);
  if (!p.campaign) return null;
  if (!campaignActive(p, now))
    return (
      <p className="text-sm">
        限時活動已結束 · 原價 {formatPrice(p.campaign ? (p.compare_at_price_cents ?? p.price_cents) : p.price_cents)}
      </p>
    );
  const seconds = Math.max(0, Math.floor((Date.parse(p.campaign.ends_at) - now) / 1000));
  return (
    <p className="rounded-lg bg-secondary p-2 text-sm" role="status">
      {p.campaign.sold >= p.campaign.limit
        ? '已搶光'
        : `秒殺價 ${formatPrice(p.campaign.price_cents)} · 剩 ${p.campaign.limit - p.campaign.sold} 件 · ${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}
    </p>
  );
}
export function Discovery({ renderProduct }: { renderProduct: (p: Product) => React.ReactNode }) {
  const [all] = useAsync(() => api.listProducts({ limit: 100 }), []);
  const [tick, setTick] = useState(0);
  const history = visits();
  const active = all?.items.filter((p) => p.active) ?? [];
  const recent = history.slice(0, 10).flatMap((v) => {
    const p = active.find((p) => p.id === v.id);
    return p ? [p] : [];
  });
  const category = recent[0]?.category;
  const recommendations = [...active]
    .sort(
      (a, b) =>
        Number(b.category === category) - Number(a.category === category) || (b.sold_count ?? 0) - (a.sold_count ?? 0),
    )
    .slice(0, 8);
  return (
    <div data-refresh={tick} className="mt-8 space-y-6">
      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex justify-between">
            <h2 className="font-bold">最近瀏覽</h2>
            <Button
              size="sm"
              variant="link"
              onClick={() => {
                removeVisit();
                setTick((t) => t + 1);
              }}
            >
              清除紀錄
            </Button>
          </div>
          <ul className="flex gap-3 overflow-x-auto">
            {recent.map((p) => (
              <li key={p.id} className="w-40 shrink-0">
                {renderProduct(p)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-2 font-bold">猜你喜歡</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recommendations.map((p) => (
            <li key={p.id}>{renderProduct(p)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
export function CategoryGrid({ selected, onSelect }: { selected: string; onSelect: (category: string) => void }) {
  return (
    <nav aria-label="分類入口" className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {CATEGORY_TREE.map((c) => (
        <button
          key={c.slug}
          type="button"
          aria-pressed={selected === c.name}
          onClick={() => onSelect(c.name)}
          className={`rounded-xl border p-3 text-sm ${selected === c.name ? 'border-primary bg-secondary text-primary' : 'bg-card'}`}
        >
          <span aria-hidden="true" className="mr-2">
            {c.icon}
          </span>
          {c.name}
        </button>
      ))}
    </nav>
  );
}
export interface SearchSuggestionsHandle {
  move(direction: number): void;
  chooseActive(): boolean;
}
export const SearchSuggestions = forwardRef<SearchSuggestionsHandle, { value: string; choose: (term: string) => void }>(
  function SearchSuggestions({ value, choose }, ref) {
    const [products] = useAsync(() => api.listProducts({ limit: 100 }), []);
    const [tick, setTick] = useState(0);
    const [index, setIndex] = useState(-1);
    const options = value.trim()
      ? [
          ...new Set(products?.items.filter((p) => p.active && p.name.includes(value.trim())).map((p) => p.name) ?? []),
        ].slice(0, 8)
      : [...new Set([...searches(), '咖啡', '文具', '家居'])].slice(0, 13);
    if (useDepsChanged([value, tick])) setIndex(-1);
    const move = (direction: number) =>
      setIndex((i) =>
        !options.length
          ? -1
          : i < 0
            ? direction > 0
              ? 0
              : options.length - 1
            : (i + direction + options.length) % options.length,
      );
    function select(term: string) {
      recordSearch(term);
      choose(term);
    }
    useImperativeHandle(ref, () => ({
      move,
      chooseActive: () => {
        if (!options[index]) return false;
        select(options[index]);
        return true;
      },
    }));
    return (
      <div
        data-refresh={tick}
        aria-label="搜尋建議"
        className="absolute inset-x-0 top-full z-50 mt-1 rounded-xl border bg-card p-2 shadow-lg"
        onKeyDown={(e) => {
          if (options.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            e.stopPropagation();
            move(e.key === 'ArrowDown' ? 1 : -1);
          }
        }}
      >
        <p className="p-1 text-xs text-muted-foreground">{value ? '搜尋建議（方向鍵選擇）' : '最近搜尋及熱門詞'}</p>
        {options.map((term, i) => (
          <div key={term} className={`flex rounded ${i === index ? 'bg-muted' : ''}`}>
            <button
              type="button"
              aria-pressed={i === index}
              className="flex-1 p-2 text-left text-sm hover:bg-muted"
              onClick={() => select(term)}
            >
              {term}
            </button>
            {!value && searches().includes(term) && (
              <button
                type="button"
                aria-label={`刪除搜尋 ${term}`}
                className="px-2"
                onClick={() => {
                  removeSearch(term);
                  setTick((t) => t + 1);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!value && (
          <Button
            type="button"
            size="sm"
            variant="link"
            onClick={() => {
              removeSearch();
              setTick((t) => t + 1);
            }}
          >
            清除搜尋紀錄
          </Button>
        )}
      </div>
    );
  },
);
export function ImageSearch() {
  const nav = useNavigate();
  const [error, setError] = useState('');
  return (
    <label className="cursor-pointer text-sm">
      📷 以圖搜圖
      <Input
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="以圖搜圖"
        className="mt-1 max-w-52"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return setError('請選擇圖片檔案');
          setError('');
          const category = CATEGORY_TREE[f.size % CATEGORY_TREE.length];
          nav(`/?category=${encodeURIComponent(category.name)}&image_search=mock`);
        }}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
interface ChatLine {
  text: string;
  seller: boolean;
}
export function ChatButton({ orderId }: { orderId?: string }) {
  const { me } = useAuth();
  const key = `shop.chat.v1.${me?.id ?? 'guest'}.${orderId ?? 'shop'}`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const load = () => {
    const saved = readLocal<ChatLine[]>(key, []);
    return Array.isArray(saved) ? saved.filter((l) => typeof l?.text === 'string' && typeof l.seller === 'boolean') : [];
  };
  const [lines, setLines] = useState<ChatLine[]>(load);
  if (useDepsChanged([key])) setLines(load());
  if (API_MODE !== 'mock')
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={`mailto:${SHOP_INFO.email}?subject=${encodeURIComponent(orderId ? `訂單 ${orderId}` : '商品查詢')}`}>
          聯絡賣家
        </a>
      </Button>
    );
  function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const next = [
      ...lines,
      { text: text.trim(), seller: false },
      {
        text: `客服模擬回覆：已收到${orderId ? `訂單 #${orderId} 的` : ''}查詢。配送約 1–2 個工作天；更多資料請查看幫助中心。`,
        seller: true,
      },
    ].slice(-100);
    setLines(next);
    writeLocal(key, next);
    setText('');
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          聯絡客服
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>客服聊天（模擬）</DialogTitle>
          <DialogDescription>示範自動回覆，對話儲存在此瀏覽器。</DialogDescription>
        </DialogHeader>
        <div role="log" aria-live="polite" className="max-h-72 space-y-2 overflow-y-auto">
          {lines.map((l, i) => (
            <p key={i} className={`rounded-lg p-2 text-sm ${l.seller ? 'bg-muted' : 'bg-secondary'}`}>
              {l.seller ? '客服：' : '我：'}
              {l.text}
            </p>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={send}>
          <Input aria-label="訊息" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" disabled={!text.trim()}>
            發送
          </Button>
        </form>
        <Link to="/help" onClick={() => setOpen(false)} className="text-sm underline">
          幫助中心
        </Link>
      </DialogContent>
    </Dialog>
  );
}
