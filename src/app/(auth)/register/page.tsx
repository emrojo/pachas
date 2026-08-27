'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/dashboard';
  const { setCurrentUser } = usePachas();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Por favor introduce tu nombre completo');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // 1. Try unified PostgreSQL auth API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        // If API returned error, show error message
        setError(resData.error || 'Error al registrarte');
        return;
      }

      if (resData.user) {
        setCurrentUser(resData.user);
        router.replace(redirectTo);
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión al registrarte');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
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
            Crear Cuenta
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Únete a Pachas para compartir gastos en todos tus viajes
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            label="Nombre Completo *"
            placeholder="Ej: Laura Sánchez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="Correo Electrónico *"
            type="email"
            placeholder="laura@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Teléfono para Bizum (Opcional)"
            type="tel"
            placeholder="+34 600 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
          />

          <Input
            label="Contraseña *"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            minLength={6}
          />

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          <Button type="submit" variant="brand" className="w-full py-3" isLoading={isLoading}>
            Completar Registro
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <RegisterFormContent />
    </Suspense>
  );
}

