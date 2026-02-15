'use client';

import { LifeBuoy, LogOut, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, signOut } from '@/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function Header() {
  const auth = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-slate-800 md:text-base"
        >
          <Package className="h-6 w-6 text-blue-600" />
          <span className="font-bold">ControlMax</span>
        </Link>
        <Link
          href="/"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Inventário
        </Link>
        <Link
          href="/purchases/new"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Compras
        </Link>
        <Link
          href="/sales/new"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Vendas
        </Link>
        <Link
          href="/suppliers"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Fornecedores
        </Link>
        <Link
          href="/clients"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Clientes
        </Link>
        <Link
          href="/transactions"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Movimentações
        </Link>
        <Link
          href="/settings"
          className="text-slate-600 transition-colors hover:text-slate-900"
        >
          Configurações
        </Link>
      </nav>
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial" />
        <Link
          href="/help"
          className="flex items-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <LifeBuoy className="mr-1 h-4 w-4" />
          Ajuda
        </Link>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
