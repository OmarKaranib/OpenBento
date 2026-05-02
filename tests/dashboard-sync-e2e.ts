/**
 * End-to-end verification of cross-device dashboard sync (Task #28).
 *
 * Exercises the same code paths a real two-browser session uses:
 *   - Two independent Supabase access tokens for the SAME user (= "device A"
 *     and "device B").
 *   - Real HTTP calls against the running app at http://localhost:5000
 *     hitting `attachSupabaseUser` + `/api/dashboard` GET/POST.
 *   - Real Postgres rows in the `dashboards` table via the storage layer.
 *
 * Scenarios covered:
 *   1. Empty-remote + local-widgets first-sign-in promotion (B's POST
 *      populates the cloud row that A then reads).
 *   2. Edit on A → GET on B sees the update within ~3s (cross-device sync).
 *   3. Sign-out on A does NOT delete the cloud row, and B still reads it.
 *   4. Rapid sign-in/sign-out across two different users does not let the
 *      5-minute Supabase token cache leak one user's identity to the other.
 *
 * Run with: npx tsx tests/dashboard-sync-e2e.ts
 *
 * Required env vars (already present in this Repl):
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing Supabase env vars — aborting.');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

async function makeUser(label: string) {
  const email = `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@openbento.test`;
  const password = `Pw!${Math.random().toString(36).slice(2)}A1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
  return { id: data.user.id, email, password };
}

async function freshToken(email: string, password: string): Promise<string> {
  // Each call uses a brand-new client with no shared storage so we get an
  // independent session — the moral equivalent of a different browser.
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn: ${error?.message}`);
  return data.session.access_token;
}

async function api(path: string, token: string | null, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${APP_URL}${path}`, { ...init, headers });
  let body: any = null;
  try { body = await res.json(); } catch { /* no body */ }
  return { status: res.status, body };
}

const widget = (id: string, x: number) => ({
  id, type: 'note', x, y: 0, w: 2, h: 2, channelName: '', noteContent: id,
  refreshCounter: 0, clockUse24Hour: false,
});

