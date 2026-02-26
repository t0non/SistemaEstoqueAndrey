'use client';

import { useState, useMemo } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError,
  doc,
  deleteDoc,
  query,
  collection,
  where,
} from '@/firebase';
import type { Client } from '@/lib/types';
import {
  PlusCircle,
  MoreVertical,
  Trash2,
  Pencil,
  Phone,
  Mail,
  Users,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ClientDialog } from '@/components/clients/client-dialog';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

// Client Actions Component (Edit/Delete)
function ClientActions({ client }: { client: Client }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleDelete = async () => {
    if (!firestore) return;
    const docRef = doc(firestore, 'clients', client.id);
    try {
      await deleteDoc(docRef);
      toast({
        title: 'Cliente excluído!',
        description: `"${client.name}" foi removido da sua lista.`,
      });
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o cliente. Tente novamente.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => {
              setTimeout(() => setIsEditDialogOpen(true), 100);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600"
            onSelect={() => {
              setTimeout(() => setIsDeleteDialogOpen(true), 100);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        client={client}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o
              cliente "{client.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Client Card Component
function ClientCard({ client }: { client: Client }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl">{client.name}</CardTitle>
          <CardDescription>{client.document || 'Documento não informado'}</CardDescription>
        </div>
        <ClientActions client={client} />
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        {client.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span>{client.phone}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Page Content
function ClientsDashboard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  const clientsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'clients'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]
  );

  const { data: clientsFromHook, isLoading } = useCollection<Client>(clientsQuery);

  const clients = useMemo(() => {
    if (!clientsFromHook) return [];
    return [...clientsFromHook].sort((a, b) => a.name.localeCompare(b.name));
  }, [clientsFromHook]);

  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Clientes
            </h1>
            <p className="text-slate-500">
              Gerencie sua carteira de clientes.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-4/5" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : clients && clients.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-white py-20">
            <div className="flex flex-col items-center gap-2 text-center">
              <Users className="h-16 w-16 text-slate-300" />
              <h3 className="text-xl font-bold tracking-tight text-slate-800">
                Nenhum cliente cadastrado
              </h3>
              <p className="text-sm text-muted-foreground">
                Adicione seu primeiro cliente para começar a registrar vendas.
              </p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Cliente
              </Button>
            </div>
          </div>
        )}
      </main>
      <ClientDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </DashboardLayout>
  );
}

export default function ClientsPage() {
  return (
    <AuthGuard>
      <ClientsDashboard />
    </AuthGuard>
  );
}
