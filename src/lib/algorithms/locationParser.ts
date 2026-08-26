/**
 * Utility for parsing and validating establishment names, GPS coordinates,
 * and Google Maps URLs from CSV import fields.
 */

export interface ParsedLocationResult {
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
}

/**
 * Validates if a latitude/longitude pair falls within valid geographical ranges
 */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Helper to extract coordinates from a Google Maps or map URL
 */
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;

  // Check for q=lat,lng or ll=lat,lng or daddr=lat,lng or destination=lat,lng or loc:lat,lng
  const qMatch = url.match(/[?&](?:q|ll|daddr|destination|loc)[:=](-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  // Check for /@lat,lng,
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Helper to parse a coordinate pair string like "39.8631, 4.2186" or "39,8631; 4,2186" or "-3.7038, 40.4168"
 */
function extractCoordsFromText(text: string): { lat: number; lng: number } | null {
  if (!text) return null;
  const trimmed = text.trim();

  // If text is a URL, parse as URL
  if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('maps.google') || trimmed.includes('google.com/maps')) {
    const fromUrl = extractCoordsFromUrl(trimmed);
    if (fromUrl) return fromUrl;
  }

  // Pattern 1: Standard dot decimal "39.8631, 4.2186" or "39.8631; 4.2186" or "39.8631 4.2186"
  const dotMatch = trimmed.match(/(-?\d+\.\d+)\s*[,;\t|\/]\s*(-?\d+\.\d+)/);
  if (dotMatch) {
    const lat = parseFloat(dotMatch[1]);
    const lng = parseFloat(dotMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  // Pattern 2: European comma decimal with semicolon or slash "39,8631; 4,2186" or "39,8631 / 4,2186"
  const euroMatch = trimmed.match(/(-?\d+,\d+)\s*[;|\/]\s*(-?\d+,\d+)/);
  if (euroMatch) {
    const lat = parseFloat(euroMatch[1].replace(',', '.'));
    const lng = parseFloat(euroMatch[2].replace(',', '.'));
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  // Pattern 3: Integer or mixed coordinates like "40, -3" or "40.4168, -3"
  const simpleMatch = trimmed.match(/(-?\d+(?:[\.,]\d+)?)\s*[,;\t|\/]\s*(-?\d+(?:[\.,]\d+)?)/);
  if (simpleMatch) {
    const lat = parseFloat(simpleMatch[1].replace(',', '.'));
    const lng = parseFloat(simpleMatch[2].replace(',', '.'));
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Main parser: takes raw establishment/location text, raw coordinates text, and/or raw maps URL
 * and resolves clean locationName, latitude, longitude, and Google Maps URL.
 */
export function parseLocationAndCoordinates(
  rawLocation?: string | null,
  rawCoordinates?: string | null,
  rawMapsUrl?: string | null
): ParsedLocationResult {
  let locationName: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  // 1. Try explicit maps URL first if provided
  if (rawMapsUrl && rawMapsUrl.trim()) {
    const urlCoords = extractCoordsFromUrl(rawMapsUrl.trim());
    if (urlCoords) {
      latitude = urlCoords.lat;
      longitude = urlCoords.lng;
    }
  }

  // 2. Try explicit coordinates field if provided
  if (rawCoordinates && rawCoordinates.trim() && (latitude === null || longitude === null)) {
    const coordCoords = extractCoordsFromText(rawCoordinates.trim());
    if (coordCoords) {
      latitude = coordCoords.lat;
      longitude = coordCoords.lng;
    }
  }

  // 3. Process location name string
  if (rawLocation && rawLocation.trim()) {
    const locTrimmed = rawLocation.trim();

    // Check if location string is itself a Google Maps URL
    if (locTrimmed.includes('http://') || locTrimmed.includes('https://') || locTrimmed.includes('maps.google') || locTrimmed.includes('google.com/maps')) {
      const urlCoords = extractCoordsFromUrl(locTrimmed);
      if (urlCoords) {
        if (latitude === null || longitude === null) {
          latitude = urlCoords.lat;
          longitude = urlCoords.lng;
        }
      }
    } else {
      // Check if location string contains embedded coordinates, e.g. "Restaurante El Faro (39.8631, 4.2186)"
      const embeddedMatch = locTrimmed.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (embeddedMatch) {
        const potentialName = embeddedMatch[1].trim();
        const potentialCoordsStr = embeddedMatch[2].trim();
        const extracted = extractCoordsFromText(potentialCoordsStr);
        if (extracted) {
          if (latitude === null || longitude === null) {
            latitude = extracted.lat;
            longitude = extracted.lng;
          }
          if (potentialName) {
            locationName = potentialName;
          }
        } else {
          locationName = locTrimmed;
        }
      } else {
        // Check if the entire location string is just coordinates (e.g. "39.8631, 4.2186")
        const onlyCoords = extractCoordsFromText(locTrimmed);
        if (onlyCoords && /^[-+]?\d+[\.,\d\s;|\/+-]+$/.test(locTrimmed)) {
          if (latitude === null || longitude === null) {
            latitude = onlyCoords.lat;
            longitude = onlyCoords.lng;
          }
          // Do not set raw coordinate digits as establishment name if no other text is present
        } else {
          locationName = locTrimmed;
        }
      }
    }
  }

  // 4. Generate Google Maps link if coordinates were resolved
  const mapsUrl =
    latitude !== null && longitude !== null
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null;

  return {
    locationName: locationName || null,
    latitude,
    longitude,
    mapsUrl,
  };
}
