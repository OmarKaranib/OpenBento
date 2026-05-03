// Pure helpers + types for the Air Quality widget. Lives in `shared/` so
// both the React widget (browser) and the Node test runner can import
// without crossing alias or JSX boundaries.

export type PollutantKey = 'pm2_5' | 'pm10' | 'o3' | 'no2' | 'so2' | 'co';

export interface PollutantBag {
  pm2_5: number | null;
  pm10:  number | null;
  o3:    number | null;
  no2:   number | null;
  so2:   number | null;
  co:    number | null;
}

export type PollenLevel = 'low' | 'moderate' | 'high' | 'very_high';

export interface PollenBag {
  alder:    number | null;
  birch:    number | null;
  grass:    number | null;
  mugwort:  number | null;
  olive:    number | null;
  ragweed:  number | null;
  maxLevel: PollenLevel | null;
}

export interface AirQualityPayload {
  lat:         number;
  lon:         number;
  fetchedAt:   number;          // ms epoch
  observedAt:  string | null;   // ISO string from upstream `current.time`
  aqi:         number | null;   // US AQI
  pollutants:  PollutantBag;
  dominant:    PollutantKey | null;
  pollen:      PollenBag | null; // null when not requested / unavailable
  stale?:      boolean;          // true when served from stale fallback
}

export interface AqiCategory {
  /** 0..5 — index into AQI_BANDS for ordering / bar fills. */
  bandIdx: number;
  label:   string;
  color:   string; // background swatch
  fg:      string; // accessible foreground on the swatch
  advice:  string; // one-line health guidance
}

// US EPA AQI breakpoints. Order matters — first match wins.
const AQI_BANDS: ReadonlyArray<AqiCategory & { hi: number }> = [
  { hi: 50,  bandIdx: 0, label: 'Good',                            color: '#22c55e', fg: '#052e16', advice: 'Air quality is satisfactory.' },
  { hi: 100, bandIdx: 1, label: 'Moderate',                        color: '#eab308', fg: '#3a2e00', advice: 'Acceptable for most.' },
  { hi: 150, bandIdx: 2, label: 'Unhealthy for Sensitive Groups',  color: '#f97316', fg: '#3b1306', advice: 'Sensitive groups should limit outdoor exertion.' },
  { hi: 200, bandIdx: 3, label: 'Unhealthy',                       color: '#ef4444', fg: '#3a0a0a', advice: 'Reduce prolonged outdoor exertion.' },
  { hi: 300, bandIdx: 4, label: 'Very Unhealthy',                  color: '#a855f7', fg: '#1f0934', advice: 'Avoid outdoor activity.' },
  { hi: Infinity, bandIdx: 5, label: 'Hazardous',                  color: '#7f1d1d', fg: '#fef2f2', advice: 'Stay indoors. Health emergency.' },
];

/**
 * Maps a US AQI value to its EPA category. `null`/non-finite input falls
 * back to the "Moderate" band so the UI can still render a placeholder
 * chip without crashing.
 */
export function aqiCategory(aqi: number | null | undefined): AqiCategory {
  if (aqi == null || !Number.isFinite(aqi) || aqi < 0) {
    return { bandIdx: 1, label: 'Unknown', color: '#64748b', fg: '#f1f5f9', advice: 'No data available.' };
  }
  for (const band of AQI_BANDS) {
    if (aqi <= band.hi) {
      const { hi: _hi, ...rest } = band;
      return rest;
    }
  }
  // Unreachable — last band is Infinity.
  const last = AQI_BANDS[AQI_BANDS.length - 1];
  const { hi: _hi, ...rest } = last;
  return rest;
}

// Per-pollutant "moderate ceiling" used to rank dominant pollutant.
// Values are intentionally aligned with the EPA "Good/Moderate" cutoffs
// (µg/m³ for particulates and gases, except CO which is µg/m³ ≈ 4.4 ppm
// 8-hour). The ratio (concentration ÷ ceiling) is a stable proxy for
// each pollutant's relative contribution to AQI.
const POLLUTANT_CEILINGS: Record<PollutantKey, number> = {
  pm2_5: 12,
  pm10:  54,
  o3:    100,
  no2:   53,
  so2:   35,
  co:    4400,
};

const POLLUTANT_LABELS: Record<PollutantKey, string> = {
  pm2_5: 'PM2.5',
  pm10:  'PM10',
  o3:    'O\u2083',
  no2:   'NO\u2082',
  so2:   'SO\u2082',
  co:    'CO',
};

/** Pretty label for a pollutant key (e.g. 'pm2_5' → 'PM2.5'). */
export function pollutantLabel(k: PollutantKey): string {
  return POLLUTANT_LABELS[k];
}

/**
 * Returns the pollutant with the highest ratio against its EPA "Good"
 * ceiling. Returns `null` if every reading is missing or non-positive.
 */
export function dominantPollutant(p: PollutantBag | null | undefined): PollutantKey | null {
  if (!p) return null;
  let best: PollutantKey | null = null;
  let bestRatio = -Infinity;
  (Object.keys(POLLUTANT_CEILINGS) as PollutantKey[]).forEach((k) => {
    const v = p[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return;
    const r = v / POLLUTANT_CEILINGS[k];
    if (r > bestRatio) { bestRatio = r; best = k; }
  });
  return best;
}

/**
 * Pollen severity from grains/m³. Thresholds intentionally pessimistic
 * (matches the National Allergy Bureau's "tree pollen" scale, which is
 * the worst case across the species we sample).
 */
export function pollenLevel(grainsPerM3: number | null | undefined): PollenLevel | null {
  if (grainsPerM3 == null || !Number.isFinite(grainsPerM3) || grainsPerM3 < 0) return null;
  if (grainsPerM3 < 20)  return 'low';
  if (grainsPerM3 < 80)  return 'moderate';
  if (grainsPerM3 < 200) return 'high';
  return 'very_high';
}

const POLLEN_RANK: Record<PollenLevel, number> = { low: 0, moderate: 1, high: 2, very_high: 3 };

/** Highest level across every pollen species in the bag, or null. */
export function maxPollenLevel(p: Omit<PollenBag, 'maxLevel'> | null | undefined): PollenLevel | null {
  if (!p) return null;
  let best: PollenLevel | null = null;
  for (const k of ['alder','birch','grass','mugwort','olive','ragweed'] as const) {
    const lvl = pollenLevel(p[k]);
    if (lvl && (!best || POLLEN_RANK[lvl] > POLLEN_RANK[best])) best = lvl;
  }
  return best;
}

const POLLEN_COLORS: Record<PollenLevel, string> = {
  low:       '#22c55e',
  moderate:  '#eab308',
  high:      '#f97316',
  very_high: '#ef4444',
};

export function pollenColor(level: PollenLevel | null): string {
  if (!level) return '#64748b';
  return POLLEN_COLORS[level];
}

export function pollenLabel(level: PollenLevel | null): string {
  if (!level) return 'No data';
  return level === 'very_high' ? 'Very High' : level.charAt(0).toUpperCase() + level.slice(1);
}
