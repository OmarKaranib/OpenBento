import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canWriteCloudThemes,
  canWriteCloudThemesForUser,
  canAdoptLocalThemes,
  shouldKeepGuestThemeValue,
} from '../../client/src/dashboard/use-theme';

test('theme writes stay locked until cloud hydration succeeds', () => {
  assert.equal(canWriteCloudThemes('idle'), false);
  assert.equal(canWriteCloudThemes('loading'), false);
  assert.equal(canWriteCloudThemes('failed'), false);
  assert.equal(canWriteCloudThemes('ready'), true);
});

test('local themes can migrate from guests but never between accounts', () => {
  assert.equal(canAdoptLocalThemes(null, 'user-a'), true);
  assert.equal(canAdoptLocalThemes('user-a', 'user-a'), true);
  assert.equal(canAdoptLocalThemes('user-a', 'user-b'), false);
});

test('guest theme values only win when the cloud value is empty', () => {
  assert.equal(shouldKeepGuestThemeValue(null, false, true), true);
  assert.equal(shouldKeepGuestThemeValue(null, true, true), false);
  assert.equal(shouldKeepGuestThemeValue('user-a', false, true), false);
  assert.equal(shouldKeepGuestThemeValue(null, false, false), false);
});

test('theme hydration for one account never unlocks another account', () => {
  assert.equal(canWriteCloudThemesForUser('ready', 'user-a', 'user-a'), true);
  assert.equal(canWriteCloudThemesForUser('ready', 'user-a', 'user-b'), false);
  assert.equal(canWriteCloudThemesForUser('loading', 'user-b', 'user-b'), false);
});
