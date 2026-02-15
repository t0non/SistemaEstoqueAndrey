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

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="hidden" />
        <div className="fixed left-4 ios-top-fixed z-30 sm:hidden">
          <SidebarTrigger className="h-12 w-12 rounded-full bg-white/90 backdrop-blur-md border border-white shadow-md hover:shadow-lg text-emerald-700 [&_svg]:size-5" />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
