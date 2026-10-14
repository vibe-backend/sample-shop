import { afterEach, describe, expect, it, vi } from 'vitest';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('tokenStore (memory only)', () => {
  it('purges a legacy localStorage token on startup', async () => {
    const ls = new MemStorage();
    ls.setItem('shop.token', JSON.stringify({ access_token: 'old', expires_at: '2999-01-01T00:00:00Z' }));
    vi.stubGlobal('localStorage', ls);
    const { tokenStore } = await import('./token');
    expect(ls.getItem('shop.token')).toBeNull();
    expect(tokenStore.get()).toBeNull();
  });

  it('never writes the token to localStorage or sessionStorage', async () => {
    const ls = new MemStorage();
    const ss = new MemStorage();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('sessionStorage', ss);
    const { tokenStore } = await import('./token');
    tokenStore.set({ access_token: 'secret-token', expires_at: '2999-01-01T00:00:00Z' });
    expect(tokenStore.get()).toBe('secret-token');
    const all = [...ls.data.values(), ...ss.data.values()].join('');
    expect(all).not.toContain('secret-token');
  });

  it('is lost on reload (fresh module instance)', async () => {
    const a = await import('./token');
    a.tokenStore.set({ access_token: 't', expires_at: '2999-01-01T00:00:00Z' });
    vi.resetModules();
    const b = await import('./token');
    expect(b.tokenStore.get()).toBeNull();
  });

  it('drops an expired token and supports clear()', async () => {
    const { tokenStore } = await import('./token');
    tokenStore.set({ access_token: 't', expires_at: '2026-01-01T00:00:00Z' });
    expect(tokenStore.get(Date.parse('2026-01-01T00:00:01Z'))).toBeNull();
    tokenStore.set({ access_token: 't', expires_at: '2999-01-01T00:00:00Z' });
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});

describe('real adapter', () => {
  it('sends the in-memory token as a Bearer header', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'u1', email: 'a@b.c', display_name: 'A', roles: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { tokenStore } = await import('./token');
    const { createRealApi } = await import('./real');
    tokenStore.set({ access_token: 'abc', expires_at: '2999-01-01T00:00:00Z' });
    await createRealApi('https://api.example', 'main').me();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example/users/v1/me');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });
});

describe('mock adapter persistence', () => {
  it('does not persist sessions/tokens', async () => {
    const ls = new MemStorage();
    vi.stubGlobal('localStorage', ls);
    const { createMockApi } = await import('./mock');
    const { tokenStore } = await import('./token');
    const api = createMockApi({ persist: true });
    const t = await api.login({ email: 'demo@example.com', password: 'demo1234' });
    tokenStore.set(t);
    await api.addCartItem('p_007', 1);
    const saved = ls.getItem('shop.mock.v2') ?? '';
    expect(saved).toContain('p_007');
    expect(saved).not.toContain(t.access_token);
    // A "reload": new adapter from the same storage has the cart but no session.
    const reloaded = createMockApi({ persist: true, getToken: () => t.access_token });
    await expect(reloaded.getCart()).rejects.toMatchObject({ status: 401 });
  });
});
