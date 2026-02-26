'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  Home,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  CircleHelp,
} from 'lucide-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth, signOut } from '@/firebase';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const auth = useAuth();
  const router = useRouter();
  const navClass = (active: boolean) =>
    active
      ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 rounded-xl'
      : 'text-slate-700 hover:bg-slate-100 rounded-xl transition-colors';

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };
  
  /**
   * Garante que o menu lateral (Sheet) seja fechado no modo mobile após
   * um clique em um link. Isso previne o bug do "modal fantasma" onde
   * o overlay do menu permanecia na tela, bloqueando interações.
   */
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="m-6 rounded-[2rem] bg-white/70 backdrop-blur-2xl saturate-150 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center shadow-sm">
            <Package className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-gray-900">ControlMax</span>
        </Link>
      </SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/'}
            onClick={handleLinkClick}
          >
            <Link href="/" className={navClass(pathname === '/')}>
              <Home strokeWidth={1.5} />
              Dashboard
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname.startsWith('/sales')}
            onClick={handleLinkClick}
          >
            <Link href="/sales/new" className={navClass(pathname.startsWith('/sales'))}>
              <ShoppingCart strokeWidth={1.5} />
              Vendas
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname.startsWith('/purchases')}
            onClick={handleLinkClick}
          >
            <Link href="/purchases/new" className={navClass(pathname.startsWith('/purchases'))}>
              <Truck strokeWidth={1.5} />
              Compras
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/transactions'}
            onClick={handleLinkClick}
          >
            <Link href="/transactions" className={navClass(pathname === '/transactions')}>
              <Wallet strokeWidth={1.5} />
              Movimentações
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/clients'}
            onClick={handleLinkClick}
          >
            <Link href="/clients" className={navClass(pathname === '/clients')}>
              <Users />
              Clientes
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/suppliers'}
            onClick={handleLinkClick}
          >
            <Link href="/suppliers" className={navClass(pathname === '/suppliers')}>
              <Boxes />
              Fornecedores
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarFooter className="mt-auto">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar className="ring-2 ring-emerald-600/15">
              <AvatarFallback className="bg-gray-900 text-white">CM</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">user@local.com</div>
          </div>
          <SidebarMenuButton className="hover:text-emerald-700" onClick={handleSignOut}>
            <LogOut />
            Sair
          </SidebarMenuButton>
        </div>
        <SidebarMenu className="mt-3">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/help'}
              onClick={handleLinkClick}
            >
              <Link href="/help" className={navClass(pathname === '/help')}>
                <CircleHelp strokeWidth={1.5} />
                Ajuda
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/settings'}
              onClick={handleLinkClick}
            >
              <Link href="/settings" className={navClass(pathname === '/settings')}>
                <Settings strokeWidth={1.5} />
                Configurações
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
