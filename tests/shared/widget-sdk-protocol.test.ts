// Widget SDK protocol — schema + reducer + URL allow-list tests.
// Runs under `tsx --test` (no DOM, no Vite).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROTOCOL_VERSION,
  ClientMessageSchema,
  HostMessageSchema,
  applyClientMessage,
  isAllowedCustomWidgetUrl,
  SAMPLE_CUSTOM_WIDGETS,
  type ThemeBundle,
} from '../../shared/widget-sdk-protocol';

const theme: ThemeBundle = { dark: true, accent: '#22d3ee', customColor: null, bg: null };

// ─── Client message schema ────────────────────────────────────────────────
test('ClientMessageSchema accepts each well-formed verb', () => {
  for (const m of [
    { v: 1, id: 'a', type: 'ready',    payload: { name: 'X', version: '1.0.0' } },
    { v: 1, id: 'b', type: 'getState' },
    { v: 1, id: 'c', type: 'setState', payload: { foo: 1, bar: 'baz' } },
    { v: 1, id: 'd', type: 'refresh' },
  ]) {
    const r = ClientMessageSchema.safeParse(m);
    assert.equal(r.success, true, `expected ${m.type} to validate`);
  }
});

test('ClientMessageSchema rejects malformed messages', () => {
  for (const bad of [
    null,
    undefined,
    'string-not-object',
    {},
    { v: 2, id: 'a', type: 'ready', payload: {} },                    // wrong version
    { v: 1, id: '',  type: 'ready', payload: {} },                    // empty id
    { v: 1, id: 'a', type: 'unknown' },                                // unknown verb
    { v: 1, id: 'a', type: 'setState' },                               // missing payload
    { v: 1, id: 'a', type: 'setState', payload: 'not-an-object' },     // bad payload type
    { v: 1, id: 'a', type: 'ready',    payload: { name: 12345 } },     // wrong field type
  ]) {
    const r = ClientMessageSchema.safeParse(bad);
    assert.equal(r.success, false, `expected rejection of ${JSON.stringify(bad)}`);
  }
});

// ─── Host message schema ──────────────────────────────────────────────────
test('HostMessageSchema accepts each host verb', () => {
  for (const m of [
    { v: 1, id: 'a', type: 'state',  payload: { x: 1 } },
    { v: 1, id: 'a', type: 'ack',    payload: { x: 1 } },
    { v: 1, id: 'a', type: 'error',  payload: { message: 'boom' } },
    { v: 1, id: 'a', type: 'resize', payload: { w: 4, h: 3 } },
    { v: 1, id: 'a', type: 'theme',  payload: theme },
  ]) {
    const r = HostMessageSchema.safeParse(m);
    assert.equal(r.success, true, `expected host ${m.type} to validate`);
  }
});

// ─── Pure reducer ─────────────────────────────────────────────────────────
test('applyClientMessage(ready) returns a theme bundle keyed by request id', () => {
  const { nextState, response } = applyClientMessage({}, { v: 1, id: 'r1', type: 'ready', payload: {} } as any, theme);
  assert.deepEqual(nextState, {});
  assert.equal(response?.type, 'theme');
  assert.equal(response?.id, 'r1');
  assert.deepEqual((response as any).payload, theme);
});

test('applyClientMessage(getState) returns a snapshot of the per-instance state', () => {
  const state = { count: 7, mode: 'focus' };
  const { nextState, response } = applyClientMessage(state, { v: 1, id: 'g', type: 'getState' } as any, theme);
  assert.equal(nextState, state);
  assert.equal(response?.type, 'state');
  assert.deepEqual((response as any).payload, state);
});

test('applyClientMessage(setState) shallow-merges and returns the merged state in the ack', () => {
  const state = { a: 1, b: 2 };
  const msg = { v: 1, id: 's', type: 'setState' as const, payload: { b: 99, c: 3 } };
  const { nextState, response } = applyClientMessage(state, msg as any, theme);
  assert.deepEqual(nextState, { a: 1, b: 99, c: 3 });
  assert.equal(response?.type, 'ack');
  assert.deepEqual((response as any).payload, { a: 1, b: 99, c: 3 });
  // Reducer must not mutate the input state.
  assert.deepEqual(state, { a: 1, b: 2 });
});

test('applyClientMessage(refresh) returns no response (host remounts iframe)', () => {
  const { nextState, response } = applyClientMessage({ x: 1 }, { v: 1, id: 'r', type: 'refresh' } as any, theme);
  assert.deepEqual(nextState, { x: 1 });
  assert.equal(response, null);
});

