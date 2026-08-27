'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  MapPin,
  Navigation,
  Loader2,
  ExternalLink,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  LocateFixed,
} from 'lucide-react';

export interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  onChange: (data: { latitude: number | null; longitude: number | null; locationName: string | null }) => void;
  isEditing?: boolean;
  disabled?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  latitude,
  longitude,
  locationName,
  onChange,
  isEditing = false,
  disabled = false,
}) => {

  const [isPhysicallyHere, setIsPhysicallyHere] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showManualPicker, setShowManualPicker] = useState(false);

  const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  // Auto-fill address from coordinates using reverse geocoding
  const fetchAddress = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      if (res.ok) {
        const data = await res.json();
        const venue =
          data.name ||
          data.address?.amenity ||
          data.address?.shop ||
          data.address?.tourism ||
          data.address?.road ||
          data.address?.suburb ||
          data.address?.city ||
          data.display_name?.split(',')[0];

        const city = data.address?.city || data.address?.town || data.address?.village || '';
        const name = venue && city && venue !== city ? `${venue}, ${city}` : venue || data.display_name;

        return name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    } catch (err) {
      console.warn('Could not reverse geocode:', err);
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  // Get current mobile/browser position
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('La geolocalización no está soportada en tu navegador.');
      return;
    }

    setIsLocating(true);
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const name = await fetchAddress(lat, lon);

        onChange({
          latitude: lat,
          longitude: lon,
          locationName: name,
        });

        setIsLocating(false);
        setIsPhysicallyHere(true);
        setShowManualPicker(true);
      },
      (err) => {
        setIsLocating(false);
        setIsPhysicallyHere(false);
        let msg = 'No se pudo obtener la ubicación.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permiso de ubicación denegado. Actívalo en los ajustes de tu navegador o busca el lugar manualmente.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Información de ubicación no disponible.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Tiempo de espera agotado al obtener la ubicación.';
        }
        setErrorMessage(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // Toggle "Estoy físicamente en el sitio"
  const handlePhysicalCheck = (checked: boolean) => {
    setIsPhysicallyHere(checked);
    if (checked) {
      handleGetLocation();
    } else {
      // Don't necessarily delete location unless user chooses to
    }
  };

  // Search places by name/address
  const handleSearchPlaces = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setErrorMessage('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=4`,
        { headers: { 'Accept-Language': 'es' } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(
          data.map((item: any) => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          }))
        );
        if (data.length === 0) {
          setErrorMessage('No se encontraron resultados para esa búsqueda.');
        }
      }
    } catch (e) {
      setErrorMessage('Error al buscar la dirección.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { name: string; lat: number; lon: number }) => {
    onChange({
      latitude: result.lat,
      longitude: result.lon,
      locationName: result.name.split(',').slice(0, 2).join(', '),
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleClearLocation = () => {
    setIsPhysicallyHere(false);
    setShowManualPicker(false);
    setSearchResults([]);
    setSearchQuery('');
    setErrorMessage('');
    onChange({
      latitude: null,
      longitude: null,
      locationName: null,
    });
  };

  // Google Maps embed URL
  const googleMapEmbedUrl = hasLocation
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=15&output=embed`
    : null;

  const googleMapsExternalUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;

  if (disabled) {
    if (!hasLocation) {
      return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <MapPin className="w-4 h-4 opacity-50" />
          <span>Sin ubicación registrada para este gasto.</span>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
        {/* Location details card */}
        <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500/30 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                {locationName || 'Ubicación registrada'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
              </span>
            </div>
          </div>

          {googleMapsExternalUrl && (
            <a
              href={googleMapsExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
              title="Abrir en Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          )}
        </div>

        {/* Embedded Google Map Preview */}
        {googleMapEmbedUrl && (
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-44 sm:h-52 w-full bg-slate-100 dark:bg-slate-800 relative shadow-inner">
            <iframe
              title="Mapa de la ubicación del gasto"
              src={googleMapEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
      {/* Header with Physical presence Checkbox */}
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPhysicallyHere}
            onChange={(e) => handlePhysicalCheck(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              📍 Me encuentro físicamente en el sitio del pago
            </span>
            <span className="text-[11px] text-slate-400 block">
              Geolocaliza automáticamente la posición de este gasto con el GPS
            </span>
          </div>
        </label>

        {isLocating && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Obteniendo GPS...</span>
          </div>
        )}
      </div>

      {/* Manual Geolocation Toggle or Status */}
      {!hasLocation && !isLocating && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">¿No estás ahí ahora mismo?</span>
          <button
            type="button"
            onClick={() => setShowManualPicker(!showManualPicker)}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5" />
            {showManualPicker ? 'Cerrar buscador de mapa' : 'Buscar ubicación en el mapa'}
          </button>
        </div>
      )}

      {/* Manual Search Form */}
      {showManualPicker && !hasLocation && (
        <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="flex gap-2">
            <Input
              placeholder="Escribe el restaurante, ciudad o calle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchPlaces();
                }
              }}
              leftIcon={<Search className="w-4 h-4" />}
              className="text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSearchPlaces}
              isLoading={isSearching}
            >
              Buscar
            </Button>
          </div>

          {/* Search suggestions */}
          {searchResults.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-2.5 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200"
                >
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Location Display & Interactive Map */}
      {hasLocation && (
        <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          {/* Location details card */}
          <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500/30 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                  {locationName || 'Ubicación registrada'}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {googleMapsExternalUrl && (
                <a
                  href={googleMapsExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1"
                  title="Abrir en Google Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Google Maps</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleGetLocation}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                title="Actualizar con mi posición actual"
              >
                <LocateFixed className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClearLocation}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                title="Eliminar ubicación"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Embedded Google Map Preview */}
          {googleMapEmbedUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-44 sm:h-52 w-full bg-slate-100 dark:bg-slate-800 relative shadow-inner">
              <iframe
                title="Mapa de la ubicación del gasto"
                src={googleMapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

