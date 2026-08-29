import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("dashboard player controls send YouTube messages only to YouTube", async () => {
  const source = await readFile("client/src/pages/dashboard.tsx", "utf8");
  const helper = source.match(/const sendYouTubeCommand[\s\S]*?\n  }, \[\]\);/)?.[0];

  assert.ok(helper, "sendYouTubeCommand helper should exist");
  assert.match(helper, /postMessage\([\s\S]*?'https:\/\/www\.youtube\.com'\)/);
  assert.doesNotMatch(helper, /postMessage\([\s\S]*?,\s*['\"]\*['\"]\)/);
});
