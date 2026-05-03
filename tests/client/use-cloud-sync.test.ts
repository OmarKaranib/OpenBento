// Unit tests for the use-cloud-sync hook (client/src/dashboard/use-cloud-sync.ts).
//
// We exercise the hook outside of a real React renderer by installing a
// hand-rolled dispatcher onto React's internal hook slot. That lets us
// call the hook as if it were a function, then run its effects, and
// assert on the network calls it makes.
//
// Coverage:
//   1. Happy-path hydrate: cloud row returned → setWidgets called with
//      remote.widgets, no upload follows because the cached payload now
//      matches local state.
//   2. Empty-remote-skip: server returns {dashboard: null} (the "no row
//      yet" shape) → setWidgets is NOT called and no POST is made.
//   3. Unauthenticated: no userId → no fetch at all, hook is inert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { useCloudSync } from '../../client/src/dashboard/use-cloud-sync';

// ── Minimal React-hook dispatcher ───────────────────────────────────────────
// React 18 looks up hook implementations on
// __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current.
// Swap it for our own and the hook can run outside a real renderer.
const Internals = (React as any)
  .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

interface EffectSlot {
  fn: () => void | (() => void);
  deps?: ReadonlyArray<unknown>;
  cleanup?: void | (() => void);
}

function runHookOnce<T>(hook: () => T): {
  result: T;
  runEffects: () => Promise<void>;
  cleanup: () => void;
} {
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: EffectSlot[] = [];
  let sIdx = 0;
  let rIdx = 0;
  let eIdx = 0;

  const dispatcher = {
    useState: <S>(init: S | (() => S)) => {
      const i = sIdx++;
      if (i >= states.length) {
        states.push(typeof init === 'function' ? (init as () => S)() : init);
      }
      const setter = (next: S | ((prev: S) => S)) => {
        states[i] =
          typeof next === 'function'
            ? (next as (prev: S) => S)(states[i] as S)
            : next;
      };
      return [states[i] as S, setter] as const;
    },
    useRef: <T>(init: T) => {
      const i = rIdx++;
      if (i >= refs.length) refs.push({ current: init });
      return refs[i];
    },
    useCallback: <F extends Function>(fn: F) => fn,
    useMemo: <V>(fn: () => V) => fn(),
    useEffect: (fn: () => void | (() => void), deps?: ReadonlyArray<unknown>) => {
      effects.push({ fn, deps });
    },
    useLayoutEffect: (
      fn: () => void | (() => void),
      deps?: ReadonlyArray<unknown>,
    ) => {
      effects.push({ fn, deps });
    },
    useContext: () => undefined,
    useReducer: <S>(_reducer: unknown, init: S) => [init, () => {}] as const,
    useImperativeHandle: () => {},
    useDebugValue: () => {},
    useTransition: () => [false, (cb: () => void) => cb()] as const,
    useDeferredValue: <V>(v: V) => v,
    useId: () => ':r:test:',
    useSyncExternalStore: <V>(_sub: unknown, getSnap: () => V) => getSnap(),
    useInsertionEffect: () => {},
  };

  const prev = Internals.ReactCurrentDispatcher.current;
  Internals.ReactCurrentDispatcher.current = dispatcher;
  let result: T;
  try {
    sIdx = 0;
    rIdx = 0;
    eIdx = 0;
    result = hook();
  } finally {
    Internals.ReactCurrentDispatcher.current = prev;
  }

  const runEffects = async () => {
    for (const e of effects) {
      const r = e.fn();
      if (typeof r === 'function') e.cleanup = r;
      // Yield so any async work inside the effect can settle.
      await new Promise((res) => setTimeout(res, 0));
    }
  };
  const cleanup = () => {
    for (const e of effects) {
      if (typeof e.cleanup === 'function') e.cleanup();
    }
  };
  return { result, runEffects, cleanup };
}

// ── Fake fetch ──────────────────────────────────────────────────────────────
type FetchCall = { url: string; init?: RequestInit };
function makeFetch(plan: Array<(call: FetchCall) => Response | Promise<Response>>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    const call: FetchCall = { url, init };
    calls.push(call);
    const handler = plan[Math.min(i, plan.length - 1)];
    i++;
    return handler(call);
  };
  return { fn, calls };
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function fakeSupabase(token: string | null) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: token ? { access_token: token } : null },
      }),
    },
  } as any;
}

