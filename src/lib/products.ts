import type { Product } from "./types";

export const PRODUCT_STATUS = {
  CRITICAL: 'Estoque Zerado',
  ALERT: 'Repor Estoque',
  OK: 'Estoque Suficiente',
  EXCESS: 'Excesso de Estoque',
};

export const PRODUCT_STATUS_TYPE = {
  CRITICAL: 'CRITICAL',
  ALERT: 'ALERT',
  OK: 'OK',
  EXCESS: 'EXCESS',
}

export function getProductStatus(product: Pick<Product, 'currentStock' | 'minStock' | 'maxStock'>) {
  const { currentStock, minStock, maxStock } = product;

  if (currentStock <= 0) {
    return { label: PRODUCT_STATUS.CRITICAL, type: PRODUCT_STATUS_TYPE.CRITICAL };
  }
  if (currentStock <= minStock) {
    return { label: PRODUCT_STATUS.ALERT, type: PRODUCT_STATUS_TYPE.ALERT };
  }
  // A maxStock of 0 or less means it's not controlled
  if (maxStock > 0 && currentStock >= maxStock) {
    return { label: PRODUCT_STATUS.EXCESS, type: PRODUCT_STATUS_TYPE.EXCESS };
  }
  return { label: PRODUCT_STATUS.OK, type: PRODUCT_STATUS_TYPE.OK };
}

export function computeVirtualStock(finalProduct: Product | null, allProducts: Product[] | null): number {
  if (!finalProduct || !Array.isArray(finalProduct.bom) || !allProducts) return 0;
  if (finalProduct.bom.length === 0) return 0;
  let minUnits = Infinity;
  for (const comp of finalProduct.bom) {
    const compProduct = allProducts.find(p => p.id === comp.productId);
    const available = compProduct?.currentStock || 0;
    const neededPerUnit = comp.quantity || 0;
    if (neededPerUnit <= 0) return 0;
    const producible = Math.floor(available / neededPerUnit);
    minUnits = Math.min(minUnits, producible);
  }
  return Number.isFinite(minUnits) ? minUnits : 0;
}
