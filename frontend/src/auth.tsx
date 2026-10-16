import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore, type Credentials, type Me, type RegisterInput } from './api';

interface AuthCtx {
  me: Me | null;
  ready: boolean;
  isStaff: boolean;
  cartCount: number;
  setCartCount(n: number): void;
  refreshCart(): void;
  refreshMe(): Promise<void>;
  login(c: Credentials): Promise<void>;
  register(r: RegisterInput): Promise<void>;
  logout(): void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  // Without a token there is nothing to load, so the session is ready on first render.
  const [ready, setReady] = useState(() => !tokenStore.get());
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(() => {
    api
      .getCart()
      .then((c) => setCartCount(c.items.reduce((s, i) => s + i.quantity, 0)))
      .catch(() => setCartCount(0));
  }, []);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setMe(null);
      setReady(true);
      refreshCart();
      return;
    }
    try {
      setMe(await api.me());
      refreshCart();
    } catch {
      tokenStore.clear();
      setMe(null);
    } finally {
      setReady(true);
    }
  }, [refreshCart]);

  useEffect(() => {
    if (tokenStore.get()) void loadMe();
    else refreshCart();
  }, [loadMe, refreshCart]);

  const value: AuthCtx = {
    me,
    ready,
    isStaff: !!me?.roles.includes('staff'),
    cartCount,
    setCartCount,
    refreshCart,
    refreshMe: loadMe,
    async login(c) {
      tokenStore.set(await api.login(c));
      await loadMe();
    },
    async register(r) {
      tokenStore.set(await api.register(r));
      await loadMe();
    },
    logout() {
      tokenStore.clear();
      setMe(null);
      refreshCart();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
