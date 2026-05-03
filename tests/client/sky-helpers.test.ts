// Sky & Ambient pack — unit tests for the sun-position math and moon
// phase helpers. Imports the real implementation from sky-helpers.ts so
// any drift fails the gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeMoonPhase,
  computeSunTimes,
  haversineKm,
  sunArcPosition,
} from '../../client/src/widgets/sky-helpers';

// ─── Sunrise / sunset ───────────────────────────────────────────────────
test('computeSunTimes: London on summer solstice has long day, sunrise < noon < sunset', () => {
  // 2025 June 21, 12:00 UTC. London ≈ 51.5074, -0.1278.
  const noonUtc = new Date(Date.UTC(2025, 5, 21, 12, 0, 0));
  const s = computeSunTimes(noonUtc, 51.5074, -0.1278);
  assert.ok(s.sunrise instanceof Date, 'sunrise computed');
  assert.ok(s.sunset instanceof Date,  'sunset computed');
  assert.ok(s.sunrise!.getTime() < s.solarNoon.getTime(), 'rise before noon');
  assert.ok(s.solarNoon.getTime() < s.sunset!.getTime(),  'noon before set');
  // London on the solstice has ~16h of daylight (give a generous range).
  const dayHours = (s.sunset!.getTime() - s.sunrise!.getTime()) / 3_600_000;
  assert.ok(dayHours > 14 && dayHours < 18, `day length ${dayHours}h within solstice band`);
});

test('computeSunTimes: London winter solstice day is short', () => {
  const noonUtc = new Date(Date.UTC(2025, 11, 21, 12, 0, 0));
  const s = computeSunTimes(noonUtc, 51.5074, -0.1278);
  const dayHours = (s.sunset!.getTime() - s.sunrise!.getTime()) / 3_600_000;
  assert.ok(dayHours > 6 && dayHours < 9.5, `winter day ${dayHours}h short`);
});

test('computeSunTimes: golden hour evening lands strictly before sunset', () => {
  const t = new Date(Date.UTC(2025, 4, 1, 12, 0, 0));
  const s = computeSunTimes(t, 40.7128, -74.0060); // NYC
  assert.ok(s.goldenHourEveningStart instanceof Date);
  assert.ok(s.sunset instanceof Date);
  assert.ok(s.goldenHourEveningStart!.getTime() < s.sunset!.getTime(),
    'golden hour starts before sunset');
  // And after solar noon — it's the *evening* boundary.
  assert.ok(s.goldenHourEveningStart!.getTime() > s.solarNoon.getTime(),
    'evening golden hour after noon');
});

test('computeSunTimes: arcFraction is 0..1 between sunrise and sunset', () => {
  const t = new Date(Date.UTC(2025, 5, 21, 12, 0, 0));
  const s = computeSunTimes(t, 51.5074, -0.1278);
  assert.ok(!Number.isNaN(s.arcFraction));
  assert.ok(s.arcFraction >= 0 && s.arcFraction <= 1,
    `arcFraction ${s.arcFraction} in range`);
  assert.equal(s.isDay, true, 'noon UTC in summer at London is daytime');
});

test('computeSunTimes: subSolarLon is between -180 and 180 and tracks UTC', () => {
  const t = new Date(Date.UTC(2025, 5, 21, 12, 0, 0));
  const s = computeSunTimes(t, 0, 0);
  assert.ok(s.subSolarLon >= -180 && s.subSolarLon <= 180);
  // At 12:00 UTC equator/0° lon, sub-solar longitude should be near 0.
  assert.ok(Math.abs(s.subSolarLon) < 5, `subSolarLon ~0 at noon UTC, got ${s.subSolarLon}`);
});

test('computeSunTimes: polar night returns null sunrise/sunset', () => {
  // Northern winter solstice well above the Arctic Circle.
  const t = new Date(Date.UTC(2025, 11, 21, 12, 0, 0));
  const s = computeSunTimes(t, 80, 0);
  assert.equal(s.sunrise, null);
  assert.equal(s.sunset, null);
  assert.equal(s.isDay, false);
});