test('per-instance state isolation: two reducers operating on separate states never cross-contaminate', () => {
  let stateA: Record<string, unknown> = {};
  let stateB: Record<string, unknown> = {};
  ({ nextState: stateA } = applyClientMessage(stateA, { v: 1, id: 'a1', type: 'setState', payload: { secret: 'a-only' } } as any, theme));
  ({ nextState: stateB } = applyClientMessage(stateB, { v: 1, id: 'b1', type: 'setState', payload: { secret: 'b-only' } } as any, theme));
  assert.equal(stateA.secret, 'a-only');
  assert.equal(stateB.secret, 'b-only');
  // A getState on B must NOT see A's keys.
  const { response: rb } = applyClientMessage(stateB, { v: 1, id: 'b2', type: 'getState' } as any, theme);
  assert.deepEqual((rb as any).payload, { secret: 'b-only' });
});

// ─── URL allow-list ───────────────────────────────────────────────────────
test('isAllowedCustomWidgetUrl accepts http(s) URLs and same-origin absolute paths', () => {
  for (const ok of [
    'https://example.com/widget.html',
    'http://localhost:5173/x.html',
    '/examples/widgets/pomodoro/index.html',
    '/sdk/widget-sdk.v1.js',
  ]) {
    assert.equal(isAllowedCustomWidgetUrl(ok), true, `expected ${ok} to be allowed`);
  }
});

test('isAllowedCustomWidgetUrl blocks dangerous schemes and protocol-relative URLs', () => {
  for (const bad of [
    '',
    '   ',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)', // case-insensitive
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'blob:https://x/abc',
    'vbscript:msgbox',
    'about:blank',
    '//evil.com/widget.html',
    'ftp://example.com/x',
    'not a url at all',
    null,
    undefined,
    42,
  ] as unknown[]) {
    assert.equal(isAllowedCustomWidgetUrl(bad), false, `expected ${String(bad)} to be blocked`);
  }
});

// ─── Sample registry ──────────────────────────────────────────────────────
test('SAMPLE_CUSTOM_WIDGETS entries all have allowed URLs', () => {
  assert.ok(SAMPLE_CUSTOM_WIDGETS.length >= 1);
  for (const s of SAMPLE_CUSTOM_WIDGETS) {
    assert.equal(isAllowedCustomWidgetUrl(s.url), true, `sample ${s.id} url ${s.url} must be allowed`);
    assert.ok(s.name.length > 0);
    assert.ok(s.description.length > 0);
  }
});

test('PROTOCOL_VERSION is locked to 1', () => {
  assert.equal(PROTOCOL_VERSION, 1);
});

// ─── Configurable allow / deny pattern policy ─────────────────────────────
test('isAllowedCustomWidgetUrl honours caller-supplied denyPatterns (deny wins)', () => {
  const policy = { denyPatterns: [/evil\.com/i] };
  assert.equal(isAllowedCustomWidgetUrl('https://evil.com/x.html', policy), false);
  assert.equal(isAllowedCustomWidgetUrl('https://EVIL.com/x.html', policy), false);
  assert.equal(isAllowedCustomWidgetUrl('https://safe.com/x.html', policy), true);
});

test('isAllowedCustomWidgetUrl can restrict to a CDN allow-list', () => {
  // Tighter policy: same-origin paths off, only the CDN host allowed.
  const policy = {
    allowSameOriginPaths: false,
    allowedSchemes: [], // disable the default http(s) blanket
    allowPatterns: [/^https:\/\/cdn\.openbento\.dev\//],
  };
  assert.equal(isAllowedCustomWidgetUrl('https://cdn.openbento.dev/widgets/x.html', policy), true);
  assert.equal(isAllowedCustomWidgetUrl('https://other.com/widget.html', policy), false);
  assert.equal(isAllowedCustomWidgetUrl('/examples/widgets/pomodoro/index.html', policy), false);
});

test('isAllowedCustomWidgetUrl: dangerous schemes can NEVER be re-allowed via policy', () => {
  // Even if a misguided host adds 'javascript:' to allowedSchemes (or matches
  // it via allowPatterns), the hard-coded ALWAYS_DENY_SCHEMES list wins.
  const policy = {
    allowedSchemes: ['javascript:'],
    allowPatterns: [/^javascript:/i, /^data:/i],
  };
  assert.equal(isAllowedCustomWidgetUrl('javascript:alert(1)', policy), false);
  assert.equal(isAllowedCustomWidgetUrl('data:text/html,<x>', policy), false);
});

test('isAllowedCustomWidgetUrl: default policy is unchanged when no policy is passed', () => {
  // Sanity check — adding the policy parameter must not have shifted any
  // existing behavior for existing call sites that pass no second arg.
  assert.equal(isAllowedCustomWidgetUrl('https://example.com/x'), true);
  assert.equal(isAllowedCustomWidgetUrl('/examples/widgets/pomodoro/index.html'), true);
  assert.equal(isAllowedCustomWidgetUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedCustomWidgetUrl('//evil.com/x'), false);
});
