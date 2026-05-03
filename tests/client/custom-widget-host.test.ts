// Host-runtime tests for the Custom Widget message router.
//
// These tests exercise the SAME `routeIframeMessage` helper that
// custom-widget.tsx wires its `window.addEventListener('message', …)`
// listener to. We don't need a DOM — the router is fully decoupled
// from React/JSDOM via a `HostMessageRouterContext` callback bag.
//
// Coverage:
//   • Malformed events are silently dropped.
//   • Events from the wrong source (different iframe) are ignored.
//   • Two parallel widget instances never read or write each other's
//     state, even when they share the same router code (per-instance
//     state isolation — the spec's "Done" criterion).
//   • Pomodoro-style setState round-trip: ready → getState → setState
//     produces an `ack` with the merged state and updates per-instance
//     state in place.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  routeIframeMessage,
  type HostMessage,
  type ThemeBundle,
  type HostMessageRouterContext,
} from '../../shared/widget-sdk-protocol';

const theme: ThemeBundle = { dark: true, accent: '#22d3ee', customColor: null, bg: null };

interface Harness {
  state: Record<string, unknown>;
  version: string | null;
  outbox: HostMessage[];
  refreshes: number;
  iframe: object;
  ctx: HostMessageRouterContext;
}

function makeHarness(initial: Record<string, unknown> = {}): Harness {
  const iframe = { __id: Math.random() }; // any sentinel object will do
  const h: Harness = {
    state: { ...initial },
    version: null,
    outbox: [],
    refreshes: 0,
    iframe,
    // assigned below
    ctx: undefined as unknown as HostMessageRouterContext,
  };
  h.ctx = {
    iframeWindow: iframe,
    getState: () => h.state,
    getTheme: () => theme,
    setState: (next) => { h.state = next; },
    setVersion: (v) => { h.version = v; },
    post: (msg) => { h.outbox.push(msg); },
    onRefreshRequest: () => { h.refreshes += 1; },
  };
  return h;
}

// ─── Malformed-message drop ───────────────────────────────────────────────
test('routeIframeMessage drops events with malformed payloads (no post, no state mutation)', () => {
  const h = makeHarness({ count: 7 });
  for (const bad of [
    null,
    undefined,
    'not-an-object',
    {},
    { v: 2, id: 'x', type: 'ready', payload: {} },              // wrong version
    { v: 1, id: '',  type: 'ready', payload: {} },              // empty id
    { v: 1, id: 'x', type: 'unknown' },                          // unknown verb
    { v: 1, id: 'x', type: 'setState', payload: 'string' },      // bad payload shape
    { v: 1, id: 'x', type: 'setState' },                         // missing payload
  ]) {
    routeIframeMessage({ source: h.iframe, data: bad }, h.ctx);
  }
  assert.equal(h.outbox.length, 0, 'no outbound messages for malformed input');
  assert.deepEqual(h.state, { count: 7 }, 'state must be untouched');
});

// ─── Source check ─────────────────────────────────────────────────────────
test('routeIframeMessage ignores events whose source !== our iframeWindow', () => {
  const h = makeHarness({ a: 1 });
  const otherIframe = { __id: 'other' };
  routeIframeMessage(
    { source: otherIframe, data: { v: 1, id: 'x', type: 'setState', payload: { a: 999 } } },
    h.ctx,
  );
  assert.equal(h.outbox.length, 0);
  assert.deepEqual(h.state, { a: 1 });
});

test('routeIframeMessage ignores events when iframeWindow is null', () => {
  const h = makeHarness({ a: 1 });
  h.ctx.iframeWindow = null as unknown as object;
  routeIframeMessage(
    { source: { x: 1 }, data: { v: 1, id: 'x', type: 'getState' } },
    h.ctx,
  );
  assert.equal(h.outbox.length, 0);
});

