import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_MODE } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageTitle } from '../components/ui-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function useNext() {
  const [p] = useSearchParams();
  const n = p.get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const next = useNext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
      nav(next, { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <PageTitle>登入</PageTitle>
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <Field id="email" label="電郵">
              <Input id="email" type="email" autoComplete="email" required className="h-10" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field id="password" label="密碼">
              <Input id="password" type="password" autoComplete="current-password" required className="h-10" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" size="lg" className="h-10" disabled={busy}>
              {busy ? '登入中…' : '登入'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              還沒有帳戶？
              <Link to={`/register?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
                註冊
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      {API_MODE === 'mock' && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>示範帳戶</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              ['顧客', 'demo@example.com', 'demo1234'],
              ['店務人員', 'staff@example.com', 'staff1234'],
            ].map(([role, em, pw]) => (
              <Button
                key={em}
                type="button"
                variant="outline"
                className="h-auto flex-wrap justify-between gap-2 py-2.5 text-left"
                onClick={() => {
                  setEmail(em);
                  setPassword(pw);
                }}
              >
                <strong>{role}</strong>
                <span className="font-normal text-muted-foreground">
                  {em} / {pw}
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const next = useNext();
  const [f, setF] = useState({ display_name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(f);
      nav(next, { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <PageTitle>建立帳戶</PageTitle>
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <Field id="display_name" label="顯示名稱">
              <Input id="display_name" required className="h-10" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
            </Field>
            <Field id="email" label="電郵">
              <Input id="email" type="email" autoComplete="email" required className="h-10" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field id="password" label="密碼（最少 8 個字元）">
              <Input id="password" type="password" autoComplete="new-password" required minLength={8} className="h-10" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" size="lg" className="h-10" disabled={busy}>
              {busy ? '建立中…' : '註冊'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              已有帳戶？
              <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
                登入
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
