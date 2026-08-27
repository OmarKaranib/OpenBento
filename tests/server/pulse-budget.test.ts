import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maximumDailyPulseChecks,
  PULSE_INTERVAL_MS,
  TOP_CHANNELS_LIMIT,
} from '../../server/services/pulse-policy';

test('background stream checks stay under a 1,000-request daily baseline', () => {
  assert.equal(PULSE_INTERVAL_MS, 30 * 60 * 1000);
  assert.equal(TOP_CHANNELS_LIMIT, 20);
  assert.equal(maximumDailyPulseChecks(), 960);
  assert.ok(maximumDailyPulseChecks() <= 1_000);
});
