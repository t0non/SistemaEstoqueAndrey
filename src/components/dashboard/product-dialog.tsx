'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Product, Supplier } from '@/lib/types';
import {
  useFirestore,
  errorEmitter,
  FirestorePermissionError,
  useUser,
  useCollection,
  useMemoFirebase,
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  query,
  where,
  Timestamp,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

interface ProductDialogProps {
  product?: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: (product: Product) => void;
}

const formSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'O nome deve ter pelo menos 2 caracteres.' }),
  sku: z.string().optional(),
  category: z.string().optional(),
  minStock: z.coerce
    .number()
    .min(0, { message: 'O estoque não pode ser negativo.' }),
  maxStock: z.coerce
    .number()
    .min(0, { message: 'O estoque não pode ser negativo.' }),
  observations: z.string().optional(),
  supplierId: z.string().optional(),
});

export function ProductDialog({
  product,
  open,
  onOpenChange,
  onProductCreated,
}: ProductDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const suppliersQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'suppliers'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]
  );
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      minStock: 0,
      maxStock: 0,
      observations: '',
      supplierId: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          ...product,
        });
      } else {
        form.reset({
          name: '',
          sku: '',
          category: '',
          minStock: 0,
          maxStock: 0,
          observations: '',
          supplierId: '',
        });
      }
    }
  }, [product, form, open]);

  const isEditing = !!product;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user) return;

    if (isEditing && product) {
      const productData = { ...values, updatedAt: serverTimestamp() };
      const docRef = doc(firestore, 'products', product.id);
      updateDoc(docRef, productData)
        .then(() => {
          toast({
            title: 'Produto atualizado!',
            description: `O item "${values.name}" foi atualizado com sucesso.`,
          });
        })
        .catch(() => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: productData,
            })
          );
        });
    } else {
      const productData = {
        ...values,
        ownerId: user.uid,
        updatedAt: serverTimestamp(),
        currentStock: 0, // New products start with 0 stock
        costPrice: 0,
      };
      const collRef = collection(firestore, 'products');
      addDoc(collRef, productData)
        .then((docRef) => {
          updateDoc(docRef, { id: docRef.id });
          toast({
            title: 'Produto adicionado!',
            description: `O item "${values.name}" foi criado com sucesso.`,
          });
          if (onProductCreated) {
            const newProductForCallback: Product = {
              ...{
                name: '',
                sku: '',
                category: '',
                minStock: 0,
                maxStock: 0,
                observations: '',
                supplierId: '',
              },
              ...values,
              id: docRef.id,
              ownerId: user.uid,
              currentStock: 0,
              costPrice: 0,
              updatedAt: Timestamp.now(),
            };
            onProductCreated(newProductForCallback);
          }
        })
        .catch(() => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: collRef.path,
              operation: 'create',
              requestResourceData: productData,
            })
          );
        });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Item' : 'Adicionar Novo Item'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Faça alterações no seu produto aqui. Clique em salvar quando terminar.'
              : 'Preencha os detalhes do novo produto. O estoque inicial será 0.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Parafuso Sextavado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU / Código do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: PAR-SEX-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Fixadores" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor Padrão</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Máximo</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Qualquer informação adicional..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
