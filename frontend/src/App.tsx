import { StaffOrdersPage } from './pages/StaffOrders';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { House, ListOrdered, LogOut, Menu, Monitor, Moon, Search, ShoppingCart, Sun, User } from 'lucide-react';
import { API_MODE, resetMockData } from './api';
import { useAuth } from './auth';
import { RequireAuth } from './components/ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { CartPage, CheckoutPage } from './pages/Cart';
import { LoginPage, RegisterPage } from './pages/Auth';
import { OrderDetailPage, OrdersPage, PayPage } from './pages/Orders';
import { ProductDetailPage, ProductListPage } from './pages/Products';
import { StaffEditPage, StaffProductsPage } from './pages/Staff';
import { useTheme, type Theme } from './theme';

const THEME_LABEL: Record<Theme, string> = { auto: '跟隨系統', light: '淺色', dark: '深色' };

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`主題：${THEME_LABEL[theme]}`} title={`主題：${THEME_LABEL[theme]}`}>
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>主題</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <DropdownMenuRadioItem key={t} value={t}>
              {THEME_LABEL[t]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm transition-colors hover:text-foreground', isActive ? 'text-foreground font-medium' : 'text-muted-foreground');

/** Wide header search with an orange button; submits to the home page's ?q= filter. */
function HeaderSearch({ className }: { className?: string }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const q = pathname === '/' ? (params.get('q') ?? '') : '';
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  function submit(e: FormEvent) {
    e.preventDefault();
    const n = pathname === '/' ? new URLSearchParams(params) : new URLSearchParams();
    if (draft.trim()) n.set('q', draft.trim());
    else n.delete('q');
    const s = n.toString();
    nav(s ? `/?${s}` : '/');
  }
  return (
    <form role="search" onSubmit={submit} className={cn('flex h-10 items-stretch rounded-full border-2 border-brand bg-card focus-within:ring-3 focus-within:ring-ring', className)}>
      <Search className="my-auto ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Input type="search" placeholder="搜尋商品…" aria-label="搜尋商品" className="h-full flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button type="submit" className="m-0.5 h-auto rounded-full px-5 sm:px-7">
        搜尋
      </Button>
    </form>
  );
}

/** 「我的」 tab target: the account menu as a page (mobile). */
function AccountPage() {
  const { me, isStaff, logout } = useAuth();
  const nav = useNavigate();
  return (
    <section className="mx-auto grid max-w-md gap-3">
      <div className="rounded-xl bg-gradient-to-r from-[#c43c00] to-[#9e2f00] p-5 text-white">
        <div className="text-lg font-semibold">{me?.display_name}</div>
        <div className="text-sm">{me?.email}</div>
      </div>
      <nav className="grid divide-y rounded-xl bg-card" aria-label="帳戶">
        <Link to="/orders" className="px-4 py-3">我的訂單</Link>
        {isStaff && <Link to="/staff/products" className="px-4 py-3">商品管理</Link>}
        {isStaff && <Link to="/staff/orders" className="px-4 py-3">訂單管理</Link>}
        <button type="button" className="px-4 py-3 text-left text-destructive" onClick={() => { logout(); nav('/'); }}>
          登出
        </button>
      </nav>
    </section>
  );
}

/** Mobile-only bottom tab bar. */
function BottomTabs({ cartCount, signedIn }: { cartCount: number; signedIn: boolean }) {
  const tab = ({ isActive }: { isActive: boolean }) => cn('relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px]', isActive ? 'text-primary' : 'text-muted-foreground');
  return (
    <nav aria-label="底部分頁" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <NavLink to="/" end className={tab}>
        <House className="size-5" aria-hidden="true" />
        首頁
      </NavLink>
      <NavLink to="/cart" className={tab}>
        <ShoppingCart className="size-5" aria-hidden="true" />
        {cartCount > 0 && <Badge className="absolute top-0.5 left-1/2 ml-1 h-4 min-w-4 px-1 text-[10px]">{cartCount}</Badge>}
        購物車
      </NavLink>
      <NavLink to="/orders" className={tab}>
        <ListOrdered className="size-5" aria-hidden="true" />
        訂單
      </NavLink>
      <NavLink to={signedIn ? '/account' : '/login'} className={tab}>
        <User className="size-5" aria-hidden="true" />
        {signedIn ? '我的' : '登入'}
      </NavLink>
    </nav>
  );
}

export default function App() {
  const { me, isStaff, cartCount, logout } = useAuth();
  const nav = useNavigate();
  const links = [
    { to: '/', label: '商品', end: true, show: true },
    { to: '/orders', label: '訂單', end: false, show: !!me },
    { to: '/staff/products', label: '商品管理', end: false, show: isStaff },
    { to: '/staff/orders', label: '訂單管理', end: false, show: isStaff },
  ].filter((l) => l.show);

  function doLogout() {
    logout();
    nav('/');
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-3 sm:h-16 sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="開啟選單">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle>Sample Shop</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="主選單">
                {links.map((l) => (
                  <SheetClose asChild key={l.to}>
                    <NavLink to={l.to} end={l.end} className={({ isActive }) => cn('rounded-md px-3 py-2 text-base', isActive ? 'bg-muted font-medium' : 'text-muted-foreground')}>
                      {l.label}
                    </NavLink>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/" className="shrink-0 text-lg font-bold tracking-tight text-primary sm:text-xl">
            Sample<span className="font-normal text-foreground">Shop</span>
          </Link>
          <HeaderSearch className="hidden max-w-2xl flex-1 sm:flex" />
          <nav className="hidden items-center gap-5 lg:flex" aria-label="主選單">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link to="/cart" aria-label={`購物車，${cartCount} 件`}>
                <ShoppingCart />
                {cartCount > 0 && <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">{cartCount}</Badge>}
              </Link>
            </Button>
            {me ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="帳戶">
                    <User />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuLabel>
                    {me.display_name}
                    <div className="text-xs font-normal text-muted-foreground">{me.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => nav('/orders')}>我的訂單</DropdownMenuItem>
                  {isStaff && <DropdownMenuItem onSelect={() => nav('/staff/products')}>商品管理</DropdownMenuItem>}
                  {isStaff && <DropdownMenuItem onSelect={() => nav('/staff/orders')}>訂單管理</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={doLogout}>
                    <LogOut /> 登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">登入</Link>
              </Button>
            )}
            <ThemeMenu />
          </div>
        </div>
      </header>
      {API_MODE === 'mock' && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 border-b px-4 py-1.5 text-center text-xs text-muted-foreground">
          示範模式：所有資料都是模擬資料，只儲存在此瀏覽器。
          {resetMockData && (
            <Button
              variant="link"
              size="xs"
              className="h-auto p-0 text-xs"
              onClick={() => {
                resetMockData?.();
                logout();
                nav('/');
                location.reload();
              }}
            >
              重設示範資料
            </Button>
          )}
        </div>
      )}
      <div className="border-b bg-card px-3 py-2 sm:hidden">
        <HeaderSearch />
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-4 pb-24 sm:px-6 sm:pt-6 sm:pb-12">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="/orders/:id/pay" element={<RequireAuth><PayPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/staff/orders" element={<RequireAuth staff><StaffOrdersPage /></RequireAuth>} />
          <Route path="/staff/products" element={<RequireAuth staff><StaffProductsPage /></RequireAuth>} />
          <Route path="/staff/products/new" element={<RequireAuth staff><StaffEditPage /></RequireAuth>} />
          <Route path="/staff/products/:id" element={<RequireAuth staff><StaffEditPage /></RequireAuth>} />
          <Route
            path="*"
            element={
              <section className="py-16 text-center">
                <h1 className="mb-4 text-3xl font-semibold tracking-tight">找不到頁面</h1>
                <Button variant="link" asChild>
                  <Link to="/">返回商品列表</Link>
                </Button>
              </section>
            }
          />
        </Routes>
      </main>
      <footer className="mx-auto hidden w-full max-w-7xl border-t px-4 pt-5 pb-10 text-xs text-muted-foreground sm:block sm:px-6">Sample Shop · vibe-backend 示範前端</footer>
      <BottomTabs cartCount={cartCount} signedIn={!!me} />
    </div>
  );
}
