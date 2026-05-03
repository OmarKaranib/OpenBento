// Backend tests for the Air Quality service. Mirrors markets.test.ts:
// drives `createAirQualityService` with a fake fetch + injectable clock so
// we can assert TTL caching, stale fallback within window, and graceful
// surface of upstream errors past the stale window. Also runs the route
// handler in-process for end-to-end HTTP-level assertions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import http from 'node:http';

import {
  createAirQualityService,
  AIR_QUALITY_TTL_MS,
  AIR_QUALITY_STALE_MS,
  geocodeCity,
} from '../../server/air-quality';
import { aqiCategory, dominantPollutant, pollenLevel, maxPollenLevel } from '../../shared/air-quality';

// ── Fake fetch builder ──────────────────────────────────────────────────────
type FakeResponse = { ok: boolean; status: number; body: any };
function makeFakeFetch() {
  const calls: string[] = [];
  let nextResponse: FakeResponse = { ok: true, status: 200, body: {} };
  let throwNext = false;
  const fakeFetch = async (input: any) => {
    calls.push(typeof input === 'string' ? input : String(input));
    if (throwNext) {
      throwNext = false;
      throw new Error('Network down');
    }
    return {
      ok: nextResponse.ok,
      status: nextResponse.status,
      json: async () => nextResponse.body,
    };
  };
  return {
    fetch: fakeFetch,
    calls,
    setResponse(r: FakeResponse) { nextResponse = r; },
    throwOnce() { throwNext = true; },
  };
}

function happyPayload(usAqi: number, pm2_5: number = 8) {
  return {
    ok: true, status: 200,
    body: {
      current: {
        time:             '2026-05-03T12:00',
        us_aqi:           usAqi,
        pm2_5,
        pm10:             18,
        ozone:            72,
        nitrogen_dioxide: 14,
        sulphur_dioxide:  3,
        carbon_monoxide:  240,
      },
    },
  };
}

// ── Pure helpers ────────────────────────────────────────────────────────────

test('aqiCategory: maps every EPA band correctly', () => {
  assert.equal(aqiCategory(0).label,   'Good');
  assert.equal(aqiCategory(50).label,  'Good');
  assert.equal(aqiCategory(51).label,  'Moderate');
  assert.equal(aqiCategory(100).label, 'Moderate');
  assert.equal(aqiCategory(101).label, 'Unhealthy for Sensitive Groups');
  assert.equal(aqiCategory(150).label, 'Unhealthy for Sensitive Groups');
  assert.equal(aqiCategory(151).label, 'Unhealthy');
  assert.equal(aqiCategory(200).label, 'Unhealthy');
  assert.equal(aqiCategory(201).label, 'Very Unhealthy');
  assert.equal(aqiCategory(300).label, 'Very Unhealthy');
  assert.equal(aqiCategory(301).label, 'Hazardous');
  assert.equal(aqiCategory(999).label, 'Hazardous');
});

test('aqiCategory: bandIdx is monotonic', () => {
  const indices = [0, 51, 101, 151, 201, 301].map(v => aqiCategory(v).bandIdx);
  for (let i = 1; i < indices.length; i++) {
    assert.ok(indices[i] > indices[i - 1], `band ${i} must be greater than ${i - 1}`);
  }
});

test('aqiCategory: null/NaN/negative falls back to Unknown', () => {
  assert.equal(aqiCategory(null).label, 'Unknown');
  assert.equal(aqiCategory(undefined).label, 'Unknown');
  assert.equal(aqiCategory(NaN).label, 'Unknown');
  assert.equal(aqiCategory(-5).label, 'Unknown');
});

test('dominantPollutant: picks the highest ratio, ignores nulls', () => {
  // PM2.5 12 ceiling → 24/12 = 2.0; PM10 54 ceiling → 30/54 = 0.55 → PM2.5 wins.
  assert.equal(dominantPollutant({ pm2_5: 24, pm10: 30, o3: 50, no2: 10, so2: 1, co: 200 }), 'pm2_5');
  // Bump O3 way up → O3 wins.
  assert.equal(dominantPollutant({ pm2_5: 5, pm10: 10, o3: 250, no2: 10, so2: 1, co: 200 }), 'o3');
});

