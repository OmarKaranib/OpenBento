import test from 'node:test';
import assert from 'node:assert/strict';
import { checkChannelLiveStatus } from '../../server/services/youtube-api';

test('successful YouTube live checks are shared through the server cache', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        items: [{
          id: { videoId: 'live-video' },
          snippet: { title: 'Live now' },
        }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const first = await checkChannelLiveStatus('UC-cache-test', 'test-key');
    const second = await checkChannelLiveStatus('UC-cache-test', 'test-key');

    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    assert.equal(second.liveVideoId, 'live-video');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failed YouTube live checks are not cached', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 503 } as Response;
  }) as typeof fetch;

  try {
    const first = await checkChannelLiveStatus('UC-error-test', 'test-key');
    const second = await checkChannelLiveStatus('UC-error-test', 'test-key');

    assert.equal(first.apiError, true);
    assert.equal(second.apiError, true);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
