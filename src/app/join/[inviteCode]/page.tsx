'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { ArrowRight, CheckCircle2, Bell } from 'lucide-react';
import { GroupMember } from '@/types/database';
import { subscribeDeviceToPush } from '@/lib/notifications/pushNotificationService';

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params?.inviteCode as string;

  const { groups, joinGroup, currentUser, getGroupMembers } = usePachas();
  const { t } = useTranslation();

  const [remoteGroup, setRemoteGroup] = useState<any>(null);
  const [remoteMembers, setRemoteMembers] = useState<GroupMember[]>([]);
  const [isFetchingGroup, setIsFetchingGroup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [error, setError] = useState('');

  // 1. Check local groups first
  const localGroup = groups.find(
    (g) => g.invite_code.toLowerCase() === inviteCode?.toLowerCase()
  );

  // 2. Fetch group info from API if not already in local state
  useEffect(() => {
    let isMounted = true;
    async function fetchInvite() {
      if (!inviteCode) {
        setIsFetchingGroup(false);
        return;
      }
      try {
        setIsFetchingGroup(true);
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
  }, [inviteCode]);

  const targetGroup = localGroup || remoteGroup;
  const members = localGroup ? getGroupMembers(localGroup.id) : remoteMembers;

  const handleJoinGroup = async () => {
    if (!currentUser) {
      router.push(`/login?redirectTo=/join/${inviteCode}`);
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      if (enableNotifications) {
        await subscribeDeviceToPush();
      }

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

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
          {isFetchingGroup && !targetGroup ? (
            <div className="py-12 space-y-3">
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">{t('join.searching')}</p>
            </div>
          ) : targetGroup ? (
            <>
              {/* Trip info */}
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-5xl mx-auto shadow-xs">
                  {targetGroup.icon_emoji}
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

              {/* Join Button */}
              <div>
                {isSuccess ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {t('join.joinedSuccess')}
                  </div>
                ) : currentUser ? (
                  <Button
                    size="lg"
                    variant="brand"
                    onClick={handleJoinGroup}
                    isLoading={isLoading}
                    className="w-full shadow-md"
                  >
                    {t('join.joinGroupBtn')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Link href={`/login?redirectTo=/join/${inviteCode}`} className="block w-full">
                    <Button size="lg" variant="brand" className="w-full shadow-md">
                      {t('join.loginToJoin')}
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

      <Footer showDonations={false} className="mt-12" />
    </div>
  );
}

