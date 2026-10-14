import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'auto';
const KEY = 'shop.theme';

interface ThemeCtx {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme(t: Theme): void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const systemDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

function readTheme(): Theme {
  try {
    const t = globalThis.localStorage?.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

/** Light / dark / follow-system theme, applied as the `dark` class on <html> (shadcn class strategy). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSysDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = theme === 'auto' ? (sysDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    try {
      globalThis.localStorage?.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, resolved]);

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}

export function useResolvedTheme(): 'light' | 'dark' {
  return useContext(Ctx)?.resolved ?? 'light';
}
