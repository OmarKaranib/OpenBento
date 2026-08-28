import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
