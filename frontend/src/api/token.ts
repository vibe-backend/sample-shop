/**
 * Access-token holder. The token lives only in this module's memory:
 * it is never written to localStorage/sessionStorage, so injected script
 * cannot lift it from storage, and it is gone after a reload (the user signs in again).
 *
 * A production backend should pair this with a refresh token in an httpOnly,
 * Secure, SameSite cookie so a reload can silently mint a new access token.
 * The current contract has no refresh endpoint, so that step is not implemented.
 */

/** Key used by earlier builds that persisted the token; removed on startup. */
export const LEGACY_TOKEN_KEY = 'shop.token';

export interface StoredToken {
  access_token: string;
  expires_at: string;
}

let current: StoredToken | null = null;

export const tokenStore = {
  get(now = Date.now()): string | null {
    if (!current) return null;
    if (Date.parse(current.expires_at) <= now) {
      current = null;
      return null;
    }
    return current.access_token;
  },
  set(t: StoredToken) {
    current = { access_token: t.access_token, expires_at: t.expires_at };
  },
  clear() {
    current = null;
  },
};

/** Remove any token a previous build left in web storage. */
export function purgeLegacyToken(storage: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage) {
  try {
    storage?.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* storage unavailable (privacy mode); nothing to purge */
  }
}

purgeLegacyToken();
