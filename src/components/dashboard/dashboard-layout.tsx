'use client';

import * as React from 'react';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { useUser } from '@/firebase';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { Header } from './header';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-slate-50">
        <div className="fixed left-4 ios-top-fixed z-30 sm:hidden">
          <SidebarTrigger className="rounded-full bg-white/80 backdrop-blur-md border border-white shadow-sm" />
        </div>
        <Header />
        <main className="px-4 md:px-6 py-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
