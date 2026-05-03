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
  assert.deepEqual(
    evaluateWordleGuess('rance', 'crane'),
    ['present', 'present', 'present', 'present', 'correct'],
  );
});

test('evaluateWordleGuess: duplicate letter in guess vs single in answer marks only one', () => {
  assert.deepEqual(
    evaluateWordleGuess('llama', 'apple'),
    ['present', 'absent', 'present', 'absent', 'absent'],
  );
});

test('evaluateWordleGuess: duplicate letter where one is correct + extra is absent', () => {
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

test('utcDateKey: returns YYYY-MM-DD in UTC', () => {
  const d = new Date(Date.UTC(2025, 4, 3, 12, 0, 0));
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
  assert.ok(seen.size > 12, `daily words across a month: ${seen.size} unique`);
});

test('pickDailyWord: result is always within the answer pool', () => {
  for (let day = 1; day <= 28; day++) {
    const w = pickDailyWord(`2025-02-${String(day).padStart(2, '0')}`);
    assert.ok(WORDLE_ANSWERS.includes(w), `${w} should be in pool`);
  }
});

// Regression guard for the widget's UTC midnight rollover: the 60s tick
// must observe a different date key the moment we cross 00:00 UTC.
test('utcDateKey: 1ms before vs after UTC midnight produces different keys', () => {
  const justBefore = new Date(Date.UTC(2025, 4, 3, 23, 59, 59, 999));
  const justAfter  = new Date(Date.UTC(2025, 4, 4,  0,  0,  0,   1));
  assert.equal(utcDateKey(justBefore), '2025-05-03');
  assert.equal(utcDateKey(justAfter),  '2025-05-04');
  assert.notEqual(
    pickDailyWord(utcDateKey(justBefore)),
    pickDailyWord(utcDateKey(justAfter)),
  );
});

test('pickFallbackQuote: deterministic on seed and stays in pool', () => {
  const a = pickFallbackQuote(12345);
  const b = pickFallbackQuote(12345);
  assert.equal(a.text, b.text);
  assert.ok(FALLBACK_QUOTES.some(q => q.text === a.text));
});
