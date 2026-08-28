import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeatherLookup } from '../../server/services/weather-query';

test('weather lookup accepts valid coordinates', () => {
  assert.deepEqual(parseWeatherLookup({ lat: '25.2048', lon: '55.2708' }), {
    ok: true,
    lookup: { kind: 'coordinates', lat: 25.2048, lon: 55.2708 },
  });
});

test('weather lookup rejects incomplete and out-of-range coordinates', () => {
  assert.deepEqual(parseWeatherLookup({ lat: '25' }), {
    ok: false,
    error: 'Both lat and lon must be provided once',
  });
  assert.deepEqual(parseWeatherLookup({ lat: '91', lon: '55' }), {
    ok: false,
    error: 'Invalid latitude or longitude',
  });
  assert.deepEqual(parseWeatherLookup({ lat: '25', lon: '-181' }), {
    ok: false,
    error: 'Invalid latitude or longitude',
  });
});

test('weather lookup trims cities and defaults to London', () => {
  assert.deepEqual(parseWeatherLookup({ city: '  Dubai  ' }), {
    ok: true,
    lookup: { kind: 'city', city: 'Dubai' },
  });
  assert.deepEqual(parseWeatherLookup({}), {
    ok: true,
    lookup: { kind: 'city', city: 'London' },
  });
});

test('weather lookup rejects malformed and oversized cities', () => {
  assert.deepEqual(parseWeatherLookup({ city: ['Dubai'] }), {
    ok: false,
    error: 'Invalid city',
  });
  assert.deepEqual(parseWeatherLookup({ city: 'x'.repeat(101) }), {
    ok: false,
    error: 'City name is too long',
  });
});
