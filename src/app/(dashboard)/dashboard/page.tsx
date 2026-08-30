'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Footer } from '@/components/layout/Footer';
import { GroupCard } from '@/components/groups/GroupCard';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { BuyMeACoffeeButton } from '@/components/donations/BuyMeACoffeeButton';
import { PendingScansBanner } from '@/components/expenses/PendingScansBanner';
import { ReceiptValidationModal } from '@/components/expenses/ReceiptValidationModal';
import { PendingReceiptScan } from '@/types/database';
import { Button } from '@/components/ui/Button';

import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import {
  Plus,
  Search,
  KeyRound,
  Layers,
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  Bell,
} from 'lucide-react';
import { subscribeDeviceToPush } from '@/lib/notifications/pushNotificationService';

export default function DashboardPage() {
  const { groups, currentUser, joinGroup, getGroupBalances, getGroupMembers, restoreGroup } = usePachas();
  const { t } = useTranslation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinNotificationsEnabled, setJoinNotificationsEnabled] = useState(true);
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [validatingScan, setValidatingScan] = useState<PendingReceiptScan | null>(null);

  if (!currentUser) return null;

  // Separate active groups from archived groups
  const activeGroups = groups.filter((g) => !g.is_archived);
  const adminArchivedGroups = groups.filter((g) => {
    if (!g.is_archived) return false;
    const members = getGroupMembers(g.id);
    return (
      g.created_by === currentUser.id ||
      members.some((m) => m.user_id === currentUser.id && m.role === 'admin')
    );
  });

  // Overall calculations across active groups
  let totalNetOwedToUser = 0;
  let totalNetUserOwes = 0;

  activeGroups.forEach((g) => {
    const balances = getGroupBalances(g.id);
    const myBalance = balances.find((b) => b.user_id === currentUser.id);
    const net = myBalance?.net_balance || 0;
    if (net > 0) totalNetOwedToUser += net;
    if (net < 0) totalNetUserOwes += Math.abs(net);
  });

  const filteredGroups = activeGroups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    try {
      setIsJoining(true);
      setJoinError('');

      if (joinNotificationsEnabled) {
        try {
          await subscribeDeviceToPush();
        } catch (e) {
          console.warn('Push subscription during join:', e);
        }
      }

      const group = await joinGroup(joinCode.trim(), joinNotificationsEnabled);
      if (!group) {
        setJoinError(t('dashboard.joinGroupError'));
      } else {
        setJoinCode('');
      }
    } catch (err: any) {
      setJoinError(t('dashboard.joinGroupError'));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-12">
      <Navbar onCreateGroupClick={() => setIsCreateOpen(true)} />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* User Welcome & Net Balance Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-600/15 relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-100 block mb-1">
                {t('dashboard.myGroups')}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {t('dashboard.welcome', { name: currentUser.full_name.split(' ')[0] })} 🌴
              </h1>
              <p className="text-xs sm:text-sm text-emerald-50 mt-1 max-w-md">
                {t('dashboard.welcomeSubtitle')}
              </p>
            </div>

            {/* Quick Balances in Header */}
            <div className="flex gap-2">
              <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20">
                <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                  {t('dashboard.totalOwedToYou')}
                </span>
                <span className="text-base sm:text-lg font-black text-white">
                  +{formatMoney(totalNetOwedToUser, 'EUR')}
                </span>
              </div>
              <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20">
                <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                  {t('dashboard.totalYouOwe')}
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-100">
                  -{formatMoney(totalNetUserOwes, 'EUR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Scans Banner for user */}
        <PendingScansBanner
          onSelectScanToValidate={(scan) => setValidatingScan(scan)}
        />

        {/* Search Bar & Join with Code Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder={t('dashboard.searchGroups')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <form onSubmit={handleJoin} className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                placeholder={t('dashboard.joinByCodePlaceholder')}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4" />}
                error={joinError}
              />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                isLoading={isJoining}
                className="shrink-0 font-bold"
              >
                {t('dashboard.joinGroupBtn')}
              </Button>
            </div>
            {joinCode.trim().length > 0 && (
              <label className="flex items-center gap-1.5 px-1 cursor-pointer select-none text-[11px] text-slate-600 dark:text-slate-400 animate-in fade-in duration-150">
                <input
                  type="checkbox"
                  checked={joinNotificationsEnabled}
                  onChange={(e) => setJoinNotificationsEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
                />
                <Bell className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{t('notifications.enableOnJoin') || 'Activar notificaciones al unirme'}</span>
              </label>
            )}
          </form>
        </div>

        {/* Groups Grid Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              {t('dashboard.yourGroups')}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                {activeGroups.length}
              </span>
            </h2>
          </div>

          <Button
            size="sm"
            variant="brand"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t('nav.newGroup')}
          </Button>
        </div>

        {/* Groups Grid */}
        {filteredGroups.length === 0 ? (
          <Card className="text-center py-12 border-dashed">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-3xl">
              🏖️
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dashboard.noGroupsTitle')}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              {t('dashboard.noGroupsSubtitle')}
            </p>
            <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t('dashboard.createFirstGroup')}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}

        {/* Admin Archived Groups Section */}
        {adminArchivedGroups.length > 0 && (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    {t('dashboard.archivedTrips')}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                      {adminArchivedGroups.length}
                    </span>
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('dashboard.archivedTripsHelp')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminArchivedGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-amber-200/80 dark:border-amber-900/40 flex flex-col justify-between gap-4 shadow-xs relative overflow-hidden backdrop-blur-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 flex items-center justify-center text-2xl shrink-0">
                        {group.icon_emoji}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {group.name}
                        </h3>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium block">
                          {t('dashboard.archivedOn', { date: group.archived_at ? formatDate(group.archived_at, 'dd/MM/yyyy') : '' })}
                        </span>
                      </div>
                    </div>

                    <Badge variant="amber" size="sm">
                      {t('groups.archiveGroup')}
                    </Badge>
                  </div>

                  {group.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {group.description}
                    </p>
                  )}

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Link
                      href={`/groups/${group.id}`}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>{t('dashboard.viewHistory')}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await restoreGroup(group.id);
                      }}
                      className="text-xs font-bold gap-1 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 border-amber-300 dark:border-amber-800"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('groups.restoreGroup')}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
      <BottomNav onAddClick={() => setIsCreateOpen(true)} />

      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {validatingScan && (
        <ReceiptValidationModal
          isOpen={!!validatingScan}
          onClose={() => setValidatingScan(null)}
          pendingScan={validatingScan}
          groupId={validatingScan.group_id}
        />
      )}
    </div>
  );
}

