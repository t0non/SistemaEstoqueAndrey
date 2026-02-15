'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IMaskInput } from 'react-imask';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError,
  doc,
  setDoc,
  serverTimestamp,
} from '@/firebase';

interface OnboardingModalProps {
  onComplete: () => void;
}

const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;

const formSchema = z.object({
  companyName: z
    .string()
    .min(2, { message: 'O nome da empresa é obrigatório.' }),
  cnpj: z.string().refine((val) => cnpjRegex.test(val), {
    message: 'CNPJ inválido.',
  }),
  phone: z.string().refine((val) => phoneRegex.test(val), {
    message: 'Telefone inválido.',
  }),
  segment: z.string({
    required_error: 'Por favor, selecione um segmento.',
  }),
});

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      cnpj: '',
      phone: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Usuário ou banco de dados não encontrado.',
      });
      return;
    }

    const companyData = {
      name: values.companyName,
      cnpj: values.cnpj,
      phone: values.phone,
      segment: values.segment,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    };
    const docRef = doc(firestore, 'companies', user.uid);
    setDoc(docRef, companyData)
      .then(() => {
        onComplete();
      })
      .catch(() => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: companyData,
          })
        );
      });
  }

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Bem-vindo ao ControlMax!</DialogTitle>
          <DialogDescription>
            Faltam apenas alguns detalhes para começar a usar o sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Sua Empresa LTDA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <IMaskInput
                      mask="00.000.000/0000-00"
                      value={field.value}
                      onAccept={(value: any) => {
                        field.onChange(value);
                      }}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      as={Input as any}
                      placeholder="00.000.000/0000-00"
                    />
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
                      onAccept={(value: any) => {
                        field.onChange(value);
                      }}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      as={Input as any}
                      placeholder="(00) 00000-0000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="segment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o segmento do seu negócio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="metalurgica">Metalúrgica</SelectItem>
                      <SelectItem value="varejo">Varejo</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Salvando...'
                  : 'Salvar e Iniciar Teste'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}