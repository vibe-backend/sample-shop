const KEY = 'shop.token';

export interface StoredToken {
  access_token: string;
  expires_at: string;
}

export const tokenStore = {
  get(): string | null {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    try {
      const t = JSON.parse(raw) as StoredToken;
      if (Date.parse(t.expires_at) <= Date.now()) {
        globalThis.localStorage?.removeItem(KEY);
        return null;
      }
      return t.access_token;
    } catch {
      return null;
    }
  },
  set(t: StoredToken) {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(t));
  },
  clear() {
    globalThis.localStorage?.removeItem(KEY);
  },
};
