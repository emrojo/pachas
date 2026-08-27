'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';

export interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  title,
  latitude,
  longitude,
  locationName,
}) => {
  if (!latitude || !longitude) return null;

  const googleMapEmbedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=15&output=embed`;
  const googleMapsExternalUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={locationName || 'Ubicación del Gasto'}
      description={`Gasto: ${title}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Map iframe */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-64 sm:h-72 w-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <iframe
            title={`Ubicación de ${title}`}
            src={googleMapEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Location Info Card */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                {locationName || title}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block">
                {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
              </span>

            </div>
          </div>

          <a
            href={googleMapsExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button size="sm" variant="brand" className="gap-1.5 text-xs">
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir en Google Maps
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  );
};
