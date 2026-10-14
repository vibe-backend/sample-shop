import type { KeyboardEvent } from 'react';

/**
 * WAI-ARIA radio group keyboard support: only the checked (or first) radio is tabbable;
 * Arrow keys / Home / End move focus *and* selection.
 */
export function rovingRadio<T>(items: readonly T[], value: T | null, onChange: (v: T) => void) {
  const active = Math.max(0, value === null ? 0 : items.indexOf(value));
  return {
    tabIndex: (i: number) => (i === active ? 0 : -1),
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const i = active;
      const n = items.length;
      let next: number | null = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + n) % n;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      onChange(items[next]);
      const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
      radios[next]?.focus();
    },
  };
}
