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
import { IMaskInput } from 'react-imask';

import {
  PlusCircle,
  Trash2,
  User as UserIcon,
  ShoppingCart,
} from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClientDialog } from '@/components/clients/client-dialog';
import { cn } from '@/lib/utils';
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

  // State Management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

  // Master form state
  const [clientId, setClientId] = useState<string>('consumidor-final');
  const [clientName, setClientName] = useState<string>('Consumidor Final');
  const [saleDate, setSaleDate] = useState<string>(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    return `${day}/${month}/${year}`;
  });
  const [paymentStatus, setPaymentStatus] = useState<string>('COMPLETED');
  const [discount, setDiscount] = useState<number>(0);

  // Item entry state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | ''>(1);
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
  const { data: products, isLoading: productsLoading } =
    useCollection<Product>(productsQuery);

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
  const quantityNumber = typeof quantity === 'number' ? quantity : 0;

  const handleProductSelect = (productId: string) => {
    const product = products?.find((p: Product) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setCurrentPrice(product.salePrice || 0);
      setQuantity(1);
    } else {
      setSelectedProduct(null);
      setCurrentPrice(0);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || quantityNumber <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione um produto e uma quantidade válida.',
      });
      return;
    }
    if (quantityNumber > selectedProduct.currentStock) {
      toast({
        variant: 'destructive',
        title: 'Estoque Insuficiente',
        description: `Apenas ${selectedProduct.currentStock} unidades disponíveis.`,
      });
      return;
    }

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (item) => item.productId === selectedProduct.id
      );

      if (existingItemIndex > -1) {
        // Merge with existing item
        const updatedCart = [...prevCart];
        const existingItem = updatedCart[existingItemIndex];
        const newQuantity = existingItem.quantity + quantityNumber;

        if (newQuantity > selectedProduct.currentStock) {
          toast({
            variant: 'destructive',
            title: 'Estoque Insuficiente',
            description: `A quantidade total no carrinho (${newQuantity}) excede o estoque disponível (${selectedProduct.currentStock}).`,
          });
          return prevCart;
        }

        updatedCart[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          price: currentPrice, // Update price to the latest negotiated one
        };
        return updatedCart;
      } else {
        // Add new item
        const newItem: CartItem = {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: quantityNumber,
          price: currentPrice,
          availableStock: selectedProduct.currentStock,
          costPrice: selectedProduct.costPrice || 0,
        };
        return [...prevCart, newItem];
      }
    });

    // Reset fields
    setSelectedProduct(null);
    setCurrentPrice(0);
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
    const [day, month, year] = saleDate.split('/');
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    const parsedSaleDate = d && m && y ? new Date(y, m - 1, d) : null;
    if (!parsedSaleDate || isNaN(parsedSaleDate.getTime())) {
      toast({
        variant: 'destructive',
        title: 'Data inválida',
        description: 'Informe uma data de venda válida no formato dd/mm/aaaa.',
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

        // 1. First, read all product documents and check stock within the transaction
        for (const item of cart) {
          const productRef = doc(firestore, 'products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            throw new Error(`Produto "${item.productName}" não encontrado.`);
          }
          if (productSnap.data().currentStock < item.quantity) {
            throw new Error(
              `Estoque insuficiente para "${item.productName}". Disponível: ${
                productSnap.data().currentStock
              }`
            );
          }
          productDetails.push({ ref: productRef, snap: productSnap, item });
        }

        // 2. If all checks pass, proceed with writes
        const transactionRef = doc(firestore, 'transactions', transactionId);
        transaction.set(transactionRef, {
          id: transactionId,
          ownerId: user.uid,
          type: 'OUT',
          status: paymentStatus,
          clientId: clientId,
          clientName: clientName,
          date: Timestamp.fromDate(parsedSaleDate),
          totalValue: subtotal,
          discountValue: discount,
          netTotal: netTotal,
        });

        for (const detail of productDetails) {
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
            costPrice: detail.item.costPrice,
          });

          // 3b. Update product stock
          const newStock = detail.snap.data().currentStock - detail.item.quantity;
          transaction.update(detail.ref, { currentStock: newStock });
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
                <IMaskInput
                  mask="00/00/0000"
                  value={saleDate}
                  onAccept={(value: any) => setSaleDate(value)}
                  as={Input as any}
                  placeholder="dd/mm/aaaa"
                  className="bg-[#E8E8ED]/50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
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
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-slate-800">
                        {selectedProduct.name}
                      </h3>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Quantidade</label>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setQuantity('');
                            } else {
                              setQuantity(Number(value));
                            }
                          }}
                          className={cn(
                            'text-lg h-12 bg-[#E8E8ED]/50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all',
                            quantityNumber > selectedProduct.currentStock &&
                              'border-red-500 focus-visible:ring-red-500'
                          )}
                          min={1}
                        />
                        {quantityNumber > selectedProduct.currentStock && (
                          <p className="text-sm font-medium text-destructive mt-1">
                            Estoque insuficiente.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Preço Unit. (R$)</label>
                        <Input
                          type="number"
                          value={currentPrice}
                          onChange={(e) =>
                            setCurrentPrice(Number(e.target.value))
                          }
                          className="text-lg h-12 bg-[#E8E8ED]/50 focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleAddItem}
                disabled={
                  !selectedProduct ||
                  quantityNumber <= 0 ||
                  quantityNumber > (selectedProduct?.currentStock || 0)
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
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/10"
                    >
                      <div className="flex-grow">
                        <p className="font-semibold text-white">{item.productName}</p>
                        <p className="text-sm text-slate-300">
                          {item.quantity} x {formatCurrency(item.price)}
                        </p>
                      </div>
                      <p className="font-bold text-white">
                        {formatCurrency(item.quantity * item.price)}
                      </p>
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
                    value={discount}
                    onChange={(e) =>
                      setDiscount(Math.max(0, Number(e.target.value)))
                    }
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
