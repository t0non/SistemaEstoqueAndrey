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
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold text-slate-800 md:text-base"
      >
        <Package className="h-6 w-6 text-emerald-600" />
        <span className="font-bold">ControlMax</span>
      </Link>
      <div className="flex items-center gap-3">
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
