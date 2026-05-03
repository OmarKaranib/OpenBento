// Wellness & Focus pack — unit tests for the production helpers
// shared by Water Tracker (computeStreak) and Standup Roller
// (seededShuffle). Imports the real implementations from the
// non-JSX module so any drift between code and tests is caught.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStreak,
  dateKey,
  lastNDays,
  offsetLocalKey,
  seededShuffle,
} from '../../client/src/widgets/wellness-helpers';

function offsetKey(today: string, offset: number): string {
  const parts = today.split('-').map(n => parseInt(n, 10));
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offset);
  return dateKey(d);
}

// ─── computeStreak ──────────────────────────────────────────────────────
test('computeStreak: empty map → 0', () => {
  assert.equal(computeStreak({}, 8, '2026-05-03'), 0);
});

test('computeStreak: today met → counts today', () => {
  const today = '2026-05-03';
  assert.equal(computeStreak({ [today]: 8 }, 8, today), 1);
});

test('computeStreak: 5 consecutive days incl. today', () => {
  const today = '2026-05-03';
  const days: Record<string, number> = {};
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
    [offsetKey(today, -2)]: 0,
    [offsetKey(today, -3)]: 8,
    [offsetKey(today, -4)]: 8,
  };
  assert.equal(computeStreak(days, 8, today), 2);
});

test('computeStreak: cups below target do not count', () => {
  const today = '2026-05-03';
  const days = { [today]: 5, [offsetKey(today, -1)]: 8 };
  assert.equal(computeStreak(days, 8, today), 1);
});

test('computeStreak: target=0 → 0 (guard)', () => {
  assert.equal(computeStreak({ '2026-05-03': 5 }, 0, '2026-05-03'), 0);
});

test('computeStreak: invalid todayKey → 0 (guard)', () => {
  assert.equal(computeStreak({ '2026-05-03': 8 }, 8, 'not-a-date'), 0);
});

// ─── seededShuffle ──────────────────────────────────────────────────────
test('seededShuffle: same seed → same order (deterministic)', () => {
  const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ev', 'Fe'];
  assert.deepEqual(seededShuffle(names, 12345), seededShuffle(names, 12345));
});

test('seededShuffle: different seeds → different order', () => {
  const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ev', 'Fe', 'Gi', 'Ha'];
  assert.notDeepEqual(seededShuffle(names, 1), seededShuffle(names, 2));
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

// ─── offsetLocalKey sanity ──────────────────────────────────────────────
test('offsetLocalKey: 0 returns today, -1 returns yesterday', () => {
  const today = offsetLocalKey(0);
  const yesterday = offsetLocalKey(-1);
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(yesterday, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(today, yesterday);
});

// ─── lastNDays (Mood heatmap window) ────────────────────────────────────
test('lastNDays: returns N keys ending at today, oldest first', () => {
  const out = lastNDays(30, '2026-05-03');
  assert.equal(out.length, 30);
  assert.equal(out[29], '2026-05-03');
  assert.equal(out[28], '2026-05-02');
  assert.equal(out[0], '2026-04-04');
});

test('lastNDays: midnight rollover shifts the window forward by one day', () => {
  // Simulates the Mood Check-in widget rerendering at local midnight: the
  // todayKey changes, so the heatmap window slides forward, the new today
  // appears at the tail, and the oldest day falls off the head.
  const beforeMidnight = lastNDays(30, '2026-05-03');
  const afterMidnight  = lastNDays(30, '2026-05-04');
  assert.equal(afterMidnight[29], '2026-05-04');
  assert.equal(afterMidnight[0],  '2026-04-05');
  assert.notEqual(afterMidnight[29], beforeMidnight[29]);
  // The 29 overlapping days should match: shifted-by-one alignment.
  for (let i = 0; i < 29; i++) {
    assert.equal(afterMidnight[i], beforeMidnight[i + 1]);
  }
});

test('lastNDays: invalid todayKey → empty array (guard)', () => {
  assert.deepEqual(lastNDays(30, 'not-a-date'), []);
});
