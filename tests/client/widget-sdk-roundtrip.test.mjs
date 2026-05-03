// SDK <-> host round-trip integration test.
//
// Loads the real client/public/sdk/widget-sdk.v1.js into a Node `vm`
// sandbox with a *minimal* fake `window` + `parent` — i.e. the same
// surface the dependency-free SDK actually touches — and drives a
// Pomodoro-style flow end-to-end:
//
//   SDK.ready({ name, version })     →  host receives 'ready' (+ version)
//                                    ←  host posts 'theme' bundle, SDK.onTheme fires
//   SDK.getState()                   →  host receives 'getState'
//                                    ←  host posts 'state' (empty)
//   SDK.setState({ mode, count })    →  host receives 'setState'
//                                    ←  host posts 'ack' (merged)  →  promise resolves
//   SDK.getState()                   ←  host posts 'state' (merged) →  promise resolves
//
// This proves the wire protocol round-trips faithfully through the
// shipped SDK file (i.e. the very bytes a third-party widget would
// download from /sdk/widget-sdk.v1.js), not just through unit tests
// of the schemas in isolation.

import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
register({ parentURL: pathToFileURL('./').href });

import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const { applyClientMessage, ClientMessageSchema } =
  await import('../../shared/widget-sdk-protocol.ts');

// ─── Minimal browser shim that the SDK touches ─────────────────────────
// The SDK only uses: window.addEventListener('message', …),
// window.OpenBento = …, parent.postMessage(...), setTimeout/clearTimeout,
// Promise, Date, Object.freeze.
function makeSandbox(hostHandleClientMessage) {
  const listeners = [];
  const window = {};
  const parent = {
    // Whatever the SDK posts goes through here. We funnel it into the
    // host's reducer and synchronously dispatch any reply back to the
    // SDK by calling its own message listeners. That mimics the real
    // browser's bidirectional postMessage channel without JSDOM.
    postMessage: (msg /*, targetOrigin */) => {
      const reply = hostHandleClientMessage(msg);
      if (reply) {
        // Deliver the reply on the next microtask so the SDK's
        // request() helper has time to register its `pending[id]`.
        queueMicrotask(() => {
          for (const fn of listeners) fn({ data: reply });
        });
      }
    },
  };
  window.addEventListener = (type, cb) => {
    if (type === 'message') listeners.push(cb);
  };
  window.removeEventListener = (type, cb) => {
    if (type !== 'message') return;
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };

  const sandbox = {
    window,
    parent,
    setTimeout, clearTimeout,
    Promise, Object, Array, JSON, Date, Math, Error, String, Number, Boolean,
    queueMicrotask,
  };
  // Mirror window-as-globalThis convention used by the SDK
  // (`if (typeof window === 'undefined' || window.OpenBento) return;`)
  vm.createContext(sandbox);
  return sandbox;
}

