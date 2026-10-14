import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CreditCard,
  Heart,
  HelpCircle,
  History,
  LockKeyhole,
  MessageSquare,
  Package,
  Ticket,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { api, API_MODE, formatPrice } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ErrorNote, PageTitle, Spinner, useAsync } from '../components/ui-helpers';
import { ProductCard } from './Products';
import { visits, removeVisit } from '../lib/browsing';
import { SHOP_INFO } from '../lib/commerce';

export function AccountExtras() {
  const { me, refreshMe, logout } = useAuth();
  const nav = useNavigate();
  const [counts, countsError, countsLoading] = useAsync(
    () => (API_MODE === 'mock' ? api.orderCounts() : Promise.resolve(null)),
    [],
  );
  const [wallet, walletError, walletLoading] = useAsync(
    () => (API_MODE === 'mock' ? api.wallet() : Promise.resolve(null)),
    [],
  );
  const [name, setName] = useState(me?.display_name ?? '');
  const [oldPassword, setOld] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function update(e: FormEvent, changePassword: boolean) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (changePassword) {
        await api.changePassword(oldPassword, password);
        logout();
        nav('/login');
      } else {
        await api.updateMe({ display_name: name });
        await refreshMe();
        setMessage('個人資料已更新');
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      {API_MODE === 'mock' && (
        <section className="rounded-xl border bg-card p-5" aria-labelledby="account-orders-title">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="account-orders-title" className="font-semibold">
              訂單進度
            </h2>
            <Link to="/orders" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              全部訂單
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ErrorNote error={countsError} />
          {countsLoading ? (
            <Spinner label="載入訂單進度…" />
          ) : (
            counts && (
              <nav className="grid grid-cols-4 gap-1" aria-label="訂單進度">
                {[
                  { status: 'pending', title: '待付款', Icon: CreditCard },
                  { status: 'paid', title: '待發貨', Icon: Package },
                  { status: 'shipped', title: '待收貨', Icon: Truck },
                  { status: 'needs_review', title: '待評價', Icon: MessageSquare },
                ].map(({ status, title, Icon }) => (
                  <Link
                    key={status}
                    to={`/orders?status=${status}`}
                    className="flex flex-col items-center gap-2 rounded-lg px-1 py-3 text-center hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    <span className="text-xl font-semibold tabular-nums">{counts[status as keyof typeof counts]}</span>
                    <span className="text-xs text-muted-foreground sm:text-sm">{title}</span>
                  </Link>
                ))}
              </nav>
            )
          )}
        </section>
      )}
      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="會員服務">
        {[
          { to: '/account/favorites', title: '收藏商品', subtitle: '留住喜歡的好物', Icon: Heart },
          { to: '/account/coupons', title: '我的優惠券', subtitle: '查看可用優惠', Icon: Ticket },
          { to: '/account/history', title: '足跡', subtitle: '繼續最近的探索', Icon: History },
          { to: '/help', title: '幫助中心', subtitle: '購物問題與支援', Icon: HelpCircle },
        ].map(({ to, title, subtitle, Icon }) => (
          <Link
            key={to}
            to={to}
            className="rounded-xl border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon className="mb-3 size-5 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </Link>
        ))}
      </nav>
      {API_MODE === 'mock' && (
        <>
          <section className="rounded-xl border bg-card p-5" aria-labelledby="account-points-title">
            <h2 id="account-points-title" className="flex items-center gap-2 font-semibold">
              <Wallet className="size-5 text-primary" aria-hidden="true" />
              會員積分
            </h2>
            <ErrorNote error={walletError} />
            {walletLoading ? (
              <Spinner label="載入會員積分…" />
            ) : (
              wallet && (
                <>
                  <p className="my-3 text-3xl font-semibold tabular-nums">
                    {wallet.balance}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">分</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    完成訂單每 HK$1 得 1 分；1 分抵 HK$1，最多抵商品淨額 10%。
                  </p>
                  {wallet.entries.length ? (
                    <ul className="mt-4 max-h-48 divide-y overflow-y-auto text-sm" aria-label="積分紀錄">
                      {wallet.entries.map((it, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="break-words">{it.reason}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(it.at).toLocaleDateString('zh-Hant')}
                            </p>
                          </div>
                          <span className="shrink-0 font-medium tabular-nums">
                            {it.amount > 0 ? '+' : ''}
                            {it.amount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      還沒有積分紀錄，完成訂單後即可累積積分。
                    </p>
                  )}
                </>
              )
            )}
          </section>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <form onSubmit={(e) => update(e, false)} className="grid gap-3 rounded-xl border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <UserRound className="size-5 text-primary" aria-hidden="true" />
                個人資料
              </h2>
              <label htmlFor="profile-name" className="text-sm">
                顯示名稱
              </label>
              <Input
                id="profile-name"
                autoComplete="nickname"
                value={name}
                maxLength={80}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <Button disabled={busy} className="mt-2">
                儲存個人資料
              </Button>
            </form>
            <form onSubmit={(e) => update(e, true)} className="grid gap-3 rounded-xl border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <LockKeyhole className="size-5 text-primary" aria-hidden="true" />
                修改密碼
              </h2>
              <label htmlFor="profile-old-password" className="text-sm">
                舊密碼
              </label>
              <Input
                id="profile-old-password"
                type="password"
                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(e) => setOld(e.target.value)}
              />
              <label htmlFor="profile-new-password" className="text-sm">
                新密碼（至少 8 個字元）
              </label>
              <Input
                id="profile-new-password"
                aria-label="新密碼"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button disabled={busy} className="mt-2">
                修改密碼並重新登入
              </Button>
            </form>
          </div>
        </>
      )}
      <ErrorNote error={error} />
      <p role="status" className="text-sm text-success">
        {message}
      </p>
    </div>
  );
}

export function FavoritesPage() {
  const [items, error, loading, reload] = useAsync(() => api.listFavorites(), []);
  const [opError, setOpError] = useState<unknown>(null);
  return (
    <section>
      <PageTitle>收藏商品</PageTitle>
      <ErrorNote error={error || opError} />
      {loading ? (
        <Spinner />
      ) : !items?.length ? (
        <p>還沒有收藏商品。</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((p) => (
            <li key={p.id}>
              <ProductCard p={p} />
              {!p.active && <p className="text-sm">已下架，收藏已失效</p>}
              <Button
                size="sm"
                variant="link"
                onClick={async () => {
                  try {
                    await api.setFavorite(p.id, false);
                    reload();
                  } catch (e) {
                    setOpError(e);
                  }
                }}
              >
                移除收藏
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function HistoryPage() {
  const [tick, setTick] = useState(0);
  const [products, error, loading] = useAsync(() => api.listProducts({ limit: 100 }), []);
  const groups = new Map<string, ReturnType<typeof visits>>();
  for (const v of visits()) {
    const key = new Date(v.at).toLocaleDateString('zh-Hant');
    const xs = groups.get(key) ?? [];
    xs.push(v);
    groups.set(key, xs);
  }
  return (
    <section data-refresh={tick}>
      <PageTitle>足跡（最近 30 日）</PageTitle>
      <Button
        variant="outline"
        onClick={() => {
          removeVisit();
          setTick((x) => x + 1);
        }}
      >
        清空足跡
      </Button>
      <ErrorNote error={error} />
      {loading && <Spinner />}
      {[...groups].map(([day, xs]) => (
        <section key={day} className="mt-5">
          <h2 className="mb-2 font-bold">{day}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {xs.map((v) => {
              const p = products?.items.find((p) => p.id === v.id);
              return (
                <li key={v.id}>
                  {p ? <ProductCard p={p} /> : <p>商品已下架</p>}
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => {
                      removeVisit(v.id);
                      setTick((x) => x + 1);
                    }}
                  >
                    刪除足跡
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
export function CouponsPage({ compact = false }: { compact?: boolean }) {
  const [items, error, loading, reload] = useAsync(() => api.listCoupons(), []);
  const [tab, setTab] = useState('available');
  const [opError, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const shown = items?.filter(
    (c) =>
      compact ||
      (tab === 'used'
        ? c.used_order_id
        : tab === 'expired'
          ? !c.used_order_id && Date.parse(c.expires_at) <= Date.now()
          : !c.used_order_id && Date.parse(c.expires_at) > Date.now()),
  );
  return (
    <section>
      {compact ? <h2 className="mb-2 font-bold">店舖優惠券</h2> : <PageTitle>我的優惠券</PageTitle>}
      {!compact && (
        <nav className="mb-3 flex gap-2" aria-label="優惠券狀態">
          {[
            ['available', '可用／可領'],
            ['used', '已用'],
            ['expired', '已過期'],
          ].map(([value, label]) => (
            <Button key={value} size="sm" variant={tab === value ? 'default' : 'outline'} onClick={() => setTab(value)}>
              {label}
            </Button>
          ))}
        </nav>
      )}
      <ErrorNote error={error || opError} />
      {loading && <Spinner />}
      <ul className="grid gap-2">
        {shown?.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <strong>{c.name}</strong>
              <p className="text-xs text-muted-foreground">
                優惠碼 {c.code} · {new Date(c.expires_at).toLocaleDateString('zh-Hant')} 到期 · 面額{' '}
                {formatPrice(c.discount_cents)}
              </p>
            </div>
            <Button
              size="sm"
              disabled={!!busy || c.claimed || Date.parse(c.expires_at) <= Date.now()}
              onClick={async () => {
                setBusy(c.id);
                try {
                  await api.claimCoupon(c.id);
                  reload();
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {c.used_order_id ? '已使用' : c.claimed ? '已領取' : '領取'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function ForgotPasswordPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [response, setResponse] = useState<{ message: string; demo_code?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!response) setResponse(await api.requestPasswordReset(email));
      else {
        await api.resetPassword(email, code, password);
        nav('/login?reset=1');
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-md">
      <PageTitle>忘記密碼</PageTitle>
      <form className="grid gap-3" onSubmit={submit}>
        <Input
          aria-label="電郵"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={!!response}
          onChange={(e) => setEmail(e.target.value)}
        />
        {response && (
          <>
            <p role="status">{response.message}</p>
            {API_MODE === 'mock' && (
              <p>
                示範驗證碼：<strong>{response.demo_code}</strong>（10 分鐘內有效）
              </p>
            )}
            <Input
              aria-label="驗證碼"
              required
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Input
              aria-label="新密碼"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}
        <ErrorNote error={error} />
        <Button disabled={busy}>{response ? '重設密碼' : '取得重設指示'}</Button>
        <Link to="/login">返回登入</Link>
      </form>
    </section>
  );
}
const FAQ = [
  {
    topic: '配送',
    q: '運費及發貨時間？',
    a: '快遞 HK$30，商品小計滿 HK$300 免運；門市自提免費。香港發貨，預計 1–2 個工作天。',
  },
  {
    topic: '付款',
    q: '如何付款？',
    a: '示範版支援模擬信用卡及支付寶。不會收取真實款項，可選付款成功或失敗。未付款訂單保留庫存 30 分鐘。',
  },
  {
    topic: '退貨',
    q: '如何申請退款／退貨？',
    a: '於已付款訂單詳情選擇申請售後，填原因及最多 3 張憑證圖。標示支援的商品可於收貨 7 日內申請無理由退貨。賣家同意退貨後請填寄回單號。',
  },
  {
    topic: '優惠',
    q: '優惠券及積分如何使用？',
    a: '先領券，結帳時選擇或輸入優惠碼。滿 HK$500 自動減 HK$20；完成訂單累積積分，結帳最多抵扣商品淨額 10%。',
  },
  { topic: '帳戶', q: '忘記密碼怎麼辦？', a: '登入頁選「忘記密碼」。示範驗證碼有效 10 分鐘，最多嘗試 5 次。' },
];
export function HelpPage() {
  const [q, setQ] = useState('');
  return (
    <section className="mx-auto max-w-2xl">
      <PageTitle>幫助中心</PageTitle>
      <Input
        type="search"
        aria-label="搜尋問題"
        placeholder="搜尋問題…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {[...new Set(FAQ.map((f) => f.topic))].map((topic) => {
        const items = FAQ.filter((f) => f.topic === topic && `${f.q}${f.a}`.includes(q));
        return items.length ? (
          <section className="mt-5" key={topic}>
            <h2 className="mb-2 font-bold">{topic}</h2>
            {items.map((f) => (
              <details key={f.q} className="mb-2 rounded-lg border bg-card p-3">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </section>
        ) : null;
      })}
      <p className="mt-5">
        聯絡電郵：
        <a className="underline" href={`mailto:${SHOP_INFO.email}`}>
          {SHOP_INFO.email}
        </a>
        （示範聯絡地址）
      </p>
    </section>
  );
}
