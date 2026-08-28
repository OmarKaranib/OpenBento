import test from 'node:test';
import assert from 'node:assert/strict';
import { authRedirectUrl } from '../../client/src/lib/auth-redirect';

test('auth redirects return to the site the user opened', () => {
  assert.equal(
    authRedirectUrl('https://preview.example.com', '/auth/callback'),
    'https://preview.example.com/auth/callback',
  );
  assert.equal(
    authRedirectUrl('http://localhost:5000', '/auth/reset-password'),
    'http://localhost:5000/auth/reset-password',
  );
});

test('auth redirects fall back safely for malformed origins', () => {
  assert.equal(
    authRedirectUrl('javascript:alert(1)', '/auth/callback'),
    'https://openbento.tv/auth/callback',
  );
  assert.equal(
    authRedirectUrl('https://user:pass@example.com', '/auth/callback'),
    'https://openbento.tv/auth/callback',
  );
});
