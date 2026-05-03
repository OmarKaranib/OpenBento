// Pure helpers shared by the Wellness pack widgets.
// Extracted from shared.tsx so they can be imported by node-only test
// runners (no React/JSX in this file).

// ─── Local-date keys (YYYY-MM-DD in the user's local TZ) ─────────────────
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
export function todayLocalKey(): string {
  return dateKey(new Date());
}
export function offsetLocalKey(offset: number, base?: Date): string {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offset);
  return dateKey(d);
}

// ─── Streak calculator ───────────────────────────────────────────────────
// A day "counts" if days[k] >= target. Today is allowed to be short
// without immediately killing the streak (we resume from yesterday).
export function computeStreak(
  days: Record<string, number>,
  target: number,
  todayKey: string,
): number {
  if (target <= 0) return 0;
  const parts = todayKey.split('-').map(n => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return 0;
  const cursor = new Date(parts[0], parts[1] - 1, parts[2]);
  let streak = 0;
  if ((days[todayKey] ?? 0) < target) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 366; i++) {
    const k = dateKey(cursor);
    if ((days[k] ?? 0) >= target) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

// ─── Seeded shuffle (mulberry32 + Fisher–Yates) ──────────────────────────
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}
