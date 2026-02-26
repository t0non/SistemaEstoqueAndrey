'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { NewPurchaseForm } from '@/components/purchases/new-purchase-form';

function NewPurchasePageContent() {
  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Registrar Nova Compra
            </h1>
            <p className="text-slate-500">
              Preencha os dados da nota/pedido de compra para atualizar o estoque.
            </p>
          </div>
        </div>
        <NewPurchaseForm />
      </main>
    </DashboardLayout>
  );
}

export default function NewPurchasePage() {
  return (
    <AuthGuard>
      <NewPurchasePageContent />
    </AuthGuard>
  );
}
