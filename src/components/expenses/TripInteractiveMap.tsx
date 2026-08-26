'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Expense, Group } from '@/types/database';
import { getCategoryInfo } from '@/lib/categories';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { MapPin, Route, Layers, Maximize2, ExternalLink } from 'lucide-react';
import type * as LeafletType from 'leaflet';

export interface TripInteractiveMapProps {
  group: Group;
  geoStops: Expense[];
  selectedStopIndex: number;
  onSelectStop: (index: number) => void;
  showRouteLineDefault?: boolean;
}

export const TripInteractiveMap: React.FC<TripInteractiveMapProps> = ({
  group,
  geoStops,
  selectedStopIndex,
  onSelectStop,
  showRouteLineDefault = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletType.Map | null>(null);
  const markersRef = useRef<LeafletType.Marker[]>([]);
  const polylineRef = useRef<LeafletType.Polyline | null>(null);

  const [showRouteLine, setShowRouteLine] = useState(showRouteLineDefault);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || typeof window === 'undefined') return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Default fallback center
      const defaultCenter: [number, number] =
        geoStops.length > 0 && geoStops[0].latitude && geoStops[0].longitude
          ? [geoStops[0].latitude, geoStops[0].longitude]
          : [40.4168, -3.7038];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });

      // CartoDB Positron / OSM clean tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Polyline when geoStops or selectedStopIndex changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      // Clear existing markers and lines
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      if (geoStops.length === 0) return;

      const latLngs: [number, number][] = [];

      geoStops.forEach((expense, index) => {
        if (typeof expense.latitude !== 'number' || typeof expense.longitude !== 'number') return;

        const isSelected = selectedStopIndex === index;
        const latLng: [number, number] = [expense.latitude, expense.longitude];
        latLngs.push(latLng);

        const cat = getCategoryInfo(expense.category);
        const payerName =
          expense.payers?.[0]?.profile?.full_name?.split(' ')[0] ||
          expense.creator?.full_name?.split(' ')[0] ||
          'Amigo';

        const mapsQuery = expense.location_name
          ? `${expense.location_name}, ${expense.latitude},${expense.longitude}`
          : `${expense.latitude},${expense.longitude}`;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

        // Custom HTML Marker Icon
        const customIcon = L.divIcon({
          className: 'custom-pachas-marker',
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <div style="
                width: ${isSelected ? '36px' : '30px'};
                height: ${isSelected ? '36px' : '30px'};
                border-radius: 9999px;
                background-color: ${isSelected ? '#059669' : '#10b981'};
                border: 2.5px solid #ffffff;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                color: #ffffff;
                font-weight: 900;
                font-size: ${isSelected ? '14px' : '12px'};
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              ">
                ${index + 1}
              </div>
              ${
                isSelected
                  ? `<div style="
                      position: absolute;
                      width: 48px;
                      height: 48px;
                      border-radius: 9999px;
                      border: 2px solid #10b981;
                      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                      opacity: 0.75;
                    "></div>`
                  : ''
              }
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; color: #1e293b; min-width: 190px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 13px; color: #0f172a;">
                ${cat.emoji} ${expense.title}
              </span>
              <span style="font-weight: 900; color: #059669; font-size: 13px;">
                ${formatMoney(expense.amount, expense.currency)}
              </span>
            </div>
            ${
              expense.location_name
                ? `<div style="font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 4px;">
                    📍 ${expense.location_name}
                  </div>`
                : ''
            }
            <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
              🗓️ ${formatDate(expense.expense_date, 'd MMM, HH:mm')} • Pagó: <b>${payerName}</b>
            </div>
            <a
              href="${mapsUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                background-color: #ecfdf5;
                color: #047857;
                font-weight: 700;
                font-size: 11px;
                padding: 5px 8px;
                border-radius: 8px;
                border: 1px solid #a7f3d0;
                text-decoration: none;
              "
            >
              <span>Ver ficha en Google Maps</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        `;

        const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent, { maxWidth: 260 });

        marker.on('click', () => {
          onSelectStop(index);
        });

        markersRef.current.push(marker);

        // Open popup for active selected stop
        if (isSelected) {
          marker.openPopup();
        }
      });

      // Draw route line if toggled
      if (showRouteLine && latLngs.length > 1) {
        const polyline = L.polyline(latLngs, {
          color: '#10b981',
          weight: 3.5,
          opacity: 0.8,
          dashArray: '6, 8',
        }).addTo(map);
        polylineRef.current = polyline;
      }

      // If initial load or only one point, fit bounds
      if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    });
  }, [geoStops, showRouteLine, mapReady]);

  // Pan to selected stop when index changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || selectedStopIndex < 0 || selectedStopIndex >= geoStops.length) return;

    const stop = geoStops[selectedStopIndex];
    if (stop && typeof stop.latitude === 'number' && typeof stop.longitude === 'number') {
      map.panTo([stop.latitude, stop.longitude], { animate: true });
      const marker = markersRef.current[selectedStopIndex];
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedStopIndex, mapReady]);

  // Fit all bounds button
  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || geoStops.length === 0) return;
    import('leaflet').then((L) => {
      const latLngs: [number, number][] = geoStops
        .filter((e) => typeof e.latitude === 'number' && typeof e.longitude === 'number')
        .map((e) => [e.latitude!, e.longitude!]);
      if (latLngs.length > 0) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 16 });
      }
    });
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-64 sm:h-80 bg-slate-100 dark:bg-slate-950 shadow-inner">
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Layer / Mode Controls Overlay */}
      <div className="absolute top-2.5 right-2.5 z-1000 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md">
        <button
          type="button"
          onClick={() => setShowRouteLine(!showRouteLine)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
            showRouteLine
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Alternar entre ver solo marcadores/fichas o con línea de ruta"
        >
          {showRouteLine ? <Route className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
          <span>{showRouteLine ? 'Con Ruta' : 'Solo Fichas'}</span>
        </button>

        <button
          type="button"
          onClick={handleFitAllBounds}
          className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Ajustar zoom para ver todos los puntos"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
