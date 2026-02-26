'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
} from '@/services/hooks';
import type { Product } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ProductDialog } from './product-dialog';
import { PlusCircle, Truck, PackageSearch } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { InventoryTableActions } from './inventory-table-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { computeVirtualStock } from '@/lib/products';

interface InventoryTableProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

export function InventoryTable({ products, setProducts }: InventoryTableProps) {
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<'TODOS' | 'FINAL' | 'INSUMO'>('TODOS');
  const firestore = useFirestore();
  const { user } = useUser();

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

  const { data, isLoading, error } = useCollection<Product>(productsQuery);

  const sortedProducts = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    // Sort on the client side
    return [...data].sort(
      (a, b) => (a.name.localeCompare(b.name))
    );
  }, [data]);

  useEffect(() => {
    if (sortedProducts) {
      const filtered =
        filterType === 'TODOS'
          ? sortedProducts
          : sortedProducts.filter((p) => p.type === filterType);
      setProducts(filtered);
    }
  }, [sortedProducts, filterType, setProducts]);

  if (error) {
    console.error('Error fetching products: ', error);
  }

  return (
    <>
    <Card className="bg-white/70 backdrop-blur-2xl saturate-150 border border-white/40 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <CardTitle className="tracking-tight text-slate-900">Inventário</CardTitle>
            <CardDescription className="text-slate-500">
              Gerencie seus produtos e estoque.
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-2">
            <Button size="sm" variant="outline" asChild className="border-gray-300 text-gray-700 hover:bg-gray-100">
              <Link href="/purchases/new">
                <Truck className="mr-2 h-4 w-4" />
                Registrar Compra
              </Link>
            </Button>
            <Button size="sm" onClick={() => setIsProductDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </div>
          <div className="w-full flex items-center gap-2">
            <Button
              variant={filterType === 'TODOS' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('TODOS')}
            >
              Todos
            </Button>
            <Button
              variant={filterType === 'FINAL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('FINAL')}
            >
              Produtos Finais
            </Button>
            <Button
              variant={filterType === 'INSUMO' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('INSUMO')}
            >
              Insumos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
         {isLoading ? (
            <div className="space-y-2">
               {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
               ))}
            </div>
         ) : products.length > 0 ? (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="uppercase text-xs font-semibold text-gray-400">
                    Produto
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-center uppercase text-xs font-semibold text-gray-400">
                    Situação
                  </TableHead>
                  <TableHead className="text-center uppercase text-xs font-semibold text-gray-400">
                    Estoque Atual
                  </TableHead>
                  <TableHead className="text-center uppercase text-xs font-semibold text-gray-400">
                    Estoque Virtual
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-center uppercase text-xs font-semibold text-gray-400">
                    Estoque Mín/Máx
                  </TableHead>
                  <TableHead className="text-right uppercase text-xs font-semibold text-gray-400">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="hover:bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <TableCell className="font-medium text-slate-800 break-words">
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-slate-500">
                          {product.sku && `SKU: ${product.sku}`}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        <StatusBadge product={product} />
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">
                        {product.currentStock}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">
                        {product.bom && product.bom.length > 0
                          ? computeVirtualStock(product, data || [])
                          : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center text-slate-600">
                        {product.minStock} / {product.maxStock}
                      </TableCell>
                      <TableCell className="text-right">
                        <InventoryTableActions product={product} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
         ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <PackageSearch className="h-16 w-16 text-slate-300" />
            <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-800">
              Seu inventário está vazio
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione seu primeiro produto para começar a gerenciar seu estoque.
            </p>
            <Button className="mt-6" onClick={() => setIsProductDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          </div>
         )}
      </CardContent>
    </Card>
    <ProductDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
      />
    </>
  );
}
