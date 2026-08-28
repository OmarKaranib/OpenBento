import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKickEmbedUrl,
  buildTwitchEmbedUrl,
  resolveEmbedOrigin,
} from '../../client/src/lib/stream-embed-url';

test('Twitch embed URL keeps channel, parent, and mute settings separate', () => {
  const url = new URL(buildTwitchEmbedUrl('name&parent=evil.example', 'openbento.tv', false));

  assert.equal(url.origin, 'https://player.twitch.tv');
  assert.equal(url.searchParams.get('channel'), 'name&parent=evil.example');
  assert.equal(url.searchParams.get('parent'), 'openbento.tv');
  assert.equal(url.searchParams.get('muted'), 'false');
  assert.equal(url.searchParams.get('autoplay'), 'true');
});

test('Kick embed URL safely encodes its channel and includes the parent', () => {
  const url = new URL(buildKickEmbedUrl('name/../../bad', 'openbento.tv'));

  assert.equal(url.origin, 'https://player.kick.com');
  assert.equal(url.pathname, '/name%2F..%2F..%2Fbad');
  assert.equal(url.searchParams.get('parent'), 'openbento.tv');
  assert.equal(url.searchParams.get('muted'), 'true');
  assert.equal(url.searchParams.get('autoplay'), 'true');
});

test('embed origin follows valid preview and local hosts', () => {
  assert.equal(resolveEmbedOrigin('https://preview.example.com/path'), 'https://preview.example.com');
  assert.equal(resolveEmbedOrigin('http://localhost:5000'), 'http://localhost:5000');
});

test('embed origin rejects malformed and credential-bearing values', () => {
  assert.equal(resolveEmbedOrigin('javascript:alert(1)'), 'https://openbento.tv');
  assert.equal(resolveEmbedOrigin('https://user:pass@example.com'), 'https://openbento.tv');
  assert.equal(resolveEmbedOrigin(undefined), 'https://openbento.tv');
});
