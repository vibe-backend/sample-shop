// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, api, tokenStore, type Me } from './api';
import { AuthProvider, useAuth } from './auth';

const meOk: Me = {
  id: 'u1',
  email: 'demo@example.com',
  display_name: 'Demo',
  roles: [],
};

const emptyCart = { items: [] as never[], currency: 'HKD', total_cents: 0 };

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function strictWrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <AuthProvider>{children}</AuthProvider>
    </StrictMode>
  );
}

afterEach(() => {
  cleanup();
  tokenStore.clear();
  vi.restoreAllMocks();
});

describe('AuthProvider session restore (#108)', () => {
  it('with a token, calls refreshCart only after me() resolves', async () => {
    tokenStore.set({ access_token: 'tok', expires_at: '2999-01-01T00:00:00Z' });

    let resolveMe!: (m: Me) => void;
    const mePromise = new Promise<Me>((resolve) => {
      resolveMe = resolve;
    });
    vi.spyOn(api, 'me').mockReturnValue(mePromise);
    const getCart = vi.spyOn(api, 'getCart').mockResolvedValue(emptyCart);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(api.me).toHaveBeenCalledTimes(1);
    expect(getCart).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);

    await act(async () => {
      resolveMe(meOk);
      await mePromise;
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.me).toEqual(meOk);
      expect(getCart).toHaveBeenCalledTimes(1);
    });
  });

  it('on me() 401: clears token, sets me null and ready true, does not refreshCart', async () => {
    tokenStore.set({ access_token: 'bad', expires_at: '2999-01-01T00:00:00Z' });

    vi.spyOn(api, 'me').mockRejectedValue(new ApiRequestError(401, 'UNAUTHORIZED', 'not signed in'));
    const getCart = vi.spyOn(api, 'getCart').mockResolvedValue(emptyCart);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.me).toBeNull();
    expect(tokenStore.get()).toBeNull();
    expect(getCart).not.toHaveBeenCalled();
    expect(result.current.cartCount).toBe(0);
  });

  it('live guard: unmount before me() resolves does not refreshCart', async () => {
    tokenStore.set({ access_token: 'tok', expires_at: '2999-01-01T00:00:00Z' });

    let resolveMe!: (m: Me) => void;
    const mePromise = new Promise<Me>((resolve) => {
      resolveMe = resolve;
    });
    vi.spyOn(api, 'me').mockReturnValue(mePromise);
    const getCart = vi.spyOn(api, 'getCart').mockResolvedValue(emptyCart);

    const { unmount } = renderHook(() => useAuth(), { wrapper });
    expect(api.me).toHaveBeenCalledTimes(1);
    unmount();

    await act(async () => {
      resolveMe(meOk);
      await mePromise;
    });

    // Cleanup set live=false; stale resolution must not touch cart.
    expect(getCart).not.toHaveBeenCalled();
  });

  it('live guard under StrictMode: refreshCart runs only once for the live mount', async () => {
    tokenStore.set({ access_token: 'tok', expires_at: '2999-01-01T00:00:00Z' });

    const resolvers: Array<(m: Me) => void> = [];
    vi.spyOn(api, 'me').mockImplementation(
      () =>
        new Promise<Me>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const getCart = vi.spyOn(api, 'getCart').mockResolvedValue(emptyCart);

    const { result } = renderHook(() => useAuth(), { wrapper: strictWrapper });

    await waitFor(() => expect(resolvers.length).toBeGreaterThanOrEqual(1));

    // Resolve every in-flight me() (StrictMode may have mounted twice in dev).
    // Only the live effect should call refreshCart — at most once.
    await act(async () => {
      for (const resolve of resolvers) resolve(meOk);
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.me).toEqual(meOk);
    });
    expect(getCart).toHaveBeenCalledTimes(1);
  });

  it('without a token, is ready immediately and loads the guest cart', async () => {
    const getCart = vi.spyOn(api, 'getCart').mockResolvedValue({
      ...emptyCart,
      items: [{ id: 'ci1', product: { id: 'p1' } as never, quantity: 2, unit_price_cents: 100 }],
    });
    const me = vi.spyOn(api, 'me');

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.ready).toBe(true);
    expect(result.current.me).toBeNull();
    expect(me).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.cartCount).toBe(2));
    expect(getCart).toHaveBeenCalled();
  });
});
