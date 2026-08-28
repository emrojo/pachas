'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Group, Expense } from '@/types/database';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/categories';
import { exportGroupLocationsToKML } from '@/lib/export';
import {
  MapPin,
  ExternalLink,
  Navigation,
  Clock,
  Compass,
  Calendar,
  Layers,
  ChevronRight,
  Route,
  Sparkles,
  Download,
  Globe,
} from 'lucide-react';

// Dynamically load interactive Leaflet map purely on client-side
const TripInteractiveMap = dynamic(
  () => import('./TripInteractiveMap').then((mod) => mod.TripInteractiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-80 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
        ...
      </div>
    ),
  }
);

export interface TripRouteMapModalProps {
  group: Group;
  expenses: Expense[];
  isOpen: boolean;
  onClose: () => void;
}

export const TripRouteMapModal: React.FC<TripRouteMapModalProps> = ({
  group,
  expenses,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  // Sort all expenses chronologically by expense_date
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
  );

  // Filter only those with valid GPS coordinates
  const geoStops = sortedExpenses.filter(
    (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number'
  );

  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0);

  // Build multi-stop Google Maps Navigation Route URL (with directions)
  const buildGoogleMapsRouteUrl = () => {
    if (geoStops.length === 0) return 'https://maps.google.com';
    if (geoStops.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${geoStops[0].latitude},${geoStops[0].longitude}`;
    }

    const origin = `${geoStops[0].latitude},${geoStops[0].longitude}`;
    const destination = `${geoStops[geoStops.length - 1].latitude},${geoStops[geoStops.length - 1].longitude}`;
    const waypoints = geoStops
      .slice(1, -1)
      .map((e) => `${e.latitude},${e.longitude}`)
      .join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints) {
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    return url;
  };

  // Get direct Google Maps link for a single establishment
  const getEstablishmentMapUrl = (expense: Expense) => {
    if (!expense.latitude || !expense.longitude) return 'https://maps.google.com';
    const query = expense.location_name
      ? `${expense.location_name}, ${expense.latitude},${expense.longitude}`
      : `${expense.latitude},${expense.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const totalGeoSpent = geoStops.reduce(
    (sum, e) => sum + (e.converted_amount || e.amount),
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tripMap.title')}
      description={`${t('nav.groups')}: ${group.name}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Header Stats Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {t('expenses.location')}
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {geoStops.length} / {expenses.length}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {t('charts.totalSpent')}
            </span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalGeoSpent, group.base_currency)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {t('tripMap.tabTitle')}
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate block">
              {geoStops.length > 0
                ? `${formatDate(geoStops[0].expense_date, 'd MMM')} ➔ ${formatDate(geoStops[geoStops.length - 1].expense_date, 'd MMM')}`
                : '-'}
            </span>
          </div>
        </div>

        {geoStops.length === 0 ? (
          /* Empty State */
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
              📍
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('tripMap.noLocationsTitle')}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {t('tripMap.noLocationsSubtitle')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Dedicated Interactive Map (Strictly trip places only) */}
            <div className="lg:col-span-7 space-y-2">
              <TripInteractiveMap
                group={group}
                geoStops={geoStops}
                selectedStopIndex={selectedStopIndex}
                onSelectStop={(idx) => setSelectedStopIndex(idx)}
                showRouteLineDefault={false}
              />

              {/* Action Buttons: Open Google Maps Route & Export KML for My Maps / Earth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportGroupLocationsToKML(group, geoStops)}
                  className="gap-1.5 text-xs font-bold w-full justify-center"
                  title="Descargar archivo KML con solo tus sitios para abrir en Google Earth o Google My Maps"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  <span>KML para Google My Maps</span>
                </Button>

                <a
                  href={buildGoogleMapsRouteUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-950 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 transition-colors justify-center shadow-xs text-center"
                  title={t('common.openInGoogleMaps')}
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t('common.openInGoogleMaps')}</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                </a>
              </div>
            </div>

            {/* Right: Chronological Timeline Feed */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                {t('tripMap.tabTitle')} ({geoStops.length})
              </span>

              <div className="max-h-72 sm:max-h-80 overflow-y-auto space-y-2 pr-1">
                {geoStops.map((expense, idx) => {
                  const isSelected = selectedStopIndex === idx;
                  const cat = getCategoryInfo(expense.category);
                  const payerName =
                    expense.payers?.[0]?.profile?.full_name?.split(' ')[0] ||
                    expense.creator?.full_name?.split(' ')[0] ||
                    t('common.someone');

                  return (
                    <button
                      key={expense.id}
                      type="button"
                      onClick={() => setSelectedStopIndex(idx)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {/* Step Number Badge */}
                      <div
                        className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {cat.emoji} {expense.title}
                          </span>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0">
                            {formatMoney(expense.amount, expense.currency)}
                          </span>
                        </div>

                        {/* Location Name & Google Maps Direct Link */}
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            📍 {expense.location_name ? expense.location_name.split(',')[0] : `${Number(expense.latitude).toFixed(4)}, ${Number(expense.longitude).toFixed(4)}`}
                          </span>

                          <a
                            href={getEstablishmentMapUrl(expense)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100"
                            title="Abrir este local en Google Maps"
                          >
                            <span>Ficha</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>

                        {/* Date and Hour with Timezone & Payer */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(expense.expense_date, 'd MMM, HH:mm')}</span>
                          <span>•</span>
                          <span>Pagó: {payerName}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Cerrar Mapa
          </Button>
        </div>
      </div>
    </Modal>
  );
};
