import test from 'node:test';
import assert from 'node:assert/strict';
import { extractKickChannel, extractTwitchChannel } from '../../client/src/lib/stream-url';

test('extractTwitchChannel accepts channel and player links', () => {
  assert.equal(extractTwitchChannel('https://www.twitch.tv/Shroud'), 'shroud');
  assert.equal(extractTwitchChannel('https://player.twitch.tv/?channel=Pokimane&parent=example.com'), 'pokimane');
});

test('extractTwitchChannel rejects site pages and lookalike domains', () => {
  assert.equal(extractTwitchChannel('https://twitch.tv/videos/123'), null);
  assert.equal(extractTwitchChannel('https://twitch.tv/directory/game/example'), null);
  assert.equal(extractTwitchChannel('https://twitch.tv.example.com/shroud'), null);
  assert.equal(extractTwitchChannel('https://clips.twitch.tv/example'), null);
});

test('extractKickChannel accepts channel and player links', () => {
  assert.equal(extractKickChannel('https://kick.com/xQc'), 'xqc');
  assert.equal(extractKickChannel('https://player.kick.com/trainwreckstv?autoplay=true'), 'trainwreckstv');
});

test('extractKickChannel rejects site pages and lookalike domains', () => {
  assert.equal(extractKickChannel('https://kick.com/categories/games'), null);
  assert.equal(extractKickChannel('https://kick.com/browse'), null);
  assert.equal(extractKickChannel('https://kick.com.example.com/xqc'), null);
  assert.equal(extractKickChannel('https://kick.com/%E0%A4%A'), null);
  assert.equal(extractKickChannel('not a URL'), null);
});
