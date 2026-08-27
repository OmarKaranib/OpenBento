import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('public API cannot register arbitrary channels for background checks', () => {
  const routes = readFileSync('server/routes.ts', 'utf8');
  const client = readFileSync('client/src/lib/stream-api.ts', 'utf8');

  assert.doesNotMatch(routes, /app\.post\(["']\/api\/stream\/register/);
  assert.doesNotMatch(client, /\/api\/stream\/register/);
});
