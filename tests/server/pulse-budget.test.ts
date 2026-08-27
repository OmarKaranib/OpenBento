import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BACKGROUND_REPAIR_LIMIT,
  BACKGROUND_REPAIR_WINDOW_MS,
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

test('automatic repair searches have a separate daily ceiling', () => {
  assert.equal(BACKGROUND_REPAIR_WINDOW_MS, 24 * 60 * 60 * 1000);
  assert.equal(BACKGROUND_REPAIR_LIMIT, 20);

  const pulseCache = readFileSync('server/services/pulse-cache.ts', 'utf8');
  assert.match(pulseCache, /backgroundRepairBudget\.allow\('youtube'\)/);
});
