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
  // Fresh DOM before each test so class+style state never leaks.
  installDom();
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