test('dominantPollutant: returns null when every reading is missing', () => {
  assert.equal(dominantPollutant({ pm2_5: null, pm10: null, o3: null, no2: null, so2: null, co: null }), null);
  assert.equal(dominantPollutant(null), null);
  assert.equal(dominantPollutant(undefined), null);
});

test('pollenLevel: classifies grains/m³ into the 4 NAB bands', () => {
  assert.equal(pollenLevel(0),    'low');
  assert.equal(pollenLevel(15),   'low');
  assert.equal(pollenLevel(30),   'moderate');
  assert.equal(pollenLevel(120),  'high');
  assert.equal(pollenLevel(500),  'very_high');
  assert.equal(pollenLevel(null), null);
  assert.equal(pollenLevel(NaN),  null);
});

test('maxPollenLevel: returns the worst across all species', () => {
  const lvl = maxPollenLevel({ alder: 5, birch: 30, grass: 0, mugwort: null, olive: null, ragweed: 250 });
  assert.equal(lvl, 'very_high');
  const allLow = maxPollenLevel({ alder: 1, birch: 2, grass: 0, mugwort: null, olive: null, ragweed: 5 });
  assert.equal(allLow, 'low');
  assert.equal(maxPollenLevel(null), null);
});

// ── Cache hit within TTL ────────────────────────────────────────────────────

test('cache hit within 15 min returns same payload without re-fetching', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(42));

  let nowMs = 1_700_000_000_000;
  const svc = createAirQualityService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
  });

  const first = await svc.getAirQuality({ lat: 40.7, lon: -74.0 });
  assert.equal(first.aqi, 42);
  assert.equal(fake.calls.length, 1);

  // Still well under the TTL.
  nowMs += AIR_QUALITY_TTL_MS - 1;
  const second = await svc.getAirQuality({ lat: 40.7, lon: -74.0 });
  assert.equal(fake.calls.length, 1, 'cache hit must not refetch');
  assert.strictEqual(second, first, 'returns same cached object');
});

test('cache key rounds lat/lon to ~1 km so neighbours share entries', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(60));
  const svc = createAirQualityService({ fetchImpl: fake.fetch as any });

  await svc.getAirQuality({ lat: 40.704, lon: -74.001 });
  await svc.getAirQuality({ lat: 40.701, lon: -74.004 });
  assert.equal(fake.calls.length, 1, 'second nearby call should hit the cache');
});

test('pollen flag produces a separate cache key', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(30));
  const svc = createAirQualityService({ fetchImpl: fake.fetch as any });

  await svc.getAirQuality({ lat: 51.5, lon: -0.12 });
  await svc.getAirQuality({ lat: 51.5, lon: -0.12, includePollen: true });
  assert.equal(fake.calls.length, 2, 'pollen variant must not collide with no-pollen cache');
  // The pollen URL must include the hourly param.
  assert.ok(fake.calls[1].includes('hourly='), 'pollen request includes hourly fields');
  assert.ok(!fake.calls[0].includes('hourly='), 'no-pollen request omits hourly');
});

// ── Cache expiry ────────────────────────────────────────────────────────────

test('cache expires past TTL and triggers a fresh upstream call', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(42));
  let nowMs = 1_700_000_000_000;
  const svc = createAirQualityService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
  });

  await svc.getAirQuality({ lat: 0, lon: 0 });
  assert.equal(fake.calls.length, 1);

  nowMs += AIR_QUALITY_TTL_MS + 1;
  fake.setResponse(happyPayload(123));
  const next = await svc.getAirQuality({ lat: 0, lon: 0 });
  assert.equal(fake.calls.length, 2);
  assert.equal(next.aqi, 123);
});

// ── Stale fallback ──────────────────────────────────────────────────────────

test('stale-cache fallback fires when upstream fails (within stale window)', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(75));
  let nowMs = 1_700_000_000_000;
  const svc = createAirQualityService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
  });

  const primed = await svc.getAirQuality({ lat: 1, lon: 1 });
  assert.equal(primed.aqi, 75);
  assert.equal(primed.stale, undefined);

  // Past TTL but well within stale window. Upstream now broken.
  nowMs += AIR_QUALITY_TTL_MS + 1_000;
  fake.throwOnce();

  const stale = await svc.getAirQuality({ lat: 1, lon: 1 });
  assert.equal(stale.aqi, 75, 'serves last known value');
  assert.equal(stale.stale, true, 'flags the response as stale');
});

