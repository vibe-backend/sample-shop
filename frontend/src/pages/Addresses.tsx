import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { api, ApiRequestError, type Address } from '../api';
import { useAuth } from '../auth';
import { AddAddressButton, AddressDialog, AddressLines } from '../components/address';
import { Empty, ErrorNote, PageTitle, Spinner, useAsync } from '../components/ui-helpers';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MAX_ADDRESSES } from '@/lib/address';
import { BackLink } from './Products';

/** 地址簿 (#44): add, edit, delete and set the default delivery address. */
export function AddressBookPage() {
  const { me } = useAuth();
  const [list, error, loading, reload] = useAsync(() => api.listAddresses(), []);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Address | null }>({ open: false, editing: null });
  const [removing, setRemoving] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState('');

  if (loading && !list) return <Spinner />;
  if (!list) return <ErrorNote error={error} />;
  const full = list.length >= MAX_ADDRESSES;

  async function run(a: Address, fn: () => Promise<unknown>, msg: string) {
    setBusy(a.id);
    setLive('處理中…');
    try {
      await fn();
      setLive(msg);
      toast.success(msg);
    } catch (e) {
      setLive('');
      toast.error(e instanceof ApiRequestError ? e.message : '操作失敗');
    } finally {
      setBusy(null);
      reload();
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <BackLink to="/account">我的帳戶</BackLink>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>收貨地址</PageTitle>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums" id="addr-count">
            {list.length} / {MAX_ADDRESSES}
          </span>
          {!full && <AddAddressButton onClick={() => setDialog({ open: true, editing: null })} />}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
      {full && (
        <p className="mb-3 rounded-lg bg-warning/10 p-3 text-sm text-warning" role="note">
          已達上限 {MAX_ADDRESSES} 個地址，請先刪除不需要的地址再新增。
        </p>
      )}
      {list.length === 0 ? (
        <Empty>
          <span>未有收貨地址</span>
        </Empty>
      ) : (
        <ul className="grid gap-3" aria-label="收貨地址">
          {list.map((a) => (
            <li key={a.id}>
              <Card className="py-4">
                <CardContent className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <AddressLines a={a} />
                  </div>
                  {a.is_default && <Badge variant="secondary">預設</Badge>}
                  <div className="flex w-full flex-wrap justify-end gap-2">
                    {!a.is_default && (
                      <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => run(a, () => api.setDefaultAddress(a.id), '已設為預設地址')} aria-label={`將 ${a.recipient} ${a.line1} 設為預設`}>
                        <Star aria-hidden="true" /> 設為預設
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => setDialog({ open: true, editing: a })} aria-label={`編輯 ${a.recipient} ${a.line1}`}>
                      <Pencil aria-hidden="true" /> 編輯
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={busy === a.id} onClick={() => setRemoving(a)} aria-label={`刪除 ${a.recipient} ${a.line1}`}>
                      <Trash2 aria-hidden="true" /> 刪除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <AddressDialog
        open={dialog.open}
        editing={dialog.editing}
        defaultName={me?.display_name ?? ''}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        onCreated={() => {
          const msg = dialog.editing ? '地址已更新' : '地址已新增';
          setLive(msg);
          toast.success(msg);
          reload();
        }}
      />
      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除此地址？</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && `${removing.recipient}，${removing.region} ${removing.line1}。`}
              {removing?.is_default ? '這是預設地址，刪除後最新的地址會成為預設。' : ''}已下單的訂單不受影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const a = removing!;
                setRemoving(null);
                void run(a, () => api.deleteAddress(a.id), '地址已刪除');
              }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
