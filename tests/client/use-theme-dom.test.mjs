// Integration tests for the Themes Marketplace DOM-apply path.
//
// These complement the pure-helper tests in tests/client/themes.test.ts
// by exercising the *actual* side-effecting writer (writeThemeToDom) and
// the useTheme hook's preview/revert flow. The architect's earlier review
// flagged that pure-helper coverage alone could not catch CSS-cascade or
// gating regressions; these tests close that gap.
//
// We can't load a real browser here, so we shim the minimum surface
// writeThemeToDom touches: a document with documentElement+body that own
// CSSStyleDeclaration-shaped style objects, and a window.getComputedStyle
// that returns the body's inline style.
//
// Coverage:
//   1. writeThemeToDom on a solid-color theme:
//      - sets --slot-bg-rgb on documentElement (the var .dashboard-slot
//        inherits, so untinted widgets pick up the theme tint)
//      - sets body.style.fontFamily (real font swap, not just a var)
//      - adds the .ob-theme-active class (which the !important CSS rule
//        in index.css uses to make the dashboard container transparent
//        during hover-preview as well as full apply)
//      - flips dark/light mode via the injected setter
//   2. writeThemeToDom on a gradient theme: backgroundImage gets the raw
//      gradient string and backgroundColor becomes transparent.
//   3. previewTheme + revertPreview round-trip: hover preview adds the
//      themed class; revert removes it for the no-prior-theme case so
//      the dashboard returns to its hardcoded backdrop.

import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
register({ parentURL: pathToFileURL('./').href });

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Minimal DOM shim ─────────────────────────────────────────────────

function makeStyle() {
  const map = new Map();
  return {
    setProperty(k, v) { map.set(k, String(v)); },
    getPropertyValue(k) { return map.get(k) ?? ''; },
    removeProperty(k) { map.delete(k); },
    // Inline-style "named" props writeThemeToDom touches:
    fontFamily: '',
    backgroundImage: '',
    backgroundColor: '',
    backgroundSize: '',
    backgroundPosition: '',
    backgroundAttachment: '',
    _map: map,
  };
}

function makeClassList() {
  const set = new Set();
  return {
    add(c)      { set.add(c); },
    remove(c)   { set.delete(c); },
    contains(c) { return set.has(c); },
    _set: set,
  };
}

function installDom() {
  const root = { style: makeStyle(), classList: makeClassList() };
  const body = { style: makeStyle(), classList: makeClassList() };
  globalThis.document = {
    documentElement: root,
    body,
  };
  globalThis.window = {
    getComputedStyle: (el) => ({
      // Just echo back the inline style props we care about.
      fontFamily:      el?.style?.fontFamily      ?? '',
      backgroundImage: el?.style?.backgroundImage ?? '',
      backgroundColor: el?.style?.backgroundColor ?? '',
    }),
  };
  return { root, body };
}

