import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewPassword } from '../../client/src/lib/auth-validation';

test('new passwords must contain at least six characters', () => {
  assert.equal(
    validateNewPassword('short', 'short'),
    'Password must be at least 6 characters.',
  );
});

test('new password confirmation must match', () => {
  assert.equal(
    validateNewPassword('correct-password', 'different-password'),
    'Passwords do not match.',
  );
});

test('matching passwords pass validation', () => {
  assert.equal(validateNewPassword('correct-password', 'correct-password'), null);
});
