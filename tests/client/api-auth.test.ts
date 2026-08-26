import test from "node:test";
import assert from "node:assert/strict";
import { buildApiHeaders, shouldAttachAdminToken } from "../../client/src/lib/api-auth";

test("admin API paths require a Supabase token", () => {
  assert.equal(shouldAttachAdminToken("/api/admin/channels"), true);
  assert.equal(shouldAttachAdminToken("/api/admin"), true);
});

test("tokens are not attached to public or lookalike URLs", () => {
  assert.equal(shouldAttachAdminToken("/api/links"), false);
  assert.equal(shouldAttachAdminToken("/api/admin-evil/collect"), false);
  assert.equal(shouldAttachAdminToken("https://example.com/api/admin/users"), false);
});

test("authenticated JSON requests include both required headers", () => {
  assert.deepEqual(buildApiHeaders(true, "test-token"), {
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  });
});

test("guest requests never get an empty authorization header", () => {
  assert.deepEqual(buildApiHeaders(false), {});
  assert.deepEqual(buildApiHeaders(true), { "Content-Type": "application/json" });
});
