'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IMaskInput } from 'react-imask';

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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useUser,
  errorEmitter,
  FirestorePermissionError,
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from '@/firebase';
import type { Client } from '@/lib/types';

const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;

const clientFormSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'O nome do cliente deve ter pelo menos 3 caracteres.' }),
  document: z.string().optional(),
  phone: z.string().refine((val) => !val || phoneRegex.test(val), {
    message: 'Telefone inválido.',
  }).optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
});

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  onClientCreated?: (client: Client) => void;
}

export function ClientDialog({
  open,
  onOpenChange,
  client,
  onClientCreated
}: ClientDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: '',
      document: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (client) {
        form.reset(client);
      } else {
        form.reset({
          name: '',
          document: '',
          phone: '',
          email: '',
        });
      }
    }
  }, [client, form, open]);

  const isEditing = !!client;

  const onSubmit = (values: z.infer<typeof clientFormSchema>) => {
    if (!firestore || !user) return;

    const clientData = {
      ...values,
      ownerId: user.uid,
    };

    if (isEditing) {
      const docRef = doc(firestore, 'clients', client.id);
      updateDoc(docRef, { ...values, updatedAt: serverTimestamp() })
        .then(() => {
          toast({
            title: 'Cliente atualizado!',
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
      const collRef = collection(firestore, 'clients');
      addDoc(collRef, clientData)
        .then((docRef) => {
          const newClient = { ...clientData, id: docRef.id };
          updateDoc(docRef, { id: docRef.id });
          toast({
            title: 'Cliente adicionado!',
            description: `"${values.name}" agora faz parte da sua lista.`,
          });
          onClientCreated?.(newClient);
        })
        .catch(() => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: collRef.path,
              operation: 'create',
              requestResourceData: clientData,
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
          <SheetTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Atualize os dados do cliente.'
              : 'Adicione um novo cliente à sua base.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo / Razão Social</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF / CNPJ (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="00.000.000/0000-00" {...field} />
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
                  <FormLabel>Telefone / WhatsApp (Opcional)</FormLabel>
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
                  <FormLabel>Email (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="joao@email.com" {...field} />
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
