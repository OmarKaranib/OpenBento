// Unit tests for the use-cloud-sync hook
// (client/src/dashboard/use-cloud-sync.ts).
//
// Runnable directly with `node --test tests/client/use-cloud-sync.test.mjs`
// — no `tsx` CLI required. We register tsx as a Node module loader at the
// top of this file so the dynamic import of the .ts hook source resolves
// inside the same `node --test` process.
//
// We exercise the hook outside of a real React renderer by installing a
// hand-rolled dispatcher onto React's internal hook slot. That lets us
// call the hook as if it were a function, then run its effects, and
// assert on the network calls it makes.
//
// Coverage:
//   1. Happy-path hydrate: cloud row returned -> setWidgets called with
//      remote.widgets, no upload follows because the cached payload now
//      matches local state.
//   2. Empty-remote-skip: server returns {dashboard: null} (the "no row
//      yet" shape) -> setWidgets is NOT called and no POST is made.
//   3. Unauthenticated: no userId -> no fetch at all, hook is inert.
import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

// Register the tsx ESM loader so the subsequent dynamic import of the
// hook's .ts source can be resolved without a separate CLI wrapper.
// `tsx`'s own `register()` wraps node:module.register correctly for
// Node 20 (which forbids the bare `--loader` flag).
register({ parentURL: pathToFileURL('./').href });

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

const {
  canWriteCloudDashboard,
  cloudWriteRetryDelay,
  saveCloudDashboard,
  useCloudSync,
} = await import(
  '../../client/src/dashboard/use-cloud-sync.ts'
);

// --- Minimal React-hook dispatcher ----------------------------------------
// React 18 looks up hook implementations on
// __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current.
// Swap it for our own and the hook can run outside a real renderer.
const Internals =
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

function runHookOnce(hook) {
  const states = [];
  const refs = [];
  const effects = [];
  let sIdx = 0;
  let rIdx = 0;

  const dispatcher = {
    useState(init) {
      const i = sIdx++;
      if (i >= states.length) {
        states.push(typeof init === 'function' ? init() : init);
      }
      const setter = (next) => {
        states[i] = typeof next === 'function' ? next(states[i]) : next;
      };
      return [states[i], setter];
    },
    useRef(init) {
      const i = rIdx++;
      if (i >= refs.length) refs.push({ current: init });
      return refs[i];
    },
    useCallback(fn) {
      return fn;
    },
    useMemo(fn) {
      return fn();
    },
    useEffect(fn, deps) {
      effects.push({ fn, deps });
    },
    useLayoutEffect(fn, deps) {
      effects.push({ fn, deps });
    },
    useContext() {
      return undefined;
    },
    useReducer(_reducer, init) {
      return [init, () => {}];
    },
    useImperativeHandle() {},
    useDebugValue() {},
    useTransition() {
      return [false, (cb) => cb()];
    },
    useDeferredValue(v) {
      return v;
    },
    useId() {
      return ':r:test:';
    },
    useSyncExternalStore(_sub, getSnap) {
      return getSnap();
    },
    useInsertionEffect() {},
  };

  const prev = Internals.ReactCurrentDispatcher.current;
  Internals.ReactCurrentDispatcher.current = dispatcher;
  try {
    sIdx = 0;
    rIdx = 0;
    hook();
  } finally {
    Internals.ReactCurrentDispatcher.current = prev;
  }

  const runEffects = async () => {
    for (const e of effects) {
      const r = e.fn();
      if (typeof r === 'function') e.cleanup = r;
      // Yield so async work inside the effect can settle.
      await new Promise((res) => setTimeout(res, 0));
    }
  };
  const cleanup = () => {
    for (const e of effects) {
      if (typeof e.cleanup === 'function') e.cleanup();
    }
  };
  return { runEffects, cleanup };
}

// --- Fake fetch -----------------------------------------------------------
function makeFetch(plan) {
  const calls = [];
  let i = 0;
  const fn = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    const handler = plan[Math.min(i, plan.length - 1)];
    i++;
    return handler(call);
  };
  return { fn, calls };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function fakeSupabase(token) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: token ? { access_token: token } : null },
      }),
    },
  };
}

// --- Tests ----------------------------------------------------------------
// Multi-Page Dashboards refactor: the hook now operates on the full
// pages collection. We keep the same three scenarios (happy-path
// hydrate, empty-remote-skip, unauthenticated-no-op) but assert
// against pagesState instead of a flat widgets array.

const emptyPagesState = () => ({
  pages: [
    { id: 'page-home', name: 'Home', isDefault: true, widgets: [], createdAt: 0 },
  ],
  activePageId: 'page-home',
});

const pagesStateWith = (widgets) => ({
  pages: [
    { id: 'page-home', name: 'Home', isDefault: true, widgets, createdAt: 0 },
  ],
  activePageId: 'page-home',
});

test('cloud writes stay locked unless cloud loading succeeded', () => {
  assert.equal(canWriteCloudDashboard('idle'), false);
  assert.equal(canWriteCloudDashboard('loading'), false);
  assert.equal(canWriteCloudDashboard('failed'), false);
  assert.equal(canWriteCloudDashboard('ready'), true);
});

