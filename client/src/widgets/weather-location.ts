// Tiny module-level location cache. The Weather widget writes its
// resolved {lat, lon, label} here on every successful /api/weather
// response so other widgets (Sun & Sky, ISS Tracker) can reuse it
// without re-prompting for geolocation or duplicating geocoding.
//
// This is intentionally not a React store — it's a plain pub/sub so
// multiple instances of any widget can subscribe and unsubscribe
// cleanly through useEffect.

export interface ResolvedLocation { lat: number; lon: number; label: string; ts: number; }

let current: ResolvedLocation | null = null;
const listeners = new Set<(loc: ResolvedLocation) => void>();

export function getLastResolvedLocation(): ResolvedLocation | null {
  return current;
}

export function setLastResolvedLocation(loc: Omit<ResolvedLocation, 'ts'>): void {
  current = { ...loc, ts: Date.now() };
  listeners.forEach(fn => {
    try { fn(current!); } catch { /* swallow listener errors */ }
  });
}

export function subscribeLocation(fn: (loc: ResolvedLocation) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
