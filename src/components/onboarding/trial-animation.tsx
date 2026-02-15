'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export function TrialAnimation() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const checkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { type: 'spring', duration: 1, bounce: 0 },
        opacity: { duration: 0.01 },
      },
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="mx-auto h-24 w-24 stroke-green-400"
          strokeWidth="1.5"
          fill="none"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            variants={checkVariants}
            initial="hidden"
            animate="visible"
          />
        </motion.svg>
        <h2 className="mt-6 text-2xl font-bold text-white">
          Tudo pronto!
        </h2>
        <p className="mt-2 text-lg text-slate-300">
          Seu teste grátis de 14 dias começou.
        </p>
      </motion.div>
    </div>
  );
}
