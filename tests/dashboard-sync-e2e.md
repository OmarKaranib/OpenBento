# Cross-Device Dashboard Sync — End-to-End Verification (Task #28)

This folder contains both an automated and a manual end-to-end test for the
cloud sync feature added in Task #27 (signed-in users have their widget
layout mirrored to the `dashboards` table via `/api/dashboard`, debounced
1.5s on the client).

## Automated test — `dashboard-sync-e2e.ts`

The automated script drives the **same code path** a real two-browser
session uses: it acquires two independent Supabase access tokens for the
same user (= "device A" / "device B") and exercises the live HTTP routes
on `http://localhost:5000`, hitting the real `attachSupabaseUser`
middleware and the real Postgres `dashboards` table.

### Prerequisites

- The `Start application` workflow is running.
- Env vars present in this Repl: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Run

```bash
npx tsx tests/dashboard-sync-e2e.ts
```

Exit code 0 = all invariants hold, non-zero = at least one failed (with
a printed reason).

### Scenarios verified

1. **First-sign-in promotion.** A brand-new user has no cloud row;
   device A posts its local widgets, device B (same user, separate
   session) immediately reads them back.
2. **Cross-device edit propagation.** Device A POSTs an updated layout
   and device B sees it within ≤3 s (typical: <50 ms in the local Repl).
3. **Sign-out isolation.** Calling `admin.auth.admin.signOut(tokenA)`
   does **not** wipe the cloud row, and device B's independent session
   continues to read the same dashboard.
4. **Token cache is per-user.** Rapid alternation between two different
   users' tokens never returns the wrong user's dashboard, and after a
   sign-out + sign-in for user B their fresh token still resolves to
   their own row (no cache leakage despite the 5-minute TTL).
5. **Auth boundary.** Requests with no token or a garbage token are
   rejected with 401.

### Documented finding (follow-up, not a regression)

When `admin.auth.admin.signOut(token)` is called, the access-token JWT
itself stays cryptographically valid until its natural expiry (~1 h),
and the server's `attachSupabaseUser` cache pins identity for 5 minutes
per token. The script therefore **does not** assert that the signed-out
token is rejected — it logs the observed status as informational. If we
ever need true revocation-on-signout we would need to either (a) drop
the cache TTL substantially, (b) maintain a token-blacklist invalidated
on `auth.signOut`, or (c) verify the session against Supabase's session
table on every call. This is out of scope for Task #28 but worth filing.

## Manual two-browser playbook (optional sanity check)

Useful when you want a human-eye confirmation of the visual behavior.

1. Open the app in **two different browser profiles** (or one normal +
   one incognito window) so they have independent localStorage/cookies.
2. In both windows, sign in as the same Supabase user (email/password
   or OAuth). Wait until each window shows the dashboard.
3. In window A, drag a widget to a new position or add/remove a widget.
   The change is committed locally immediately and uploaded after the
   1.5 s debounce.
4. In window B, hard-refresh (or wait for it to be re-mounted). Within
   ~3 s of the upload completing it should display the new layout.
5. In window A, click "Sign out". Window B should remain signed in
   and continue to display the cloud-stored layout. Refresh window B —
   the layout must still be there (the cloud row was not deleted).
6. Sign back in on window A. It should immediately hydrate from the
   cloud copy that window B has been editing in the meantime.

If any step deviates from the above, capture the network panel for
`GET/POST /api/dashboard` plus the browser console (search for
"Cloud sync" / `[Auth]` log lines) and file as a bug.