test('stale fallback expires past 6 h and surfaces the upstream error', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(50));
  let nowMs = 1_700_000_000_000;
  const svc = createAirQualityService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
  });
  await svc.getAirQuality({ lat: 2, lon: 2 });

  // Jump well past the stale window.
  nowMs += AIR_QUALITY_STALE_MS + 1_000;
  fake.throwOnce();

  await assert.rejects(
    () => svc.getAirQuality({ lat: 2, lon: 2 }),
    /Network down/,
  );
});

test('upstream non-2xx propagates as Upstream error', async () => {
  const fake = makeFakeFetch();
  fake.setResponse({ ok: false, status: 500, body: {} });
  const svc = createAirQualityService({ fetchImpl: fake.fetch as any });
  await assert.rejects(
    () => svc.getAirQuality({ lat: 3, lon: 3 }),
    /Upstream 500/,
  );
});

// ── Mapper sanity ───────────────────────────────────────────────────────────

test('mapper computes dominant pollutant from the upstream concentrations', async () => {
  const fake = makeFakeFetch();
  // Push PM2.5 sky-high so it dominates.
  fake.setResponse(happyPayload(180, /* pm2_5 */ 240));
  const svc = createAirQualityService({ fetchImpl: fake.fetch as any });
  const out = await svc.getAirQuality({ lat: 4, lon: 4 });
  assert.equal(out.dominant, 'pm2_5');
  assert.equal(out.pollutants.pm2_5, 240);
});

// ── HTTP contract ───────────────────────────────────────────────────────────

async function startServer(handler: (req: Request, res: Response) => Promise<void>) {
  const app = express();
  app.get('/api/air-quality', handler);
  return await new Promise<{ url: string; close: () => Promise<void> }>(resolve => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(() => r())),
      });
    });
  });
}

test('HTTP /api/air-quality: 400 on missing/invalid coords', async () => {
  const svc = createAirQualityService({ fetchImpl: (() => { throw new Error('should not call'); }) as any });
  const { url, close } = await startServer(async (req, res) => {
    const lat = Number(req.query.lat); const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      res.status(400).json({ error: 'lat/lon required and must be valid coordinates' }); return;
    }
    res.json(await svc.getAirQuality({ lat, lon }));
  });
  try {
    const r1 = await fetch(`${url}/api/air-quality`);
    assert.equal(r1.status, 400);
    const r2 = await fetch(`${url}/api/air-quality?lat=999&lon=0`);
    assert.equal(r2.status, 400);
  } finally {
    await close();
  }
});

test('geocodeCity: maps a city name to {lat, lon, label} via Open-Meteo', async () => {
  const calls: string[] = [];
  const fakeFetch = async (input: any) => {
    calls.push(typeof input === 'string' ? input : String(input));
    return {
      ok: true, status: 200,
      json: async () => ({ results: [{ name: 'London', country: 'United Kingdom', latitude: 51.51, longitude: -0.13 }] }),
    };
  };
  const hit = await geocodeCity('london', fakeFetch as any);
  assert.deepEqual(hit, { lat: 51.51, lon: -0.13, label: 'London, United Kingdom' });
  assert.match(calls[0], /name=london/);
});

test('geocodeCity: returns null for empty / no-match queries', async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) });
  assert.equal(await geocodeCity('   ', fakeFetch as any), null);
  assert.equal(await geocodeCity('asdfghjkl', fakeFetch as any), null);
});

test('HTTP /api/air-quality: 200 with payload on success', async () => {
  const fake = makeFakeFetch();
  fake.setResponse(happyPayload(88));
  const svc = createAirQualityService({ fetchImpl: fake.fetch as any });
  const { url, close } = await startServer(async (req, res) => {
    const lat = Number(req.query.lat); const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { res.status(400).json({}); return; }
    res.json(await svc.getAirQuality({ lat, lon }));
  });
  try {
    const resp = await fetch(`${url}/api/air-quality?lat=10&lon=20`);
    assert.equal(resp.status, 200);
    const body = await resp.json() as any;
    assert.equal(body.aqi, 88);
    assert.equal(body.lat, 10);
    assert.equal(body.lon, 20);
  } finally {
    await close();
  }
});
