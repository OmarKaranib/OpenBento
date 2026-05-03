// Themes Marketplace — pure-helper tests.
//
// Covers two contracts:
//   1. The theme-apply reducer (themeToCssVars) returns a stable, fully-
//      populated CSS-var bag for every built-in theme.
//   2. Personal-theme capture + sanitize round-trips losslessly through
//      JSON, and rejects malformed entries on the way back in.
//
// We run under `tsx --test` (see check workflow) so this file imports
// directly from `@shared/themes`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILT_IN_THEMES,
  BUILT_IN_THEMES_BY_ID,
  THEME_FONT_STACKS,
  themeToCssVars,
  hexToRgba,
  hexToRgbTriplet,
  captureLookAsTheme,
  sanitizeThemes,
  isValidTheme,
  type Theme,
} from '../../shared/themes';

// ─── Built-in catalogue ────────────────────────────────────────────────────

test('ships exactly 8 built-in themes with unique ids', () => {
  assert.equal(BUILT_IN_THEMES.length, 8);
  const ids = new Set(BUILT_IN_THEMES.map(t => t.id));
  assert.equal(ids.size, 8, 'theme ids must be unique');
  for (const t of BUILT_IN_THEMES) {
    assert.equal(t.builtIn, true, `${t.id} should be marked builtIn`);
    assert.ok(t.name && t.description, `${t.id} needs name + description`);
    assert.ok(BUILT_IN_THEMES_BY_ID[t.id] === t, 'lookup map must reference same instance');
  }
});

test('every built-in theme is recognised by isValidTheme', () => {
  for (const t of BUILT_IN_THEMES) {
    assert.ok(isValidTheme(t), `built-in ${t.id} failed validation`);
  }
});

// ─── themeToCssVars (the apply reducer) ────────────────────────────────────

test('themeToCssVars returns the full var bag for a solid-color theme', () => {
  const paper = BUILT_IN_THEMES_BY_ID['paper-light'];
  const vars  = themeToCssVars(paper);
  assert.equal(vars['--ob-bg-color'], '#f8f4ec');
  assert.equal(vars['--ob-bg-image'], 'none');
  assert.equal(vars['--ob-accent'],   '#1f2937');
  assert.equal(vars['--ob-widget-tint'], '#ffffff');
  assert.equal(vars['--ob-font'], THEME_FONT_STACKS.serif);
  // --ob-accent-soft is the accent at ~18% alpha
  assert.match(vars['--ob-accent-soft'], /^rgba\(31, 41, 55, 0\.18\)$/);
  // --slot-bg-rgb drives .dashboard-slot's translucent fill in index.css
  assert.equal(vars['--slot-bg-rgb'], '255, 255, 255');
});

test('themeToCssVars sets --slot-bg-rgb so .dashboard-slot picks up the tint', () => {
  for (const t of BUILT_IN_THEMES) {
    const vars = themeToCssVars(t);
    assert.match(vars['--slot-bg-rgb'], /^\d+, \d+, \d+$/, `${t.id} bad triplet`);
  }
});

test('themeToCssVars returns transparent bg-color for gradient themes', () => {
  const ocean = BUILT_IN_THEMES_BY_ID['midnight-ocean'];
  const vars  = themeToCssVars(ocean);
  assert.equal(vars['--ob-bg-color'], 'transparent');
  // The gradient string is forwarded verbatim into --ob-bg-image
  assert.ok(vars['--ob-bg-image'].startsWith('linear-gradient'));
  assert.equal(vars['--ob-accent'], '#22d3ee');
});

test('themeToCssVars output is deterministic — same input, same vars', () => {
  for (const t of BUILT_IN_THEMES) {
    const a = themeToCssVars(t);
    const b = themeToCssVars(t);
    assert.deepEqual(a, b, `${t.id} reducer not deterministic`);
  }
});

// ─── hexToRgba safety ───────────────────────────────────────────────────────

test('hexToRgba parses 3-digit and 6-digit hex; passes through garbage', () => {
  assert.equal(hexToRgba('#fff', 1),     'rgba(255, 255, 255, 1)');
  assert.equal(hexToRgba('#22d3ee', 0.5), 'rgba(34, 211, 238, 0.5)');
  // Bad input → return as-is so a malformed personal theme can't crash.
  assert.equal(hexToRgba('not-a-color', 0.5), 'not-a-color');
});

test('hexToRgbTriplet returns "r, g, b" or null for bad input', () => {
  assert.equal(hexToRgbTriplet('#fff'),    '255, 255, 255');
  assert.equal(hexToRgbTriplet('#22d3ee'), '34, 211, 238');
  assert.equal(hexToRgbTriplet('nope'),    null);
});

// ─── Personal-theme round-trip ─────────────────────────────────────────────

test('captureLookAsTheme produces a valid Theme with builtIn:false + createdAt', () => {
  const captured = captureLookAsTheme({
    name: 'My Sunset',
    background: { kind: 'gradient', value: 'linear-gradient(0deg,#000,#fff)' },
    accent: '#ff0066',
    font: 'mono',
    widgetTint: '#111111',
    lightMode: false,
  });
  assert.equal(captured.builtIn, false);
  assert.equal(captured.name,    'My Sunset');
  assert.match(captured.id, /^personal-/);
  assert.ok(typeof captured.createdAt === 'number' && captured.createdAt > 0);
  assert.ok(isValidTheme(captured));
});

test('captureLookAsTheme falls back to "My Theme" on empty name', () => {
  const t = captureLookAsTheme({
    name: '   ',
    background: { kind: 'color', value: '#000000' },
    accent: '#ffffff',
    font: 'inter',
    widgetTint: '#000000',
    lightMode: false,
  });
  assert.equal(t.name, 'My Theme');
});

test('localStorage round-trip preserves personal themes', () => {
  // Simulate the save/load cycle without touching real localStorage.
  const original: Theme[] = [
    captureLookAsTheme({
      name: 'A', background: { kind: 'color', value: '#101010' },
      accent: '#22d3ee', font: 'inter', widgetTint: '#101010', lightMode: false,
    }),
    captureLookAsTheme({
      name: 'B', background: { kind: 'gradient', value: 'linear-gradient(90deg,#fff,#000)' },
      accent: '#ea580c', font: 'serif', widgetTint: '#fff', lightMode: true,
    }),
  ];
  const wire    = JSON.stringify(original);
  const decoded = sanitizeThemes(JSON.parse(wire));
  assert.equal(decoded.length, 2);
  assert.deepEqual(decoded, original);
});

test('sanitizeThemes drops malformed entries and survives garbage input', () => {
  const valid = captureLookAsTheme({
    name: 'Good', background: { kind: 'color', value: '#000' },
    accent: '#fff', font: 'inter', widgetTint: '#000', lightMode: false,
  });
  // Mix of valid + missing fields + wrong types + nulls
  const dirty = [
    valid,
    { id: 'no-name', builtIn: false }, // missing fields
    { ...valid, font: 'comic-sans' },  // unknown font
    { ...valid, background: { kind: 'sparkles', value: 'x' } }, // bad bg kind
    null,
    'string',
    undefined,
  ];
  const cleaned = sanitizeThemes(dirty);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, valid.id);
  // Non-array → empty result, not a crash
  assert.deepEqual(sanitizeThemes(null),  []);
  assert.deepEqual(sanitizeThemes('foo'), []);
  assert.deepEqual(sanitizeThemes(42),    []);
});
