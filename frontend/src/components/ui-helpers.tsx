import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ApiRequestError } from '../api';
import { useAuth } from '../auth';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function errorText(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  return '發生未預期的錯誤，請稍後再試';
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertDescription>{errorText(error)}</AlertDescription>
    </Alert>
  );
}

export function Spinner({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function PageTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h1 className={`mt-2 mb-5 text-3xl font-semibold tracking-tight sm:text-4xl ${className}`}>{children}</h1>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-4 py-12 text-center text-muted-foreground">{children}</section>
  );
}

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

/**
 * True on the render where `deps` changed since the previous render. Lets a component reset state
 * while rendering ("adjusting state when a prop changes", react.dev) instead of in an effect.
 */
export function useDepsChanged(deps: readonly unknown[]): boolean {
  const [prev, setPrev] = useState(deps);
  if (sameDeps(prev, deps)) return false;
  setPrev(deps);
  return true;
}

/** Time captured once when the component mounts; render code must not call Date.now() (react-hooks/purity). */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

/** Small async loader: returns [data, error, loading, reload]. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): [T | null, unknown, boolean, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  // Reset for a new request while rendering, not synchronously in the effect (react-hooks/set-state-in-effect).
  if (useDepsChanged(deps)) {
    setLoading(true);
    setError(null);
  }
  useEffect(() => {
    let live = true;
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setTick((t) => t + 1);
  }, []);
  return [data, error, loading, reload];
}

export function RequireAuth({ staff, children }: { staff?: boolean; children: ReactNode }) {
  const { me, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (staff && !me.roles.includes('staff'))
    return (
      <Empty>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">沒有權限</h1>
        <p>此頁面只開放給店務人員。</p>
      </Empty>
    );
  return <>{children}</>;
}
