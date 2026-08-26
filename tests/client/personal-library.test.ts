import test from 'node:test';
import assert from 'node:assert/strict';
import {
  libraryItemToSavedChannel,
  mergeSavedChannels,
  savedChannelIdentity,
  savedChannelToLibraryItem,
  type SavedChannel,
} from '../../client/src/lib/personal-library';

const channel = (overrides: Partial<SavedChannel> = {}): SavedChannel => ({
  id: 'local-id',
  name: 'NASA',
  url: 'https://youtube.com/@nasa',
  iconType: 'science',
  category: 'Space',
  platform: 'youtube',
  channelId: 'UCNASA',
  savedAt: 100,
  ...overrides,
});

test('saved channels use their strongest stable identity', () => {
  assert.equal(savedChannelIdentity(channel({ videoId: 'video-1' })), 'youtube:video:video-1');
  assert.equal(savedChannelIdentity(channel()), 'youtube:channel:UCNASA');
  assert.equal(
    savedChannelIdentity(channel({ channelId: undefined, url: 'HTTPS://EXAMPLE.COM/live/' })),
    'youtube:url:https://example.com/live',
  );
});

test('cloud entries win when local and cloud libraries contain the same channel', () => {
  const cloud = channel({ id: 'server-uuid', savedAt: 200 });
  const local = channel({ id: 'old-local-id', savedAt: 100 });
  const uniqueLocal = channel({ id: 'other', channelId: 'other-channel' });

  assert.deepEqual(mergeSavedChannels([cloud], [local, uniqueLocal]), [cloud, uniqueLocal]);
});

test('cloud records convert to the format used by the sidebar', () => {
  const saved = libraryItemToSavedChannel({
    id: 'server-uuid',
    userId: 'user-1',
    name: 'NASA',
    url: 'https://youtube.com/@nasa',
    platform: 'youtube',
    channelId: 'UCNASA',
    videoId: null,
    category: 'Space',
    createdAt: '2026-08-27T00:00:00.000Z',
  });

  assert.equal(saved.id, 'server-uuid');
  assert.equal(saved.iconType, 'science');
  assert.equal(saved.videoId, undefined);
  assert.equal(saved.savedAt, Date.parse('2026-08-27T00:00:00.000Z'));
});

test('local records only send fields accepted by the cloud API', () => {
  assert.deepEqual(savedChannelToLibraryItem(channel({ videoId: null })), {
    name: 'NASA',
    url: 'https://youtube.com/@nasa',
    platform: 'youtube',
    channelId: 'UCNASA',
    videoId: undefined,
    category: 'Space',
  });
});
