import test from 'node:test';
import assert from 'node:assert/strict';
import { savedWeatherQuery } from '../../client/src/widgets/weather-widget';
import type { Widget } from '../../client/src/widgets/shared';

function weatherWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'weather-1',
    type: 'weather',
    x: 0,
    y: 0,
    w: 3,
    h: 2,
    isMuted: false,
    isPaused: false,
    volume: 1,
    ...overrides,
  };
}

test('Weather uses saved coordinates after a reload', () => {
  assert.deepEqual(
    savedWeatherQuery(weatherWidget({
      weatherCity: 'Dubai',
      weatherLat: 25.2048,
      weatherLon: 55.2708,
    })),
    { kind: 'coords', lat: 25.2048, lon: 55.2708 },
  );
});

test('Weather falls back to a saved city when coordinates are unavailable', () => {
  assert.deepEqual(
    savedWeatherQuery(weatherWidget({ weatherCity: '  Abu Dhabi  ' })),
    { kind: 'city', city: 'Abu Dhabi' },
  );
});

test('Weather ignores invalid saved coordinates', () => {
  assert.deepEqual(
    savedWeatherQuery(weatherWidget({
      weatherCity: 'Sharjah',
      weatherLat: 200,
      weatherLon: 55.4,
    })),
    { kind: 'city', city: 'Sharjah' },
  );
});
