import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_MODE } from '../api';
import { useAuth } from '../auth';
import { ErrorNote } from '../components/ui';

function useNext() {
  const [p] = useSearchParams();
  const n = p.get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
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
    <section className="auth">
      <h1>登入</h1>
      <form onSubmit={submit} className="panel form">
        <label>
          電郵
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          密碼
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorNote error={error} />
        <button className="btn block" disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>
        <p className="muted small center">
          還沒有帳戶？<Link to={`/register?next=${encodeURIComponent(next)}`}>註冊</Link>
        </p>
      </form>
      {API_MODE === 'mock' && (
        <div className="panel demo">
          <h2>示範帳戶</h2>
          {[
            ['顧客', 'demo@example.com', 'demo1234'],
            ['店務人員', 'staff@example.com', 'staff1234'],
          ].map(([role, em, pw]) => (
            <button
              key={em}
              type="button"
              className="demo-acct"
              onClick={() => {
                setEmail(em);
                setPassword(pw);
              }}
            >
              <strong>{role}</strong>
              <span>
                {em} / {pw}
              </span>
            </button>
          ))}
        </div>
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
    <section className="auth">
      <h1>建立帳戶</h1>
      <form onSubmit={submit} className="panel form">
        <label>
          顯示名稱
          <input required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
        </label>
        <label>
          電郵
          <input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label>
          密碼（最少 8 個字元）
          <input type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </label>
        <ErrorNote error={error} />
        <button className="btn block" disabled={busy}>
          {busy ? '建立中…' : '註冊'}
        </button>
        <p className="muted small center">
          已有帳戶？<Link to={`/login?next=${encodeURIComponent(next)}`}>登入</Link>
        </p>
      </form>
    </section>
  );
}
