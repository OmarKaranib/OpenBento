// Knowledge & Play pack — unit tests for the Wordle evaluator and the
// daily-word seed helpers. Imports the real implementation from
// client/src/widgets/play-helpers.ts so any drift fails the gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateWordleGuess,
  fnv1a32,
  pickDailyWord,
  pickFallbackQuote,
  utcDateKey,
  WORDLE_ANSWERS,
  FALLBACK_QUOTES,
} from '../../client/src/widgets/play-helpers';

// ─── Wordle evaluator ──────────────────────────────────────────────────
test('evaluateWordleGuess: all-correct returns five correct verdicts', () => {
  assert.deepEqual(
    evaluateWordleGuess('apple', 'apple'),
    ['correct', 'correct', 'correct', 'correct', 'correct'],
  );
});

test('evaluateWordleGuess: all-absent returns five absent verdicts', () => {
  assert.deepEqual(
    evaluateWordleGuess('zzzzz', 'apple'),
    ['absent', 'absent', 'absent', 'absent', 'absent'],
  );
});

test('evaluateWordleGuess: mixed correct + present + absent', () => {
  // answer = "crane", guess = "rance":
  //  r vs c → 'present' (r is in answer at idx 1, not consumed)
  //  a vs r → 'present' (a is in answer at idx 2, not consumed)
  //  n vs a → 'present' (n is in answer at idx 3, not consumed)
  //  c vs n → 'present' (c is in answer at idx 0, not consumed)
  //  e vs e → 'correct'
  assert.deepEqual(
    evaluateWordleGuess('rance', 'crane'),
    ['present', 'present', 'present', 'present', 'correct'],
  );
});

test('evaluateWordleGuess: duplicate letter in guess vs single in answer marks only one', () => {
  // answer = "apple", guess = "llama":
  //  l vs a → 'present' (consume 'l' at idx 3)
  //  l vs p → 'absent'   (no more 'l' to consume)
  //  a vs p → 'present' (consume 'a' at idx 0)
  //  m vs l → 'absent'
  //  a vs e → 'absent'   (no more 'a' to consume)
  assert.deepEqual(
    evaluateWordleGuess('llama', 'apple'),
    ['present', 'absent', 'present', 'absent', 'absent'],
  );
});

test('evaluateWordleGuess: duplicate letter where one is correct + extra is absent', () => {
  // answer = "apple", guess = "pulps":
  //  p vs a → 'present' (consume answer p at idx 1)
  //  u vs p → 'absent'
  //  l vs p → 'absent' (no unconsumed p left after exact match below)
  //  p vs l → 'correct' (exact match wins, consumes idx 3? wait answer[3] is l)
  // Re-derive carefully: answer = a,p,p,l,e ; guess = p,u,l,p,s
  // Pass 1 (exact):
  //   i=0: g=p a=a → no
  //   i=1: g=u a=p → no
  //   i=2: g=l a=p → no
  //   i=3: g=p a=l → no
  //   i=4: g=s a=e → no
  // Pass 2 (present): no exacts consumed yet.
  //   i=0 p: scan answer for p, find idx 1 → 'present', consume idx 1
  //   i=1 u: not in answer → 'absent'
  //   i=2 l: scan, find idx 3 → 'present', consume idx 3
  //   i=3 p: scan, idx 1 consumed, idx 2 has p → 'present', consume idx 2
  //   i=4 s: not in answer → 'absent'
  assert.deepEqual(
    evaluateWordleGuess('pulps', 'apple'),
    ['present', 'absent', 'present', 'present', 'absent'],
  );
});

test('evaluateWordleGuess: case-insensitive', () => {
  assert.deepEqual(
    evaluateWordleGuess('APPLE', 'apple'),
    ['correct', 'correct', 'correct', 'correct', 'correct'],
  );
});

// ─── Daily seed determinism ────────────────────────────────────────────
test('utcDateKey: returns YYYY-MM-DD in UTC', () => {
  const d = new Date(Date.UTC(2025, 4, 3, 12, 0, 0)); // 2025-05-03
  assert.equal(utcDateKey(d), '2025-05-03');
});

test('fnv1a32: deterministic', () => {
  assert.equal(fnv1a32('hello'), fnv1a32('hello'));
  assert.notEqual(fnv1a32('hello'), fnv1a32('hellp'));
});

test('pickDailyWord: same date returns same word', () => {
  const a = pickDailyWord('2025-05-03');
  const b = pickDailyWord('2025-05-03');
  assert.equal(a, b);
  assert.equal(a.length, 5);
});

test('pickDailyWord: different dates usually return different words across a month', () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 30; day++) {
    seen.add(pickDailyWord(`2025-05-${String(day).padStart(2, '0')}`));
  }
  // Won't be 30 unique always, but should be a healthy spread.
  assert.ok(seen.size > 12, `daily words across a month: ${seen.size} unique`);
});

test('pickDailyWord: result is always within the answer pool', () => {
  for (let day = 1; day <= 28; day++) {
    const w = pickDailyWord(`2025-02-${String(day).padStart(2, '0')}`);
    assert.ok(WORDLE_ANSWERS.includes(w), `${w} should be in pool`);
  }
});

// ─── Fallback quote pool ───────────────────────────────────────────────
// Regression guard for the UTC midnight rollover behaviour the Wordle
// widget relies on. Polling `utcDateKey(new Date())` must yield a
// strictly different key the moment we cross 00:00 UTC, so the widget's
// 60-second tick can detect the new day and reset the board.
test('utcDateKey: 1ms before vs after UTC midnight produces different keys', () => {
  const justBefore = new Date(Date.UTC(2025, 4, 3, 23, 59, 59, 999));
  const justAfter  = new Date(Date.UTC(2025, 4, 4,  0,  0,  0,   1));
  assert.equal(utcDateKey(justBefore), '2025-05-03');
  assert.equal(utcDateKey(justAfter),  '2025-05-04');
  assert.notEqual(
    pickDailyWord(utcDateKey(justBefore)),
    pickDailyWord(utcDateKey(justAfter)),
    'day rollover should (almost always) yield a different daily word',
  );
});

test('pickFallbackQuote: deterministic on seed and stays in pool', () => {
  const a = pickFallbackQuote(12345);
  const b = pickFallbackQuote(12345);
  assert.equal(a.text, b.text);
  assert.ok(FALLBACK_QUOTES.some(q => q.text === a.text));
});
