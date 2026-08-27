import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canWriteCloudThemes,
  canWriteCloudThemesForUser,
  canAdoptLocalThemes,
  shouldKeepGuestThemeValue,
  saveCloudThemes,
  shouldRetryThemeRead,
  themeReadRetryDelay,
  themeWriteRetryDelay,
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

test('failed theme writes get two retries and then stop', () => {
  assert.equal(themeWriteRetryDelay(0), 1000);
  assert.equal(themeWriteRetryDelay(1), 2000);
  assert.equal(themeWriteRetryDelay(2), null);
});

test('theme loading only retries temporary failures', () => {
  assert.equal(themeReadRetryDelay(0), 500);
  assert.equal(themeReadRetryDelay(1), 1500);
  assert.equal(themeReadRetryDelay(2), null);
  assert.equal(shouldRetryThemeRead(408), true);
  assert.equal(shouldRetryThemeRead(429), true);
  assert.equal(shouldRetryThemeRead(503), true);
  assert.equal(shouldRetryThemeRead(401), false);
  assert.equal(shouldRetryThemeRead(403), false);
});

test('theme cloud save uses PATCH and creates a missing dashboard row', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response('{}', { status: calls.length === 1 ? 404 : 200 });
  };

  assert.equal(await saveCloudThemes([], null, 'theme-token', request), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init?.method, 'PATCH');
  assert.equal(calls[1].init?.method, 'POST');
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer theme-token');
});

test('theme cloud save reports HTTP and network failures', async () => {
  assert.equal(
    await saveCloudThemes([], null, 'token', async () => new Response('{}', { status: 503 })),
    false,
  );
  assert.equal(
    await saveCloudThemes([], null, 'token', async () => { throw new Error('offline'); }),
    false,
  );
});

test('theme hydration for one account never unlocks another account', () => {
  assert.equal(canWriteCloudThemesForUser('ready', 'user-a', 'user-a'), true);
  assert.equal(canWriteCloudThemesForUser('ready', 'user-a', 'user-b'), false);
  assert.equal(canWriteCloudThemesForUser('loading', 'user-b', 'user-b'), false);
});
