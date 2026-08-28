import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  requestTimeoutSignal,
} from '../../client/src/lib/request-timeout';

test('browser requests get a ten-second default deadline', () => {
  assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 10_000);
  assert.ok(requestTimeoutSignal() instanceof AbortSignal);
});

test('custom browser request deadlines abort', async () => {
  const signal = requestTimeoutSignal(5);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(signal.aborted, true);
});

test('a parent cancellation still aborts a timed request', () => {
  const parent = new AbortController();
  const signal = requestTimeoutSignal(10_000, parent.signal);
  parent.abort();
  assert.equal(signal.aborted, true);
});
