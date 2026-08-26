'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = usePachas();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !currentUser) {
      const returnUrl = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?redirectTo=${returnUrl}`);
    }
  }, [currentUser, isLoading, router, pathname]);

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl animate-pulse shadow-lg shadow-emerald-500/25 mb-4">
          💸
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs font-semibold text-slate-400 mt-3">Comprobando sesión...</span>
      </div>
    );
  }

  return <>{children}</>;
}
