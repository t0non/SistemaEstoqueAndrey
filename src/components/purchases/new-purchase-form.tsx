'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError,
  collection,
  query,
  where,
  doc,
  writeBatch,
  increment,
  Timestamp,
} from '@/firebase';
import type { Product, Supplier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  CalendarIcon,
  PlusCircle,
  MinusCircle,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductDialog } from '@/components/dashboard/product-dialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Schemas
const itemSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto.'),
  quantity: z.coerce.number().gt(0, 'A quantidade deve ser maior que 0.'),
  price: z.coerce.number().min(0, 'O custo não pode ser negativo.'),
});

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Selecione um fornecedor.'),
  date: z.date({ required_error: 'A data da compra é obrigatória.' }),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  discountValue: z.coerce.number().min(0).default(0),
  items: z.array(itemSchema).min(1, 'Adicione pelo menos um item à compra.'),
});

export function NewPurchaseForm() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // Data fetching
  const suppliersQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'suppliers'),
            where('ownerId', '==', user.uid)
          )
        : null,
    [firestore, user]
  );
  const { data: suppliers, isLoading: suppliersLoading } =
    useCollection<Supplier>(suppliersQuery);

  const productsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'products'),
            where('ownerId', '==', user.uid)
          )
        : null,
    [firestore, user]
  );
  const { data: products, isLoading: productsLoading } =
    useCollection<Product>(productsQuery);

  // Form setup
  const form = useForm<z.infer<typeof purchaseSchema>>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      date: new Date(),
      invoiceNumber: '',
      notes: '',
      discountValue: 0,
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');

  // Derived state and memos
  const supplierOptions: ComboboxOption[] = useMemo(
    () =>
      suppliers?.map((s) => ({ value: s.id, label: s.name })) || [],
    [suppliers]
  );

  const subtotal = useMemo(
    () =>
      watchedItems.reduce(
        (acc, item) => acc + (item.quantity || 0) * (item.price || 0),
        0
      ),
    [watchedItems]
  );

  const discount = form.watch('discountValue');
  const netTotal = useMemo(
    () => subtotal - (discount || 0),
    [subtotal, discount]
  );

  const onFinalizePurchase = async (values: z.infer<typeof purchaseSchema>) => {
    if (!firestore || !user) return;

    try {
      const batch = writeBatch(firestore);

      // 1. Create transaction doc
      const transactionRef = doc(collection(firestore, 'transactions'));
      batch.set(transactionRef, {
        id: transactionRef.id,
        ownerId: user.uid,
        type: 'OUT',
        status: 'COMPLETED',
        supplierId: values.supplierId,
        date: Timestamp.fromDate(values.date),
        invoiceNumber: values.invoiceNumber || '',
        notes: values.notes || '',
        totalValue: subtotal,
        discountValue: values.discountValue,
        netTotal,
      });

      // 2. Create item docs and update products
      values.items.forEach((item) => {
        const product = products?.find((p) => p.id === item.productId);
        if (!product) return;

        // 2a. Create transaction_item doc
        const itemRef = doc(collection(firestore, 'transaction_items'));
        batch.set(itemRef, {
          id: itemRef.id,
          transactionId: transactionRef.id,
          ownerId: user.uid,
          productId: item.productId,
          productName: product.name,
          sku: product.sku || '',
          quantity: item.quantity,
          price: item.price,
        });

        // 2b. Update product doc
        const productRef = doc(firestore, 'products', item.productId);
        batch.update(productRef, {
          currentStock: increment(item.quantity),
          costPrice: item.price,
          supplierId: values.supplierId,
        });
      });

      // 3. Commit batch
      await batch.commit();

      toast({
        title: 'Compra finalizada com sucesso!',
        description: 'O estoque dos produtos foi atualizado.',
      });
      router.push('/');
    } catch (e) {
      console.error('Falha ao finalizar compra:', e);
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: 'transactions_batch_write',
          operation: 'write',
        })
      );
      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar compra',
        description: 'Não foi possível salvar os dados. Tente novamente.',
      });
    }
  };

  const addItem = (data: z.infer<typeof itemSchema>) => {
    const existingItemIndex = fields.findIndex(
      (field) => field.productId === data.productId
    );
    if (existingItemIndex !== -1) {
      const existingItem = fields[existingItemIndex];
      update(existingItemIndex, {
        ...existingItem,
        quantity: existingItem.quantity + data.quantity,
        price: data.price, // Update with the latest cost
      });
    } else {
      append(data);
    }
  };
  
  if (suppliersLoading || productsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onFinalizePurchase)}
        className="space-y-8"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Master Section */}
          <div className="lg:col-span-1">
            <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Dados da Compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fornecedor</FormLabel>
                      <Combobox
                        options={supplierOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Selecione um fornecedor"
                        emptyMessage="Nenhum fornecedor encontrado."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data da Compra</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          className="bg-slate-50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Nota Fiscal / Pedido</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 12345" {...field} className="bg-slate-50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detalhes da negociação..." {...field} className="bg-slate-50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Detail Section */}
          <div className="lg:col-span-2">
            <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Itens da Compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Item Input Form */}
                <ItemEntryForm products={products || []} onAddItem={addItem} supplierId={form.watch('supplierId')} />

                {/* Items Table */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Itens na Nota</h3>
                  <div className="rounded-md border">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-[100px] text-center">Qtd.</TableHead>
                          <TableHead className="w-[120px] text-right">Custo Unit.</TableHead>
                          <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.length > 0 ? (
                          fields.map((field, index) => {
                            const product = products?.find(
                              (p) => p.id === field.productId
                            );
                            const itemSubtotal = (field.quantity || 0) * (field.price || 0);
                            return (
                              <TableRow key={field.id}>
                                <TableCell className="flex items-center gap-3">
                                  {product?.photoUrl ? (
                                    <img src={product.photoUrl} alt={product.name} className="h-8 w-8 rounded object-cover border" />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-slate-200 border" />
                                  )}
                                  <span>{product?.name}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {field.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(field.price || 0)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(itemSubtotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                              Nenhum item adicionado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="discountValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Desconto</FormLabel>
                          <div className="flex items-center justify-between">
                             <span className="text-muted-foreground">Desconto (R$)</span>
                            <FormControl>
                        <Input
                          type="number"
                          className="h-8 w-24 text-right"
                          value={field.value === 0 ? '' : field.value}
                          placeholder="0"
                          onChange={(e) => field.onChange(Number(e.target.value || 0))}
                        />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between border-t pt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                      <span className="text-lg font-bold">Total Final</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(netTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-center">
          <Button type="submit" size="lg" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? 'Finalizando...'
              : 'Finalizar Compra'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Sub-component for item entry
function ItemEntryForm({
  products,
  onAddItem,
  supplierId
}: {
  products: Product[];
  onAddItem: (data: z.infer<typeof itemSchema>) => void;
  supplierId: string | undefined;
}) {
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const itemEntryForm = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { productId: '', quantity: 1, price: 0 },
  });

  const handleProductCreated = (newProduct: Product) => {
    itemEntryForm.setValue('productId', newProduct.id);
    setIsProductDialogOpen(false);
  };

  const productOptions: ComboboxOption[] = useMemo(() => {
    const sortedProducts = [...products]
      .filter(p => p.type === 'INSUMO')
      .sort((a,b) => {
      const aIsFromSupplier = a.supplierId === supplierId;
      const bIsFromSupplier = b.supplierId === supplierId;
      if (aIsFromSupplier && !bIsFromSupplier) return -1;
      if (!aIsFromSupplier && bIsFromSupplier) return 1;
      return a.name.localeCompare(b.name);
    });
    return sortedProducts.map((p) => ({
      value: p.id,
      label: `${p.name} ${p.sku ? `(${p.sku})` : ''}`,
    }));
  }, [products, supplierId]);
  
  const selectedProductId = itemEntryForm.watch('productId');
  const watchedQty = itemEntryForm.watch('quantity');
  const watchedPrice = itemEntryForm.watch('price');
  const canAdd = !!selectedProductId && (watchedQty || 0) > 0 && (watchedPrice || 0) >= 0;

  useEffect(() => {
    const product = products.find(p => p.id === selectedProductId);
    if(product && product.costPrice) {
      itemEntryForm.setValue('price', product.costPrice);
    }
  }, [selectedProductId, products, itemEntryForm])


  const onSubmit = (data: z.infer<typeof itemSchema>) => {
    onAddItem(data);
    itemEntryForm.reset({ productId: '', quantity: 1, price: 0 });
  };

  const adjustQuantity = (amount: number) => {
    const currentQty = itemEntryForm.getValues('quantity');
    itemEntryForm.setValue('quantity', Math.max(1, currentQty + amount));
  };

  return (
    <>
      <Form {...itemEntryForm}>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <FormField
                control={itemEntryForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-slate-600">Produto</FormLabel>
                    <div className="flex items-center gap-2">
                      <Combobox
                        options={productOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Buscar insumo..."
                        emptyMessage="Nenhum produto encontrado."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsProductDialogOpen(true)}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-3">
              <FormField
                control={itemEntryForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-slate-600">Quantidade</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        className="text-center bg-slate-50 focus:ring-2 focus:ring-neutral-300 focus:border-transparent"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-3">
              <FormField
                control={itemEntryForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-slate-600">Custo Unit. (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        className="bg-slate-50 focus:ring-2 focus:ring-neutral-300 focus:border-transparent w-full"
                        value={field.value === 0 ? '' : field.value}
                        placeholder="0"
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-2 flex items-end justify-end">
              <Button
                type="button"
                onClick={itemEntryForm.handleSubmit(onSubmit)}
                className="min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!canAdd}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </Form>
      <ProductDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        onProductCreated={handleProductCreated}
      />
    </>
  );
}
