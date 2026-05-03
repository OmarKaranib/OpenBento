// Pure helpers shared by the Sky & Ambient pack widgets.
// No React/JSX so node-only test runners can import this directly.
//
// Sun-position math is a compact NOAA/SunCalc-style port:
//   - sunrise / sunset from hour-angle formula
//   - golden hour boundary at solar altitude +6°
//   - sub-solar longitude (used by Earth-at-Night terminator)
// Moon phase uses synodic month from a known new-moon reference.

const PI = Math.PI;
const rad = PI / 180;
const dayMs = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const obliquity = rad * 23.4397;

function toJulian(d: Date): number {
  return d.getTime() / dayMs - 0.5 + J1970;
}
function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * dayMs);
}
function toDays(d: Date): number {
  return toJulian(d) - J2000;
}

function solarMeanAnomaly(d: number): number {
  return rad * (357.5291 + 0.98560028 * d);
}
function eclipticLongitude(M: number): number {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372;
  return M + C + P + PI;
}
function declination(L: number): number {
  return Math.asin(Math.sin(obliquity) * Math.sin(L));
}
function julianCycle(d: number, lw: number): number {
  return Math.round(d - 0.0009 - lw / (2 * PI));
}
function approxTransit(Ht: number, lw: number, n: number): number {
  return 0.0009 + (Ht + lw) / (2 * PI) + n;
}
function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}
function hourAngle(h: number, phi: number, d: number): number {
  const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d));
  if (cosH > 1 || cosH < -1) return NaN;
  return Math.acos(cosH);
}

export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date;
  goldenHourEveningStart: Date | null;
  goldenHourMorningEnd: Date | null;
  /** Fraction of the day-arc the sun has traversed: 0 at sunrise, 1 at sunset. NaN at polar day/night. */
  arcFraction: number;
  /** True when `now` is between sunrise and sunset. */
  isDay: boolean;
  /** Sub-solar longitude in degrees (where the sun is directly overhead). */
  subSolarLon: number;
}

export function computeSunTimes(now: Date, lat: number, lon: number): SunTimes {
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(now);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);
  const solarNoon = fromJulian(Jnoon);

  const hSunset = rad * -0.833;
  const wSet = hourAngle(hSunset, phi, dec);
  const hasArc = !Number.isNaN(wSet);
  const Jset = hasArc ? solarTransitJ(approxTransit(wSet, lw, n), M, L) : NaN;
  const Jrise = hasArc ? Jnoon - (Jset - Jnoon) : NaN;

  const hGold = rad * 6;
  const wGold = hourAngle(hGold, phi, dec);
  const hasGolden = !Number.isNaN(wGold) && hasArc;
  const JgoldenEvening = hasGolden ? solarTransitJ(approxTransit(wGold, lw, n), M, L) : NaN;
  const JgoldenMorning = hasGolden ? Jnoon - (JgoldenEvening - Jnoon) : NaN;

  let arcFraction = NaN;
  let isDay = false;
  if (hasArc) {
    const t = now.getTime();
    const ts = fromJulian(Jset).getTime();
    const tr = fromJulian(Jrise).getTime();
    arcFraction = (t - tr) / (ts - tr);
    isDay = t >= tr && t <= ts;
  }

  // Sub-solar longitude (degrees east). At solar noon at lon, the sun is
  // overhead — so subSolarLon = lon - 15 * hoursSinceNoon (UTC).
  const hoursFromNoonUTC = (now.getTime() - solarNoon.getTime()) / 3_600_000 + lon / 15;
  let subSolarLon = -15 * hoursFromNoonUTC;
  subSolarLon = ((subSolarLon + 540) % 360) - 180;

  return {
    sunrise: hasArc ? fromJulian(Jrise) : null,
    sunset: hasArc ? fromJulian(Jset) : null,
    solarNoon,
    goldenHourEveningStart: hasGolden ? fromJulian(JgoldenEvening) : null,
    goldenHourMorningEnd: hasGolden ? fromJulian(JgoldenMorning) : null,
    arcFraction,
    isDay,
    subSolarLon,
  };
}

// ─── Moon phase ─────────────────────────────────────────────────────────
// Reference new moon: 2000-01-06 18:14 UTC. Synodic month: 29.530588853 d.
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC = 29.530588853;

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

const PHASE_GLYPHS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'] as const;

export interface MoonPhase {
  /** 0..1 fraction of the synodic month since last new moon. */
  fraction: number;
  /** 0..7 bucket index (new, waxing crescent, … waning crescent). */
  index: number;
  name: string;
  glyph: string;
  /** 0..1 illuminated disk fraction. */
  illumination: number;
}

export function computeMoonPhase(now: Date): MoonPhase {
  const days = (now.getTime() - REF_NEW_MOON_MS) / dayMs;
  const fraction = ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
  // 8 equal buckets centred on new (0), first quarter (0.25), full (0.5),
  // last quarter (0.75). Each bucket spans 1/8 = 0.125.
  const index = Math.floor((fraction + 1 / 16) * 8) % 8;
  const illumination = (1 - Math.cos(2 * PI * fraction)) / 2;
  return {
    fraction,
    index,
    name: PHASE_NAMES[index],
    glyph: PHASE_GLYPHS[index],
    illumination,
  };
}

// ─── Great-circle distance (km) for ISS overhead estimate ────────────────
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
