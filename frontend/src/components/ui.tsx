import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiRequestError } from '../api';
import { useAuth } from '../auth';

export function errorText(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  return '發生未預期的錯誤，請稍後再試';
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {errorText(error)}
    </p>
  );
}

export function Spinner({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="dot" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Small async loader: returns [data, error, loading, reload]. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): [T | null, unknown, boolean, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return [data, error, loading, () => setTick((t) => t + 1)];
}

export function RequireAuth({ staff, children }: { staff?: boolean; children: ReactNode }) {
  const { me, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (staff && !me.roles.includes('staff'))
    return (
      <section className="empty">
        <h1>沒有權限</h1>
        <p>此頁面只開放給店務人員。</p>
      </section>
    );
  return <>{children}</>;
}
