// True end-to-end mount of the Pomodoro sample widget.
//
// Loads the *actual shipped* sample HTML at
// client/public/examples/widgets/pomodoro/index.html, executes both the
// SDK script (`/sdk/widget-sdk.v1.js`) and the sample's own inline
// `<script>` block inside a Node `vm` sandbox with a minimal DOM shim,
// and asserts the contract every third-party widget relies on:
//
//   • The sample's own code calls `OpenBento.ready` + `OpenBento.getState`
//     + `OpenBento.setState` against the real shipped SDK bytes.
//   • A re-mount of the sample with persisted host state correctly
//     hydrates the in-DOM time/mode/round labels (proving the
//     "refresh-survives-state" durability contract end-to-end).
//   • Clicking the "Start" / "Skip" buttons drives the SDK -> host
//     setState path; the host's persisted state slice matches what the
//     sample tried to save.
//
// We deliberately avoid pulling in JSDOM — the sample only touches a
// tiny surface (getElementById + a handful of element properties +
// addEventListener). Hand-rolling the shim keeps the test fast and
// pinpoints exactly which DOM behaviors the SDK contract depends on.

import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
register({ parentURL: pathToFileURL('./').href });

import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const { applyClientMessage, ClientMessageSchema } =
  await import('../../shared/widget-sdk-protocol.ts');

// ─── Tiny DOM shim — only what the Pomodoro sample touches ────────────
function makeFakeElement(id) {
  const handlers = {};
  return {
    id,
    textContent: '',
    style: {},
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    // Test-only helper used by the click simulation.
    _click: () => { for (const fn of handlers.click || []) fn({}); },
  };
}

function makeDocument() {
  const els = {
    time:   makeFakeElement('time'),
    mode:   makeFakeElement('mode'),
    toggle: makeFakeElement('toggle'),
    reset:  makeFakeElement('reset'),
    skip:   makeFakeElement('skip'),
    round:  makeFakeElement('round'),
  };
  return {
    els,
    getElementById: (id) => els[id] || null,
    documentElement: { style: { setProperty: () => {} } },
  };
}

async function loadSdkSource() {
  return readFile(
    new URL('../../client/public/sdk/widget-sdk.v1.js', import.meta.url),
    'utf8',
  );
}

async function loadSampleScript() {
  // Extract the <script>(function () { ... })()</script> body from the
  // sample HTML — we don't need a real HTML parser, the sample has
  // exactly two <script> tags and only the second one is inline.
  const html = await readFile(
    new URL('../../client/public/examples/widgets/pomodoro/index.html', import.meta.url),
    'utf8',
  );
  // Match the LAST inline <script>...</script> block.
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(matches.length >= 1, 'sample must contain an inline <script>');
  return matches[matches.length - 1][1];
}

// Build a fresh sandbox that runs the SDK + sample HTML and proxies
// postMessage through the supplied host. Returns the sandbox + the
// fake document so the test can poke the DOM.
function buildSampleSandbox(host) {
  const messageListeners = [];
  const window = {};
  const parent = {
    postMessage: (msg) => {
      const reply = host(msg);
      if (reply) {
        queueMicrotask(() => {
          for (const fn of messageListeners) fn({ data: reply });
        });
      }
    },
  };
  window.addEventListener = (type, cb) => {
    if (type === 'message') messageListeners.push(cb);
  };
  window.removeEventListener = (type, cb) => {
    if (type !== 'message') return;
    const i = messageListeners.indexOf(cb);
    if (i >= 0) messageListeners.splice(i, 1);
  };

  const doc = makeDocument();

  const sandbox = {
    window, parent,
    document: doc,
    setTimeout, clearTimeout,
    Promise, Object, Array, JSON, Date, Math, Error, String, Number, Boolean,
    queueMicrotask,
  };
  vm.createContext(sandbox);
  return { sandbox, doc };
}

// Drain queued microtasks a few times so request/response promises in
// the SDK have time to settle before we assert.
async function settle() {
  for (let i = 0; i < 6; i++) await new Promise((r) => queueMicrotask(r));
}

// ─── 1. Cold mount: sample boots, persists initial state via setState ─
test('Pomodoro sample (real HTML): cold-mount renders defaults and persists initial state via SDK', async () => {
  let hostState = {};
  const theme = { dark: true, accent: '#22d3ee', customColor: null, bg: null };
  function host(rawMsg) {
    const parsed = ClientMessageSchema.safeParse(rawMsg);
    if (!parsed.success) return null;
    const m = parsed.data;
    const { nextState, response } = applyClientMessage(hostState, m, theme);
    hostState = nextState;
    return response;
  }

  const { sandbox, doc } = buildSampleSandbox(host);
  vm.runInContext(await loadSdkSource(), sandbox);
  // In a real browser `window === globalThis`, so the sample's bare
  // `OpenBento` reference resolves to the same object the SDK attached
  // to `window`. Mirror that for the vm sandbox.
  sandbox.OpenBento = sandbox.window.OpenBento;
  vm.runInContext(await loadSampleScript(), sandbox);
  await settle();

  // Default render reflects the in-script defaults: 25:00 focus / round 1.
  assert.equal(doc.els.time.textContent,   '25:00');
  assert.equal(doc.els.mode.textContent,   'Focus');
  assert.equal(doc.els.toggle.textContent, 'Start');
  assert.equal(doc.els.round.textContent,  'Round 1 of 4');

  // Click "Reset" → sample calls OpenBento.setState({…}) WITHOUT starting
  // the recurring 1-second tick (which would keep the event loop alive
  // and time the test out). This still proves the DOM-event → SDK →
  // host setState path runs end-to-end against the real shipped bytes.
  doc.els.reset._click();
  await settle();
  assert.equal(hostState.mode,      'focus',   'host received mode via SDK setState');
  assert.equal(hostState.remaining, 25 * 60,   'host received remaining via SDK setState');
  assert.equal(hostState.round,     1);
  assert.equal(hostState.running,   false);
});

// ─── 2. Re-mount with persisted host state hydrates the DOM ──────────
test('Pomodoro sample (real HTML): re-mount with persisted host state hydrates the DOM via OpenBento.getState', async () => {
  // Simulate a host that already has persisted Pomodoro state from a
  // previous session — what the user sees after a page refresh.
  let hostState = { mode: 'break', remaining: 137, round: 3, running: true };
  const theme = { dark: false, accent: '#a78bfa', customColor: null, bg: null };
  function host(rawMsg) {
    const parsed = ClientMessageSchema.safeParse(rawMsg);
    if (!parsed.success) return null;
    const m = parsed.data;
    const { nextState, response } = applyClientMessage(hostState, m, theme);
    hostState = nextState;
    return response;
  }

  const { sandbox, doc } = buildSampleSandbox(host);
  vm.runInContext(await loadSdkSource(), sandbox);
  sandbox.OpenBento = sandbox.window.OpenBento; // mirror window===globalThis
  vm.runInContext(await loadSampleScript(), sandbox);
  await settle();

  // Hydration round-trip: getState resolved with the persisted slice
  // and the sample re-rendered the DOM accordingly.
  assert.equal(doc.els.mode.textContent,   'Break');
  assert.equal(doc.els.time.textContent,   '02:17',  'remaining=137s formatted as 02:17');
  assert.equal(doc.els.round.textContent,  'Round 3 of 4');
  // Per the sample's contract, persisted `running:true` is intentionally
  // NOT auto-resumed — the toggle must read "Start" again on remount.
  assert.equal(doc.els.toggle.textContent, 'Start',
    'sample never auto-resumes a running timer after remount (documented contract)');
});
