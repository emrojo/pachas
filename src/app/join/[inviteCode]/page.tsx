'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney } from '@/lib/currencies';
import { Sparkles, Users, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params?.inviteCode as string;

  const { groups, joinGroup, currentUser, getGroupMembers } = usePachas();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Find target group by invite code
  const targetGroup = groups.find(
    (g) => g.invite_code.toLowerCase() === inviteCode?.toLowerCase()
  );

  const members = targetGroup ? getGroupMembers(targetGroup.id) : [];

  const handleJoinGroup = async () => {
    if (!currentUser) {
      router.push(`/login?redirectTo=/join/${inviteCode}`);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const group = await joinGroup(inviteCode);
      if (group) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push(`/groups/${group.id}`);
        }, 1500);
      } else {
        setError('No se pudo unir al grupo. El enlace puede haber caducado.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al unirse al grupo');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/25 mx-auto mb-2">
            💸
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Pachas
          </h2>
        </div>

        <Card className="p-6 sm:p-8 text-center space-y-6">
          {targetGroup ? (
            <>
              {/* Trip info */}
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-5xl mx-auto shadow-xs">
                  {targetGroup.icon_emoji}
                </div>
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Invitación a Viaje
                </span>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  {targetGroup.name}
                </h1>
                {targetGroup.description && (
                  <p className="text-xs text-slate-500">{targetGroup.description}</p>
                )}
              </div>

              {/* Members participating */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 block mb-2">
                  Amigos ya en este grupo ({members.length}):
                </span>
                <div className="flex items-center justify-center -space-x-2">
                  {members.map((m) => (
                    <Avatar
                      key={m.id}
                      profile={m.profile}
                      size="sm"
                      className="ring-2 ring-white dark:ring-slate-900"
                    />
                  ))}
                </div>
              </div>

              {/* Current user confirmation */}
              {currentUser && (
                <div className="text-xs text-slate-500">
                  Te unirás con tu cuenta:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {currentUser.full_name} ({currentUser.email})
                  </strong>
                </div>
              )}


              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                  {error}
                </div>
              )}

              {/* Join Button */}
              <div>
                {isSuccess ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ¡Te has unido con éxito! Redirigiendo...
                  </div>
                ) : currentUser ? (
                  <Button
                    size="lg"
                    variant="brand"
                    onClick={handleJoinGroup}
                    isLoading={isLoading}
                    className="w-full shadow-md"
                  >
                    Unirme al Grupo de Gastos
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Link href={`/login?redirectTo=/join/${inviteCode}`} className="block w-full">
                    <Button size="lg" variant="brand" className="w-full shadow-md">
                      Iniciar Sesión para Unirme
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>

            </>
          ) : (
            <div className="space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Código de invitación no válido
              </h3>
              <p className="text-xs text-slate-500">
                El código "{inviteCode}" no corresponde a ningún grupo de viaje activo.
              </p>
              <Link href="/dashboard">
                <Button variant="brand" className="w-full">
                  Ir al Panel de Grupos
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
