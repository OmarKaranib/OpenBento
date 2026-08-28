import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('all stream and library requests use the timed request helper', () => {
  const source = readFileSync('client/src/lib/stream-api.ts', 'utf8');

  assert.match(source, /function fetchStreamApi/);
  assert.match(source, /requestTimeoutSignal\(undefined, init\.signal \?\? undefined\)/);
  assert.equal(source.match(/await fetchStreamApi\(/g)?.length, 10);
  assert.equal(source.match(/await fetch\(/g)?.length ?? 0, 0);
});

test('the legacy video refresh reaches its cache fallback after a deadline', () => {
  const source = readFileSync('client/src/lib/video-cache.ts', 'utf8');

  assert.match(source, /api\/live-video[\s\S]*signal: requestTimeoutSignal\(\)/);
});
