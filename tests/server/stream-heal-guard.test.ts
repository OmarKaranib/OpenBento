import test from 'node:test';
import assert from 'node:assert/strict';
import { streamHealRequestSchema } from '../../server/services/stream-heal-guard';

test('stream repair accepts a normal request and trims identifiers', () => {
  const result = streamHealRequestSchema.safeParse({
    channelId: '  UC123  ',
    channelName: '  News Channel  ',
    currentVideoId: '  abc123  ',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      channelId: 'UC123',
      channelName: 'News Channel',
      currentVideoId: 'abc123',
    });
  }
});

test('stream repair rejects empty, oversized, and extra input', () => {
  assert.equal(streamHealRequestSchema.safeParse({ channelId: '', channelName: 'News' }).success, false);
  assert.equal(streamHealRequestSchema.safeParse({ channelId: 'UC1', channelName: 'x'.repeat(201) }).success, false);
  assert.equal(streamHealRequestSchema.safeParse({ channelId: 'UC1', channelName: 'News', admin: true }).success, false);
});
