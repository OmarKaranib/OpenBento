import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('shared API mutations receive a request deadline', () => {
  const source = readFileSync('client/src/lib/queryClient.ts', 'utf8');
  const mutation = source.slice(
    source.indexOf('export async function apiRequest'),
    source.indexOf('type UnauthorizedBehavior'),
  );

  assert.match(mutation, /signal: requestTimeoutSignal\(\)/);
});

test('shared API queries combine cancellation with a deadline', () => {
  const source = readFileSync('client/src/lib/queryClient.ts', 'utf8');
  const query = source.slice(source.indexOf('export const getQueryFn'));

  assert.match(query, /async \(\{ queryKey, signal \}\)/);
  assert.match(query, /signal: requestTimeoutSignal\(undefined, signal\)/);
});
