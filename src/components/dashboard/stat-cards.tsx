import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Boxes, ShieldAlert, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardsProps {
  totalItems: number;
  criticalItems: number;
  stockValue: number;
}

export function StatCards({
  totalItems,
  criticalItems,
  stockValue,
}: StatCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const hasCriticalItems = criticalItems > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">
            Total de Itens
          </CardTitle>
          <Boxes className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-800">{totalItems}</div>
          <p className="text-xs text-slate-500">
            Itens únicos cadastrados no estoque
          </p>
        </CardContent>
      </Card>
      <Card className={cn(hasCriticalItems && 'bg-red-50 border-red-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', hasCriticalItems ? 'text-red-800' : 'text-slate-500')}>
            Itens Críticos
          </CardTitle>
          <ShieldAlert
            className={cn('h-4 w-4', hasCriticalItems ? 'text-red-500' : 'text-slate-400')}
          />
        </CardHeader>
        <CardContent>
          <div
            className={cn('text-2xl font-bold', hasCriticalItems ? 'text-red-700' : 'text-slate-800')}
          >
            {criticalItems}
          </div>
          <p className={cn('text-xs', hasCriticalItems ? 'text-red-600' : 'text-slate-500')}>
            Produtos que precisam de reposição
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">
            Valor em Estoque
          </CardTitle>
          <DollarSign className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-800">
            {formatCurrency(stockValue)}
          </div>
          <p className="text-xs text-slate-500">
            Custo total estimado dos produtos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
