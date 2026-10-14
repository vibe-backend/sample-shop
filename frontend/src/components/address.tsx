import { useState, type FormEvent } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { api, type Address, type AddressInput, type AddressSnapshot } from '../api';
import { ErrorNote } from './ui-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HK_REGIONS, formatAddress, validateAddress, type AddressErrors } from '@/lib/address';
import { rovingRadio } from '@/lib/roving';
import { cn } from '@/lib/utils';

/** Read-only address block (checkout choice, order snapshot). */
export function AddressLines({ a }: { a: AddressSnapshot }) {
  return (
    <div className="grid gap-0.5 text-sm">
      <span className="font-medium text-foreground">
        {a.recipient} <span className="ml-1.5 tabular-nums">{a.phone}</span>
      </span>
      <span className="text-muted-foreground">{formatAddress(a)}</span>
    </div>
  );
}

/** Selectable list of saved addresses (role=radiogroup). */
export function AddressPicker({ addresses, value, onChange }: { addresses: Address[]; value: string | null; onChange: (id: string) => void }) {
  const roving = rovingRadio(addresses.map((a) => a.id), value, onChange);
  return (
    <div role="radiogroup" aria-label="收貨地址" className="grid gap-2" onKeyDown={roving.onKeyDown}>
      {addresses.map((a, i) => {
        const on = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={roving.tabIndex(i)}
            onClick={() => onChange(a.id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              on ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
            )}
          >
            <MapPin className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
            <div className="flex-1">
              <AddressLines a={a} />
            </div>
            {a.is_default && <Badge variant="secondary">預設</Badge>}
          </button>
        );
      })}
    </div>
  );
}

const BLANK: AddressInput = { recipient: '', phone: '', region: '', line1: '', is_default: false };

/** Add-address dialog; validates client-side with the same rules as the mock server. */
export function AddressDialog({ open, onOpenChange, onCreated, defaultName = '', forceDefault = false }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (a: Address) => void; defaultName?: string; forceDefault?: boolean }) {
  const [f, setF] = useState<AddressInput>({ ...BLANK, recipient: defaultName });
  const [errors, setErrors] = useState<AddressErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = validateAddress(f);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setError(null);
    try {
      const a = await api.createAddress({ ...f, is_default: forceDefault || f.is_default });
      onCreated(a);
      setF({ ...BLANK, recipient: defaultName });
      onOpenChange(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof AddressErrors) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `addr-${k}-err` : undefined });
  const Err = ({ k }: { k: keyof AddressErrors }) =>
    errors[k] ? (
      <p id={`addr-${k}-err`} className="text-xs text-destructive">
        {errors[k]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增收貨地址</DialogTitle>
          <DialogDescription>收件人、電話及地址均為必填。</DialogDescription>
        </DialogHeader>
        <form id="address-form" className="grid gap-3" onSubmit={submit} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="addr-recipient">收件人</Label>
              <Input id="addr-recipient" className="h-10" autoComplete="name" value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} {...field('recipient')} />
              <Err k="recipient" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="addr-phone">電話</Label>
              <Input id="addr-phone" className="h-10" type="tel" inputMode="tel" autoComplete="tel" placeholder="例如 9123 4567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} {...field('phone')} />
              <Err k="phone" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="addr-region">地區</Label>
            <Select value={f.region} onValueChange={(v) => setF({ ...f, region: v })}>
              <SelectTrigger id="addr-region" className="h-10! w-full" {...field('region')}>
                <SelectValue placeholder="請選擇地區" />
              </SelectTrigger>
              <SelectContent>
                {HK_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Err k="region" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="addr-line1">詳細地址</Label>
            <Input id="addr-line1" className="h-10" autoComplete="street-address" placeholder="街道、大廈、樓層及單位" value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} {...field('line1')} />
            <Err k="line1" />
          </div>
          {!forceDefault && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!f.is_default} onCheckedChange={(c) => setF({ ...f, is_default: c === true })} />
              設為預設地址
            </label>
          )}
          <ErrorNote error={error} />
        </form>
        <DialogFooter>
          <Button type="submit" form="address-form" className="h-10" disabled={busy}>
            {busy ? '儲存中…' : '儲存地址'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddAddressButton(props: { onClick: () => void; label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={props.onClick}>
      <Plus /> {props.label ?? '新增地址'}
    </Button>
  );
}
