import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannelHandle } from '../../server/services/youtube-api';

test('YouTube handles use the direct low-cost channel lookup', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return {
      ok: true,
      json: async () => ({ items: [{ id: 'UC-direct-id' }] }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await resolveChannelHandle('OpenBento', 'test-key');
    const url = new URL(requestedUrl);

    assert.equal(result, 'UC-direct-id');
    assert.equal(url.pathname, '/youtube/v3/channels');
    assert.equal(url.searchParams.get('part'), 'id');
    assert.equal(url.searchParams.get('forHandle'), '@OpenBento');
    assert.equal(url.searchParams.get('q'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('YouTube handle lookup returns null when no channel matches', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ items: [] }),
  } as Response)) as typeof fetch;

  try {
    assert.equal(await resolveChannelHandle('@missing', 'test-key'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
