import test from 'node:test';
import assert from 'node:assert/strict';
import {
  manualYouTubeCheckAction,
  shouldCheckYouTubeWidget,
} from '../../client/src/lib/youtube-widget-check';

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

test('manual checks search for a replacement only after a confirmed ended video', () => {
  assert.equal(manualYouTubeCheckAction({ isLive: false, apiError: true }, true), 'preserve');
  assert.equal(manualYouTubeCheckAction({ isLive: true, apiError: false }, true), 'accept-live');
  assert.equal(manualYouTubeCheckAction({ isLive: false, apiError: false }, true), 'search-replacement');
  assert.equal(manualYouTubeCheckAction({ isLive: false, apiError: false }, false), 'accept-offline');
});
