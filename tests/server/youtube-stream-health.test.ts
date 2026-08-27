import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStreamHealth } from '../../server/services/youtube-api';

test('temporary YouTube failures are not mistaken for dead streams', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 503 } as Response)) as typeof fetch;

  try {
    assert.deepEqual(await checkStreamHealth('known-video', 'test-key'), {
      isHealthy: false,
      errorCode: 'apiError',
      apiError: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a successful empty response still means the video is gone', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ items: [] }),
  } as Response)) as typeof fetch;

  try {
    assert.deepEqual(await checkStreamHealth('missing-video', 'test-key'), {
      isHealthy: false,
      errorCode: 'notFound',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