async function cleanup(userIds: string[]) {
  for (const id of userIds) {
    try { await admin.auth.admin.deleteUser(id); } catch { /* ignore */ }
  }
}

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs = 3000, intervalMs = 200): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function main() {
  console.log(`\nDashboard sync e2e against ${APP_URL}\n`);

  const userA = await makeUser('userA');
  const userB = await makeUser('userB');
  const createdUserIds = [userA.id, userB.id];

  try {
    // ── Scenario 1: empty-remote + local-widgets first-sign-in promotion ──
    console.log('Scenario 1: first sign-in promotes local widgets to cloud');
    const tokenA1 = await freshToken(userA.email, userA.password);
    const tokenA2 = await freshToken(userA.email, userA.password); // "device B"

    const initialGet = await api('/api/dashboard', tokenA1);
    check('GET on fresh user returns 200', initialGet.status === 200, initialGet);
    check('fresh user has no cloud dashboard yet', initialGet.body?.dashboard == null, initialGet.body);

    // Device A simulates the client-side "promotion" upload after seeing the
    // empty remote slot: it POSTs its local widgets to the cloud.
    const localWidgets = [widget('w1', 0), widget('w2', 2)];
    const post1 = await api('/api/dashboard', tokenA1, {
      method: 'POST',
      body: JSON.stringify({ name: 'My Dashboard', widgets: localWidgets }),
    });
    check('device A POST succeeds', post1.status === 200, post1);
    check('POST returns the saved dashboard', Array.isArray(post1.body?.dashboard?.widgets) && post1.body.dashboard.widgets.length === 2);

    // Device B (same user, separate session) immediately reads it — this is
    // the cross-device hydration path exercised by the App.tsx useEffect.
    const get1 = await api('/api/dashboard', tokenA2);
    check('device B GET returns the cloud row', get1.status === 200 && get1.body?.dashboard?.widgets?.length === 2, get1.body);
    check('device B sees the same widget IDs', JSON.stringify(get1.body?.dashboard?.widgets?.map((w: any) => w.id)) === JSON.stringify(['w1', 'w2']));

    // ── Scenario 2: edit on A → propagates to B within ~3s ──
    console.log('\nScenario 2: edit on A appears on B within 3s');
    const editedWidgets = [widget('w1', 0), widget('w2', 2), widget('w3', 4)];
    const editStart = Date.now();
    const post2 = await api('/api/dashboard', tokenA1, {
      method: 'POST',
      body: JSON.stringify({ name: 'My Dashboard', widgets: editedWidgets }),
    });
    check('device A edit POST succeeds', post2.status === 200, post2);

    const seen = await waitFor(async () => {
      const r = await api('/api/dashboard', tokenA2);
      const ids = r.body?.dashboard?.widgets?.map((w: any) => w.id);
      return JSON.stringify(ids) === JSON.stringify(['w1', 'w2', 'w3']) ? r : null;
    }, 3000, 150);
    const elapsed = Date.now() - editStart;
    check(`device B sees edit within 3s (took ${elapsed}ms)`, seen !== null);

    // ── Scenario 3: sign-out on A does NOT delete cloud row ──
    console.log('\nScenario 3: sign-out on A leaves cloud row intact for B');
    const { error: signOutErr } = await admin.auth.admin.signOut(tokenA1);
    check('admin signOut for tokenA1 succeeds', !signOutErr, signOutErr);

    // Note: the access-token JWT itself stays cryptographically valid until
    // its natural ~1h expiry, and the server's `attachSupabaseUser` cache
    // pins identity for 5 minutes per-token. This is an *informational*
    // probe — sign-out invalidates the refresh token client-side but does
    // not retroactively revoke an already-issued JWT, so a 200 here is
    // expected. The real cross-device invariant (sign-out on A must not
    // affect B or wipe the cloud row) is checked next.
    const getAfterSignOut = await api('/api/dashboard', tokenA1);
    console.log(`  · post-signOut tokenA1 GET → status ${getAfterSignOut.status} ` +
      `(expected: still accepted until JWT expiry; documented follow-up)`);

    // Device B's session is independent and still reads the row.
    const getB2 = await api('/api/dashboard', tokenA2);
    check('device B still sees the cloud row after A signs out', getB2.status === 200 && getB2.body?.dashboard?.widgets?.length === 3, getB2.body);

    // ── Scenario 4: token cache must not leak identity across users ──
    console.log('\nScenario 4: 5-min token cache stays per-user');
    // Seed a row for userB so we can tell them apart.
    const tokenB1 = await freshToken(userB.email, userB.password);
    const seedB = await api('/api/dashboard', tokenB1, {
      method: 'POST',
      body: JSON.stringify({ name: 'B Dashboard', widgets: [widget('only-b', 0)] }),
    });
    check('seed userB POST succeeds', seedB.status === 200, seedB);

    // Hammer back-and-forth between A's token (now cached) and B's token —
    // each must always return its own row.
    let leaked = false;
    for (let i = 0; i < 6; i++) {
      const a = await api('/api/dashboard', tokenA2);
      const b = await api('/api/dashboard', tokenB1);
      const aIds = a.body?.dashboard?.widgets?.map((w: any) => w.id) ?? [];
      const bIds = b.body?.dashboard?.widgets?.map((w: any) => w.id) ?? [];
      if (JSON.stringify(aIds) !== JSON.stringify(['w1', 'w2', 'w3'])) leaked = true;
      if (JSON.stringify(bIds) !== JSON.stringify(['only-b'])) leaked = true;
    }
    check('rapid alternation never returns the wrong user\'s dashboard', !leaked);

    // Sign-out userB and re-sign-in — fresh token must still resolve to userB.
    await admin.auth.admin.signOut(tokenB1);
    const tokenB2 = await freshToken(userB.email, userB.password);
    const reGetB = await api('/api/dashboard', tokenB2);
    check('after signOut + signIn, userB still sees only their row',
      reGetB.status === 200 &&
      JSON.stringify(reGetB.body?.dashboard?.widgets?.map((w: any) => w.id)) === JSON.stringify(['only-b']),
      reGetB.body);

    // ── Auth boundary sanity check ──
    console.log('\nScenario 5: unauthenticated and bad tokens are rejected');
    const noAuth = await api('/api/dashboard', null);
    check('no token → 401', noAuth.status === 401);
    const badAuth = await api('/api/dashboard', 'not-a-real-token');
    check('garbage token → 401', badAuth.status === 401);
  } finally {
    await cleanup(createdUserIds);
  }

  console.log('');
  if (failures === 0) {
    console.log('✅ All cross-device dashboard sync checks passed.');
    process.exit(0);
  } else {
    console.log(`❌ ${failures} check(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in e2e test:', err);
  process.exit(1);
});
