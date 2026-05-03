// Wellness & Focus pack — pure-logic tests for the streak calculator
// and the seeded shuffle. We intentionally re-implement the helpers
// here in plain JS so this `node --test` runner does not have to load
// React/TSX. The implementations MUST stay in lockstep with
// client/src/widgets/shared.tsx (computeStreak, mulberry32,
// seededShuffle) — if you touch one, touch the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function offsetKey(today, offset) {
  const parts = today.split('-').map(n => parseInt(n, 10));
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offset);
  return dateKey(d);
}

function computeStreak(days, target, todayKey) {
  if (target <= 0) return 0;
  const parts = todayKey.split('-').map(n => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return 0;
  const cursor = new Date(parts[0], parts[1] - 1, parts[2]);
  let streak = 0;
  if ((days[todayKey] ?? 0) < target) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 366; i++) {
    const k = dateKey(cursor);
    if ((days[k] ?? 0) >= target) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const out = arr.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

// ─── computeStreak ──────────────────────────────────────────────────────────
test('computeStreak: empty map → 0', () => {
  assert.equal(computeStreak({}, 8, '2026-05-03'), 0);
});

test('computeStreak: today met → counts today', () => {
  const today = '2026-05-03';
  const days = { [today]: 8 };
  assert.equal(computeStreak(days, 8, today), 1);
});

test('computeStreak: 5 consecutive days incl. today', () => {
  const today = '2026-05-03';
  const days = {};
  for (let i = 0; i < 5; i++) days[offsetKey(today, -i)] = 8;
  assert.equal(computeStreak(days, 8, today), 5);
});

test('computeStreak: today not yet met but yesterday is — streak from yesterday', () => {
  const today = '2026-05-03';
  const days = {
    [offsetKey(today, -1)]: 8,
    [offsetKey(today, -2)]: 8,
    [offsetKey(today, -3)]: 8,
  };
  assert.equal(computeStreak(days, 8, today), 3);
});

test('computeStreak: gap breaks streak', () => {
  const today = '2026-05-03';
  const days = {
    [today]: 8,
    [offsetKey(today, -1)]: 8,
    [offsetKey(today, -2)]: 0, // miss
    [offsetKey(today, -3)]: 8,
    [offsetKey(today, -4)]: 8,
  };
  assert.equal(computeStreak(days, 8, today), 2);
});

test('computeStreak: cups below target do not count', () => {
  const today = '2026-05-03';
  const days = { [today]: 5, [offsetKey(today, -1)]: 8 };
  // today=5 < 8 → falls back to yesterday which is 8 → streak=1
  assert.equal(computeStreak(days, 8, today), 1);
});

test('computeStreak: target=0 → 0 (guard)', () => {
  assert.equal(computeStreak({ '2026-05-03': 5 }, 0, '2026-05-03'), 0);
});

// ─── seededShuffle ──────────────────────────────────────────────────────────
test('seededShuffle: same seed → same order (deterministic)', () => {
  const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ev', 'Fe'];
  const a = seededShuffle(names, 12345);
  const b = seededShuffle(names, 12345);
  assert.deepEqual(a, b);
});

test('seededShuffle: different seeds → (almost always) different order', () => {
  const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ev', 'Fe', 'Gi', 'Ha'];
  const a = seededShuffle(names, 1);
  const b = seededShuffle(names, 2);
  assert.notDeepEqual(a, b);
});

test('seededShuffle: preserves multiset (no drops, no dupes)', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const out = seededShuffle(names, 99);
  assert.equal(out.length, names.length);
  assert.deepEqual([...out].sort(), [...names].sort());
});

test('seededShuffle: pure — does not mutate input', () => {
  const names = ['x', 'y', 'z'];
  const snapshot = names.slice();
  seededShuffle(names, 7);
  assert.deepEqual(names, snapshot);
});

test('seededShuffle: empty + single-element are no-ops', () => {
  assert.deepEqual(seededShuffle([], 1), []);
  assert.deepEqual(seededShuffle(['solo'], 1), ['solo']);
});
