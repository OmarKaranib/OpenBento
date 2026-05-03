/**
 * End-to-end verification of the Widget Marketplace (Task #59).
 *
 * Exercises the same code paths a browser session uses, against the running
 * dev server at http://localhost:5000:
 *   1. GET /widgets returns the SPA shell HTML (route is wired in App.tsx).
 *   2. GET /marketplace/widgets.json serves the catalog as static JSON.
 *   3. parseMarketplaceManifest accepts the live catalog with 0 invalid
 *      entries and surfaces all 4 ship-with-app sample widgets.
 *   4. Every sample widget URL resolves with HTTP 200 (so the install
 *      handoff to /?install=<url> can succeed end-to-end).
 *   5. The dashboard root (GET /) is reachable so the install handoff has
 *      a destination.
 *
 * Run with: npx tsx tests/marketplace-e2e.ts
 *
 * Requires the `Start application` workflow to be running on port 5000.
 */

import { parseMarketplaceManifest } from '../shared/marketplace-manifest';

const APP_URL = process.env.APP_URL || 'http://localhost:5000';

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}`);
    if (detail !== undefined) console.log('     detail:', detail);
  }
}

async function main() {
  console.log('Marketplace e2e against', APP_URL);

  // 1. SPA route /widgets serves the dashboard HTML shell.
  const widgetsRes = await fetch(`${APP_URL}/widgets`);
  check('GET /widgets returns 200', widgetsRes.status === 200, widgetsRes.status);
  const widgetsHtml = await widgetsRes.text();
  check(
    'GET /widgets returns an HTML document (SPA shell)',
    widgetsHtml.includes('<div id="root"') || widgetsHtml.includes('<!DOCTYPE html'),
  );

  // 2. Catalog JSON is reachable as a static asset.
  const manifestRes = await fetch(`${APP_URL}/marketplace/widgets.json`);
  check('GET /marketplace/widgets.json returns 200', manifestRes.status === 200, manifestRes.status);
  const raw = await manifestRes.json();

  // 3. Live manifest parses cleanly with the same Zod schema the page uses.
  const { widgets, invalidCount } = parseMarketplaceManifest(raw);
  check('Live manifest has 0 invalid entries', invalidCount === 0, invalidCount);
  const ids = new Set(widgets.map((w) => w.id));
  for (const expected of ['pomodoro', 'hello-world', 'click-counter', 'public-quote']) {
    check(`Catalog contains "${expected}"`, ids.has(expected));
  }

  // 4. Each sample widget URL resolves so the install handoff works.
  for (const w of widgets) {
    if (!w.url.startsWith('/')) continue; // skip absolute urls — those are out of our control
    const url = `${APP_URL}${w.url}`;
    const r = await fetch(url);
    check(`Sample widget asset OK: ${w.id} (${w.url})`, r.status === 200, r.status);
  }

  // 5. Dashboard root reachable — install handoff target.
  const rootRes = await fetch(`${APP_URL}/`);
  check('GET / (install handoff target) returns 200', rootRes.status === 200, rootRes.status);

  if (failures > 0) {
    console.error(`\nFAILED: ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll marketplace e2e checks passed.');
}

main().catch((err) => {
  console.error('e2e crashed:', err);
  process.exit(2);
});
