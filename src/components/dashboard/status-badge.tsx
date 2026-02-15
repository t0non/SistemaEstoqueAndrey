import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { getProductStatus, PRODUCT_STATUS_TYPE } from '@/lib/products';

interface StatusBadgeProps {
  product: Product;
}

export function StatusBadge({ product }: StatusBadgeProps) {
  const { label, type } = getProductStatus(product);

  const badgeClasses = {
    [PRODUCT_STATUS_TYPE.CRITICAL]: 'bg-white text-red-700 border-red-200 hover:bg-white',
    [PRODUCT_STATUS_TYPE.ALERT]: 'bg-white text-amber-700 border-amber-200 hover:bg-white',
    [PRODUCT_STATUS_TYPE.OK]: 'bg-white text-emerald-600 border-emerald-200 hover:bg-white',
    [PRODUCT_STATUS_TYPE.EXCESS]: 'bg-white text-sky-700 border-sky-200 hover:bg-white',
  };
  const dotClasses = {
    [PRODUCT_STATUS_TYPE.CRITICAL]: 'bg-red-600',
    [PRODUCT_STATUS_TYPE.ALERT]: 'bg-amber-500',
    [PRODUCT_STATUS_TYPE.OK]: 'bg-emerald-600',
    [PRODUCT_STATUS_TYPE.EXCESS]: 'bg-sky-500',
  };

  return (
    <Badge
      variant="outline"
      className={cn('font-semibold', badgeClasses[type])}
    >
      <span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full animate-pulse', dotClasses[type])} />
      {label}
    </Badge>
  );
}
