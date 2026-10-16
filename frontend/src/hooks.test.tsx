// @vitest-environment jsdom
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDepsChanged, useNow } from './components/ui-helpers';

afterEach(() => vi.useRealTimers());

describe('useDepsChanged', () => {
  it('is false on mount and for equal deps, true once when a dep changes', () => {
    const seen: boolean[] = [];
    const { rerender } = renderHook(({ a, b }) => seen.push(useDepsChanged([a, b])), { initialProps: { a: 1, b: 'x' } });
    rerender({ a: 1, b: 'x' });
    rerender({ a: 2, b: 'x' });
    const afterChange = seen.length;
    rerender({ a: 2, b: 'x' });
    expect(seen[0]).toBe(false);
    expect(seen[1]).toBe(false);
    expect(seen.slice(2, afterChange)).toContain(true);
    expect(seen[afterChange]).toBe(false);
  });

  it('lets a component reset state while rendering when its key changes', () => {
    const { result, rerender } = renderHook(
      ({ id }) => {
        const [n, setN] = useStateCounter();
        if (useDepsChanged([id])) setN(0);
        return { n, setN };
      },
      { initialProps: { id: 'a' } },
    );
    act(() => result.current.setN(5));
    expect(result.current.n).toBe(5);
    rerender({ id: 'a' });
    expect(result.current.n).toBe(5);
    rerender({ id: 'b' });
    expect(result.current.n).toBe(0);
  });
});

describe('useNow', () => {
  it('ticks every interval and stops after unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
    const { result, unmount } = renderHook(() => useNow(60_000));
    const t0 = result.current;
    act(() => vi.advanceTimersByTime(59_999));
    expect(result.current).toBe(t0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(t0 + 60_000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('defaults to a 30 s tick', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useNow());
    const t0 = result.current;
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current).toBe(t0 + 30_000);
  });
});

function useStateCounter() {
  return useState(0);
}