test('failed cloud writes get two retries and then stop', () => {
  assert.equal(cloudWriteRetryDelay(0), 1000);
  assert.equal(cloudWriteRetryDelay(1), 2000);
  assert.equal(cloudWriteRetryDelay(2), null);
});

test('saveCloudDashboard sends the active page and full pages collection', async () => {
  const pagesState = pagesStateWith([
    { id: 'local-1', type: 'clock', x: 0, y: 0, w: 3, h: 2 },
  ]);
  const { fn: fetchFn, calls } = makeFetch([
    () => json(200, { dashboard: {} }),
  ]);

  assert.equal(await saveCloudDashboard(pagesState, 'token-save', fetchFn), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-save');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.activePageId, 'page-home');
  assert.deepEqual(body.widgets, pagesState.pages[0].widgets);
  assert.deepEqual(body.pages, pagesState.pages);
});

test('saveCloudDashboard reports HTTP and network failures', async () => {
  const pagesState = emptyPagesState();
  assert.equal(
    await saveCloudDashboard(pagesState, 'token', async () => json(503, {})),
    false,
  );
  assert.equal(
    await saveCloudDashboard(pagesState, 'token', async () => { throw new Error('offline'); }),
    false,
  );
});

test('Scenario 1: happy-path hydrate populates widgets from cloud row', async () => {
  const cloudWidgets = [
    { id: 'w1', type: 'clock', x: 0, y: 0, w: 3, h: 2 },
    { id: 'w2', type: 'note', x: 3, y: 0, w: 3, h: 2, noteContent: 'hi' },
  ];
  // The server still returns the legacy `widgets` shape on rows that
  // pre-date the multi-page rollout — the hook must wrap it as a
  // one-page Home via migrateLegacyWidgets.
  const { fn: fetchFn, calls } = makeFetch([
    () => json(200, { dashboard: { widgets: cloudWidgets } }),
  ]);
  globalThis.fetch = fetchFn;

  let received = null;
  const setPagesState = (next) => {
    received = next;
  };
  const pagesState = emptyPagesState();
  const pagesStateRef = { current: pagesState };

  const harness = runHookOnce(() =>
    useCloudSync({
      isAuthenticated: true,
      userId: 'user-1',
      supabaseClient: fakeSupabase('token-abc'),
      pagesState,
      setPagesState,
      pagesStateRef,
    }),
  );
  await harness.runEffects();
  await new Promise((r) => setTimeout(r, 50));
  harness.cleanup();

  assert.ok(calls.length >= 1, 'hydrate GET fires');
  assert.match(calls[0].url, /\/api\/dashboard/);
  assert.equal((calls[0].init && calls[0].init.method) || 'GET', 'GET');
  assert.ok(received, 'setPagesState was called');
  assert.equal(received.pages.length, 1, 'legacy row maps to a single Home page');
  assert.deepEqual(
    received.pages[0].widgets,
    cloudWidgets,
    'active page widgets mirror the cloud row',
  );
  const posts = calls.filter(
    (c) => ((c.init && c.init.method) || 'GET') === 'POST',
  );
  assert.equal(posts.length, 0, 'no upload immediately after hydrate');
});

test('Scenario 2: empty-remote-skip leaves local state untouched', async () => {
  const { fn: fetchFn, calls } = makeFetch([
    // Server says "no cloud dashboard yet" by returning .dashboard = null.
    // The hook must treat this as a no-op and NOT clobber local pages.
    () => json(200, { dashboard: null }),
  ]);
  globalThis.fetch = fetchFn;

  let setCalled = false;
  const setPagesState = () => {
    setCalled = true;
  };
  const pagesState = pagesStateWith([
    { id: 'local-1', type: 'clock', x: 0, y: 0, w: 3, h: 2 },
  ]);
  const pagesStateRef = { current: pagesState };

  const harness = runHookOnce(() =>
    useCloudSync({
      isAuthenticated: true,
      userId: 'user-2',
      supabaseClient: fakeSupabase('token-xyz'),
      pagesState,
      setPagesState,
      pagesStateRef,
    }),
  );
  await harness.runEffects();
  await new Promise((r) => setTimeout(r, 50));
  harness.cleanup();

  assert.ok(calls.length >= 1, 'hydrate GET still fires');
  assert.equal(setCalled, false, 'setPagesState must NOT be called when remote is empty');
  const posts = calls.filter(
    (c) => ((c.init && c.init.method) || 'GET') === 'POST',
  );
  assert.equal(posts.length, 0, 'no immediate POST upload on empty-remote-skip');
});

test('Scenario 3: hook is inert for unauthenticated users', async () => {
  const { fn: fetchFn, calls } = makeFetch([]);
  globalThis.fetch = fetchFn;

  let setCalled = false;
  const setPagesState = () => {
    setCalled = true;
  };
  const pagesState = emptyPagesState();
  const pagesStateRef = { current: pagesState };

  const harness = runHookOnce(() =>
    useCloudSync({
      isAuthenticated: false,
      userId: undefined,
      supabaseClient: fakeSupabase(null),
      pagesState,
      setPagesState,
      pagesStateRef,
    }),
  );
  await harness.runEffects();
  await new Promise((r) => setTimeout(r, 50));
  harness.cleanup();

  assert.equal(calls.length, 0, 'no network when unauthenticated');
  assert.equal(setCalled, false, 'no setPagesState when unauthenticated');
});
