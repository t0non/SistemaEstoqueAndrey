'use client';

import { useState, useMemo } from 'react';
import type { Product, Transaction, TransactionItem } from '@/lib/types';
import { InventoryTable } from '@/components/dashboard/inventory-table';
import { AuthGuard } from '@/components/auth/auth-guard';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
  collection,
  query,
  where,
} from '@/firebase';
import { subDays, startOfDay, endOfDay, isWithinInterval, format as formatDate } from 'date-fns';
import { toJsDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
 
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { KpiCard } from '@/components/dashboard/kpi-card';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

function DashboardAnalytics() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [filter, setFilter] = useState<'today' | '7days' | '30days'>('7days');
  const [seriesEnabled, setSeriesEnabled] = useState({ revenue: true, profit: true, expenses: true });
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.15)]">
          <div className="text-[11px] font-semibold text-slate-500">{label}</div>
          <div className="mt-2 space-y-1 text-xs">
            {payload.map((p: any, i: number) => (
              <div key={i} className="flex justify-between gap-6">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-slate-600">{p.name}</span>
                </span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Fetch transactions
  const transactionsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'transactions'),
            where('ownerId', '==', user.uid)
          )
        : null,
    [firestore, user]
  );
  const { data: transactions, isLoading: transactionsLoading } =
    useCollection<Transaction>(transactionsQuery);

  // Fetch transaction items
  const itemsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'transaction_items'),
            where('ownerId', '==', user.uid)
          )
        : null,
    [firestore, user]
  );
  const { data: transactionItems, isLoading: itemsLoading } =
    useCollection<TransactionItem>(itemsQuery);

  // Process data
  const analyticsData = useMemo(() => {
    if (!transactions || !transactionItems) {
      return { dailyData: [], todayStats: { revenue: 0, cost: 0, expenses: 0, profit: 0 }, todaySalesCount: 0, todayAvgTicket: 0, periodDeltas: { revenue: 0, cost: 0, expenses: 0, profit: 0 } };
    }

    const now = new Date();
    const filterStartDate = startOfDay(
      {
        today: now,
        '7days': subDays(now, 6),
        '30days': subDays(now, 29),
      }[filter]
    );
    const windowDays = { today: 1, '7days': 7, '30days': 30 }[filter];
    const periodStart = filterStartDate;
    const periodEnd = endOfDay(now);
    const prevStart = startOfDay(subDays(filterStartDate, windowDays));
    const prevEnd = endOfDay(subDays(filterStartDate, 1));

    const sales = transactions.filter(
      (t) =>
        t.type === 'IN' &&
        t.status === 'COMPLETED' &&
        toJsDate(t.date) >= filterStartDate
    );
    const purchases = transactions.filter(
      (t) =>
        t.type === 'OUT' &&
        t.status === 'COMPLETED' &&
        toJsDate(t.date) >= filterStartDate
    );

    const dailyDataMap = new Map<
      string,
      { date: string; faturamento: number; custo: number; despesa: number; lucro: number }
    >();

    for (const sale of sales) {
      const saleDate = formatDate(toJsDate(sale.date), 'dd/MM');
      const itemsOfSale = transactionItems.filter(
        (i) => i.transactionId === sale.id
      );

      if (!dailyDataMap.has(saleDate)) {
        dailyDataMap.set(saleDate, {
          date: saleDate,
          faturamento: 0,
          custo: 0,
          despesa: 0,
          lucro: 0,
        });
      }

      const dayData = dailyDataMap.get(saleDate)!;

      const saleRevenue = sale.netTotal;
      const saleCost = itemsOfSale.reduce(
        (acc, item) => acc + (item.costPrice || 0) * item.quantity,
        0
      );

      dayData.faturamento += saleRevenue;
      dayData.custo += saleCost;
      dayData.lucro += saleRevenue - saleCost;
    }
    
    for (const purchase of purchases) {
      const purchaseDate = formatDate(toJsDate(purchase.date), 'dd/MM');
      if (!dailyDataMap.has(purchaseDate)) {
        dailyDataMap.set(purchaseDate, {
          date: purchaseDate,
          faturamento: 0,
          custo: 0,
          despesa: 0,
          lucro: 0,
        });
      }
      const dayData = dailyDataMap.get(purchaseDate)!;
      const expense = purchase.netTotal;
      dayData.despesa += expense;
      dayData.lucro -= expense;
    }

    const today = new Date();
    const todaySales = transactions.filter(
      (t) =>
        t.type === 'IN' &&
        t.status === 'COMPLETED' &&
        isWithinInterval(toJsDate(t.date), {
          start: startOfDay(today),
          end: endOfDay(today),
        })
    );
    const todayPurchases = transactions.filter(
      (t) =>
        t.type === 'OUT' &&
        t.status === 'COMPLETED' &&
        isWithinInterval(toJsDate(t.date), {
          start: startOfDay(today),
          end: endOfDay(today),
        })
    );

    let todayRevenue = 0;
    let todayCost = 0;
    let todayExpenses = 0;

    for (const sale of todaySales) {
      const itemsOfSale = transactionItems.filter(
        (i) => i.transactionId === sale.id
      );
      const saleCost = itemsOfSale.reduce(
        (acc, item) => acc + (item.costPrice || 0) * item.quantity,
        0
      );
      todayRevenue += sale.netTotal;
      todayCost += saleCost;
    }
    for (const purchase of todayPurchases) {
      todayExpenses += purchase.netTotal;
    }

    const todaySalesCount = todaySales.length;
    const todayAvgTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

    const periodSales = transactions.filter(
      (t) =>
        t.type === 'IN' &&
        t.status === 'COMPLETED' &&
        isWithinInterval(toJsDate(t.date), { start: periodStart, end: periodEnd })
    );
    const periodPurchases = transactions.filter(
      (t) =>
        t.type === 'OUT' &&
        t.status === 'COMPLETED' &&
        isWithinInterval(toJsDate(t.date), { start: periodStart, end: periodEnd })
    );
    const prevSales = transactions.filter(
      (t) =>
        t.type === 'IN' &&
        t.status === 'COMPLETED' &&
        isWithinInterval(toJsDate(t.date), { start: prevStart, end: prevEnd })
    );
    const prevPurchases = transactions.filter(
      (t) =>
        t.type === 'OUT' &&
        t.status === 'COMPLETED' &&
        isWithinInterval(toJsDate(t.date), { start: prevStart, end: prevEnd })
    );
    const periodRevenue = periodSales.reduce((acc, s) => acc + s.netTotal, 0);
    const prevRevenue = prevSales.reduce((acc, s) => acc + s.netTotal, 0);
    const periodExpenses = periodPurchases.reduce((acc, p) => acc + p.netTotal, 0);
    const prevExpenses = prevPurchases.reduce((acc, p) => acc + p.netTotal, 0);
    const periodCost = periodSales.reduce((acc, s) => {
      const itemsOfSale = transactionItems.filter((i) => i.transactionId === s.id);
      const saleCost = itemsOfSale.reduce((a, it) => a + (it.costPrice || 0) * it.quantity, 0);
      return acc + saleCost;
    }, 0);
    const prevCost = prevSales.reduce((acc, s) => {
      const itemsOfSale = transactionItems.filter((i) => i.transactionId === s.id);
      const saleCost = itemsOfSale.reduce((a, it) => a + (it.costPrice || 0) * it.quantity, 0);
      return acc + saleCost;
    }, 0);
    const periodProfit = periodRevenue - periodCost - periodExpenses;
    const prevProfit = prevRevenue - prevCost - prevExpenses;
    const pct = (curr: number, prev: number) => {
      const base = prev === 0 ? (curr === 0 ? 1 : curr) : prev;
      return ((curr - prev) / base) * 100;
    };
    const periodDeltas = {
      revenue: pct(periodRevenue, prevRevenue),
      cost: pct(periodCost, prevCost),
      expenses: pct(periodExpenses, prevExpenses),
      profit: pct(periodProfit, prevProfit),
    };
    return {
      dailyData: Array.from(dailyDataMap.values()),
      todayStats: {
        revenue: todayRevenue,
        cost: todayCost,
        expenses: todayExpenses,
        profit: todayRevenue - todayCost - todayExpenses,
      },
      todaySalesCount,
      todayAvgTicket,
      periodDeltas,
    };
  }, [transactions, transactionItems, filter]);

  const isLoading = transactionsLoading || itemsLoading;

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Faturamento (hoje)"
          value={formatCurrency(analyticsData.todayStats.revenue)}
          isLoading={isLoading}
          deltaPercent={analyticsData.periodDeltas.revenue}
        />
        <KpiCard
          title="Custo (CMV hoje)"
          value={formatCurrency(analyticsData.todayStats.cost)}
          isLoading={isLoading}
          deltaPercent={analyticsData.periodDeltas.cost}
        />
        <KpiCard
          title="Despesas (hoje)"
          value={formatCurrency(analyticsData.todayStats.expenses)}
          isLoading={isLoading}
          deltaPercent={analyticsData.periodDeltas.expenses}
        />
        <KpiCard
          title="Lucro Líquido (hoje)"
          value={formatCurrency(analyticsData.todayStats.profit)}
          isLoading={isLoading}
          deltaPercent={analyticsData.periodDeltas.profit}
        />
        <KpiCard
          title="Vendas (hoje)"
          value={analyticsData.todaySalesCount}
          isLoading={isLoading}
        />
        <KpiCard
          title="Ticket Médio (hoje)"
          value={formatCurrency(analyticsData.todayAvgTicket)}
          isLoading={isLoading}
        />
      </div>

      {/* Chart */}
      <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2 px-1">
              <Button size="sm" onClick={() => setFilter('today')} className={filter === 'today' ? 'rounded-full bg-emerald-600 text-white' : 'rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100'}>
                Hoje
              </Button>
              <Button size="sm" onClick={() => setFilter('7days')} className={filter === '7days' ? 'rounded-full bg-emerald-600 text-white' : 'rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100'}>
                7 dias
              </Button>
              <Button size="sm" onClick={() => setFilter('30days')} className={filter === '30days' ? 'rounded-full bg-emerald-600 text-white' : 'rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100'}>
                30 dias
              </Button>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-center">Análise de Lucratividade</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="h-[200px] sm:h-[320px] md:h-[420px] pt-2 sm:pt-6">
           {isLoading ? (
              <div className="flex h-full items-center justify-center">
                 <Skeleton className="h-full w-full" />
              </div>
            ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={analyticsData.dailyData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal vertical={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
              {seriesEnabled.revenue && (
                <Line type="monotone" dataKey="faturamento" stroke="#16A34A" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="Entradas" />
              )}
              {seriesEnabled.profit && (
                <Line type="monotone" dataKey="lucro" stroke="#6B7280" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="Lucro" />
              )}
              {seriesEnabled.expenses && (
                <Line type="monotone" dataKey="despesa" stroke="#DC2626" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="Saídas" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
            )}
          {!isLoading && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                className={`px-3 py-1 rounded-full text-sm ${seriesEnabled.revenue ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                onClick={() => setSeriesEnabled((s) => ({ ...s, revenue: !s.revenue }))}
              >
                Entradas
              </button>
              <button
                className={`px-3 py-1 rounded-full text-sm ${seriesEnabled.profit ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                onClick={() => setSeriesEnabled((s) => ({ ...s, profit: !s.profit }))}
              >
                Lucro
              </button>
              <button
                className={`px-3 py-1 rounded-full text-sm ${seriesEnabled.expenses ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                onClick={() => setSeriesEnabled((s) => ({ ...s, expenses: !s.expenses }))}
              >
                Saídas
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}

function DashboardContent() {
  const [products, setProducts] = useState<Product[]>([]);

  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-gray-50 p-4 ios-bottom-pad md:gap-8 md:p-8">
        <DashboardAnalytics />
        <InventoryTable products={products} setProducts={setProducts} />
      </main>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
