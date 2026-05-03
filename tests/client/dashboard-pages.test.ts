import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPage,
  deletePage,
  duplicatePage,
  getActivePage,
  makeEmptyState,
  migrateLegacyWidgets,
  renamePage,
  sanitizePages,
  setActivePage,
  setDefaultPage,
  updateActivePageWidgets,
  newPageId,
  slugify,
  type DashboardPageWidget,
} from '../../shared/dashboard-pages';

const w = (id: string, type = 'note'): DashboardPageWidget => ({
  id, type, x: 0, y: 0, w: 2, h: 2,
});

test('migrateLegacyWidgets wraps a flat array as a Home page', () => {
  const state = migrateLegacyWidgets([w('a'), w('b')]);
  assert.equal(state.pages.length, 1);
  assert.equal(state.pages[0].name, 'Home');
  assert.equal(state.pages[0].isDefault, true);
  assert.equal(state.pages[0].widgets.length, 2);
  assert.equal(state.activePageId, state.pages[0].id);
});

test('migrateLegacyWidgets handles null / undefined / non-array input', () => {
  for (const input of [null, undefined, 'oops' as unknown as DashboardPageWidget[]]) {
    const s = migrateLegacyWidgets(input as DashboardPageWidget[] | null);
    assert.equal(s.pages.length, 1);
    assert.equal(s.pages[0].widgets.length, 0);
  }
});

test('sanitizePages drops malformed widgets and enforces a single default', () => {
  const raw = {
    pages: [
      { id: 'a', name: 'A', isDefault: false, widgets: [w('1'), { foo: 'bar' }] },
      { id: 'b', name: 'B', isDefault: true, widgets: [] },
      { id: 'c', name: 'C', isDefault: true, widgets: [] }, // duplicate default
      'garbage',
    ],
    activePageId: 'b',
  };
  const s = sanitizePages(raw)!;
  assert.ok(s);
  assert.equal(s.pages.length, 3);
  assert.equal(s.pages[0].widgets.length, 1, 'malformed widget filtered');
  // First page claiming default wins; later defaults flipped off.
  const defaults = s.pages.filter(p => p.isDefault);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, 'b');
  assert.equal(s.activePageId, 'b');
});

test('sanitizePages returns null for unrecoverable input and falls back to first when active missing', () => {
  assert.equal(sanitizePages(null), null);
  assert.equal(sanitizePages({}), null);
  assert.equal(sanitizePages({ pages: [] }), null);
  const s = sanitizePages({
    pages: [{ id: 'x', name: 'X', isDefault: false, widgets: [] }],
    activePageId: 'does-not-exist',
  })!;
  assert.equal(s.activePageId, 'x');
  assert.equal(s.pages[0].isDefault, true, 'first page promoted to default');
});

test('addPage / renamePage / setDefaultPage / setActivePage round-trip', () => {
  let s = makeEmptyState();
  s = addPage(s, 'Work');
  s = addPage(s, 'Side');
  assert.equal(s.pages.length, 3);
  assert.equal(s.activePageId, s.pages[2].id, 'addPage activates new page');

  s = renamePage(s, s.pages[1].id, '   ');
  assert.equal(s.pages[1].name, 'Work', 'blank rename ignored');
  s = renamePage(s, s.pages[1].id, 'Work HQ');
  assert.equal(s.pages[1].name, 'Work HQ');

  s = setDefaultPage(s, s.pages[2].id);
  assert.equal(s.pages.filter(p => p.isDefault).length, 1);
  assert.equal(s.pages[2].isDefault, true);

  s = setActivePage(s, s.pages[0].id);
  assert.equal(s.activePageId, s.pages[0].id);
  s = setActivePage(s, 'bogus');
  assert.equal(s.activePageId, s.pages[0].id, 'invalid id ignored');
});

test('updateActivePageWidgets only mutates the active page', () => {
  let s = makeEmptyState();
  s = addPage(s, 'Work');
  // Active is now the new "Work" page.
  s = updateActivePageWidgets(s, [w('only-on-work')]);
  assert.equal(s.pages[0].widgets.length, 0, 'home untouched');
  assert.equal(s.pages[1].widgets.length, 1);
  s = setActivePage(s, s.pages[0].id);
  s = updateActivePageWidgets(s, [w('home-1'), w('home-2')]);
  assert.equal(s.pages[0].widgets.length, 2);
  assert.equal(s.pages[1].widgets.length, 1, 'work still isolated');
  assert.equal(s.pages[1].widgets[0].id, 'only-on-work');
});

test('duplicatePage clones widgets with fresh ids and a new page id', () => {
  let s = makeEmptyState();
  s = updateActivePageWidgets(s, [w('a'), w('b')]);
  const original = getActivePage(s);
  s = duplicatePage(s, original.id);
  assert.equal(s.pages.length, 2);
  const dup = s.pages[1];
  assert.notEqual(dup.id, original.id);
  assert.equal(dup.widgets.length, 2);
  assert.notEqual(dup.widgets[0].id, 'a', 'widget id rewritten');
  assert.equal(dup.isDefault, false);
  assert.equal(s.activePageId, dup.id);
});

