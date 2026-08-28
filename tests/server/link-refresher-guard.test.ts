import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('background YouTube page fetches cannot freeze a refresh cycle', () => {
  const refresher = readFileSync('server/link-refresher.ts', 'utf8');
  const fetchSection = refresher.slice(
    refresher.indexOf('const response = await fetch(liveUrl'),
    refresher.indexOf('if (!response.ok)'),
  );

  assert.match(fetchSection, /signal: AbortSignal\.timeout\(10_000\)/);
});
