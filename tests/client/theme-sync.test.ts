import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canWriteCloudThemes,
  canWriteCloudThemesForUser,
} from '../../client/src/dashboard/use-theme';

test('theme writes stay locked until cloud hydration succeeds', () => {
  assert.equal(canWriteCloudThemes('idle'), false);
  assert.equal(canWriteCloudThemes('loading'), false);
  assert.equal(canWriteCloudThemes('failed'), false);
  assert.equal(canWriteCloudThemes('ready'), true);
});

test('theme hydration for one account never unlocks another account', () => {
  assert.equal(canWriteCloudThemesForUser('ready', 'user-a', 'user-a'), true);
  assert.equal(canWriteCloudThemesForUser('ready', 'user-a', 'user-b'), false);
  assert.equal(canWriteCloudThemesForUser('loading', 'user-b', 'user-b'), false);
});
