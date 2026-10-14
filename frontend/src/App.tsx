import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { API_MODE, resetMockData } from './api';
import { useAuth } from './auth';
import { RequireAuth } from './components/ui';
import { CartPage, CheckoutPage } from './pages/Cart';
import { LoginPage, RegisterPage } from './pages/Auth';
import { OrderDetailPage, OrdersPage } from './pages/Orders';
import { ProductDetailPage, ProductListPage } from './pages/Products';
import { StaffEditPage, StaffProductsPage } from './pages/Staff';

type Theme = 'light' | 'dark' | 'auto';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('shop.theme') as Theme) || 'auto');
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    localStorage.setItem('shop.theme', theme);
  }, [theme]);
  const order: Theme[] = ['auto', 'light', 'dark'];
  return [theme, () => setTheme(order[(order.indexOf(theme) + 1) % 3])];
}

const THEME_LABEL: Record<Theme, string> = { auto: '跟隨系統', light: '淺色', dark: '深色' };

export default function App() {
  const { me, isStaff, cartCount, logout } = useAuth();
  const [theme, cycleTheme] = useTheme();
  const nav = useNavigate();

  return (
    <>
      <header className="topbar">
        <div className="wrap bar">
          <Link to="/" className="brand">
            Sample<span>Shop</span>
          </Link>
          <nav className="nav" aria-label="主選單">
            <NavLink to="/" end>
              商品
            </NavLink>
            {me && <NavLink to="/orders">訂單</NavLink>}
            {isStaff && <NavLink to="/staff/products">商品管理</NavLink>}
          </nav>
          <div className="actions">
            <Link to="/cart" className="cart-link" aria-label={`購物車，${cartCount} 件`}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20.5h.01M17 20.5h.01" />
              </svg>
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </Link>
            {me ? (
              <button
                className="link-btn"
                onClick={() => {
                  logout();
                  nav('/');
                }}
                title={me.email}
              >
                登出
              </button>
            ) : (
              <Link to="/login" className="link-btn">
                登入
              </Link>
            )}
            <button className="icon-btn" onClick={cycleTheme} aria-label={`主題：${THEME_LABEL[theme]}`} title={`主題：${THEME_LABEL[theme]}`}>
              {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
            </button>
          </div>
        </div>
      </header>
      {API_MODE === 'mock' && (
        <div className="mock-banner">
          示範模式：所有資料都是模擬資料，只儲存在此瀏覽器。
          {resetMockData && (
            <button
              className="link-btn"
              onClick={() => {
                resetMockData?.();
                logout();
                nav('/');
                location.reload();
              }}
            >
              重設示範資料
            </button>
          )}
        </div>
      )}
      <main className="wrap main">
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
          <Route path="*" element={<section className="empty"><h1>找不到頁面</h1><Link to="/">返回商品列表</Link></section>} />
        </Routes>
      </main>
      <footer className="wrap footer">Sample Shop · vibe-backend 示範前端</footer>
    </>
  );
}