// ─── Moon phase ─────────────────────────────────────────────────────────
test('computeMoonPhase: reference epoch returns ~new moon', () => {
  // Reference new moon: 2000-01-06 18:14 UTC.
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const m = computeMoonPhase(ref);
  assert.equal(m.index, 0);
  assert.equal(m.name, 'New Moon');
  assert.ok(m.illumination < 0.05, `illumination ${m.illumination} ≈ 0`);
});

test('computeMoonPhase: half a synodic month later is ~full moon', () => {
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const halfLater = new Date(ref.getTime() + 14.7653 * 86_400_000);
  const m = computeMoonPhase(halfLater);
  assert.equal(m.name, 'Full Moon');
  assert.ok(m.illumination > 0.95, `illumination ${m.illumination} ≈ 1`);
});

test('computeMoonPhase: fraction is in [0, 1)', () => {
  for (const days of [0, 5, 10, 15, 20, 25, 100, 1000]) {
    const d = new Date(Date.UTC(2025, 0, 1, 0, 0, 0) + days * 86_400_000);
    const m = computeMoonPhase(d);
    assert.ok(m.fraction >= 0 && m.fraction < 1, `fraction ${m.fraction}`);
    assert.ok(m.index >= 0 && m.index < 8, `index ${m.index}`);
  }
});

// ─── Haversine ──────────────────────────────────────────────────────────
test('haversineKm: London → New York is ~5570 km', () => {
  const d = haversineKm(51.5074, -0.1278, 40.7128, -74.0060);
  assert.ok(d > 5400 && d < 5700, `distance ${d}km`);
});

test('haversineKm: identical points return 0', () => {
  assert.equal(haversineKm(0, 0, 0, 0), 0);
});

// ─── Sun-arc render geometry ────────────────────────────────────────────
// Regression test for the sunrise-left/sunset-right invariant. A previous
// version of the widget mirrored the X axis, putting sunrise on the right
// and sunset on the left. The arc geometry helper now lives in
// sky-helpers.ts and is covered here.
test('sunArcPosition: t=0 is on the LEFT (sunrise side), t=1 is on the RIGHT (sunset side)', () => {
  const arcW = 200;
  const arcH = 100;
  const dotR = 8;
  const sunrise = sunArcPosition(0, arcW, arcH, dotR);
  const noon = sunArcPosition(0.5, arcW, arcH, dotR);
  const sunset = sunArcPosition(1, arcW, arcH, dotR);
  // Sunrise is on the left edge (cx − rx), sunset on the right (cx + rx).
  assert.ok(sunrise.x < noon.x, `sunrise (${sunrise.x}) should be left of noon (${noon.x})`);
  assert.ok(noon.x < sunset.x, `noon (${noon.x}) should be left of sunset (${sunset.x})`);
  const EPS = 1e-9;
  assert.ok(Math.abs(sunrise.x - dotR) < EPS, `sunrise.x ${sunrise.x} ≈ dotR`);
  assert.ok(Math.abs(sunset.x - (arcW - dotR)) < EPS, `sunset.x ${sunset.x} ≈ arcW − dotR`);
  // Sunrise/sunset both at horizon (cy), noon at the top.
  assert.ok(Math.abs(sunrise.y - arcH) < EPS);
  assert.ok(Math.abs(sunset.y - arcH) < EPS);
  assert.ok(noon.y < sunrise.y, 'noon should be above the horizon');
  assert.ok(Math.abs(noon.y - dotR) < EPS, `noon.y ${noon.y} ≈ dotR`);
});

test('sunArcPosition: clamps t outside [0,1] and tolerates NaN', () => {
  const before = sunArcPosition(-2, 200, 100, 8);
  const after = sunArcPosition(2, 200, 100, 8);
  const nan = sunArcPosition(Number.NaN, 200, 100, 8);
  const EPS = 1e-9;
  assert.ok(Math.abs(before.x - 8) < EPS);          // clamped to t=0
  assert.ok(Math.abs(after.x - (200 - 8)) < EPS);   // clamped to t=1
  assert.ok(Math.abs(nan.x - 8) < EPS);             // NaN treated as t=0
});
