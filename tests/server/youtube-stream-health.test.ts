import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStreamHealth, checkVideoLiveStatusById } from '../../server/services/youtube-api';

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

test('video live checks return the broadcast status expected by the browser', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      items: [{
        id: 'ended-video',
        snippet: { title: 'Ended stream', liveBroadcastContent: 'none' },
      }],
    }),
  } as Response)) as typeof fetch;

  try {
    const result = await checkVideoLiveStatusById('ended-video', 'test-key');
    assert.equal(result.isLive, false);
    assert.equal(result.liveBroadcastContent, 'none');
    assert.equal(result.apiError, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
