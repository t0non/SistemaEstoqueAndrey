'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
  doc,
  updateDoc,
} from '@/firebase';
import type { Company } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { IMaskInput } from 'react-imask';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
const cepRegex = /^\d{5}-\d{3}$/;

const formSchema = z.object({
  name: z.string().min(2, { message: 'O nome da empresa é obrigatório.' }),
  logoUrl: z.string().url({ message: 'URL do logo inválida.' }).optional().or(z.literal('')),
  cnpj: z.string().refine((val) => cnpjRegex.test(val), { message: 'CNPJ inválido.' }),
  phone: z.string().refine((val) => phoneRegex.test(val), { message: 'Telefone inválido.' }),
  segment: z.string({ required_error: 'Por favor, selecione um segmento.' }),
  cep: z.string().refine((val) => !val || cepRegex.test(val), { message: 'CEP inválido.' }).optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export function SettingsForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isCepLoading, setIsCepLoading] = useState(false);

  const companyDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'companies', user.uid) : null),
    [user, firestore]
  );
  const { data: company, isLoading: companyLoading } = useDoc<Company>(companyDocRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      logoUrl: '',
      cnpj: '',
      phone: '',
      segment: 'outros',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        ...company,
        logoUrl: company.logoUrl || '',
        cep: company.cep || '',
        street: company.street || '',
        number: company.number || '',
        complement: company.complement || '',
        neighborhood: company.neighborhood || '',
        city: company.city || '',
        state: company.state || '',
      });
    }
  }, [company, form]);

  const handleCepSearch = async (cep: string) => {
    const cleanCEP = cep?.replace(/\D/g, '');
    if (cleanCEP?.length !== 8) {
      return;
    }
    setIsCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue('street', data.logradouro);
        form.setValue('neighborhood', data.bairro);
        form.setValue('city', data.localidade);
        form.setValue('state', data.uf);
        form.setFocus('number');
      } else {
        toast({ variant: 'destructive', title: 'CEP não encontrado' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao buscar CEP' });
    } finally {
      setIsCepLoading(false);
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!companyDocRef) return;
    updateDoc(companyDocRef, values)
      .then(() => {
        toast({
          title: 'Configurações Salvas!',
          description: 'Os dados da sua empresa foram atualizados.',
        });
      })
      .catch((err) => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: companyDocRef.path,
            operation: 'update',
            requestResourceData: values,
          })
        );
      });
  }

  if (companyLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
            <CardDescription>
              Informações que serão usadas em recibos e documentos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Sua Empresa LTDA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="logoUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Logo</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <IMaskInput mask="00.000.000/0000-00" value={field.value} onAccept={(value: any) => field.onChange(value)} onBlur={field.onBlur} inputRef={field.ref} as={Input as any} placeholder="00.000.000/0000-00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp</FormLabel>
                  <FormControl>
                    <IMaskInput mask="(00) 00000-0000" value={field.value} onAccept={(value: any) => field.onChange(value)} onBlur={field.onBlur} inputRef={field.ref} as={Input as any} placeholder="(00) 00000-0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="segment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o segmento" />
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
              )} />
            </div>

            <Separator />
            <h3 className="text-lg font-medium">Endereço</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <FormField control={form.control} name="cep" render={({ field }) => (
                <FormItem className="md:col-span-1">
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                     <div className="relative">
                      <IMaskInput mask="00000-000" value={field.value ?? ''} onAccept={(value: any) => { field.onChange(value); handleCepSearch(value); }} onBlur={field.onBlur} inputRef={field.ref} as={Input as any} placeholder="00000-000" />
                      {isCepLoading && <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="street" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Logradouro</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
             <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
               <FormField control={form.control} name="number" render={({ field }) => (
                <FormItem className="md:col-span-1">
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
                <FormField control={form.control} name="complement" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Complemento</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
             <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
               <FormField control={form.control} name="neighborhood" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
          <div className="flex justify-end p-6 pt-0">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
