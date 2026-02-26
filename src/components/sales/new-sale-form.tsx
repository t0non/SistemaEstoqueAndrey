'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useMemoFirebase,
  useUser,
  useFirestore,
  useCollection,
  collection,
  query,
  where,
  doc,
  runTransaction,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
} from '@/firebase';
import type { Product, Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

// Icons
import {
  CalendarIcon,
  PlusCircle,
  Trash2,
  User as UserIcon,
  ShoppingCart,
} from 'lucide-react';

// Date handling
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// UI Components
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClientDialog } from '@/components/clients/client-dialog';
import { cn } from '@/lib/utils';
import { computeVirtualStock } from '@/lib/products';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  availableStock: number;
  costPrice: number;
}

export function NewSaleForm() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const parseLocalDateFromInput = (value: string | null | undefined) => {
    if (!value) return new Date();
    const parts = value.split('-').map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date();
    const [y, m, d] = parts;
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };

  // State Management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

  // Master form state
  const [clientId, setClientId] = useState<string>('consumidor-final');
  const [clientName, setClientName] = useState<string>('Consumidor Final');
  const [saleDateStr, setSaleDateStr] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('COMPLETED');
  const [discount, setDiscount] = useState<number>(0);

  // Item entry state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Data fetching
  const clientsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'clients'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]
  );
  const { data: clients, isLoading: clientsLoading } =
    useCollection<Client>(clientsQuery);

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
  const { data: allProducts, isLoading: productsLoading } =
    useCollection<Product>(productsQuery);

  const products = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter((p: Product) => p.type === 'FINAL');
  }, [allProducts]);

  // Derived State & Memos
  const clientOptions: ComboboxOption[] = useMemo(() => {
    const baseOptions =
      clients?.map((c: Client) => ({ value: c.id, label: c.name })) || [];
    return [
      { value: 'consumidor-final', label: 'Consumidor Final' },
      ...baseOptions,
    ];
  }, [clients]);

  const productOptions: ComboboxOption[] = useMemo(
    () =>
      products?.map((p: Product) => ({
        value: p.id,
        label: `${p.name} ${p.sku ? `(${p.sku})` : ''}`,
      })) || [],
    [products]
  );

  // Financial Calculations
  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.price, 0),
    [cart]
  );
  const totalCost = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.costPrice, 0),
    [cart]
  );
  const netTotal = useMemo(() => subtotal - discount, [subtotal, discount]);
  const estimatedProfit = useMemo(
    () => netTotal - totalCost,
    [netTotal, totalCost]
  );

  // Handlers
  const handleProductSelect = (productId: string) => {
    const product = products?.find((p: Product) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setCurrentPrice(product.salePrice || 0);
      setQuantity(1);
    } else {
      setSelectedProduct(null);
        setCurrentPrice(Number.NaN);
    }
  };

  const virtualStock = useMemo(
    () => computeVirtualStock(selectedProduct, allProducts || []),
    [selectedProduct, allProducts]
  );

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione um produto e uma quantidade válida.',
      });
      return;
    }
    const isBom = selectedProduct.bom && selectedProduct.bom.length > 0;
    if (!isBom && quantity > selectedProduct.currentStock) {
      toast({
        variant: 'destructive',
        title: 'Estoque Insuficiente',
        description: `Apenas ${selectedProduct.currentStock} unidades disponíveis.`,
      });
      return;
    }
    // Para produtos com BOM: permitir vender até (estoque atual + capacidade de produção pelos insumos)
    if (isBom && quantity > (selectedProduct.currentStock + virtualStock)) {
      toast({
        variant: 'destructive',
        title: 'Insumos Insuficientes',
        description: `Máximo vendável: estoque (${selectedProduct.currentStock}) + insumos (${virtualStock}).`,
      });
      return;
    }

    if (selectedProduct.bom && selectedProduct.bom.length > 0) {
      const shortfall = Math.max(0, quantity - selectedProduct.currentStock);
      const insufficient: string[] = [];
      for (const comp of selectedProduct.bom) {
        const compProduct = allProducts?.find((p) => p.id === comp.productId);
        // Apenas verifica insumos para a parte que excede o estoque disponível
        const required = shortfall * comp.quantity;
        const available = compProduct?.currentStock || 0;
        if (required > available) {
          insufficient.push(
            `${compProduct?.name || comp.productId}: necessário ${required}, disponível ${available}`
          );
        }
      }
      if (insufficient.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Matéria-prima insuficiente',
          description: insufficient.join(' | '),
        });
        return;
      }
    }

    const costPerUnit =
      selectedProduct.bom && selectedProduct.bom.length > 0
        ? selectedProduct.bom.reduce((sum, comp) => {
            const compProduct = allProducts?.find((p) => p.id === comp.productId);
            const compCost = compProduct?.costPrice || 0;
            return sum + compCost * comp.quantity;
          }, 0)
        : selectedProduct.costPrice || 0;

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (item) => item.productId === selectedProduct.id
      );

      if (existingItemIndex > -1) {
        // Merge with existing item
        const updatedCart = [...prevCart];
        const existingItem = updatedCart[existingItemIndex];
        const newQuantity = existingItem.quantity + quantity;
        // Permite até o limite de (estoque + insumos)
        const maxSellable = selectedProduct.currentStock + virtualStock;
        if (newQuantity > maxSellable) {
          toast({
            variant: 'destructive',
            title: 'Quantidade excede o disponível',
            description: `Máximo vendável: ${maxSellable} (estoque + insumos).`,
          });
          return prevCart;
        }

        updatedCart[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          price: currentPrice, // Update price to the latest negotiated one
          costPrice: costPerUnit,
        };
        return updatedCart;
      } else {
        // Add new item
        const newItem: CartItem = {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: quantity,
          price: Number.isFinite(currentPrice) ? currentPrice : 0,
          availableStock: selectedProduct.currentStock,
          costPrice: costPerUnit,
        };
        return [...prevCart, newItem];
      }
    });

    // Reset fields
    setSelectedProduct(null);
    setCurrentPrice(Number.NaN);
    setQuantity(1);
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const handleClientCreated = (newClient: Client) => {
    setClientId(newClient.id);
    setClientName(newClient.name);
  };

  const onFinalizeSale = async () => {
    if (cart.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Carrinho Vazio',
        description: 'Adicione pelo menos um item para concluir a venda.',
      });
      return;
    }
    if (!firestore || !user) return;
    setIsSubmitting(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const transactionId = doc(collection(firestore, 'transactions')).id;
        const productDetails: {
          ref: DocumentReference;
          snap: DocumentSnapshot;
          item: CartItem;
        }[] = [];
        const consumptionOps: {
          ref: DocumentReference;
          snap: DocumentSnapshot;
          required: number;
          name: string;
        }[] = [];

        // 1. First, read all product documents and check stock within the transaction
        for (const item of cart) {
          const productRef = doc(firestore, 'products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            throw new Error(`Produto "${item.productName}" não encontrado.`);
          }
          const prodData: any = productSnap.data();
          const currentStock = (prodData.currentStock || 0) as number;
          const fromStock = Math.min(currentStock, item.quantity);
          const shortfall = Math.max(0, item.quantity - fromStock);

          if (Array.isArray(prodData.bom) && prodData.bom.length > 0) {
            for (const comp of prodData.bom) {
              const compRef = doc(firestore, 'products', comp.productId);
              const compSnap = await transaction.get(compRef);
              if (!compSnap.exists()) {
                throw new Error(`Insumo "${comp.productId}" não encontrado.`);
              }
              // Consome apenas o necessário para cobrir a parte sem estoque
              const required = shortfall * comp.quantity;
              const available = (compSnap.data() as any).currentStock || 0;
              if (required > available) {
                const name = (compSnap.data() as any).name || comp.productId;
                throw new Error(
                  `Matéria-prima insuficiente para "${name}". Necessário ${required}, disponível ${available}.`
                );
              }
              const name = (compSnap.data() as any).name || comp.productId;
              if (required > 0) {
                consumptionOps.push({ ref: compRef, snap: compSnap, required, name });
              }
            }
          }
          // Guarda também quanto será abatido do estoque pronto de cada produto
          productDetails.push({ ref: productRef, snap: productSnap, item: { ...item, availableStock: fromStock } as any });
        }

        // 2. If all checks pass, proceed with writes
        const transactionRef = doc(firestore, 'transactions', transactionId);
        transaction.set(transactionRef, {
          id: transactionId,
          ownerId: user.uid,
          type: 'IN',
          status: paymentStatus,
          clientId: clientId,
          clientName: clientName,
          date: Timestamp.fromDate(parseLocalDateFromInput(saleDateStr)),
          totalValue: subtotal,
          discountValue: discount,
          netTotal: netTotal,
        });

        for (const detail of productDetails) {
          const prodData: any = detail.snap.data();
          const fromStock = (detail.item as any).availableStock || 0;
          const shortfall = Math.max(0, detail.item.quantity - fromStock);
          let assembledCostPerUnit = 0;
          if (Array.isArray(prodData.bom) && prodData.bom.length > 0) {
            for (const comp of prodData.bom) {
              const compRef = doc(firestore, 'products', comp.productId);
              const compSnap = await transaction.get(compRef);
              const compCost = (compSnap.data() as any).costPrice || 0;
              assembledCostPerUnit += compCost * comp.quantity;
            }
          }
          // Custo médio ponderado: parte do estoque pronto + parte montada
          const readyCost = (prodData.costPrice || 0) as number;
          const totalQty = detail.item.quantity;
          const costPerUnit =
            totalQty > 0
              ? ((fromStock * readyCost) + (shortfall * assembledCostPerUnit)) / totalQty
              : readyCost;
          // 3a. Create transaction item
          const itemRef = doc(collection(firestore, 'transaction_items'));
          transaction.set(itemRef, {
            id: itemRef.id,
            transactionId: transactionId,
            ownerId: user.uid,
            productId: detail.item.productId,
            productName: detail.item.productName,
            quantity: detail.item.quantity,
            price: detail.item.price,
            costPrice: costPerUnit,
          });

          // 3b. Update product stock
          const newStock = prodData.currentStock - fromStock;
          transaction.update(detail.ref, { currentStock: newStock });
        }

        for (const cons of consumptionOps) {
          const newStock = (cons.snap.data() as any).currentStock - cons.required;
          transaction.update(cons.ref, { currentStock: newStock });
        }
      });

      toast({
        title: 'Venda finalizada com sucesso!',
        description: 'O estoque dos produtos foi atualizado.',
      });
      router.push('/');
    } catch (e: any) {
      console.error('Falha ao finalizar venda:', e);
      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar venda',
        description: e.message || 'Não foi possível salvar os dados.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (clientsLoading || productsLoading) {
    return (
      <div className="grid grid-cols-12 gap-6 p-4 md:p-8">
        <div className="col-span-12 md:col-span-7 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="col-span-12 md:col-span-5">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium">Cliente</label>
                <div className="flex gap-2">
                  <Combobox
                    options={clientOptions}
                    value={clientId}
                    onChange={(value) => {
                      const client = clients?.find((c: Client) => c.id === value);
                      setClientId(value);
                      setClientName(
                        client ? client.name : 'Consumidor Final'
                      );
                    }}
                    placeholder="Selecione um cliente"
                    emptyMessage="Nenhum cliente encontrado."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsClientDialogOpen(true)}
                  >
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium">Data da Venda</label>
                <Input
                  type="date"
                  value={saleDateStr}
                  onChange={(e) => setSaleDateStr(e.target.value)}
                  className="bg-slate-50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Buscar Produto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Combobox
                options={productOptions}
                value={selectedProduct?.id || ''}
                onChange={handleProductSelect}
                placeholder="Digite para buscar um produto..."
                emptyMessage="Nenhum produto encontrado ou estoque zerado."
              />

              {selectedProduct && (
                <Card className="bg-slate-50 border border-slate-200 rounded-xl">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {selectedProduct.photoUrl ? (
                          <img src={selectedProduct.photoUrl} alt={selectedProduct.name} className="h-10 w-10 rounded-lg object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-slate-300 border" />
                        )}
                        <h3 className="text-lg font-bold text-slate-800">
                          {selectedProduct.name}
                        </h3>
                      </div>
                      <Badge
                        variant={
                          selectedProduct.currentStock > selectedProduct.minStock
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-base px-3 py-1"
                      >
                        Estoque: {selectedProduct.currentStock}
                      </Badge>
                    </div>
                {selectedProduct.bom && selectedProduct.bom.length > 0 && (
                  <div className="text-sm text-slate-600">
                    Temos insumos para produzir {virtualStock} unidade(s).
                  </div>
                )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Quantidade</label>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                          className={cn(
                            'text-lg h-12 bg-[#E8E8ED]/50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all',
                        selectedProduct.bom && selectedProduct.bom.length > 0
                          ? quantity > virtualStock
                          : quantity > selectedProduct.currentStock &&
                              'border-red-500 focus-visible:ring-red-500'
                          )}
                          min={1}
                        />
                    {selectedProduct.bom && selectedProduct.bom.length > 0 ? (
                      quantity > ((selectedProduct.currentStock || 0) + virtualStock) && (
                        <p className="text-sm font-medium text-destructive mt-1">
                          Insumos insuficientes para a quantidade escolhida.
                        </p>
                      )
                    ) : (
                      quantity > selectedProduct.currentStock && (
                          <p className="text-sm font-medium text-destructive mt-1">
                            Estoque insuficiente.
                          </p>
                      )
                    )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Preço Unit. (R$)</label>
                        <Input
                          type="number"
                          value={Number.isFinite(currentPrice) ? currentPrice : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentPrice(val === '' ? Number.NaN : Number(val));
                          }}
                          className="text-lg h-12 bg-[#E8E8ED]/50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                          step="0.01"
                        />
                      </div>
                    </div>
                    {selectedProduct.bom && selectedProduct.bom.length > 0 && (
                      <div className="mt-4 rounded-lg border bg-white p-3">
                        <div className="text-sm font-semibold text-slate-700 mb-2">
                          Insumos consumidos para {quantity} unidade(s)
                        </div>
                        <div className="space-y-2">
                          {selectedProduct.bom.map((comp) => {
                            const compProduct = allProducts?.find((p) => p.id === comp.productId);
                            const consumed = (comp.quantity || 0) * quantity;
                            const unitCost = compProduct?.costPrice || 0;
                            const totalCost = unitCost * consumed;
                            return (
                              <div key={comp.productId} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  {compProduct?.photoUrl ? (
                                    <img src={compProduct.photoUrl} alt={compProduct.name} className="h-6 w-6 rounded object-cover border" />
                                  ) : (
                                    <div className="h-6 w-6 rounded bg-slate-200 border" />
                                  )}
                                  <span className="text-slate-700">{compProduct?.name || comp.productId}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-slate-500">Qtd: {consumed}</span>
                                  <span className="text-slate-500">Custo: {formatCurrency(totalCost)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleAddItem}
                disabled={
                  !selectedProduct ||
                  quantity <= 0 ||
                  (selectedProduct?.bom && selectedProduct?.bom.length > 0
                    ? quantity > ((selectedProduct?.currentStock || 0) + virtualStock)
                    : quantity > (selectedProduct?.currentStock || 0))
                }
              >
                <PlusCircle className="mr-2" />
                Adicionar Item
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-5">
          <Card className="h-full flex flex-col bg-gradient-to-br from-emerald-900 to-emerald-800 text-white border border-emerald-800 rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart /> Carrinho de Venda
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                  <ShoppingCart className="h-16 w-16 mb-4 text-slate-400 opacity-40" />
                  <h3 className="text-lg font-semibold text-slate-200">Seu carrinho está vazio</h3>
                  <p className="text-sm text-slate-400">
                    Adicione produtos para começar a venda.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="p-2 rounded-lg bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        {allProducts?.find((p) => p.id === item.productId)?.photoUrl ? (
                          <img
                            src={allProducts.find((p) => p.id === item.productId)!.photoUrl as string}
                            alt={item.productName}
                            className="h-8 w-8 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-white/20 border border-white/30" />
                        )}
                        <p className="font-semibold text-white flex-1">{item.productName}</p>
                        <p className="text-sm text-slate-300">
                          {item.quantity} x {formatCurrency(item.price)}
                        </p>
                      </div>
                      <p className="font-bold text-white text-right">
                        {formatCurrency(item.quantity * item.price)}
                      </p>
                      {(() => {
                        const prod = allProducts?.find((p) => p.id === item.productId);
                        if (prod && prod.bom && prod.bom.length > 0) {
                          return (
                            <div className="mt-2 rounded-md bg-white/5 p-2">
                              <div className="text-xs text-slate-300 mb-1">
                                Insumos consumidos para {item.quantity} unidade(s)
                              </div>
                              <div className="space-y-1">
                                {prod.bom.map((comp) => {
                                  const compProduct = allProducts?.find((p) => p.id === comp.productId);
                                  const consumed = (comp.quantity || 0) * item.quantity;
                                  const unitCost = compProduct?.costPrice || 0;
                                  const totalCost = unitCost * consumed;
                                  return (
                                    <div key={comp.productId} className="flex items-center justify-between text-xs">
                                      <span className="text-slate-300">{compProduct?.name || comp.productId}</span>
                                      <span className="text-slate-400">
                                        Qtd: {consumed} • Custo: {formatCurrency(totalCost)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-400 hover:bg-rose-600/20 hover:text-rose-300 h-8 w-8"
                        onClick={() => handleRemoveItem(item.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 bg-emerald-900/30 p-4 ios-sticky-footer ios-bottom-pad border-t border-emerald-800">
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Subtotal</span>
                  <span className="font-medium text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Desconto (R$)</span>
                  <Input
                    type="number"
                    value={discount === 0 ? '' : discount}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = Number(val);
                      setDiscount(val === '' || Number.isNaN(num) ? 0 : Math.max(0, num));
                    }}
                    className="h-8 w-28 sm:w-24 text-right bg-[#E8E8ED]/50 text-black focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                    disabled={cart.length === 0}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-700">
                  <span className="font-medium">Lucro Estimado</span>
                  <span className="font-medium">
                    {formatCurrency(estimatedProfit)}
                  </span>
                </div>
              </div>
              <div className="w-full flex justify-between items-center border-t border-slate-700 pt-4 rounded-xl bg-slate-800/60 px-4 py-3">
                <span className="text-xl font-bold text-slate-200">Total</span>
                <span className="text-3xl font-bold text-white">
                  {formatCurrency(netTotal)}
                </span>
              </div>
              <div className="w-full">
                <label className="text-sm font-medium text-slate-300">Status do Pagamento</label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-slate-700">
                    <SelectItem value="COMPLETED">Pago</SelectItem>
                    <SelectItem value="PENDING_PAYMENT">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="lg"
                className="w-full h-16 text-lg rounded-full bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all"
                onClick={onFinalizeSale}
                disabled={isSubmitting || cart.length === 0}
              >
                {isSubmitting ? 'Finalizando...' : 'Concluir Venda'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      <ClientDialog
        open={isClientDialogOpen}
        onOpenChange={setIsClientDialogOpen}
        onClientCreated={handleClientCreated}
      />
    </>
  );
}
