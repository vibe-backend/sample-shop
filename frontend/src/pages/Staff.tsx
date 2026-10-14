import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatPrice, type Product, type ProductInput } from '../api';
import { ErrorNote, PageTitle, Spinner } from '../components/ui-helpers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './Auth';
import { BackLink, CATEGORIES, StockTag } from './Products';

export function StaffProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        // Staff see inactive products too; walk every page.
        const all: Product[] = [];
        let cursor: string | undefined;
        do {
          const p = await api.listStaffProducts({ cursor, limit: 50, sort: 'created_at_desc' });
          all.push(...p.items);
          cursor = p.next_cursor ?? undefined;
        } while (cursor);
        if (live) setItems(all);
      } catch (e) {
        if (live) setError(e);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [tick]);

  async function remove(p: Product) {
    setDeleting(p.id);
    try {
      await api.deleteProduct(p.id);
      toast.success(`已刪除「${p.name}」`);
      setTick((t) => t + 1);
    } catch (e) {
      toast.error(`刪除「${p.name}」失敗：${e instanceof Error ? e.message : '未知錯誤'}`);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <PageTitle>商品管理</PageTitle>
        <Button asChild size="lg" className="h-10">
          <Link to="/staff/products/new">
            <Plus /> 新增商品
          </Link>
        </Button>
      </div>
      <ErrorNote error={error} />
      {loading ? (
        <Spinner />
      ) : (
        <Card className="py-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">商品</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>價格</TableHead>
                <TableHead>庫存</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">操作</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} className={p.active ? '' : 'text-muted-foreground'}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <img src={p.image_urls[0]} alt="" className="size-10 rounded-md" />
                      <div>
                        {p.name}
                        <div className="text-xs text-muted-foreground">{p.slug}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell>{formatPrice(p.price_cents, p.currency)}</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell>
                    {p.active ? <Badge className="bg-success/15 text-success">上架中</Badge> : <StockTag p={p} />}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="link" size="sm" asChild>
                      <Link to={`/staff/products/${p.id}`}>編輯</Link>
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-destructive"
                      disabled={deleting === p.id}
                      onClick={() => setPending(p)}
                    >
                      {deleting === p.id ? '刪除中…' : '刪除'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除商品？</AlertDialogTitle>
            <AlertDialogDescription>確定刪除「{pending?.name}」？此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) remove(pending);
                setPending(null);
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

const EMPTY: ProductInput = {
  slug: '',
  name: '',
  description: '',
  price_cents: 0,
  currency: 'HKD',
  image_urls: [],
  category: CATEGORIES[0],
  stock: 0,
  active: true,
};

export function StaffEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState<ProductInput>(EMPTY);
  const [price, setPrice] = useState('0');
  const [optionsText, setOptionsText] = useState('');
  const [imageText, setImageText] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [skuCount, setSkuCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    api
      .getProduct(id)
      .then((p) => {
        setF({
          slug: p.slug,
          name: p.name,
          description: p.description,
          price_cents: p.price_cents,
          currency: p.currency,
          image_urls: p.image_urls,
          category: p.category,
          stock: p.stock,
          active: p.active,
        });
        setOptionsText(p.options?.map((o) => `${o.name}:${o.values.join(',')}`).join('\n') ?? '');
        setPrice((p.price_cents / 100).toString());
        setSkuCount(p.variants?.length ?? 0);
        setImageText(p.image_urls.filter((u) => !u.startsWith('data:')).join('\n'));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const typed = imageText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    const image_urls = typed.length ? typed : f.image_urls.filter((u) => u.startsWith('data:'));
    const options = optionsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [name, ...parts] = line.split(':');
        return {
          name: name.trim(),
          values: parts
            .join(':')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        };
      });
    const full = { ...f, image_urls, options, price_cents: Math.round(Number(price) * 100) };
    // SKU products: price/stock come from the variants, so never send them.
    const { price_cents: _p, stock: _s, ...rest } = full;
    void _p;
    void _s;
    const body = skuCount ? rest : full;
    try {
      if (id) await api.updateProduct(id, body);
      else await api.createProduct(full);
      nav('/staff/products');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <section className="mx-auto max-w-3xl">
      <BackLink to="/staff/products">商品管理</BackLink>
      <PageTitle>{id ? '編輯商品' : '新增商品'}</PageTitle>
      <Card>
        <CardContent>
          {id && (
            <Button className="mb-4" variant="outline" asChild>
              <Link to={`/staff/products/${id}/variants`}>管理商品規格</Link>
            </Button>
          )}
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <Field id="name" label="名稱">
              <Input
                id="name"
                required
                className="h-10"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field id="slug" label="Slug">
              <Input
                id="slug"
                required
                pattern="[a-z0-9-]+"
                title="小寫英文、數字及連字號"
                className="h-10"
                value={f.slug}
                onChange={(e) => setF({ ...f, slug: e.target.value })}
              />
            </Field>
            {skuCount > 0 && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                此商品設有 {skuCount} 個規格，價格及庫存由規格計算（最低規格價、規格庫存總和），不可在此修改。
              </p>
            )}
            <Field id="price" label={skuCount > 0 ? '價格（HK$，由規格計算）' : '價格（HK$）'}>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                required
                readOnly={skuCount > 0}
                aria-readonly={skuCount > 0}
                className="h-10 read-only:bg-muted"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field id="stock" label={skuCount > 0 ? '庫存（由規格計算）' : '庫存'}>
              <Input
                id="stock"
                type="number"
                min="0"
                step="1"
                required
                readOnly={skuCount > 0}
                aria-readonly={skuCount > 0}
                className="h-10 read-only:bg-muted"
                value={f.stock}
                onChange={(e) => setF({ ...f, stock: Number(e.target.value) })}
              />
            </Field>
            <Field id="category" label="分類">
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger id="category" className="h-10! w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2 self-end pb-2.5">
              <Checkbox id="active" checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v === true })} />
              <Label htmlFor="active">上架（顧客可見）</Label>
            </div>
            <div className="sm:col-span-2">
              <Field id="description" label="描述">
                <Textarea
                  id="description"
                  rows={4}
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="images" label="圖片網址（每行一個；示範圖片不會顯示在此）">
                <Textarea id="images" rows={2} value={imageText} onChange={(e) => setImageText(e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="options" label="商品選項（每行 名稱:值1,值2，例如 顏色:霧白,墨黑）">
                <Textarea id="options" rows={3} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:col-span-2">
              <ErrorNote error={error} />
              <Button type="submit" size="lg" className="h-10 justify-self-start px-6" disabled={busy}>
                {busy ? '儲存中…' : '儲存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
