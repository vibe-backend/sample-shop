import { CreditCard, Wallet } from 'lucide-react';
import type { PaymentMethod } from '../api';
import { rovingRadio } from '@/lib/roving';
import { cn } from '@/lib/utils';

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  mock_card: '模擬信用卡',
  mock_alipay: '模擬支付寶',
};

const ICON = { mock_card: CreditCard, mock_alipay: Wallet } as const;

/** Payment method chooser (role=radiogroup); demo methods only. */
export function PaymentPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const methods = Object.keys(PAYMENT_LABEL) as PaymentMethod[];
  const roving = rovingRadio(methods, value, onChange);
  return (
    <div role="radiogroup" aria-label="付款方式" className="grid gap-2 sm:grid-cols-2" onKeyDown={roving.onKeyDown}>
      {methods.map((m, i) => {
        const on = m === value;
        const Icon = ICON[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={roving.tabIndex(i)}
            onClick={() => onChange(m)}
            className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', on ? 'border-primary bg-primary/5' : 'hover:bg-muted/60')}
          >
            <Icon className={cn('size-5', on ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
            <span className="font-medium">{PAYMENT_LABEL[m]}</span>
          </button>
        );
      })}
    </div>
  );
}