// ── Tests ──────────────────────────────────────────────────────────────────
test('Scenario 1: happy-path hydrate populates widgets from cloud row', async () => {
  const cloudWidgets = [
    { id: 'w1', type: 'clock', x: 0, y: 0, w: 3, h: 2 },
    { id: 'w2', type: 'note', x: 3, y: 0, w: 3, h: 2, noteContent: 'hi' },
  ];
  const { fn: fetchFn, calls } = makeFetch([
    () => json(200, { dashboard: { widgets: cloudWidgets } }),
  ]);
  (globalThis as any).fetch = fetchFn;

  let received: unknown = null;
  const setWidgets = (next: any) => {
    received = next;
  };
  const widgets: any[] = [];
  const widgetsRef = { current: widgets };

  const harness = runHookOnce(() =>
    useCloudSync({
      isAuthenticated: true,
      userId: 'user-1',
      supabaseClient: fakeSupabase('token-abc'),
      widgets,
      setWidgets,
      widgetsRef,
    }),
  );
  await harness.runEffects();
  // Wait for the chained async work inside the hydration effect.
  await new Promise((r) => setTimeout(r, 50));
  harness.cleanup();

  assert.ok(calls.length >= 1, 'hydrate GET fires');
  assert.match(calls[0].url, /\/api\/dashboard/);
  assert.equal(calls[0].init?.method ?? 'GET', 'GET');
  assert.deepEqual(received, cloudWidgets, 'setWidgets receives the cloud row');
  // No POST should have happened — the hook hasn't seen a widget change yet.
  const posts = calls.filter((c) => (c.init?.method ?? 'GET') === 'POST');
  assert.equal(posts.length, 0, 'no upload immediately after hydrate');
});

test('Scenario 2: empty-remote-skip leaves local state untouched', async () => {
  const { fn: fetchFn, calls } = makeFetch([
    // Server says "this user has no cloud dashboard yet" by returning
    // a row with no .dashboard key. The hook must treat this as a
    // no-op and NOT clobber local widgets.
    () => json(200, { dashboard: null }),
  ]);
  (globalThis as any).fetch = fetchFn;

  let setCalled = false;
  const setWidgets = () => {
    setCalled = true;
  };
  const widgets: any[] = [
    { id: 'local-1', type: 'clock', x: 0, y: 0, w: 3, h: 2 },
  ];
  const widgetsRef = { current: widgets };

  const harness = runHookOnce(() =>
    useCloudSync({
      isAuthenticated: true,
      userId: 'user-2',
      supabaseClient: fakeSupabase('token-xyz'),
      widgets,
      setWidgets,
      widgetsRef,
    }),
  );
  await harness.runEffects();
  await new Promise((r) => setTimeout(r, 50));
  harness.cleanup();

  assert.ok(calls.length >= 1, 'hydrate GET still fires');
  assert.equal(setCalled, false, 'setWidgets must NOT be called when remote is empty');
  const posts = calls.filter((c) => (c.init?.method ?? 'GET') === 'POST');
  assert.equal(posts.length, 0, 'no immediate POST upload on empty-remote-skip');
});

test('Scenario 3: hook is inert for unauthenticated users', async () => {
  const { fn: fetchFn, calls } = makeFetch([]);
  (globalThis as any).fetch = fetchFn;

  let setCalled = false;
  const setWidgets = () => {
    setCalled = true;
  };
  const widgets: any[] = [];
  const widgetsRef = { current: widgets };

  const harness = runHookOnce(() =>
    useCloudSync({
      isAuthenticated: false,
      userId: undefined,
      supabaseClient: fakeSupabase(null),
      widgets,
      setWidgets,
      widgetsRef,
    }),
  );
  await harness.runEffects();
  await new Promise((r) => setTimeout(r, 50));
  harness.cleanup();

  assert.equal(calls.length, 0, 'no network when unauthenticated');
  assert.equal(setCalled, false, 'no setWidgets when unauthenticated');
});
