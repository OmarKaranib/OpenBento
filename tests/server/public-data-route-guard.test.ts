import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('weather and news requests cannot wait forever', () => {
  const routes = readFileSync('server/routes.ts', 'utf8');
  const publicDataRoutes = routes.slice(
    routes.indexOf('// ─── Weather API'),
    routes.indexOf('// ─── Markets API'),
  );

  const timedFetches = publicDataRoutes.match(
    /fetch\(url, \{ signal: AbortSignal\.timeout\(8_000\) \}\)/g,
  );

  assert.equal(timedFetches?.length, 3);
});
