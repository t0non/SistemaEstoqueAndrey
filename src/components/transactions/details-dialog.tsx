'use client';

import { useMemo, useState } from 'react';
import type { Transaction, TransactionItem, Company } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  writeBatch,
  doc,
  increment,
  runTransaction,
  getDocs,
  getDoc,
} from '@/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn, toJsDate } from '@/lib/utils';

interface TransactionDetailsDialogProps {
  transaction: Transaction;
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function TransactionDetailsDialog({
  transaction,
  company,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isReverting, setIsReverting] = useState(false);

  const itemsQuery = useMemoFirebase(
    () =>
      firestore && user && transaction
        ? query(
            collection(firestore, 'transaction_items'),
            where('transactionId', '==', transaction.id),
            where('ownerId', '==', user.uid)
          )
        : null,
    [firestore, user, transaction]
  );
  const { data: items, isLoading } = useCollection<TransactionItem>(itemsQuery);

  const getStatusLabel = (status: Transaction['status']) => {
    switch (status) {
      case 'COMPLETED': return 'Concluído';
      case 'PENDING_PAYMENT': return 'Pendente';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusVariant = (
    status: Transaction['status']
  ): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'COMPLETED': return 'secondary';
      case 'PENDING_PAYMENT': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'default';
    }
  };
  
  const handlePrint = () => {
    if (!items || !company) return;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(company.name, 14, 22);

    doc.setFontSize(10);
    doc.text(`CNPJ: ${company.cnpj}`, 14, 30);
    doc.text(`Telefone: ${company.phone}`, 14, 35);
    
    doc.text("RECIBO DE TRANSAÇÃO", 105, 45, { align: 'center'});
    doc.setFontSize(10);
    doc.text(`ID da Transação: ${transaction.id.substring(0,10).toUpperCase()}`, 14, 55);
    doc.text(`Data: ${format(toJsDate(transaction.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 60);
    doc.text(`Parceiro: ${transaction.clientName || 'Não informado'}`, 14, 65);


    const tableColumns = ["Produto", "Qtd", "V. Unit", "Subtotal"];
    const tableRows = items.map(item => [
      item.productName,
      item.quantity,
      formatCurrency(item.price),
      formatCurrency(item.price * item.quantity)
    ]);
    
    (doc as any).autoTable({
        startY: 75,
        head: [tableColumns],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Subtotal: ${formatCurrency(transaction.totalValue)}`, 140, finalY);
    doc.text(`Desconto: - ${formatCurrency(transaction.discountValue)}`, 140, finalY + 7);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Final: ${formatCurrency(transaction.netTotal)}`, 140, finalY + 14);

    doc.save(`recibo_${transaction.id.substring(0, 7)}.pdf`);
  };

  const handleRevert = async () => {
    if (!firestore || !items || !user) return;

    if (transaction.status === 'CANCELLED') {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Esta transação já foi cancelada.',
      });
      return;
    }

    let succeeded = false;
    setIsReverting(true);
    try {
      const freshItems =
        items && items.length > 0
          ? items
          : ((await getDocs(itemsQuery as any)).docs.map((d: any) => d.data()) as TransactionItem[]);

      await runTransaction(firestore, async (tx) => {
        // 1. Read all necessary documents
        const productSnapshots = await Promise.all(
          freshItems.map(item => tx.get(doc(firestore, 'products', item.productId)))
        );

        // 2. No hard validation — se o produto foi excluído, apenas não ajusta estoque
        
        // 3. Perform all writes
        // Adjust stock for each item
        for (let i = 0; i < freshItems.length; i++) {
          const productRef = doc(firestore, 'products', freshItems[i].productId);
          const exists = productSnapshots[i].exists();
          const stockAdjustment = transaction.type === 'IN' ? freshItems[i].quantity : -freshItems[i].quantity;
          if (exists) {
            tx.update(productRef, {
              currentStock: increment(stockAdjustment),
            });
          }
        }

        // Delete all transaction items
        for (const item of freshItems) {
          const itemRef = doc(firestore, 'transaction_items', item.id);
          tx.delete(itemRef);
        }

        // Delete the main transaction
        const transactionRef = doc(firestore, 'transactions', transaction.id);
        tx.delete(transactionRef);
      });

      succeeded = true;
      toast({
        title: 'Transação Revertida e Excluída!',
        description: 'A movimentação foi removida e o estoque ajustado.',
      });
    } catch (error: any) {
      console.error('Erro ao reverter transação:', error);
      try {
        const freshItems =
          items && items.length > 0
            ? items
            : ((await getDocs(itemsQuery as any)).docs.map((d: any) => d.data()) as TransactionItem[]);

        const batch = writeBatch(firestore);
        for (const item of freshItems) {
          const productRef = doc(firestore, 'products', item.productId);
          const snap = await getDoc(productRef);
          const stockAdjustment = transaction.type === 'IN' ? item.quantity : -item.quantity;
          if (snap.exists()) {
            batch.update(productRef, { currentStock: increment(stockAdjustment) });
          }
        }
        for (const item of freshItems) {
          const itemRef = doc(firestore, 'transaction_items', item.id);
          batch.delete(itemRef);
        }
        const transactionRef = doc(firestore, 'transactions', transaction.id);
        batch.delete(transactionRef);
        await batch.commit();
        succeeded = true;
        toast({
          title: 'Transação Revertida e Excluída!',
          description: 'A movimentação foi removida e o estoque ajustado.',
        });
      } catch (e: any) {
        console.error('Fallback batch falhou:', e);
        toast({
          variant: 'destructive',
          title: 'Erro ao Reverter',
          description:
            e?.message ||
            error?.message ||
            'Não foi possível reverter a transação. Verifique as permissões ou tente novamente.',
        });
      }
    } finally {
      setIsReverting(false);
      if (succeeded) {
        onOpenChange(false);
      }
    }
  };

  return (
    <>
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">
                Detalhes da Transação
              </DialogTitle>
              <DialogDescription>
                ID: {transaction.id.toUpperCase()}
              </DialogDescription>
            </div>
            <Badge variant={getStatusVariant(transaction.status)} className="text-base">
              {getStatusLabel(transaction.status)}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 py-4 text-sm">
            <div>
                <h4 className="font-semibold text-slate-500">PARCEIRO</h4>
                <p className="text-slate-800 font-medium">{transaction.clientName || transaction.supplierId || 'Não informado'}</p>
            </div>
             <div>
                <h4 className="font-semibold text-slate-500">DATA</h4>
                <p className="text-slate-800">{format(toJsDate(transaction.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
            <div>
                <h4 className="font-semibold text-slate-500">Nº NOTA/PEDIDO</h4>
                <p className="text-slate-800">{transaction.invoiceNumber || 'N/A'}</p>
            </div>
        </div>

        <Separator />

        <div className="py-4">
          <h4 className="font-semibold mb-2">Itens da Transação</h4>
          <div className="border rounded-md max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd.</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : items && items.length > 0 ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.quantity * item.price)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">Nenhum item encontrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(transaction.totalValue)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-medium text-red-600">- {formatCurrency(transaction.discountValue)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                    <span>TOTAL FINAL</span>
                    <span>{formatCurrency(transaction.netTotal)}</span>
                </div>
            </div>
        </div>
        
        {transaction.notes && (
            <div className="mt-4 p-3 bg-slate-50 rounded-md border">
                <h4 className="font-semibold text-sm mb-1">Observações</h4>
                <p className="text-sm text-slate-600">{transaction.notes}</p>
            </div>
        )}

        <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={handlePrint}>Imprimir</Button>
            {transaction.status !== 'CANCELLED' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRevert}
                  disabled={isReverting}
                >
                  {isReverting ? 'Processando...' : 'Estornar / Excluir'}
                </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    
    </>
  );
}
