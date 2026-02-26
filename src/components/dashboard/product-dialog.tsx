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
import { useForm, useFieldArray } from 'react-hook-form';
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
import { useEffect, useState } from 'react';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { PlusCircle, Trash2 } from 'lucide-react';

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
  type: z.enum(['FINAL', 'INSUMO']).default('INSUMO'),
  photoUrl: z.string().optional(),
  minStock: z.coerce
    .number()
    .min(0, { message: 'O estoque não pode ser negativo.' }),
  maxStock: z.coerce
    .number()
    .min(0, { message: 'O estoque não pode ser negativo.' }),
  observations: z.string().optional(),
  supplierId: z.string().optional(),
  bom: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce.number().min(0.0001, { message: 'Quantidade deve ser maior que 0.' }),
      })
    )
    .optional()
    .default([]),
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
      type: 'INSUMO',
      photoUrl: '',
      minStock: 0,
      maxStock: 0,
      observations: '',
      supplierId: '',
      bom: [],
    },
  });

  const { fields: bomFields, append: appendBom, remove: removeBom, update: updateBom } = useFieldArray({
    control: form.control,
    name: 'bom',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          ...product,
          bom: product.bom || [],
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
          bom: [],
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

  const productsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'products'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]
  );
  const { data: allProducts } = useCollection<Product>(productsQuery);
  const productOptions: ComboboxOption[] =
    allProducts
      ?.filter((p) => {
        if (product && p.id === product.id) return false;
        return p.type === 'INSUMO' || !p.type;
      })
      .map((p) => ({
        value: p.id,
        label: `${p.name} ${p.sku ? `(${p.sku})` : ''}`,
      })) || [];

  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);
  const [newCompName, setNewCompName] = useState<string>('');
  const [newCompSku, setNewCompSku] = useState<string>('');

  const handleStartCreate = (index: number) => {
    setCreatingIndex(index);
    setNewCompName('');
    setNewCompSku('');
  };

  const handleSaveNewComponent = async (index: number) => {
    if (!firestore || !user) return;
    if (!newCompName.trim()) return;
    const productData = {
      name: newCompName.trim(),
      sku: newCompSku.trim() || '',
      type: 'INSUMO',
      ownerId: user.uid,
      updatedAt: serverTimestamp(),
      currentStock: 0,
      costPrice: 0,
      minStock: 0,
      maxStock: 0,
      category: '',
      observations: '',
    };
    const collRef = collection(firestore, 'products');
    const docRef = await addDoc(collRef, productData);
    await updateDoc(docRef, { id: docRef.id });
    form.setValue(`bom.${index}.productId`, docRef.id, { shouldDirty: true, shouldTouch: true });
    toast({
      title: 'Insumo criado',
      description: `O insumo "${productData.name}" foi adicionado.`,
    });
    setCreatingIndex(null);
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
              name="photoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Foto do Produto</FormLabel>
                  <div className="flex items-center gap-3">
                    {field.value ? (
                      <img src={field.value} alt="Foto" className="h-12 w-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-slate-200 border" />
                    )}
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = String(reader.result || '');
                            form.setValue('photoUrl', dataUrl, { shouldDirty: true });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Produto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INSUMO">Insumo</SelectItem>
                      <SelectItem value="FINAL">Final</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? 'Ocultar avançado' : 'Mostrar avançado'}
              </Button>
            </div>
            {showAdvanced && (
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
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value === 0 ? '' : field.value}
                        placeholder="0"
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
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
                      <Input
                        type="number"
                        value={field.value === 0 ? '' : field.value}
                        placeholder="0"
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {showAdvanced && (
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
            )}
            {form.watch('type') === 'FINAL' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Ficha Técnica (Insumos)</FormLabel>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendBom({ productId: '', quantity: 1 })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Adicionar Insumo
                </Button>
              </div>
              <div className="space-y-2">
                {bomFields.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhum insumo adicionado.</p>
                )}
                {bomFields.map((field, index) => {
                  const currentProductId = (form.watch(`bom.${index}.productId`) as string) || '';
                  const currentQty = (form.watch(`bom.${index}.quantity`) as number) || 1;
                  return (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-8">
                        <Select
                          value={currentProductId}
                          onValueChange={(value) =>
                            form.setValue(`bom.${index}.productId`, value, { shouldDirty: true, shouldTouch: true })
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 bg-slate-50 focus:ring-2 focus:ring-neutral-300 focus:border-transparent">
                              <SelectValue placeholder="Selecione o insumo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartCreate(index)}
                          >
                            Novo insumo
                          </Button>
                        </div>
                        {creatingIndex === index && (
                          <div className="mt-2 grid grid-cols-12 gap-2">
                            <div className="col-span-6">
                              <Input
                                placeholder="Nome do insumo"
                                value={newCompName}
                                onChange={(e) => setNewCompName(e.target.value)}
                              />
                            </div>
                            <div className="col-span-4">
                              <Input
                                placeholder="SKU (opcional)"
                                value={newCompSku}
                                onChange={(e) => setNewCompSku(e.target.value)}
                              />
                            </div>
                            <div className="col-span-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveNewComponent(index)}
                                disabled={!newCompName.trim()}
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          min={0.0001}
                          step="0.0001"
                          value={currentQty}
                          className="h-10 w-full text-center bg-slate-50 focus:ring-2 focus:ring-neutral-300 focus:border-transparent"
                          onChange={(e) =>
                            form.setValue(`bom.${index}.quantity`, Number(e.target.value), { shouldDirty: true, shouldTouch: true })
                          }
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBom(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
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