// ─── Per-instance isolation (spec "Done" criterion) ───────────────────────
test('two custom-widget hosts on the same page never read or write each other\'s state', () => {
  const a = makeHarness({ secret: 'a-only' });
  const b = makeHarness({ secret: 'b-only' });

  // B tries to setState — but the message arrives at A's router with
  // event.source pointing at B's iframe. A must ignore it entirely.
  routeIframeMessage(
    { source: b.iframe, data: { v: 1, id: 'evil', type: 'setState', payload: { secret: 'pwned' } } },
    a.ctx,
  );
  assert.deepEqual(a.state, { secret: 'a-only' }, 'A state untouched by B-sourced message');

  // Now exercise each instance from its own iframe — state must stay isolated.
  routeIframeMessage({ source: a.iframe, data: { v: 1, id: 'a1', type: 'setState', payload: { only: 'A' } } }, a.ctx);
  routeIframeMessage({ source: b.iframe, data: { v: 1, id: 'b1', type: 'setState', payload: { only: 'B' } } }, b.ctx);

  assert.equal((a.state as any).only, 'A');
  assert.equal((b.state as any).only, 'B');
  assert.equal((a.state as any).secret, 'a-only');
  assert.equal((b.state as any).secret, 'b-only');

  // getState on B must NOT include any of A's keys.
  routeIframeMessage({ source: b.iframe, data: { v: 1, id: 'b2', type: 'getState' } }, b.ctx);
  const last = b.outbox[b.outbox.length - 1];
  assert.equal(last.type, 'state');
  assert.deepEqual((last as any).payload, { secret: 'b-only', only: 'B' });
});

// ─── Pomodoro-style setState round-trip ───────────────────────────────────
test('Pomodoro-style flow: ready → getState → setState → getState round-trips through the host', () => {
  const h = makeHarness({}); // empty initial state, like a freshly-added widget

  // 1. Iframe announces readiness with its name + version.
  routeIframeMessage(
    { source: h.iframe, data: { v: 1, id: 'r', type: 'ready', payload: { name: 'Pomodoro', version: '1.0.0' } } },
    h.ctx,
  );
  assert.equal(h.version, '1.0.0', 'host captured the SDK-reported version');
  // Host responded with the initial theme bundle, keyed to the ready message id.
  assert.equal(h.outbox[0].type, 'theme');
  assert.equal(h.outbox[0].id, 'r');
  assert.deepEqual((h.outbox[0] as any).payload, theme);

  // 2. Initial getState — fresh widget, so empty bag.
  routeIframeMessage(
    { source: h.iframe, data: { v: 1, id: 'g1', type: 'getState' } },
    h.ctx,
  );
  assert.equal(h.outbox[1].type, 'state');
  assert.deepEqual((h.outbox[1] as any).payload, {});

  // 3. Iframe persists its tick (mode + remaining + round) via setState.
  routeIframeMessage(
    {
      source: h.iframe,
      data: { v: 1, id: 's1', type: 'setState', payload: { mode: 'focus', remaining: 1480, round: 1 } },
    },
    h.ctx,
  );
  assert.equal(h.outbox[2].type, 'ack');
  assert.deepEqual((h.outbox[2] as any).payload, { mode: 'focus', remaining: 1480, round: 1 });
  assert.deepEqual(h.state, { mode: 'focus', remaining: 1480, round: 1 });

  // 4. Iframe shallow-merges another patch (mode flip on break).
  routeIframeMessage(
    {
      source: h.iframe,
      data: { v: 1, id: 's2', type: 'setState', payload: { mode: 'break', remaining: 300 } },
    },
    h.ctx,
  );
  assert.deepEqual(h.state, { mode: 'break', remaining: 300, round: 1 }, 'round preserved by shallow merge');
  const ack2 = h.outbox[3];
  assert.equal(ack2.type, 'ack');
  assert.deepEqual((ack2 as any).payload, h.state);

  // 5. Re-mount simulation: a *new* widget instance loads the same state
  //    via its own getState. The persisted state slice is round-tripped
  //    intact — that's the durability contract widgets like Pomodoro rely
  //    on for a refresh-survives-state experience.
  const remount = makeHarness(h.state); // simulates the host re-creating the widget with the saved state
  routeIframeMessage(
    { source: remount.iframe, data: { v: 1, id: 'g2', type: 'getState' } },
    remount.ctx,
  );
  assert.equal(remount.outbox[0].type, 'state');
  assert.deepEqual((remount.outbox[0] as any).payload, { mode: 'break', remaining: 300, round: 1 });
});

// ─── Refresh request ──────────────────────────────────────────────────────
test('routeIframeMessage(refresh) triggers the host remount callback and sends no response', () => {
  const h = makeHarness();
  routeIframeMessage({ source: h.iframe, data: { v: 1, id: 'rf', type: 'refresh' } }, h.ctx);
  assert.equal(h.refreshes, 1);
  assert.equal(h.outbox.length, 0);
});
