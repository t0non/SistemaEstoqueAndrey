'use client';

import { useState, useMemo } from 'react';
import {
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
  useUser,
  collection,
  query,
  where,
  doc,
} from '@/firebase';
import type { Transaction, Supplier, Company } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toJsDate } from '@/lib/utils';
import { AuthGuard } from '@/components/auth/auth-guard';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import {
  Card,
  CardContent,
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react';
import { TransactionDetailsDialog } from '@/components/transactions/details-dialog';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

function TransactionsDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const transactionsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'transactions'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]
  );
  const { data: transactionsFromHook, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);

  const transactions = useMemo(() => {
    if (!transactionsFromHook) return [];
    return [...transactionsFromHook].sort((a, b) => toJsDate(b.date).getTime() - toJsDate(a.date).getTime());
  }, [transactionsFromHook]);

  const suppliersQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'suppliers'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]
  );
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Supplier>(suppliersQuery);
  
  const companyDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'companies', user.uid) : null),
    [user, firestore]
  );
  const { data: company, isLoading: companyLoading } = useDoc<Company>(companyDocRef);

  const supplierMap = useMemo(() => {
    if (!suppliers) return new Map();
    return new Map(suppliers.map(s => [s.id, s.name]));
  }, [suppliers]);
  
  const isLoading = transactionsLoading || suppliersLoading || companyLoading;

  const getPartnerName = (transaction: Transaction) => {
    // Com novo mapeamento: Venda = IN (cliente), Compra = OUT (fornecedor)
    if (transaction.type === 'IN') {
      return transaction.clientName || 'Consumidor Final';
    }
    return supplierMap.get(transaction.supplierId || '') || 'Fornecedor não encontrado';
  };

  const getStatusLabel = (status: Transaction['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'Concluído';
      case 'PENDING_PAYMENT':
        return 'Pendente';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusVariant = (status: Transaction['status']): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'COMPLETED':
        return 'secondary';
      case 'PENDING_PAYMENT':
        return 'default';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <>
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">
            Histórico de Movimentações
          </h1>
          <p className="text-slate-500">
            Consulte todas as entradas e saídas do seu estoque.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Últimas Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="md:hidden space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-white p-3">
                    <Skeleton className="h-5 w-3/4" />
                    <div className="mt-2 flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))
              ) : transactions && transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div key={tx.id} className="rounded-xl border bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        {format(toJsDate(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                      <Badge variant={tx.type === 'IN' ? 'default' : 'secondary'} className={tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700 font-semibold text-[11px] px-2 py-0.5' : 'bg-red-100 text-red-700 font-semibold text-[11px] px-2 py-0.5'}>
                        {tx.type === 'IN' ? <ArrowDownLeft className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
                        {tx.type === 'IN' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </div>
                    <div className="mt-1 font-medium">{getPartnerName(tx)}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant={getStatusVariant(tx.status)} className="text-[11px] px-2 py-0.5">
                        {getStatusLabel(tx.status)}
                      </Badge>
                      <span className="font-semibold">{formatCurrency(tx.netTotal)}</span>
                      <Button variant="ghost" size="sm" className="px-2 h-7" onClick={() => setSelectedTransaction(tx)}>
                        Detalhes
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
                  Nenhuma movimentação encontrada.
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente/Fornecedor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : transactions && transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          {format(toJsDate(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.type === 'IN' ? 'default' : 'secondary'} className={tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700 font-semibold' : 'bg-red-100 text-red-700 font-semibold'}>
                            {tx.type === 'IN' ? <ArrowDownLeft className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
                            {tx.type === 'IN' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{getPartnerName(tx)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getStatusVariant(tx.status)}>{getStatusLabel(tx.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(tx.netTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(tx)}>
                            <Search className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        Nenhuma movimentação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </DashboardLayout>
    {selectedTransaction && company && (
      <TransactionDetailsDialog
        transaction={selectedTransaction}
        company={company}
        open={!!selectedTransaction}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedTransaction(null);
          }
        }}
      />
    )}
    </>
  );
}

export default function TransactionsPage() {
  return (
    <AuthGuard>
      <TransactionsDashboard />
    </AuthGuard>
  );
}
