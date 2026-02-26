'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  doc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  updateDoc,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError,
} from '@/services/hooks';
import type { Supplier } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IMaskInput } from 'react-imask';

import { AuthGuard } from '@/components/auth/auth-guard';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PlusCircle,
  MoreVertical,
  Trash2,
  Pencil,
  Phone,
  MessageCircle,
  Truck,
} from 'lucide-react';
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

// Supplier Dialog/Sheet Component
const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
const supplierFormSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'A razão social deve ter pelo menos 3 caracteres.' }),
  contactName: z
    .string()
    .min(3, { message: 'O nome do contato deve ter pelo menos 3 caracteres.' }),
  phone: z.string().refine((val) => phoneRegex.test(val), {
    message: 'Telefone inválido.',
  }),
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  leadTime: z.coerce
    .number()
    .min(0, { message: 'O tempo de entrega não pode ser negativo.' }),
});

function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof supplierFormSchema>>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: '',
      contactName: '',
      phone: '',
      email: '',
      leadTime: 0,
    },
  });

  useEffect(() => {
    if (open) {
      if (supplier) {
        form.reset(supplier);
      } else {
        form.reset({
          name: '',
          contactName: '',
          phone: '',
          email: '',
          leadTime: 0,
        });
      }
    }
  }, [supplier, form, open]);

  const isEditing = !!supplier;

  const onSubmit = (values: z.infer<typeof supplierFormSchema>) => {
    if (!firestore || !user) return;

    const supplierData = {
      ...values,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    };

    if (isEditing) {
      const docRef = doc(firestore, 'suppliers', supplier.id);
      updateDoc(docRef, { ...values, updatedAt: serverTimestamp() })
        .then(() => {
          toast({
            title: 'Fornecedor atualizado!',
            description: `Os dados de "${values.name}" foram atualizados.`,
          });
        })
        .catch(() => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: values,
            })
          );
        });
    } else {
      const collRef = collection(firestore, 'suppliers');
      addDoc(collRef, supplierData)
        .then((docRef) => {
          updateDoc(docRef, { id: docRef.id });
          toast({
            title: 'Fornecedor adicionado!',
            description: `"${values.name}" agora faz parte da sua lista.`,
          });
        })
        .catch(() => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: collRef.path,
              operation: 'create',
              requestResourceData: supplierData,
            })
          );
        });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Atualize os dados do fornecedor.'
              : 'Adicione um novo parceiro comercial à sua lista.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão Social</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Acme Ferragens" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Contato (Vendedor)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp</FormLabel>
                  <FormControl>
                    <IMaskInput
                      mask="(00) 00000-0000"
                      value={field.value}
                      onAccept={(value: any) => field.onChange(value)}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      as={Input as any}
                      placeholder="(11) 98765-4321"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="joao.silva@acme.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="leadTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo de Entrega (dias)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="pt-4">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </SheetClose>
              <Button type="submit">Salvar</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// Supplier Actions Component (Edit/Delete)
function SupplierActions({ supplier }: { supplier: Supplier }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleDelete = async () => {
    if (!firestore) return;
    const docRef = doc(firestore, 'suppliers', supplier.id);
    try {
      await deleteDoc(docRef);
      toast({
        title: 'Fornecedor excluído!',
        description: `"${supplier.name}" foi removido da sua lista.`,
      });
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o fornecedor. Tente novamente.',
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

      <SupplierDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        supplier={supplier}
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
              fornecedor "{supplier.name}".
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

// Supplier Card Component
function SupplierCard({ supplier }: { supplier: Supplier }) {
  const cleanPhone = (phone: string) => phone.replace(/\D/g, '');

  const whatsappLink = useMemo(() => {
    const phone = cleanPhone(supplier.phone);
    // Assuming Brazilian numbers, add country code 55
    return `https://wa.me/55${phone}`;
  }, [supplier.phone]);

  const telLink = useMemo(() => {
    const phone = cleanPhone(supplier.phone);
    return `tel:${phone}`;
  }, [supplier.phone]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl">{supplier.name}</CardTitle>
          <CardDescription>{supplier.contactName}</CardDescription>
        </div>
        <SupplierActions supplier={supplier} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p>
            <strong>Email:</strong> {supplier.email}
          </p>
          <p>
            <strong>Telefone:</strong> {supplier.phone}
          </p>
          <p>
            <strong>Prazo de Entrega:</strong> {supplier.leadTime} dias
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={telLink}>
              <Phone className="mr-2 h-4 w-4" />
              Ligar
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Page Content
function SuppliersDashboard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  const suppliersQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'suppliers'),
            where('ownerId', '==', user.uid)
          )
        : null,
    [firestore, user]
  );

  const { data: suppliersFromHook, isLoading } =
    useCollection<Supplier>(suppliersQuery);

  const suppliers = useMemo(() => {
    if (!suppliersFromHook) return [];
    // Sort data on the client-side
    return [...suppliersFromHook].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliersFromHook]);

  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Fornecedores
            </h1>
            <p className="text-slate-500">
              Gerencie seus parceiros e contatos comerciais.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Fornecedor
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
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-white py-20">
            <div className="flex flex-col items-center gap-2 text-center">
              <Truck className="h-16 w-16 text-slate-300" />
              <h3 className="text-xl font-bold tracking-tight text-slate-800">
                Nenhum fornecedor cadastrado
              </h3>
              <p className="text-sm text-muted-foreground">
                Adicione seu primeiro fornecedor para começar a registrar compras.
              </p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Fornecedor
              </Button>
            </div>
          </div>
        )}
      </main>
      <SupplierDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </DashboardLayout>
  );
}

export default function SuppliersPage() {
  return (
    <AuthGuard>
      <SuppliersDashboard />
    </AuthGuard>
  );
}
