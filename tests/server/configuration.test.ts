import test from "node:test";
import assert from "node:assert/strict";
import { requireDatabaseUrl } from "../../server/config/database";
import { getResendConfig } from "../../server/services/resend-client";
import { updateDashboardSchema, updateUserLibrarySchema } from "../../shared/schema";

test("production database configuration accepts Supabase hosts", () => {
  const direct = "postgresql://user:pass@db.example.supabase.co:5432/postgres";
  const pooler = "postgresql://user:pass@aws-0-region.pooler.supabase.com:6543/postgres";

  assert.equal(requireDatabaseUrl({ DATABASE_URL: direct, NODE_ENV: "production" }), direct);
  assert.equal(requireDatabaseUrl({ DATABASE_URL: pooler, NODE_ENV: "production" }), pooler);
});

test("production database configuration rejects non-Supabase hosts", () => {
  assert.throws(
    () => requireDatabaseUrl({
      DATABASE_URL: "postgresql://user:pass@old-database.example.com:5432/app",
      NODE_ENV: "production",
    }),
    /must point to Supabase/,
  );
});

test("local PostgreSQL remains available for development and tests", () => {
  const local = "postgresql://postgres:test@127.0.0.1:5432/openbento_test";
  assert.equal(requireDatabaseUrl({ DATABASE_URL: local, NODE_ENV: "test" }), local);
});

test("database configuration rejects missing and non-PostgreSQL URLs", () => {
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
  assert.throws(
    () => requireDatabaseUrl({ DATABASE_URL: "https://example.com/database" }),
    /must be a PostgreSQL/,
  );
});

test("Resend uses normal environment variables without Replit", () => {
  assert.deepEqual(getResendConfig({
    RESEND_API_KEY: "re_test_key",
    RESEND_FROM_EMAIL: "OpenBento Test <test@example.com>",
  }), {
    apiKey: "re_test_key",
    fromEmail: "OpenBento Test <test@example.com>",
  });
  assert.throws(() => getResendConfig({}), /RESEND_API_KEY/);
});

test("dashboard patches cannot change ownership or internal columns", () => {
  assert.equal(updateDashboardSchema.safeParse({ name: "Updated" }).success, true);
  assert.equal(updateDashboardSchema.safeParse({ userId: "another-user" }).success, false);
  assert.equal(updateDashboardSchema.safeParse({ id: "another-dashboard" }).success, false);
  assert.equal(updateDashboardSchema.safeParse({ createdAt: new Date() }).success, false);
});

test("personal library patches cannot change ownership or internal columns", () => {
  assert.equal(updateUserLibrarySchema.safeParse({ name: "Updated" }).success, true);
  assert.equal(updateUserLibrarySchema.safeParse({ userId: "another-user" }).success, false);
  assert.equal(updateUserLibrarySchema.safeParse({ id: "another-item" }).success, false);
  assert.equal(updateUserLibrarySchema.safeParse({ createdAt: new Date() }).success, false);
});
