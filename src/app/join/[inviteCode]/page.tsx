'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { ArrowRight, CheckCircle2, Bell, Sparkles, AlertCircle } from 'lucide-react';
import { GroupMember } from '@/types/database';
import { subscribeDeviceToPush } from '@/lib/notifications/pushNotificationService';

export default function JoinGroupPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteCode = params?.inviteCode as string;
  const claimToken = searchParams?.get('claim')?.trim() || null;

  const { groups, joinGroup, currentUser, getGroupMembers, claimMember } = usePachas();
  const { t } = useTranslation();

  const [remoteGroup, setRemoteGroup] = useState<any>(null);
  const [remoteMembers, setRemoteMembers] = useState<GroupMember[]>([]);
  const [isFetchingGroup, setIsFetchingGroup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [error, setError] = useState('');

  // Claim specific state
  const [claimStatus, setClaimStatus] = useState<'idle' | 'checking' | 'available' | 'already_claimed' | 'invalid'>('idle');
  const [claimProvisionalName, setClaimProvisionalName] = useState('');
  const [claimedByName, setClaimedByName] = useState('');

  // 1. Check local groups first
  const localGroup = groups.find(
    (g) => g.invite_code.toLowerCase() === inviteCode?.toLowerCase()
  );

  // 2. Fetch group info from API and inspect claim token if present
  useEffect(() => {
    let isMounted = true;
    async function fetchInvite() {
      if (!inviteCode) {
        setIsFetchingGroup(false);
        return;
      }
      try {
        setIsFetchingGroup(true);

        if (claimToken) {
          setClaimStatus('checking');
          try {
            const claimRes = await fetch(`/api/groups/claim?token=${encodeURIComponent(claimToken)}`);
            const claimData = await claimRes.json();
            if (isMounted) {
              if (claimData.valid && claimData.status === 'available') {
                setClaimStatus('available');
                setClaimProvisionalName(claimData.member?.provisional_name || 'Amigo');
                if (claimData.group) setRemoteGroup(claimData.group);
              } else if (claimData.status === 'already_claimed') {
                setClaimStatus('already_claimed');
                setClaimProvisionalName(claimData.provisional_name || 'Amigo');
                setClaimedByName(claimData.claimed_by_name || 'otro usuario');
                if (claimData.group) setRemoteGroup(claimData.group);
              } else {
                setClaimStatus('invalid');
              }
            }
          } catch (cErr) {
            console.warn('Could not inspect claim token:', cErr);
            if (isMounted) setClaimStatus('invalid');
          }
        }

        const res = await fetch(`/api/groups/invite/${encodeURIComponent(inviteCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.group && isMounted) {
            setRemoteGroup(data.group);
            setRemoteMembers(data.members || []);
          }
        }
      } catch (err) {
        console.warn('Could not fetch invite:', err);
      } finally {
        if (isMounted) setIsFetchingGroup(false);
      }
    }

    fetchInvite();
    return () => {
      isMounted = false;
    };
  }, [inviteCode, claimToken]);

  const targetGroup = localGroup || remoteGroup;
  const members = localGroup ? getGroupMembers(localGroup.id) : remoteMembers;

  const handleJoinGroup = async () => {
    if (!currentUser) {
      const emailParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('email') : null;
      let targetUrl = `/join/${inviteCode}`;
      const qParams: string[] = [];
      if (claimToken) qParams.push(`claim=${encodeURIComponent(claimToken)}`);
      if (emailParam) qParams.push(`email=${encodeURIComponent(emailParam)}`);
      if (qParams.length > 0) targetUrl += `?${qParams.join('&')}`;

      router.push(`/login?redirectTo=${encodeURIComponent(targetUrl)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`);
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      if (enableNotifications) {
        await subscribeDeviceToPush();
      }

      // If claiming a provisional member
      if (claimToken && claimStatus === 'available') {
        const claimResult = await claimMember(claimToken, enableNotifications);
        if (claimResult.success) {
          setIsSuccess(true);
          setTimeout(() => {
            router.push(`/groups/${claimResult.groupId}`);
          }, 1200);
          return;
        }
      }

      // Normal group join
      const group = await joinGroup(inviteCode, enableNotifications);
      if (group) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push(`/groups/${group.id}`);
        }, 1200);
      } else {
        setError(t('join.errorJoining'));
      }
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      {/* Top Header with Brand and Language Selector */}
      <header className="w-full max-w-7xl mx-auto p-4 sm:p-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-md shadow-emerald-500/20">
            💸
          </div>
          <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">
            Pachas
          </span>
        </Link>
        <LanguageSelector />
      </header>

      {/* Main Centered Invitation Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <Card className="p-6 sm:p-8 text-center space-y-6">
          {isFetchingGroup && !targetGroup ? (
            <div className="py-12 space-y-3">
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">{t('join.searching')}</p>
            </div>
          ) : targetGroup ? (
            <>
              {/* Trip info */}
              <div className="space-y-2">
                <div className="w-24 h-24 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center mx-auto shadow-xs overflow-hidden">
                  {targetGroup.cover_image_url ? (
                    <img src={targetGroup.cover_image_url} alt={targetGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {targetGroup.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  {t('join.title')}
                </span>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  {targetGroup.name}
                </h1>
                {targetGroup.description && (
                  <p className="text-xs text-slate-500">{targetGroup.description}</p>
                )}
              </div>

              {/* Claim Notice Banner */}
              {claimStatus === 'already_claimed' && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-left space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('join.claimAlreadyUsedTitle') || 'Enlace único ya utilizado'}</span>
                  </div>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                    {t('join.claimAlreadyUsedDesc', { name: claimProvisionalName, claimedBy: claimedByName }) ||
                      `El puesto provisional de "${claimProvisionalName}" ya fue reclamado por ${claimedByName}. Cada enlace solo permite un único reclamo.`}
                  </p>
                </div>
              )}

              {claimStatus === 'available' && (
                <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 text-left space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t('join.claimSlotTitle') || '¡Puesto pre-asignado para ti!'}</span>
                  </div>
                  <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
                    {t('join.claimSlotDesc', { name: claimProvisionalName }) ||
                      `Has sido invitado para reclamar el puesto de "${claimProvisionalName}". Al unirte, todos sus gastos asignados pasarán directamente a tu cuenta.`}
                  </p>
                </div>
              )}

              {/* Members participating */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 block mb-2">
                  {t('join.friendsInGroup', { count: members.length })}
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

              {/* Current user confirmation & notifications opt-in */}
              {currentUser && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    {t('join.joinWithAccount', { name: currentUser.full_name, email: currentUser.email })}
                  </div>

                  <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 cursor-pointer text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={enableNotifications}
                      onChange={(e) => setEnableNotifications(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{t('notifications.enableOnJoin') || 'Activar notificaciones para este grupo'}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {t('notifications.enableOnJoinHint') || 'Recibe avisos cuando se registren nuevos gastos o liquidaciones.'}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                  {error}
                </div>
              )}

              {/* Join / Claim Button */}
              <div>
                {isSuccess ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {claimStatus === 'available'
                      ? (t('join.claimedSuccess') || '¡Puesto reclamado y unido con éxito!')
                      : t('join.joinedSuccess')}
                  </div>
                ) : currentUser ? (
                  <Button
                    size="lg"
                    variant="brand"
                    onClick={handleJoinGroup}
                    isLoading={isLoading}
                    className="w-full shadow-md"
                  >
                    {claimStatus === 'available'
                      ? (t('join.claimAndJoinBtn', { name: claimProvisionalName }) || `Reclamar puesto de ${claimProvisionalName}`)
                      : t('join.joinGroupBtn')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Link
                    href={`/login?redirectTo=${encodeURIComponent(
                      `/join/${inviteCode}${claimToken ? `?claim=${claimToken}` : ''}`
                    )}`}
                    className="block w-full"
                  >
                    <Button size="lg" variant="brand" className="w-full shadow-md">
                      {claimStatus === 'available'
                        ? (t('join.loginToClaim', { name: claimProvisionalName }) || `Inicia sesión para reclamar el puesto de ${claimProvisionalName}`)
                        : t('join.loginToJoin')}
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
                {t('join.invalidCodeTitle')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('join.invalidCodeDesc', { code: inviteCode })}
              </p>
              <Link href="/dashboard">
                <Button variant="brand" className="w-full">
                  {t('join.goToDashboard')}
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </main>

      <Footer showDonations={false} />
    </div>
  );
}

