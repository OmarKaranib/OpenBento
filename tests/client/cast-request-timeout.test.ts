import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('all Cast popover API actions use its timed request helper', () => {
  const source = readFileSync('client/src/components/cast-popover.tsx', 'utf8');
  const helper = source.slice(
    source.indexOf('async function authedFetch'),
    source.indexOf('export function CastPopover'),
  );

  assert.match(helper, /signal: requestTimeoutSignal\(\)/);
  assert.equal(source.match(/await fetch\(/g)?.length, 1);
});

test('TV pairing and disconnect requests have deadlines', () => {
  const source = readFileSync('client/src/pages/cast.tsx', 'utf8');

  assert.equal(source.match(/signal: requestTimeoutSignal\(\)/g)?.length, 2);
});
