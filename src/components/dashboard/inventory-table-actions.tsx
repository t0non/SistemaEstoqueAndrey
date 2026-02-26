'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { ProductDialog } from './product-dialog';
import type { Product } from '@/lib/types';
import { useFirestore, doc, deleteDoc, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { processAssemblyToStock } from '@/services/bom';
import { computeVirtualStock } from '@/lib/products';

export function InventoryTableActions({ product }: { product: Product }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssemblyDialogOpen, setIsAssemblyDialogOpen] = useState(false);
  const [assemblyQty, setAssemblyQty] = useState(1);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleDelete = async () => {
    if (!firestore) return;
    const docRef = doc(firestore, 'products', product.id);
    try {
      await deleteDoc(docRef);
      toast({
        title: 'Produto excluído!',
        description: `O item "${product.name}" foi excluído com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o produto. Tente novamente.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-haspopup="true" size="icon" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => {
              setTimeout(() => setIsEditDialogOpen(true), 100);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          {product.bom && product.bom.length > 0 && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                setTimeout(() => setIsAssemblyDialogOpen(true), 100);
              }}
            >
              Montar para estoque
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            onSelect={() => {
              setTimeout(() => setIsDeleteDialogOpen(true), 100);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductDialog
        product={product}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o
              produto "{product.name}" do seu inventário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAssemblyDialogOpen} onOpenChange={setIsAssemblyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Montar para estoque</AlertDialogTitle>
            <AlertDialogDescription>
              Consome insumos da Ficha Técnica e credita o estoque do produto final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantidade a montar</label>
            <Input
              type="number"
              min={1}
              value={assemblyQty}
              onChange={(e) => setAssemblyQty(Number(e.target.value))}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!firestore || !user) return;
                try {
                  await processAssemblyToStock(firestore, user.uid, product.id, assemblyQty);
                  toast({
                    title: 'Montagem concluída',
                    description: `Foram adicionadas ${assemblyQty} unidade(s) ao estoque de "${product.name}".`,
                  });
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha na montagem',
                    description: e?.message || 'Verifique os insumos e tente novamente.',
                  });
                } finally {
                  setIsAssemblyDialogOpen(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Montar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
