import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_EMAILS, isAdminEmail } from "../../shared/admin-access";

test("every configured administrator receives admin access", () => {
  for (const email of ADMIN_EMAILS) {
    assert.equal(isAdminEmail(email), true);
  }
});

test("admin email checks normalize case and whitespace", () => {
  assert.equal(isAdminEmail(`  ${ADMIN_EMAILS[1].toUpperCase()}  `), true);
});

test("missing and unknown emails are not administrators", () => {
  assert.equal(isAdminEmail(undefined), false);
  assert.equal(isAdminEmail(null), false);
  assert.equal(isAdminEmail("someone@example.com"), false);
});