beforeEach(() => {
  // Fresh DOM + localStorage before each test so class/style/state
  // never leaks (the cloud-hydration test seeds localStorage with an
  // active id; without this reset later tests would auto-apply that
  // theme on mount and break their preconditions).
  installDom();
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

// ─── Tests ────────────────────────────────────────────────────────────

test('writeThemeToDom: solid theme sets slot tint var, font, and themed class', async () => {
  const { writeThemeToDom } = await import('../../client/src/dashboard/use-theme.ts');
  const { BUILT_IN_THEMES_BY_ID } = await import('../../shared/themes.ts');
  const paper = BUILT_IN_THEMES_BY_ID['paper-light'];

  let darkArg = null;
  writeThemeToDom(paper, (v) => { darkArg = v; });

  // (a) The theme's widgetTint hits :root as --slot-bg-rgb so .dashboard-slot
  //     (which has NO local --slot-bg-rgb anymore) inherits the new value.
  //     paper-light tint is #ffffff → "255, 255, 255".
  assert.equal(
    document.documentElement.style.getPropertyValue('--slot-bg-rgb'),
    '255, 255, 255',
    'widget tint must propagate to --slot-bg-rgb on :root',
  );

  // (b) Font is set on body (visibly changes typography).
  assert.ok(
    document.body.style.fontFamily.length > 0,
    'body fontFamily must be set, not just a CSS var',
  );

  // (c) Marker class enables the !important transparency rule that lets
  //     hover preview backgrounds show through the dashboard container.
  assert.equal(
    document.body.classList.contains('ob-theme-active'), true,
    'body must carry .ob-theme-active so dashboard becomes transparent',
  );

  // (d) Dark/light mode is bridged via the injected setter.
  assert.equal(darkArg, !paper.lightMode);

  // (e) Accent tokens are written to :root so the scoped rules in
  //     index.css (body.ob-theme-active .dashboard-slot, :focus-visible,
  //     hover ring, anchor color) actually pick up the curated colour.
  //     This is the integration assertion guarding against regressions
  //     where the variables exist on the Theme object but never reach
  //     the live DOM. paper-light's accent is "#1f2937".
  assert.equal(
    document.documentElement.style.getPropertyValue('--ob-accent'),
    paper.accent,
    '--ob-accent must reach :root so themed surfaces re-tint',
  );
  assert.match(
    document.documentElement.style.getPropertyValue('--ob-accent-soft'),
    /^rgba\(\d+, \d+, \d+, 0?\.\d+\)$/,
    '--ob-accent-soft must be a valid rgba() string for slot borders',
  );
});

test('writeThemeToDom: switching themes updates --ob-accent in place (visible accent change)', async () => {
  // Belt-and-braces check that the accent token is not "set once and
  // forgotten" — applying a second theme must overwrite the value, which
  // is what makes apply/preview visibly re-tint the dashboard accent.
  const { writeThemeToDom } = await import('../../client/src/dashboard/use-theme.ts');
  const { BUILT_IN_THEMES_BY_ID } = await import('../../shared/themes.ts');
  const a = BUILT_IN_THEMES_BY_ID['paper-light'];     // accent #1f2937
  const b = BUILT_IN_THEMES_BY_ID['midnight-ocean'];  // accent #22d3ee

  writeThemeToDom(a, () => {});
  assert.equal(document.documentElement.style.getPropertyValue('--ob-accent'), a.accent);

  writeThemeToDom(b, () => {});
  assert.equal(
    document.documentElement.style.getPropertyValue('--ob-accent'),
    b.accent,
    'a second writeThemeToDom must overwrite --ob-accent (no caching)',
  );
  assert.notEqual(a.accent, b.accent, 'sanity: the two test themes must differ');
});

test('writeThemeToDom: gradient theme writes raw gradient to backgroundImage', async () => {
  const { writeThemeToDom } = await import('../../client/src/dashboard/use-theme.ts');
  const { BUILT_IN_THEMES_BY_ID } = await import('../../shared/themes.ts');
  const ocean = BUILT_IN_THEMES_BY_ID['midnight-ocean'];

  writeThemeToDom(ocean, () => {});

  assert.ok(
    document.body.style.backgroundImage.startsWith('linear-gradient'),
    'gradient theme must paint backgroundImage with the raw gradient string',
  );
  assert.equal(document.body.style.backgroundColor, 'transparent');
});

test('clearThemeFromDom removes the previous account theme', async () => {
  const { clearThemeFromDom, writeThemeToDom } = await import('../../client/src/dashboard/use-theme.ts');
  const { BUILT_IN_THEMES_BY_ID } = await import('../../shared/themes.ts');
  writeThemeToDom(BUILT_IN_THEMES_BY_ID['midnight-ocean'], () => {});

  clearThemeFromDom();

  assert.equal(document.body.classList.contains('ob-theme-active'), false);
  assert.equal(document.body.style.backgroundImage, 'none');
  assert.equal(document.body.style.backgroundColor, '#F8F9FA');
  assert.equal(document.documentElement.style.getPropertyValue('--ob-accent'), '');
});

test('useTheme: cloud-sync handoff — activeThemeId switching A→B reapplies theme B to the DOM', async () => {
  // Regression test for the "cloud hydration handoff" bug: when device A
  // applies theme A locally and device B opens with a different cloud-
  // synced active theme B, the hook must re-write the DOM (not just
  // update React state). The fix tracks the last id written to the DOM
  // in lastAppliedIdRef and reapplies whenever activeThemeId changes
  // resolution to a different theme.
  const React = (await import('react')).default;
  const { useTheme } = await import('../../client/src/dashboard/use-theme.ts');
  const { BUILT_IN_THEMES_BY_ID } = await import('../../shared/themes.ts');

  // Stub a localStorage that starts with theme A active so the hook's
  // initial useState picks it up.
  const themeA = BUILT_IN_THEMES_BY_ID['paper-light'];      // tint #ffffff
  const themeB = BUILT_IN_THEMES_BY_ID['midnight-ocean'];   // gradient bg
  const store = new Map([['openBentoActiveThemeId', themeA.id]]);
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  // ── Re-renderable dispatcher with effect-deps tracking ─────────────
  const states  = [];
  const refs    = [];
  let effects   = [];
  let cursorS = 0, cursorR = 0;

  const dispatcher = {
    useState(init) {
      const i = cursorS++;
      if (i >= states.length) {
        states.push(typeof init === 'function' ? init() : init);
      }
      const setter = (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; };
      return [states[i], setter];
    },
    useRef(init)  { const i = cursorR++; if (i >= refs.length) refs.push({ current: init }); return refs[i]; },
    useCallback(fn) { return fn; },
    useMemo(fn)     { return fn(); },
    useEffect(fn, deps) { effects.push({ fn, deps }); },
    useLayoutEffect(fn, deps) { effects.push({ fn, deps }); },
    useContext()    { return undefined; },
    useReducer(_r, init) { return [init, () => {}]; },
    useImperativeHandle() {},
    useDebugValue() {},
    useTransition() { return [false, (cb) => cb()]; },
    useDeferredValue(v) { return v; },
    useId() { return ':r:test:'; },
    useSyncExternalStore(_s, get) { return get(); },
    useInsertionEffect() {},
  };

  const Internals =
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher
    ?? React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;

  // Track which effect-instances have already run, keyed by call order +
  // a snapshot of their last deps array. Mirrors React's effect-skip
  // semantics: re-run only when deps change.
  const lastDeps = [];
  const render = () => {
    cursorS = 0; cursorR = 0; effects = [];
    const prev = Internals.current;
    Internals.current = dispatcher;
    let api;
    try {
      api = useTheme({
        isAuthenticated: false,
        userId: undefined,
        supabaseClient: null,
        isDarkMode: true,
        setIsDarkMode: () => {},
      });
    } finally { Internals.current = prev; }
    // Run only effects whose deps changed (or first-time effects).
    effects.forEach((e, idx) => {
      const prevDeps = lastDeps[idx];
      const changed = !prevDeps
        || !e.deps
        || prevDeps.length !== e.deps.length
        || prevDeps.some((d, i) => !Object.is(d, e.deps[i]));
      if (changed) {
        e.fn();
        lastDeps[idx] = e.deps ? [...e.deps] : null;
      }
    });
    return api;
  };

  // First render: hook hydrates activeThemeId='paper-light' from
  // localStorage and the hydration effect writes theme A to the DOM.
  render();
  assert.equal(
    document.documentElement.style.getPropertyValue('--slot-bg-rgb'),
    '255, 255, 255',
    'after first render the DOM must reflect theme A (paper-light tint)',
  );

  // Simulate cloud sync arriving with a different active theme. In
  // production this happens inside the cloud-hydration effect via
  // setActiveThemeId; here we mutate the state slot directly to model
  // the post-hydration React state.
  const activeIdSlot = states.findIndex((v) => v === themeA.id);
  assert.notEqual(activeIdSlot, -1, 'expected an activeThemeId state slot');
  states[activeIdSlot] = themeB.id;

  // Re-render: the hydration effect's deps (activeThemeId) changed, so
  // it must re-run and write theme B to the DOM. If the old one-shot
  // gate were still in place, --slot-bg-rgb would stay at A's value.
  render();
  // Theme B is a gradient theme — assert on its body backgroundImage.
  assert.ok(
    document.body.style.backgroundImage.startsWith('linear-gradient'),
    'after cloud handoff the DOM must reflect theme B (gradient body bg)',
  );
});

test('useTheme.previewTheme then revertPreview removes themed class for first-time users', async () => {
  // We exercise the hook by reaching into React's internal hook dispatcher
  // (same trick as use-cloud-sync.test.mjs). Only useState/useRef/useEffect/
  // useCallback are needed — useEffect is a no-op for this preview flow.
  const React = (await import('react')).default;
  const { useTheme } = await import('../../client/src/dashboard/use-theme.ts');
  const { BUILT_IN_THEMES_BY_ID } = await import('../../shared/themes.ts');

  const states = [];
  const refs   = [];
  let cursor   = 0;

  const dispatcher = {
    useState(init) {
      const i = cursor++;
      if (states[i] === undefined) states[i] = typeof init === 'function' ? init() : init;
      const setter = (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; };
      return [states[i], setter];
    },
    useRef(init) {
      const i = cursor++;
      if (!refs[i]) refs[i] = { current: init };
      return refs[i];
    },
    useEffect()    { /* effects are not what we're testing */ },
    useCallback(fn) { return fn; },
    useMemo(fn)     { return fn(); },
    useContext()    { return undefined; },
  };

  const ReactInternals =
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher
    ?? React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;

  const runHook = (args) => {
    cursor = 0;
    const prev = ReactInternals.current;
    ReactInternals.current = dispatcher;
    try { return useTheme(args); }
    finally { ReactInternals.current = prev; }
  };

  const api = runHook({
    isAuthenticated: false,
    userId: undefined,
    supabaseClient: null,
    isDarkMode: true,
    setIsDarkMode: () => {},
  });

  assert.equal(
    document.body.classList.contains('ob-theme-active'), false,
    'precondition: no theme yet, body must not carry the marker class',
  );

  // Hover preview: marker class must turn ON so the !important rule
  // makes the dashboard transparent and the previewed bg becomes visible.
  api.previewTheme(BUILT_IN_THEMES_BY_ID['midnight-ocean']);
  assert.equal(
    document.body.classList.contains('ob-theme-active'), true,
    'previewTheme must add .ob-theme-active so live preview is visible',
  );

  // Revert: marker class must turn back OFF for first-time users so the
  // dashboard returns to its legacy hardcoded backdrop (no committed theme).
  api.revertPreview();
  assert.equal(
    document.body.classList.contains('ob-theme-active'), false,
    'revertPreview must drop .ob-theme-active when no theme had been applied',
  );
});
