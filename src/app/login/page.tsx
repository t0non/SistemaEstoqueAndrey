'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  doc,
  setDoc,
} from '@/firebase';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
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
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z
    .string()
    .min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erro de Autenticação',
        description: 'Serviço de autenticação não disponível.',
      });
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            values.email,
            values.password
          );

          if (userCredential.user && firestore) {
            const userProfileData = {
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              displayName: userCredential.user.displayName || '',
            };
            await setDoc(doc(firestore, 'user_profiles', userCredential.user.uid), userProfileData);
          }

          router.push('/');
        } catch (creationError: any) {
          if (creationError.code === 'auth/email-already-in-use') {
            toast({
              variant: 'destructive',
              title: 'Erro de Login',
              description: 'A senha está incorreta. Por favor, tente novamente.',
            });
          } else {
            let description = 'Não foi possível criar a conta. Tente novamente.';
            switch (creationError.code) {
              case 'auth/weak-password':
                description =
                  'A senha é muito fraca. Use pelo menos 6 caracteres.';
                break;
              default:
                description =
                  creationError.message ||
                  'Não foi possível criar a conta. Tente novamente.';
            }
            toast({
              variant: 'destructive',
              title: 'Erro no Cadastro',
              description,
            });
          }
        }
      } else {
        let description = 'Email ou senha inválidos. Tente novamente.';
        switch (error.code) {
          case 'auth/invalid-email':
            description = 'O formato do email é inválido.';
            break;
          case 'auth/too-many-requests':
            description =
              'Muitas tentativas de login. Bloqueamos temporariamente este dispositivo por atividade incomum. Tente novamente mais tarde.';
            break;
          default:
            description =
              error.message || 'Email ou senha inválidos. Tente novamente.';
        }
        toast({
          variant: 'destructive',
          title: 'Erro de Login',
          description,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erro de Autenticação',
        description: 'Serviço de autenticação não disponível.',
      });
      return;
    }

    if (!z.string().email().safeParse(resetEmail).success) {
      toast({
        variant: 'destructive',
        title: 'Email inválido',
        description: 'Por favor, insira um email válido para redefinir a senha.',
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({
        title: 'Email de redefinição enviado',
        description: `Verifique sua caixa de entrada em ${resetEmail}.`,
      });
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar email',
        description: 'Não foi possível enviar o email de redefinição. Verifique o email e tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="flex min-h-[100svh] w-full items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center">
            <Package className="h-10 w-10 text-blue-600" />
            <h1 className="mt-4 text-3xl font-bold text-slate-800">ControlMax</h1>
            <p className="text-slate-500">
              Acesse ou crie sua conta para continuar
            </p>
          </div>
          <div className="rounded-lg border bg-white p-8 shadow-sm">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="seu@email.com"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="text-right text-sm">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-medium text-blue-600"
                    onClick={() => {
                      setResetEmail(form.getValues('email'));
                      setIsResetDialogOpen(true);
                    }}
                  >
                    Esqueceu a senha?
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Carregando...' : 'Entrar ou Cadastrar'}
                </Button>
              </form>
            </Form>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Ao entrar, você será cadastrado se não tiver uma conta.
          </p>
        </div>
      </div>

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir sua senha</AlertDialogTitle>
            <AlertDialogDescription>
              Digite seu email e enviaremos um link para você voltar à sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              placeholder="seu@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordReset} disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar link de redefinição'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
