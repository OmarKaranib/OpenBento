import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalogLiveStatuses,
  catalogStreamLiveStatus,
  initialWidgetLiveState,
  liveStatusFromResponse,
} from '../../client/src/lib/stream-live-status';

test('unchecked Twitch and Kick catalog flags remain unknown', () => {
  assert.equal(catalogStreamLiveStatus('twitch', true), null);
  assert.equal(catalogStreamLiveStatus('kick', true), null);
  assert.equal(initialWidgetLiveState('twitch', true), false);
  assert.equal(initialWidgetLiveState('kick', true), false);
});

test('YouTube catalog status remains usable', () => {
  assert.equal(catalogStreamLiveStatus('youtube', true), true);
  assert.equal(catalogStreamLiveStatus('youtube', false), false);
  assert.equal(catalogStreamLiveStatus('youtube', undefined), null);
});

test('API status parser preserves true, false, and unknown', () => {
  assert.equal(liveStatusFromResponse({ isLive: true }), true);
  assert.equal(liveStatusFromResponse({ isLive: false }), false);
  assert.equal(liveStatusFromResponse({ isLive: null }), null);
  assert.equal(liveStatusFromResponse({ error: 'temporary failure' }), null);
  assert.equal(liveStatusFromResponse(null), null);
});

test('catalog checks all Kick channels together', async () => {
  const requested: string[] = [];
  const resolvers: Array<(value: boolean | null) => void> = [];
  const resultPromise = buildCatalogLiveStatuses([
    { id: 'kick-one', channelId: 'one', platform: 'kick' },
    { id: 'kick-two', channelId: 'two', platform: 'kick' },
  ], 123, (channelId) => new Promise((resolve) => {
    requested.push(channelId);
    resolvers.push(resolve);
  }));

  assert.deepEqual(requested, ['one', 'two']);
  resolvers[0](true);
  resolvers[1](null);

  assert.deepEqual(await resultPromise, {
    'kick-one': { channelId: 'one', isLive: true, lastChecked: 123 },
    'kick-two': { channelId: 'two', isLive: null, lastChecked: 123 },
  });
});

test('catalog skips missing handles and does not check Twitch', async () => {
  let kickChecks = 0;
  const statuses = await buildCatalogLiveStatuses([
    { id: 'youtube', channelId: 'UC-one', platform: 'youtube', isLive: true },
    { id: 'twitch', channelId: 'streamer', platform: 'twitch', isLive: true },
    { id: 'missing', platform: 'kick' },
  ], 456, async () => {
    kickChecks++;
    return true;
  });

  assert.equal(kickChecks, 0);
  assert.equal(statuses.youtube.isLive, true);
  assert.equal(statuses.twitch.isLive, null);
  assert.equal(statuses.missing, undefined);
});
