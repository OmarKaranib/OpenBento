import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planPageVisuals,
  EMPTY_PAGE_VISUAL_PREV,
  type BodyBgStyles,
  type PageVisualPrev,
} from '../../client/src/dashboard/page-visuals';

const GLOBAL_BG: BodyBgStyles = {
  backgroundImage: 'url("https://global/bg.png")',
  backgroundColor: 'transparent',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed',
};

test('switching A(override) → B(no override) restores the global theme + bg (no bleed)', () => {
  // Start with a clean baseline: user has globally chosen
  // theme-midnight-ocean and a global background.
  let prev: PageVisualPrev = EMPTY_PAGE_VISUAL_PREV;
  const globals = { themeId: 'theme-midnight-ocean', bg: GLOBAL_BG };

  // Activate page A which carries an override.
  const planA = planPageVisuals(
    prev,
    {
      themeId: 'theme-cyberpunk',
      backgroundConfig: { kind: 'color', value: '#ff00ff' },
    },
    globals,
  );
  assert.deepEqual(
    planA.commands.find(c => c.kind === 'apply-theme'),
    { kind: 'apply-theme', themeId: 'theme-cyberpunk' },
  );
  assert.equal(planA.next.hadThemeOverride, true);
  assert.equal(planA.next.hadBgOverride, true);
  prev = planA.next;

  // Now switch to page B which has no overrides — must restore the
  // global look, NOT leak page A's theme/background through.
  const planB = planPageVisuals(
    prev,
    { themeId: null, backgroundConfig: null },
    { themeId: 'theme-cyberpunk', bg: null /* current DOM is page-A's bg */ },
  );
  const restoreTheme = planB.commands.find(c => c.kind === 'restore-theme');
  const restoreBg = planB.commands.find(c => c.kind === 'restore-bg');
  assert.ok(restoreTheme, 'expected a restore-theme command');
  assert.ok(restoreBg, 'expected a restore-bg command');
  assert.equal(
    restoreTheme && restoreTheme.kind === 'restore-theme' ? restoreTheme.themeId : 'X',
    'theme-midnight-ocean',
  );
  assert.deepEqual(
    restoreBg && restoreBg.kind === 'restore-bg' ? restoreBg.bg : null,
    GLOBAL_BG,
  );
  assert.equal(planB.next.hadThemeOverride, false);
  assert.equal(planB.next.hadBgOverride, false);
});

test('two no-override pages in a row never emit DOM commands', () => {
  let prev: PageVisualPrev = EMPTY_PAGE_VISUAL_PREV;
  const globals = { themeId: 'theme-paper-light', bg: GLOBAL_BG };
  const a = planPageVisuals(prev, { themeId: null, backgroundConfig: null }, globals);
  assert.deepEqual(a.commands, []);
  prev = a.next;
  const b = planPageVisuals(prev, { themeId: null, backgroundConfig: null }, globals);
  assert.deepEqual(b.commands, []);
});

test('switching between two override pages emits apply-theme/apply-bg without restoring', () => {
  let prev: PageVisualPrev = EMPTY_PAGE_VISUAL_PREV;
  const globals = { themeId: 'theme-paper-light', bg: GLOBAL_BG };
  const a = planPageVisuals(prev, {
    themeId: 'theme-forest',
    backgroundConfig: { kind: 'color', value: '#003322' },
  }, globals);
  prev = a.next;
  const b = planPageVisuals(prev, {
    themeId: 'theme-cyberpunk',
    backgroundConfig: { kind: 'gradient', value: 'linear-gradient(45deg,#f0f,#0ff)' },
  }, { themeId: 'theme-forest', bg: null });
  // No restore should appear — we go straight from one override to
  // the next, with the original global snapshot preserved for the
  // eventual flip back to a no-override page.
  assert.equal(b.commands.some(c => c.kind === 'restore-theme'), false);
  assert.equal(b.commands.some(c => c.kind === 'restore-bg'), false);
  assert.equal(b.commands.some(c => c.kind === 'apply-theme'), true);
  assert.equal(b.commands.some(c => c.kind === 'apply-bg'), true);
  assert.equal(b.next.snapshot.themeId, 'theme-paper-light');
  assert.deepEqual(b.next.snapshot.bg, GLOBAL_BG);
});
