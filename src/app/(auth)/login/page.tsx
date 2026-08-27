'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { CreateUserModal } from '@/components/profile/CreateUserModal';
import { Profile } from '@/types/database';
import { Mail, Lock, Sparkles, ArrowRight, UserPlus, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isDemoModeAllowed } from '@/lib/authConfig';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/dashboard';
  const { setCurrentUser, availableUsers, isCurrentUserAdmin } = usePachas();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const isDemoAllowed = isDemoModeAllowed();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Try unified PostgreSQL auth API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const resData = await res.json();

      if (res.ok && resData.user) {
        setCurrentUser(resData.user);
        router.replace(redirectTo);
        return;
      }

      // If API returned error and demo mode is permitted, check local availableUsers
      if (isDemoAllowed) {
        const found = availableUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (found) {
          setCurrentUser(found);
          router.replace(redirectTo);
          return;
        }
      }

      setError(resData.error || 'Credenciales no válidas. Introduce un correo y contraseña registrados.');
    } catch (err: any) {
      setError(err.message || 'Error de conexión al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };


  const handleQuickDemoSelect = (user: Profile) => {
    if (!isDemoAllowed) {
      setError('El inicio de sesión con usuarios de prueba está deshabilitado en modo producción.');
      return;
    }
    setCurrentUser(user);
    router.replace(redirectTo);
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-md">
              💸
            </div>
            <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">
              Pachas
            </span>
          </Link>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Iniciar Sesión
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Accede a tus grupos de vacaciones y gastos compartidos
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          <Button type="submit" variant="brand" className="w-full py-3" isLoading={isLoading}>
            Entrar a Pachas
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        {/* Local Fast Access & User Creation (Visible only in Development/Demo Mode) */}
        {isDemoAllowed && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                Usuarios de prueba ({availableUsers.length}):
              </span>
              {isCurrentUserAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Crear usuario
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {availableUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickDemoSelect(u)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2 text-left transition-all text-xs"
                >
                  <Avatar profile={u} size="sm" />
                  <div className="truncate min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {u.full_name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate block">{u.email}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer link */}
        <p className="text-center text-xs text-slate-500 mt-6">
          ¿No tienes cuenta aún?{' '}
          <Link href="/register" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onSuccess={(created) => {
          handleQuickDemoSelect(created);
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}

