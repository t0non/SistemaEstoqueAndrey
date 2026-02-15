'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { SettingsForm } from '@/components/settings/settings-form';

function SettingsPageContent() {
  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Configurações
          </h1>
          <p className="text-slate-500">
            Gerencie os dados da sua empresa e preferências do sistema.
          </p>
        </div>
        <SettingsForm />
      </main>
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsPageContent />
    </AuthGuard>
  );
}
