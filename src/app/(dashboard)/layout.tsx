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
      const validPath =
        pathname && !pathname.startsWith('/login') && !pathname.startsWith('/register')
          ? pathname
          : '/dashboard';
      const returnUrl = encodeURIComponent(validPath);
      router.replace(`/login?redirectTo=${returnUrl}`);
    }
  }, [currentUser, isLoading, router, pathname]);

  // If user is banned, render lockout screen with appeal chat
  if (currentUser?.is_banned) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6">
        <main className="flex-1 flex items-center justify-center">
          <Card className="text-center p-8 max-w-lg w-full bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60 shadow-xl rounded-3xl space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto text-3xl shadow-xs">
              🚫
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold px-3 py-1 rounded-full text-xs">
                Cuenta Suspendida
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white pt-2">
                Acceso restringido por moderación
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto pt-1">
                {currentUser.ban_reason || 'Tu cuenta ha sido temporalmente suspendida debido a un reporte o infracción de las normas de convivencia.'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs text-left space-y-1">
              <span className="font-bold block text-slate-700 dark:text-slate-300">
                ⚖️ Derecho a Aclaración y Apelación:
              </span>
              <span>
                Puedes ponerte en contacto directo con el administrador a través del canal de chat oficial para solicitar aclaraciones o recurrir la decisión.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                variant="brand"
                onClick={() => openSupportModal('appeal')}
                className="w-full sm:w-auto font-bold gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Contactar con el Administrador</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => logout()}
                className="w-full sm:w-auto font-semibold text-slate-600 dark:text-slate-300"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                <span>Cerrar sesión</span>
              </Button>
            </div>
          </Card>
        </main>
        <SupportChatModal
          isOpen={isSupportModalOpen}
          onClose={closeSupportModal}
          initialCategory={supportInitialCategory || 'appeal'}
        />
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
