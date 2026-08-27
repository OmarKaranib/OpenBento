import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheHandleLiveResult,
  restoreHandleLiveResult,
} from '../../client/src/lib/youtube-handle-cache';

test('handle cache preserves the latest fallback video and channel ID', () => {
  const result = {
    isLive: false,
    liveVideoId: null,
    latestVideoId: 'latest-video',
    channelId: 'UC-channel',
    title: 'Latest upload',
  };

  const cached = cacheHandleLiveResult(result);
  assert.deepEqual(restoreHandleLiveResult(cached), {
    ...result,
    apiError: undefined,
  });
});

test('old cache entries safely fall back to null details', () => {
  assert.deepEqual(restoreHandleLiveResult({
    isLive: false,
    liveVideoId: null,
    title: null,
  }), {
    isLive: false,
    liveVideoId: null,
    latestVideoId: null,
    channelId: null,
    title: null,
    apiError: undefined,
  });
});
