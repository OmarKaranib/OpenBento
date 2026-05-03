// Client-side helper tests for the Air Quality widget. Verifies the
// pure category mapping + dominant-pollutant ranking + pollen scaling
// from the shared module that the renderer imports. Kept as a plain
// .ts test so the node test runner can execute it without a browser
// or a JSX runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aqiCategory,
  dominantPollutant,
  pollutantLabel,
  pollenLevel,
  pollenLabel,
  pollenColor,
  maxPollenLevel,
  type PollutantBag,
} from '../../shared/air-quality';

test('aqiCategory: every band has a non-empty label, color and advice', () => {
  for (const v of [0, 51, 101, 151, 201, 301]) {
    const c = aqiCategory(v);
    assert.ok(c.label && c.label.length > 0);
    assert.match(c.color, /^#[0-9a-f]{6}$/i);
    assert.match(c.fg,    /^#[0-9a-f]{6}$/i);
    assert.ok(c.advice.length > 0);
  }
});

test('aqiCategory: boundary values land in the lower band (≤ rule)', () => {
  assert.equal(aqiCategory(50).label,  'Good');
  assert.equal(aqiCategory(100).label, 'Moderate');
  assert.equal(aqiCategory(150).label, 'Unhealthy for Sensitive Groups');
  assert.equal(aqiCategory(200).label, 'Unhealthy');
  assert.equal(aqiCategory(300).label, 'Very Unhealthy');
});

test('pollutantLabel: returns pretty label with subscripts for gases', () => {
  assert.equal(pollutantLabel('pm2_5'), 'PM2.5');
  assert.equal(pollutantLabel('pm10'),  'PM10');
  assert.equal(pollutantLabel('o3'),    'O\u2083');
  assert.equal(pollutantLabel('no2'),   'NO\u2082');
  assert.equal(pollutantLabel('so2'),   'SO\u2082');
  assert.equal(pollutantLabel('co'),    'CO');
});

test('dominantPollutant: ranks by ratio against EPA "Good" ceiling', () => {
  // PM10 30/54 = 0.55 vs PM2.5 6/12 = 0.5 → PM10 wins.
  const p1: PollutantBag = { pm2_5: 6, pm10: 30, o3: 0, no2: null, so2: null, co: null };
  assert.equal(dominantPollutant(p1), 'pm10');

  // Tie-breaker: first-found greater-than wins. Make NO2 dominant.
  const p2: PollutantBag = { pm2_5: 1, pm10: 1, o3: 1, no2: 200, so2: 1, co: 1 };
  assert.equal(dominantPollutant(p2), 'no2');
});

test('dominantPollutant: zero/negative readings are ignored', () => {
  const p: PollutantBag = { pm2_5: 0, pm10: -5, o3: 30, no2: 0, so2: 0, co: 0 };
  assert.equal(dominantPollutant(p), 'o3');
});

test('pollenLevel: thresholds match the documented bands', () => {
  assert.equal(pollenLevel(0),     'low');
  assert.equal(pollenLevel(19),    'low');
  assert.equal(pollenLevel(20),    'moderate');
  assert.equal(pollenLevel(79),    'moderate');
  assert.equal(pollenLevel(80),    'high');
  assert.equal(pollenLevel(199),   'high');
  assert.equal(pollenLevel(200),   'very_high');
  assert.equal(pollenLevel(99999), 'very_high');
});

test('pollenLabel/pollenColor: include human-friendly text + valid hex', () => {
  for (const lvl of ['low','moderate','high','very_high'] as const) {
    assert.ok(pollenLabel(lvl).length > 0);
    assert.match(pollenColor(lvl), /^#[0-9a-f]{6}$/i);
  }
  assert.equal(pollenLabel(null), 'No data');
  assert.equal(pollenColor(null), '#64748b');
  assert.equal(pollenLabel('very_high'), 'Very High');
});

test('maxPollenLevel: returns the worst across species; null when empty', () => {
  assert.equal(
    maxPollenLevel({ alder: 5, birch: 25, grass: 100, mugwort: null, olive: null, ragweed: null }),
    'high',
  );
  assert.equal(
    maxPollenLevel({ alder: null, birch: null, grass: null, mugwort: null, olive: null, ragweed: null }),
    null,
  );
});
