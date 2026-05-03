// Air Quality service — wraps Open-Meteo's free Air Quality API (no key).
// Mirrors the markets service shape: a factory that takes injectable
// `fetchImpl` + `now` so the route handler uses real `fetch`/`Date.now`
// while tests can drive the cache and stale-fallback paths deterministically.

import {
  type AirQualityPayload,
  type PollutantBag,
  type PollenBag,
  dominantPollutant,
  maxPollenLevel,
} from '@shared/air-quality';

export const AIR_QUALITY_TTL_MS    = 15 * 60_000;       // 15 min
export const AIR_QUALITY_STALE_MS  = 6  * 60 * 60_000;  // 6 h
export const AIR_QUALITY_TIMEOUT_MS = 7_000;

const OPEN_METEO_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const CURRENT_FIELDS = [
  'us_aqi',
  'pm2_5',
  'pm10',
  'ozone',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'carbon_monoxide',
].join(',');

const HOURLY_POLLEN_FIELDS = [
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
].join(',');

// Upstream JSON shape — kept minimal/permissive: every field optional so
// a quirky upstream shape never crashes the route.
interface OpenMeteoResponse {
  current?: {
    time?:              string;
    us_aqi?:            number;
    pm2_5?:             number;
    pm10?:              number;
    ozone?:             number;
    nitrogen_dioxide?:  number;
    sulphur_dioxide?:   number;
    carbon_monoxide?:   number;
  };
  hourly?: {
    time?:           string[];
    alder_pollen?:   (number | null)[];
    birch_pollen?:   (number | null)[];
    grass_pollen?:   (number | null)[];
    mugwort_pollen?: (number | null)[];
    olive_pollen?:   (number | null)[];
    ragweed_pollen?: (number | null)[];
  };
}

interface CacheEntry { value: AirQualityPayload; expiresAt: number; }

export interface AirQualityServiceOptions {
  fetchImpl?:   typeof fetch;
  now?:         () => number;
  ttlMs?:       number;
  staleTtlMs?:  number;
  timeoutMs?:   number;
}

export interface AirQualityService {
  /** Returns AQI for the given lat/lon. Uses cache + stale fallback. */
  getAirQuality(args: { lat: number; lon: number; includePollen?: boolean }): Promise<AirQualityPayload>;
  /** Test-only: peek into the live cache. */
  _cacheSize(): number;
  /** Test-only: clear cache (test isolation). */
  _clear(): void;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function pickHourlyValue(times: string[] | undefined, values: (number|null)[] | undefined, observedAt: string | null): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!Array.isArray(times) || !observedAt) {
    // Fall back to the first non-null reading.
    for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) return v;
    return null;
  }
  // Find the hourly slot that matches (or is closest to) `observedAt`.
  // Open-Meteo's hourly times are aligned to the hour.
  const obsHour = observedAt.slice(0, 13); // 'YYYY-MM-DDTHH'
  let idx = times.findIndex(t => typeof t === 'string' && t.startsWith(obsHour));
  if (idx < 0) idx = 0;
  for (let i = idx; i < values.length; i++) {
    const v = values[i];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function buildPollen(hourly: OpenMeteoResponse['hourly'], observedAt: string | null): PollenBag | null {
  if (!hourly) return null;
  const alder   = pickHourlyValue(hourly.time, hourly.alder_pollen,   observedAt);
  const birch   = pickHourlyValue(hourly.time, hourly.birch_pollen,   observedAt);
  const grass   = pickHourlyValue(hourly.time, hourly.grass_pollen,   observedAt);
  const mugwort = pickHourlyValue(hourly.time, hourly.mugwort_pollen, observedAt);
  const olive   = pickHourlyValue(hourly.time, hourly.olive_pollen,   observedAt);
  const ragweed = pickHourlyValue(hourly.time, hourly.ragweed_pollen, observedAt);
  // If the upstream omitted every pollen series (common outside Europe),
  // surface `null` so the widget can render the "Not available" badge.
  if ([alder, birch, grass, mugwort, olive, ragweed].every(v => v === null)) return null;
  const partial = { alder, birch, grass, mugwort, olive, ragweed };
  return { ...partial, maxLevel: maxPollenLevel(partial) };
}

function mapResponse(json: OpenMeteoResponse, lat: number, lon: number, includePollen: boolean, now: number): AirQualityPayload {
  const cur = json.current ?? {};
  const observedAt = typeof cur.time === 'string' ? cur.time : null;
  const pollutants: PollutantBag = {
    pm2_5: num(cur.pm2_5),
    pm10:  num(cur.pm10),
    o3:    num(cur.ozone),
    no2:   num(cur.nitrogen_dioxide),
    so2:   num(cur.sulphur_dioxide),
    co:    num(cur.carbon_monoxide),
  };
  return {
    lat, lon,
    fetchedAt:  now,
    observedAt,
    aqi:        num(cur.us_aqi),
    pollutants,
    dominant:   dominantPollutant(pollutants),
    pollen:     includePollen ? buildPollen(json.hourly, observedAt) : null,
  };
}

function cacheKey(lat: number, lon: number, includePollen: boolean): string {
  // Round to 2 decimals (~1 km) so nearby calls share the cache.
  return `${lat.toFixed(2)}:${lon.toFixed(2)}:${includePollen ? 'p' : 'np'}`;
}

export function createAirQualityService(opts: AirQualityServiceOptions = {}): AirQualityService {
  const fetchImpl  = opts.fetchImpl  ?? (globalThis.fetch as typeof fetch);
  const now        = opts.now        ?? (() => Date.now());
  const ttlMs      = opts.ttlMs      ?? AIR_QUALITY_TTL_MS;
  const staleTtlMs = opts.staleTtlMs ?? AIR_QUALITY_STALE_MS;
  const timeoutMs  = opts.timeoutMs  ?? AIR_QUALITY_TIMEOUT_MS;

  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<AirQualityPayload>>();

  async function fetchUpstream(lat: number, lon: number, includePollen: boolean): Promise<AirQualityPayload> {
    const params = new URLSearchParams({
      latitude:  String(lat),
      longitude: String(lon),
      current:   CURRENT_FIELDS,
      timezone:  'auto',
    });
    if (includePollen) params.set('hourly', HOURLY_POLLEN_FIELDS);
    const url = `${OPEN_METEO_BASE}?${params.toString()}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetchImpl(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`Upstream ${resp.status}`);
      const json = await resp.json() as OpenMeteoResponse;
      return mapResponse(json, lat, lon, includePollen, now());
    } finally {
      clearTimeout(t);
    }
  }

  async function getAirQuality(args: { lat: number; lon: number; includePollen?: boolean }): Promise<AirQualityPayload> {
    const includePollen = args.includePollen === true;
    const key = cacheKey(args.lat, args.lon, includePollen);
    const cached = cache.get(key);
    const tNow = now();
    if (cached && cached.expiresAt > tNow) {
      return cached.value;
    }

    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = (async (): Promise<AirQualityPayload> => {
      try {
        const value = await fetchUpstream(args.lat, args.lon, includePollen);
        cache.set(key, { value, expiresAt: now() + ttlMs });
        return value;
      } catch (err) {
        // Stale-fallback: serve last known value within staleTtlMs.
        if (cached && (now() - (cached.expiresAt - ttlMs)) < staleTtlMs) {
          return { ...cached.value, stale: true };
        }
        throw err;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  return {
    getAirQuality,
    _cacheSize: () => cache.size,
    _clear:     () => { cache.clear(); inflight.clear(); },
  };
}
