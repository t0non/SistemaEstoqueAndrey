'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { NewSaleForm } from '@/components/sales/new-sale-form';

function NewSalePageContent() {
  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Registrar Nova Venda
            </h1>
            <p className="text-slate-500">
              Use a interface de Ponto de Venda para registrar saídas de estoque.
            </p>
          </div>
        </div>
        <NewSaleForm />
      </main>
    </DashboardLayout>
  );
}

export default function NewSalePage() {
  return (
    <AuthGuard>
      <NewSalePageContent />
    </AuthGuard>
  );
}
