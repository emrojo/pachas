'use client';

import React, { useState } from 'react';
import { Group, Expense } from '@/types/database';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/categories';
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
} from 'lucide-react';

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
  // Sort all expenses chronologically by expense_date
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
  );

  // Filter only those with valid GPS coordinates
  const geoStops = sortedExpenses.filter(
    (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number'
  );

  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0);

  const selectedExpense = geoStops[selectedStopIndex] || geoStops[0];

  // Calculate center coordinates
  const centerLat =
    geoStops.length > 0
      ? geoStops.reduce((sum, e) => sum + (e.latitude || 0), 0) / geoStops.length
      : 40.4168;
  const centerLng =
    geoStops.length > 0
      ? geoStops.reduce((sum, e) => sum + (e.longitude || 0), 0) / geoStops.length
      : -3.7038;

  // Active coordinates to focus in embed
  const activeLat = selectedExpense?.latitude || centerLat;
  const activeLng = selectedExpense?.longitude || centerLng;

  const mapEmbedUrl = `https://maps.google.com/maps?q=${activeLat},${activeLng}&z=14&output=embed`;

  // Build multi-stop Google Maps URL
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

  const totalGeoSpent = geoStops.reduce(
    (sum, e) => sum + (e.converted_amount || e.amount),
    0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Itinerario de Pagos del Viaje`}
      description={`Ruta histórica de pagos geolocalizados en ${group.name}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Header Stats Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Paradas registradas
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {geoStops.length} de {expenses.length} gastos
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Gasto en ruta
            </span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalGeoSpent, group.base_currency)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Itinerario
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate block">
              {geoStops.length > 0
                ? `${formatDate(geoStops[0].expense_date, 'd MMM')} ➔ ${formatDate(geoStops[geoStops.length - 1].expense_date, 'd MMM')}`
                : 'Sin paradas'}
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
              Aún no hay gastos con geolocalización en este viaje
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Cuando añadas o edites un gasto, marca el check de ubicación GPS o selecciona el sitio en Google Maps para trazar el mapa de ruta de vuestras vacaciones.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Interactive Map Preview */}
            <div className="lg:col-span-7 space-y-2">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-64 sm:h-80 bg-slate-100 dark:bg-slate-950 shadow-inner">
                <iframe
                  title="Mapa de ruta de gastos"
                  width="100%"
                  height="100%"
                  src={mapEmbedUrl}
                  className="border-0 w-full h-full"
                  loading="lazy"
                />

                {/* Selected stop overlay pill */}
                {selectedExpense && (
                  <div className="absolute top-3 left-3 right-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {selectedStopIndex + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {selectedExpense.title}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {selectedExpense.location_name || 'Coordenadas GPS'}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatMoney(selectedExpense.amount, selectedExpense.currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button: Open Google Maps Route */}
              <div className="flex items-center justify-between gap-2">
                <a
                  href={buildGoogleMapsRouteUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 transition-colors w-full justify-center shadow-xs"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Abrir ruta completa en Google Maps</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            {/* Right: Chronological Timeline Feed */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Cronología de Paradas ({geoStops.length})
              </span>

              <div className="max-h-72 sm:max-h-80 overflow-y-auto space-y-2 pr-1">
                {geoStops.map((expense, idx) => {
                  const isSelected = selectedStopIndex === idx;
                  const cat = getCategoryInfo(expense.category);
                  const payerName =
                    expense.payers?.[0]?.profile?.full_name?.split(' ')[0] ||
                    expense.creator?.full_name?.split(' ')[0] ||
                    'Amigo';

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

                        {/* Location Name */}
                        {expense.location_name && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                            📍 {expense.location_name.split(',')[0]}
                          </span>
                        )}

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
