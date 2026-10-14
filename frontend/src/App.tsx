import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Monitor, Moon, ShoppingCart, Sun, User } from 'lucide-react';
import { API_MODE, resetMockData } from './api';
import { useAuth } from './auth';
import { RequireAuth } from './components/ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { OrderDetailPage, OrdersPage } from './pages/Orders';
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

export default function App() {
  const { me, isStaff, cartCount, logout } = useAuth();
  const nav = useNavigate();
  const links = [
    { to: '/', label: '商品', end: true, show: true },
    { to: '/orders', label: '訂單', end: false, show: !!me },
    { to: '/staff/products', label: '商品管理', end: false, show: isStaff },
  ].filter((l) => l.show);

  function doLogout() {
    logout();
    nav('/');
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
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
          <Link to="/" className="text-base font-semibold tracking-tight">
            Sample<span className="font-normal text-muted-foreground">Shop</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-6 sm:flex" aria-label="主選單">
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-12 sm:px-6">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
      <footer className="mx-auto w-full max-w-6xl border-t px-4 pt-5 pb-10 text-xs text-muted-foreground sm:px-6">Sample Shop · vibe-backend 示範前端</footer>
    </div>
  );
}
