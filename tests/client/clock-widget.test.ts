import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClockWorldZone } from '../../client/src/widgets/clock-widget';
import { WORLD_ZONES } from '../../client/src/widgets/shared';

test('Clock restores a saved world timezone', () => {
  assert.equal(normalizeClockWorldZone('Asia/Dubai'), 'Asia/Dubai');
});

test('Clock rejects an unknown saved timezone', () => {
  assert.equal(normalizeClockWorldZone('Invalid/Zone'), WORLD_ZONES[0].tz);
  assert.equal(normalizeClockWorldZone(), WORLD_ZONES[0].tz);
});
