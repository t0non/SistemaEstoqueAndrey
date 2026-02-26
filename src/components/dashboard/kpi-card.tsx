import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  title: string;
  value: string | number;
  isLoading?: boolean;
  deltaPercent?: number;
}

export function KpiCard({ title, value, isLoading, deltaPercent }: KpiCardProps) {
  const hasDelta = typeof deltaPercent === 'number';
  const deltaText =
    hasDelta ? `${deltaPercent >= 0 ? '+' : ''}${Math.round(deltaPercent)}%` : '';
  const deltaClass =
    hasDelta ? (deltaPercent >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-500';

  return (
    <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <CardHeader className="py-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-1 py-3">
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
        )}
        {!isLoading && hasDelta && (
          <div className="text-xs font-medium">
            <span className={deltaClass}>{deltaText}</span>
            <span className="text-slate-500"> vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
