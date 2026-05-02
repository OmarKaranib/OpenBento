// Frontend tests for the Markets Ticker symbol-management helpers.
//
// The widget itself is just a thin React shell over these pure functions, so
// testing them directly gives us full coverage of the validation, dedupe,
// cap, and reorder rules without spinning up a DOM. The widget's "rendered
// order" is `widget.marketsSymbols`, which is exactly what these helpers
// produce.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addSymbol,
  removeSymbol,
  moveSymbol,
  normalizeSymbol,
  MAX_SYMBOLS,
  SYMBOL_RE,
} from '../../client/src/lib/markets-symbols';

// ── normalizeSymbol ─────────────────────────────────────────────────────────

test('normalizeSymbol trims and uppercases', () => {
  assert.equal(normalizeSymbol('  btc '), 'BTC');
  assert.equal(normalizeSymbol('AAPL'), 'AAPL');
  assert.equal(normalizeSymbol(''), '');
});

// ── Invalid symbol input is rejected ───────────────────────────────────────

test('addSymbol rejects empty / whitespace input', () => {
  const r1 = addSymbol(['BTC'], '');
  const r2 = addSymbol(['BTC'], '   ');
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  if (!r1.ok) assert.equal(r1.reason, 'empty');
  if (!r2.ok) assert.equal(r2.reason, 'empty');
});

test('addSymbol rejects characters outside SYMBOL_RE (1-8 of A-Z, 0-9, ., -)', () => {
  for (const bad of ['BTC!', 'TOOLONGTICKR', 'A B', 'foo$', 'spy*', '   $$$  ']) {
    const r = addSymbol(['BTC'], bad);
    assert.equal(r.ok, false, `expected reject for "${bad}"`);
    if (!r.ok) {
      // Either invalid (failed regex) or empty (after trim).
      assert.ok(r.reason === 'invalid' || r.reason === 'empty', `unexpected reason ${r.reason} for "${bad}"`);
    }
  }
});

test('SYMBOL_RE accepts the same shape the server validates', () => {
  for (const good of ['BTC', 'ETH', 'SPY', 'AAPL', 'BRK.B', 'A', 'A1', 'ABCDEFGH']) {
    assert.ok(SYMBOL_RE.test(good), `expected accept "${good}"`);
  }
  for (const bad of ['ABCDEFGHI', 'btc', '', 'A B', '$$$']) {
    assert.ok(!SYMBOL_RE.test(bad), `expected reject "${bad}"`);
  }
});

// ── Duplicates are prevented ────────────────────────────────────────────────

test('addSymbol rejects duplicates (case-insensitive via normalize)', () => {
  const r = addSymbol(['BTC', 'ETH'], 'btc');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'duplicate');
});

test('addSymbol rejects exact-match duplicates', () => {
  const r = addSymbol(['BTC', 'ETH', 'SPY'], 'SPY');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'duplicate');
});

// ── 12-symbol cap is enforced ───────────────────────────────────────────────

test('MAX_SYMBOLS is 12 (matches widget contract)', () => {
  assert.equal(MAX_SYMBOLS, 12);
});

test('addSymbol rejects when already at the 12-symbol cap', () => {
  const full = ['BTC','ETH','SOL','ADA','DOGE','BNB','XRP','MATIC','DOT','AVAX','LTC','LINK'];
  assert.equal(full.length, MAX_SYMBOLS);
  const r = addSymbol(full, 'AAPL');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'cap');
});

test('addSymbol succeeds at cap-1 and produces an immutable new array', () => {
  const eleven = ['BTC','ETH','SOL','ADA','DOGE','BNB','XRP','MATIC','DOT','AVAX','LTC'];
  const r = addSymbol(eleven, 'AAPL');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.symbols.length, 12);
    assert.deepEqual(eleven.length, 11, 'input array must not be mutated');
    assert.equal(r.symbols[r.symbols.length - 1], 'AAPL');
  }
});

// ── Reorder updates the rendered order ──────────────────────────────────────

