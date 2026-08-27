import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCheckYouTubeWidget } from '../../client/src/lib/youtube-widget-check';

const unchecked = new Set<string>();

test('only YouTube video widgets enter the YouTube status checker', () => {
  assert.equal(shouldCheckYouTubeWidget({
    type: 'video', isYouTube: true, videoId: 'youtube-id', isOffline: false,
  }, unchecked, false), true);

  assert.equal(shouldCheckYouTubeWidget({
    type: 'video', isYouTube: false, videoId: 'twitch-id', isOffline: true,
  }, unchecked, true), false);

  assert.equal(shouldCheckYouTubeWidget({
    type: 'weather', isYouTube: true, videoId: 'bad-data', isOffline: true,
  }, unchecked, true), false);
});

test('checked videos wait, while offline YouTube videos follow revalidation timing', () => {
  const checked = new Set(['known-video']);
  assert.equal(shouldCheckYouTubeWidget({
    type: 'video', isYouTube: true, videoId: 'known-video', isOffline: false,
  }, checked, true), false);

  const offline = { type: 'video', isYouTube: true, videoId: 'offline-video', isOffline: true };
  assert.equal(shouldCheckYouTubeWidget(offline, unchecked, false), false);
  assert.equal(shouldCheckYouTubeWidget(offline, unchecked, true), true);
});