test('widget-sdk.v1.js + host: full Pomodoro-style ready / getState / setState round-trip', async () => {
  const sdkSource = await readFile(
    new URL('../../client/public/sdk/widget-sdk.v1.js', import.meta.url),
    'utf8',
  );

  // ─── Host side state ────────────────────────────────────────────────
  let hostState = {};
  const hostTheme = { dark: true, accent: '#22d3ee', customColor: null, bg: null };
  let capturedReadyVersion = null;

  // hostHandleClientMessage simulates what the host runtime
  // (custom-widget.tsx → routeIframeMessage) does in production.
  function hostHandleClientMessage(rawMsg) {
    const parsed = ClientMessageSchema.safeParse(rawMsg);
    if (!parsed.success) return null; // host drops malformed
    const msg = parsed.data;
    if (msg.type === 'ready' && msg.payload && typeof msg.payload.version === 'string') {
      capturedReadyVersion = msg.payload.version;
    }
    const { nextState, response } = applyClientMessage(hostState, msg, hostTheme);
    hostState = nextState;
    return response;
  }

  // ─── Boot the SDK inside a VM with the shimmed window/parent ────────
  const sandbox = makeSandbox(hostHandleClientMessage);
  vm.runInContext(sdkSource, sandbox);
  const OB = sandbox.window.OpenBento;
  assert.ok(OB, 'SDK should attach window.OpenBento');
  assert.equal(OB.PROTOCOL_VERSION, 1);

  // ─── 1. ready → host captures version and broadcasts theme ──────────
  let themeFromHost = null;
  OB.onTheme((t) => { themeFromHost = t; });
  OB.ready({ name: 'Pomodoro', version: '1.0.0' });

  // Drain microtasks so the queued reply (theme) reaches the SDK.
  await new Promise((r) => queueMicrotask(r));
  await new Promise((r) => queueMicrotask(r));

  assert.equal(capturedReadyVersion, '1.0.0', 'host captured ready meta.version');
  assert.deepEqual(themeFromHost, hostTheme, 'SDK.onTheme fired with host theme bundle');

  // ─── 2. Initial getState round-trip — fresh widget, empty bag ──────
  const empty = await OB.getState();
  assert.deepEqual(empty, {});

  // ─── 3. setState patch — Pomodoro persists its tick ────────────────
  const acked1 = await OB.setState({ mode: 'focus', remaining: 1480, round: 1 });
  assert.deepEqual(acked1, { mode: 'focus', remaining: 1480, round: 1 });
  assert.deepEqual(hostState, { mode: 'focus', remaining: 1480, round: 1 }, 'host state mirrors SDK setState');

  // ─── 4. Shallow-merge: subsequent setState preserves untouched keys ─
  const acked2 = await OB.setState({ mode: 'break', remaining: 300 });
  assert.deepEqual(acked2, { mode: 'break', remaining: 300, round: 1 }, 'round survives merge');

  // ─── 5. Round-trip: re-fetched state matches what we just wrote ────
  const fetched = await OB.getState();
  assert.deepEqual(fetched, { mode: 'break', remaining: 300, round: 1 });
});

test('widget-sdk.v1.js: host-side malformed responses do not poison the SDK promise pool', async () => {
  // If the host posts garbage by mistake, well-formed in-flight requests
  // must still resolve cleanly when their proper reply arrives.
  let nextState = {};
  function host(msg) {
    const parsed = ClientMessageSchema.safeParse(msg);
    if (!parsed.success) return null;
    const m = parsed.data;
    if (m.type === 'getState') {
      // Inject a junk response BEFORE the legit one. The SDK should
      // ignore the junk (no v field, wrong version, no id, etc.) and
      // still resolve the promise with the real state payload.
      queueMicrotask(() => {
        for (const cb of sandbox.__messageListeners) {
          cb({ data: { not: 'an envelope' } });
          cb({ data: { v: 99, id: m.id, type: 'state', payload: { hacked: true } } });
        }
      });
      return { v: 1, id: m.id, type: 'state', payload: nextState };
    }
    if (m.type === 'setState') {
      nextState = { ...nextState, ...m.payload };
      return { v: 1, id: m.id, type: 'ack', payload: nextState };
    }
    return null;
  }

  const sandbox = makeSandbox(host);
  // Expose the message-listener array for the test's junk injection.
  sandbox.__messageListeners = [];
  const origAdd = sandbox.window.addEventListener;
  sandbox.window.addEventListener = (type, cb) => {
    if (type === 'message') sandbox.__messageListeners.push(cb);
    origAdd(type, cb);
  };

  const sdkSource = await readFile(
    new URL('../../client/public/sdk/widget-sdk.v1.js', import.meta.url),
    'utf8',
  );
  vm.runInContext(sdkSource, sandbox);
  const OB = sandbox.window.OpenBento;

  await OB.setState({ greeting: 'hi' });
  const got = await OB.getState();
  assert.deepEqual(got, { greeting: 'hi' }, 'real state wins, junk envelopes ignored');
});