test('integration: switching active page does not bleed widget state across pages', () => {
  // Build two pages with distinct widget arrays, then flip the active
  // page back and forth and verify each page keeps its own widgets.
  // This protects against the regression the architect flagged where
  // setWidgets-on-active accidentally writes through to other pages.
  let s = makeEmptyState();
  s = updateActivePageWidgets(s, [
    { id: 'h1', type: 'note', x: 0, y: 0, w: 2, h: 2 },
  ] as any);
  s = addPage(s, 'Work');
  const workId = s.activePageId;
  s = updateActivePageWidgets(s, [
    { id: 'w1', type: 'clock', x: 0, y: 0, w: 1, h: 1 },
    { id: 'w2', type: 'weather', x: 1, y: 0, w: 2, h: 2 },
  ] as any);
  // Flip back to Home
  const homeId = s.pages.find(p => p.name === 'Home')!.id;
  s = setActivePage(s, homeId);
  let active = s.pages.find(p => p.id === s.activePageId)!;
  assert.equal(active.widgets.length, 1);
  assert.equal(active.widgets[0].id, 'h1');
  // Mutate Home — must not touch Work
  s = updateActivePageWidgets(s, [
    { id: 'h1', type: 'note', x: 0, y: 0, w: 2, h: 2 },
    { id: 'h2', type: 'spacer', x: 2, y: 0, w: 1, h: 1 },
  ] as any);
  const work = s.pages.find(p => p.id === workId)!;
  assert.equal(work.widgets.length, 2, 'Work was not mutated by Home write');
  assert.equal(work.widgets[0].id, 'w1');
  // Flip to Work — its widgets must be untouched
  s = setActivePage(s, workId);
  active = s.pages.find(p => p.id === s.activePageId)!;
  assert.equal(active.widgets.length, 2);
  assert.deepEqual(active.widgets.map(w => w.id), ['w1', 'w2']);
});

test('integration: ?page= deep-link round-trips through setActivePage', () => {
  // Simulates the dashboard-shell deep-link effect: a URL carrying a
  // valid page id flips activePageId; an unknown id is a no-op.
  let s = makeEmptyState();
  s = addPage(s, 'Stream');
  const streamId = s.pages.find(p => p.name === 'Stream')!.id;
  const homeId = s.pages.find(p => p.name === 'Home')!.id;
  // Active page is currently Stream (addPage flips active). Simulate
  // a deep-link to Home.
  s = s.pages.some(p => p.id === homeId) ? setActivePage(s, homeId) : s;
  assert.equal(s.activePageId, homeId);
  // Deep-link to Stream
  s = s.pages.some(p => p.id === streamId) ? setActivePage(s, streamId) : s;
  assert.equal(s.activePageId, streamId);
  // Stale link — unknown id leaves state unchanged.
  const before = s.activePageId;
  const requested = 'page-does-not-exist';
  s = s.pages.some(p => p.id === requested) ? setActivePage(s, requested) : s;
  assert.equal(s.activePageId, before);
});

test('deletePage promotes the neighbor when a non-first default is removed', () => {
  // Build a 3-page state where the MIDDLE page is the default. The
  // architect flagged that previous behavior always promoted index 0;
  // we expect the page that visually replaces the deleted slot (the
  // next page over, or previous if last) to inherit default.
  let s = makeEmptyState();          // [Home(default)]
  s = addPage(s, 'Work');             // [Home, Work(active)]
  s = addPage(s, 'Side');             // [Home, Work, Side(active)]
  s = setDefaultPage(s, s.pages[1].id); // Work is default
  const sideId = s.pages[2].id;
  s = deletePage(s, s.pages[1].id);   // delete Work (default, index 1)
  assert.equal(s.pages.length, 2);
  // The neighbor that filled Work's slot is the page formerly at
  // index 2 (Side). It should now carry the default.
  assert.equal(s.pages[1].id, sideId);
  assert.equal(s.pages[1].isDefault, true);
  assert.equal(s.pages[0].isDefault, false, 'Home was not promoted');
});

test('deletePage refuses to remove the last page and re-promotes a default', () => {
  let s = makeEmptyState();
  const onlyId = s.pages[0].id;
  s = deletePage(s, onlyId);
  assert.equal(s.pages.length, 1, 'last page protected');

  s = addPage(s, 'Work');
  s = setDefaultPage(s, s.pages[1].id); // Work is default
  s = deletePage(s, s.pages[1].id); // delete the default
  assert.equal(s.pages.length, 1);
  assert.equal(s.pages[0].isDefault, true, 'remaining page becomes default');
  assert.equal(s.activePageId, s.pages[0].id, 'active falls back to remaining page');
});

test('newPageId avoids collisions and slugify produces safe ids', () => {
  assert.equal(slugify('  My Cool Page!! '), 'my-cool-page');
  assert.equal(slugify(''), 'page');
  const existing = [{ id: 'page-home' }, { id: 'page-home-2' }];
  assert.equal(newPageId('Home', existing), 'page-home-3');
  assert.equal(newPageId('Brand New', existing), 'page-brand-new');
});
