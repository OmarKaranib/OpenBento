import assert from "node:assert/strict";
import { test } from "node:test";

test("Supabase stays disabled when Vite environment settings are unavailable", async () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    const { isSupabaseConfigured, supabase } = await import("../../client/src/lib/supabase.ts");
    assert.equal(supabase, null);
    assert.equal(isSupabaseConfigured(), false);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});
