import { describe, it, expect } from 'vitest';
import { parseLocationAndCoordinates, isValidLatLng } from './locationParser';

describe('Location & Coordinate Parser for CSV', () => {
  it('validates coordinate bounds correctly', () => {
    expect(isValidLatLng(39.8631, 4.2186)).toBe(true);
    expect(isValidLatLng(-33.8688, 151.2093)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(NaN, 4.2186)).toBe(false);
  });

  it('parses separate location name and standard dot coordinates', () => {
    const result = parseLocationAndCoordinates('Restaurante El Faro', '39.8631, 4.2186');
    expect(result.locationName).toBe('Restaurante El Faro');
    expect(result.latitude).toBeCloseTo(39.8631);
    expect(result.longitude).toBeCloseTo(4.2186);
    expect(result.mapsUrl).toBe('https://www.google.com/maps?q=39.8631,4.2186');
  });

  it('parses European comma decimal coordinates with semicolon', () => {
    const result = parseLocationAndCoordinates('Playa Mitjana', '39,9342; 3,9712');
    expect(result.locationName).toBe('Playa Mitjana');
    expect(result.latitude).toBeCloseTo(39.9342);
    expect(result.longitude).toBeCloseTo(3.9712);
  });

  it('parses negative coordinates (e.g. Madrid)', () => {
    const result = parseLocationAndCoordinates('Museo del Prado', '40.4138, -3.6921');
    expect(result.locationName).toBe('Museo del Prado');
    expect(result.latitude).toBeCloseTo(40.4138);
    expect(result.longitude).toBeCloseTo(-3.6921);
  });

  it('parses embedded coordinates in location string', () => {
    const result = parseLocationAndCoordinates('Cala Galdana (39.9367, 3.9631)');
    expect(result.locationName).toBe('Cala Galdana');
    expect(result.latitude).toBeCloseTo(39.9367);
    expect(result.longitude).toBeCloseTo(3.9631);
  });

  it('parses Google Maps URLs in coordinates or mapsUrl column', () => {
    const result = parseLocationAndCoordinates(
      'Pizzería Napolitana',
      'https://www.google.com/maps?q=40.4168,-3.7038'
    );
    expect(result.locationName).toBe('Pizzería Napolitana');
    expect(result.latitude).toBeCloseTo(40.4168);
    expect(result.longitude).toBeCloseTo(-3.7038);
  });

  it('parses Google Maps URL with @lat,lng format', () => {
    const result = parseLocationAndCoordinates(
      null,
      'https://www.google.com/maps/@39.8631,4.2186,17z'
    );
    expect(result.latitude).toBeCloseTo(39.8631);
    expect(result.longitude).toBeCloseTo(4.2186);
  });

  it('handles coordinates only (no establishment name)', () => {
    const result = parseLocationAndCoordinates(null, '39.8631, 4.2186');
    expect(result.locationName).toBeNull();
    expect(result.latitude).toBeCloseTo(39.8631);
    expect(result.longitude).toBeCloseTo(4.2186);
  });

  it('handles establishment name only (no coordinates)', () => {
    const result = parseLocationAndCoordinates('Supermercado Mercadona, Ciutadella', null);
    expect(result.locationName).toBe('Supermercado Mercadona, Ciutadella');
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.mapsUrl).toBeNull();
  });

  it('handles empty/null inputs gracefully', () => {
    const result = parseLocationAndCoordinates('', '', '');
    expect(result.locationName).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.mapsUrl).toBeNull();
  });
});
