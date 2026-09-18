'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { useDevicePlatform } from '@/hooks/useDevicePlatform';
import { MobileGroupDetailView } from '@/components/mobile/MobileGroupDetailView';
import { WebGroupDetailView } from '@/components/web/WebGroupDetailView';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Adaptive Group Detail Route
 * Seamlessly dispatches to the Mobile Group View (touch-first, 3-icon bottom bar, large text, icon-only buttons)
 * or Web Desktop Group View (multi-column tabs, sidebars, dense data tools) based on device & preferences.
 */
export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;
  const { getGroup, fetchGroup, currentUser, isLoading } = usePachas();
  const { t } = useTranslation();
  const { isMobile, setViewMode } = useDevicePlatform();

  const [isFetchingGroup, setIsFetchingGroup] = useState(false);
  const lastFetchedGroupIdRef = useRef<string | null>(null);

  const group = getGroup(groupId);

  useEffect(() => {
    if (!groupId) return;
    if (lastFetchedGroupIdRef.current === groupId) return;
    lastFetchedGroupIdRef.current = groupId;

    if (!group) {
      setIsFetchingGroup(true);
    }
    fetchGroup(groupId)
      .catch(() => {})
      .finally(() => setIsFetchingGroup(false));
  }, [groupId, fetchGroup, group]);

  useEffect(() => {
    if (currentUser?.is_banned) {
      router.replace('/suspended');
    }
  }, [currentUser?.is_banned, router]);

  if ((isLoading || isFetchingGroup) && !group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="text-center p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            🏖️
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('groups.groupNotFound')}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {t('groups.groupNotFoundSubtitle')}
          </p>
          <Link href="/dashboard">
            <Button variant="brand" className="w-full">
              {t('groups.backToTrips')}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isMobile) {
    return <MobileGroupDetailView group={group} onSwitchToWeb={() => setViewMode('web')} />;
  }

  return <WebGroupDetailView onSwitchToMobile={() => setViewMode('mobile')} />;
}
