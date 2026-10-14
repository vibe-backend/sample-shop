export function formatPrice(cents: number, currency = 'HKD'): string {
  return new Intl.NumberFormat('zh-Hant', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function lineTotal(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}

export function subtotal(lines: { line_total_cents: number }[]): number {
  return lines.reduce((s, l) => s + l.line_total_cents, 0);
}
