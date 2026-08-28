import test from 'node:test';
import assert from 'node:assert/strict';
import { isRefreshableVideoWidget, refreshVideoWidget } from '../../client/src/lib/video-refresh';

test('refresh all recognises every supported video source', () => {
  assert.equal(isRefreshableVideoWidget({ type: 'video', videoId: 'youtube-video' }), true);
  assert.equal(isRefreshableVideoWidget({ type: 'video', youtubeChannelId: 'UC-channel' }), true);
  assert.equal(isRefreshableVideoWidget({ type: 'video', twitchChannel: 'twitch-name' }), true);
  assert.equal(isRefreshableVideoWidget({ type: 'video', kickChannel: 'kick-name' }), true);
  assert.equal(isRefreshableVideoWidget({ type: 'video', url: 'https://example.com/embed' }), true);
});

test('refresh all ignores empty video slots and non-video widgets', () => {
  assert.equal(isRefreshableVideoWidget({ type: 'video' }), false);
  assert.equal(isRefreshableVideoWidget({ type: 'weather', url: 'https://example.com' }), false);
});

test('refreshing a video preserves its source', () => {
  const widget = {
    type: 'video',
    url: 'https://kick.com/example',
    kickChannel: 'example',
    isOffline: true,
    error: 'old error',
    embedBlocked: true,
  };

  assert.deepEqual(refreshVideoWidget(widget, 123), {
    ...widget,
    lastRefresh: 123,
    isOffline: false,
    error: null,
    embedBlocked: false,
  });
});

test('refreshing ignores widgets without a video source', () => {
  const widget = { type: 'weather', url: 'https://example.com' };
  assert.equal(refreshVideoWidget(widget, 123), widget);
});