test('moveSymbol(idx, -1) swaps with the previous neighbor', () => {
  const result = moveSymbol(['BTC', 'ETH', 'SPY', 'AAPL'], 2, -1);
  assert.deepEqual(result, ['BTC', 'SPY', 'ETH', 'AAPL']);
});

test('moveSymbol(idx, +1) swaps with the next neighbor', () => {
  const result = moveSymbol(['BTC', 'ETH', 'SPY', 'AAPL'], 1, 1);
  assert.deepEqual(result, ['BTC', 'SPY', 'ETH', 'AAPL']);
});

test('moveSymbol at the top edge is a no-op (returns the same reference)', () => {
  const symbols = ['BTC', 'ETH', 'SPY'];
  const result = moveSymbol(symbols, 0, -1);
  assert.strictEqual(result, symbols, 'edge moves should short-circuit');
});

test('moveSymbol at the bottom edge is a no-op (returns the same reference)', () => {
  const symbols = ['BTC', 'ETH', 'SPY'];
  const result = moveSymbol(symbols, 2, 1);
  assert.strictEqual(result, symbols);
});

test('moveSymbol with out-of-range index is a no-op', () => {
  const symbols = ['BTC', 'ETH'];
  assert.strictEqual(moveSymbol(symbols, 5, 1), symbols);
  assert.strictEqual(moveSymbol(symbols, -1, 1), symbols);
});

test('moveSymbol does not mutate the input array', () => {
  const symbols = ['BTC', 'ETH', 'SPY'];
  const before = symbols.slice();
  moveSymbol(symbols, 1, -1);
  assert.deepEqual(symbols, before);
});

// ── removeSymbol ────────────────────────────────────────────────────────────

test('removeSymbol drops the target and preserves order', () => {
  const result = removeSymbol(['BTC', 'ETH', 'SPY', 'AAPL'], 'SPY');
  assert.deepEqual(result, ['BTC', 'ETH', 'AAPL']);
});

test('removeSymbol on a missing symbol returns the same reference', () => {
  const symbols = ['BTC', 'ETH'];
  assert.strictEqual(removeSymbol(symbols, 'AAPL'), symbols);
});

// ── End-to-end UI flow simulation ───────────────────────────────────────────
// The widget chains these helpers via setState; the tests below mirror the
// full add → reorder → remove journey users perform in the settings panel.

test('full UI flow: add valid → reject duplicate → reject invalid → cap → reorder → remove', () => {
  let symbols = ['BTC', 'ETH', 'SPY', 'AAPL'];

  // Add a new valid symbol
  let r = addSymbol(symbols, 'sol');
  assert.equal(r.ok, true);
  if (r.ok) symbols = r.symbols;
  assert.deepEqual(symbols, ['BTC', 'ETH', 'SPY', 'AAPL', 'SOL']);

  // Reject a duplicate
  r = addSymbol(symbols, 'BTC');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'duplicate');

  // Reject invalid
  r = addSymbol(symbols, 'B@D!');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'invalid');

  // Fill to cap
  for (const sym of ['DOGE', 'BNB', 'XRP', 'MATIC', 'DOT', 'AVAX', 'LTC']) {
    const res = addSymbol(symbols, sym);
    assert.equal(res.ok, true, `add ${sym} should succeed`);
    if (res.ok) symbols = res.symbols;
  }
  assert.equal(symbols.length, 12);
  // Cap rejection
  r = addSymbol(symbols, 'LINK');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'cap');

  // Reorder: bubble SPY (idx 2) to idx 0
  symbols = moveSymbol(symbols, 2, -1);
  symbols = moveSymbol(symbols, 1, -1);
  assert.equal(symbols[0], 'SPY');

  // Remove
  symbols = removeSymbol(symbols, 'SPY');
  assert.equal(symbols.length, 11);
  assert.ok(!symbols.includes('SPY'));

  // Now under cap, can add again
  r = addSymbol(symbols, 'LINK');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.symbols.length, 12);
});
