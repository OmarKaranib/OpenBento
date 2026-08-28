export type WeatherLookup =
  | { kind: 'coordinates'; lat: number; lon: number }
  | { kind: 'city'; city: string };

export type WeatherLookupResult =
  | { ok: true; lookup: WeatherLookup }
  | { ok: false; error: string };

export function parseWeatherLookup(query: Record<string, unknown>): WeatherLookupResult {
  const hasLat = query.lat !== undefined;
  const hasLon = query.lon !== undefined;

  if (hasLat || hasLon) {
    if (typeof query.lat !== 'string' || typeof query.lon !== 'string') {
      return { ok: false, error: 'Both lat and lon must be provided once' };
    }

    const lat = Number(query.lat);
    const lon = Number(query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)
      || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { ok: false, error: 'Invalid latitude or longitude' };
    }

    return { ok: true, lookup: { kind: 'coordinates', lat, lon } };
  }

  if (query.city !== undefined && typeof query.city !== 'string') {
    return { ok: false, error: 'Invalid city' };
  }

  const city = typeof query.city === 'string' ? query.city.trim() : '';
  if (city.length > 100) return { ok: false, error: 'City name is too long' };

  return { ok: true, lookup: { kind: 'city', city: city || 'London' } };
}
