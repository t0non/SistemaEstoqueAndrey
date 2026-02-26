import { Timestamp } from '@/services/storage';

export interface Product {
  id: string;
  name: string;
  sku?: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  costPrice?: number;
  salePrice?: number;
  type?: 'FINAL' | 'INSUMO';
  category?: string;
  observations?: string;
  photoUrl?: string;
  updatedAt: Timestamp;
  ownerId: string;
  supplierId?: string;
  bom?: {
    productId: string;
    quantity: number;
    productName?: string;
  }[];
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  segment: 'metalurgica' | 'varejo' | 'outros';
  ownerId: string;
  createdAt: Timestamp;
  logoUrl?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  leadTime: number;
  ownerId: string;
  createdAt: Timestamp;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  ownerId: string;
}

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  supplierId?: string; // Optional for sales
  clientId?: string;
  clientName?: string;
  date: Timestamp;
  totalValue: number;
  discountValue: number;
  netTotal: number;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING_PAYMENT';
  notes?: string;
  invoiceNumber?: string;
  ownerId: string;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  productName: string; // Denormalized
  quantity: number;
  price: number; // For purchases this is cost, for sales this is sale price
  costPrice?: number; // The cost of the product at the time of a sale transaction.
  sku?: string; // Denormalized
  ownerId: string;
}
