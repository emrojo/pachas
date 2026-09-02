'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';

import { PwaRegistrar } from '@/components/pwa/PwaRegistrar';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { SupportChatModal } from '@/components/support/SupportChatModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LogOut, MessageSquare } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    isLoading,
    logout,
    isSupportModalOpen,
    supportInitialCategory,
    openSupportModal,
    closeSupportModal,
  } = usePachas();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !currentUser) {
      const justLoggedOut = sessionStorage.getItem('justLoggedOut') === 'true';
      if (justLoggedOut) {
        sessionStorage.removeItem('justLoggedOut');
        router.replace('/');
      } else {
        if (pathname !== '/' && pathname !== '') {
          const validPath =
            pathname && !pathname.startsWith('/login') && !pathname.startsWith('/register')
              ? pathname
              : '/dashboard';
          const returnUrl = encodeURIComponent(validPath);
          router.replace(`/login?redirectTo=${returnUrl}`);
        } else {
          router.replace('/');
        }
      }
    }
  }, [currentUser, isLoading, router, pathname]);

  // If user is banned, immediately redirect to isolated /suspended route
  useEffect(() => {
    if (!isLoading && currentUser?.is_banned) {
      router.replace('/suspended');
    }
  }, [currentUser, isLoading, router]);

  if (currentUser?.is_banned) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white text-2xl animate-pulse shadow-lg mb-4">
          🚫
        </div>
        <span className="text-xs font-semibold text-slate-400">Redirigiendo a zona de moderación...</span>
      </div>
    );
  }

  // If currentUser is present, render immediately without blocking on background fetching
  if (currentUser) {
    return (
      <>
        <PwaRegistrar />
        <OfflineBanner />
        {children}
        <SupportChatModal
          isOpen={isSupportModalOpen}
          onClose={closeSupportModal}
          initialCategory={supportInitialCategory}
        />
      </>
    );
  }

  if (isLoading) {
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
