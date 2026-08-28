import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const appSource = await readFile("client/src/App.tsx", "utf8");

test("page routes are lazy-loaded instead of entering every visitor's main bundle", () => {
  const lazyModules = [
    "@/dashboard/dashboard-shell",
    "@/pages/admin",
    "@/pages/cast",
    "@/pages/dev-widgets",
    "@/pages/feedback",
    "@/pages/marketplace",
    "@/pages/not-found",
    "@/pages/privacy",
    "@/pages/terms",
  ];

  for (const moduleName of lazyModules) {
    assert.ok(
      appSource.includes(`import('${moduleName}')`),
      `${moduleName} should be loaded with import()`,
    );
  }
});

test("feature modules do not import through App and pull the route tree into their bundle", async () => {
  const files = [
    "client/src/components/ad-block.tsx",
    "client/src/components/cast-popover.tsx",
    "client/src/components/onboarding-flow.tsx",
    "client/src/components/widget-sidebar.tsx",
    "client/src/data/starter-packs.ts",
    "client/src/lib/cast-snapshot.ts",
    "client/src/pages/cast.tsx",
    "client/src/pages/dashboard.tsx",
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from\s+['\"]@\/App['\"]/);
  }
});
