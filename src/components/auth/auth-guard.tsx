'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase, doc } from '@/firebase';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { TrialAnimation } from '@/components/onboarding/trial-animation';
import { Skeleton } from '@/components/ui/skeleton';

function FullPageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="w-full max-w-4xl space-y-8 p-4">
        <Skeleton className="h-16 w-1/4" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const companyDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'companies', user.uid) : null),
    [user, firestore]
  );
  const { data: company, isLoading: companyLoading } = useDoc(companyDocRef);

  const [status, setStatus] = useState<
    'loading' | 'onboarding' | 'animation' | 'ready' | 'redirecting'
  >('loading');

  useEffect(() => {
    if (isUserLoading) {
      setStatus('loading');
      return;
    }

    if (!user) {
      setStatus('redirecting');
      router.push('/login');
      return;
    }

    if (companyLoading) {
      setStatus('loading');
      return;
    }

    if (user && !company) {
      setStatus('onboarding');
    } else if (user && company) {
      setStatus('ready');
    }
  }, [user, isUserLoading, company, companyLoading, router]);

  const handleOnboardingComplete = () => {
    setStatus('animation');
  };

  if (status === 'loading' || status === 'redirecting') {
    return <FullPageLoader />;
  }

  if (status === 'onboarding') {
    return <OnboardingModal onComplete={handleOnboardingComplete} />;
  }

  if (status === 'animation') {
    return <TrialAnimation />;
  }

  if (status === 'ready') {
    return <>{children}</>;
  }

  return <FullPageLoader />;
}
