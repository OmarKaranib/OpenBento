// Command Palette — pure-helper tests.
//
// Covers the fuzzy matcher, recents bookkeeping, the command-list
// builder (verifies each section produces the right commands and
// that running them invokes the right host callback), and the
// filter+group output for empty / non-empty queries.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fuzzyScore,
  rankCommand,
  pushRecent,
  loadRecents,
  saveRecents,
  RECENTS_CAP,
  RECENTS_KEY,
  buildCommands,
  filterAndGroup,
  isTypingTarget,
  SECTION_LABELS,
  type Command,
  type CommandHostBag,
} from '../../client/src/lib/command-palette-helpers';
import type { DashboardPage } from '../../shared/dashboard-pages';

// ─── fuzzyScore ───────────────────────────────────────────────────────────

test('fuzzyScore: empty query returns 0', () => {
  assert.equal(fuzzyScore('', 'anything'), 0);
});

test('fuzzyScore: exact match scores highest', () => {
  const a = fuzzyScore('clock', 'clock');
  const b = fuzzyScore('clock', 'world clocks');
  assert.ok(a !== null && b !== null);
  assert.ok(a > b, 'exact match should beat partial');
});

test('fuzzyScore: prefix scores higher than mid-string match', () => {
  const a = fuzzyScore('mark', 'markets ticker');
  const b = fuzzyScore('mark', 'add bookmark');
  assert.ok(a !== null && b !== null);
  assert.ok(a > b);
});

test('fuzzyScore: subsequence match works', () => {
  // "pomod" should match "Add Pomodoro Timer widget"
  const s = fuzzyScore('pomod', 'Add Pomodoro Timer widget');
  assert.ok(s !== null && s > 0);
});

test('fuzzyScore: returns null when query letters are not all present in order', () => {
  assert.equal(fuzzyScore('xyz', 'clock'), null);
  assert.equal(fuzzyScore('cko', 'clock'), null); // wrong order
});

test('rankCommand: picks the best of label vs keywords', () => {
  const cmd: Command = {
    id: 'a',
    section: 'actions',
    label: 'Open Themes Marketplace',
    keywords: ['look', 'palette'],
    run: () => {},
  };
  // "palette" is in keywords but not the label
  const s = rankCommand('palette', cmd);
  assert.ok(s !== null && s > 0);
});

// ─── Recents ──────────────────────────────────────────────────────────────

test('pushRecent: most-recent first, dedupes, caps at RECENTS_CAP', () => {
  let recents: string[] = [];
  recents = pushRecent(recents, 'a');
  recents = pushRecent(recents, 'b');
  recents = pushRecent(recents, 'c');
  recents = pushRecent(recents, 'a'); // bump a to front
  assert.deepEqual(recents, ['a', 'c', 'b']);

  // Fill past cap
  for (let i = 0; i < 10; i++) recents = pushRecent(recents, `x${i}`);
  assert.equal(recents.length, RECENTS_CAP);
  assert.equal(recents[0], 'x9');
});

test('loadRecents/saveRecents: round-trip via injected storage', () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  };
  saveRecents(['a', 'b'], fakeStorage as unknown as Storage);
  assert.equal(store.get(RECENTS_KEY), JSON.stringify(['a', 'b']));
  assert.deepEqual(loadRecents(fakeStorage as unknown as Storage), ['a', 'b']);
});

test('loadRecents: garbage returns empty', () => {
  const fakeStorage = {
    getItem: () => 'not-json',
  } as unknown as Storage;
  assert.deepEqual(loadRecents(fakeStorage), []);
});

// ─── buildCommands ────────────────────────────────────────────────────────

function makeHost(overrides: Partial<CommandHostBag> = {}): {
  host: CommandHostBag;
  calls: Record<string, unknown[]>;
} {
  const calls: Record<string, unknown[]> = {};
  const spy = (name: string) => (...args: unknown[]) => {
    calls[name] = args;
    return null as never;
  };
  const pages: DashboardPage[] = [
    { id: 'p1', name: 'Home', widgets: [], isDefault: true },
    { id: 'p2', name: 'Work', widgets: [] },
  ] as unknown as DashboardPage[];
  const host: CommandHostBag = {
    isEditMode: false,
    isFullscreen: false,
    isDarkMode: true,
    pages,
    activePageId: 'p1',
    setEditMode: spy('setEditMode') as unknown as CommandHostBag['setEditMode'],
    addWidget: spy('addWidget') as unknown as CommandHostBag['addWidget'],
    onAddPage: spy('onAddPage') as unknown as CommandHostBag['onAddPage'],
    onRenamePage: spy('onRenamePage') as unknown as CommandHostBag['onRenamePage'],
    onDeletePage: spy('onDeletePage') as unknown as CommandHostBag['onDeletePage'],
    onSetActivePage: spy('onSetActivePage') as unknown as CommandHostBag['onSetActivePage'],
    onSetDefaultPage: spy('onSetDefaultPage') as unknown as CommandHostBag['onSetDefaultPage'],
    setFullscreen: spy('setFullscreen') as unknown as CommandHostBag['setFullscreen'],
    setDarkMode: spy('setDarkMode') as unknown as CommandHostBag['setDarkMode'],
    openThemes: spy('openThemes') as unknown as CommandHostBag['openThemes'],
    openBlockLibrary: spy('openBlockLibrary') as unknown as CommandHostBag['openBlockLibrary'],
    openCastSettings: spy('openCastSettings') as unknown as CommandHostBag['openCastSettings'],
    openDevWidgets: spy('openDevWidgets') as unknown as CommandHostBag['openDevWidgets'],
    openFeedbackIdea: spy('openFeedbackIdea') as unknown as CommandHostBag['openFeedbackIdea'],
    openFeedbackBug: spy('openFeedbackBug') as unknown as CommandHostBag['openFeedbackBug'],
    streamPresets: [],
    promptText: () => 'NewName',
    confirm: () => true,
    ...overrides,
  };
  return { host, calls };
}

test('buildCommands: produces add / pages / actions commands and skips active page in switch list', () => {
  const { host } = makeHost();
  const cmds = buildCommands(host);
  assert.ok(cmds.some((c) => c.id === 'add-clock'));
  assert.ok(cmds.some((c) => c.id === 'add-custom-pomodoro'));
  assert.ok(cmds.some((c) => c.id === 'add-custom-from-url'));
  // Page switch — only the non-active page
  const switches = cmds.filter((c) => c.id.startsWith('page-switch-'));
  assert.deepEqual(switches.map((c) => c.id), ['page-switch-p2']);
  assert.ok(cmds.some((c) => c.id === 'page-new'));
  assert.ok(cmds.some((c) => c.id === 'page-rename'));
  assert.ok(cmds.some((c) => c.id === 'page-delete')); // 2 pages → can delete
  // Actions
  assert.ok(cmds.some((c) => c.id === 'action-edit-toggle'));
  assert.ok(cmds.some((c) => c.id === 'action-fullscreen'));
  assert.ok(cmds.some((c) => c.id === 'action-dark-toggle'));
  assert.ok(cmds.some((c) => c.id === 'action-themes'));
  assert.ok(cmds.some((c) => c.id === 'action-cast'));
  assert.ok(cmds.some((c) => c.id === 'action-block-library'));
  assert.ok(cmds.some((c) => c.id === 'action-dev-widgets'));
  assert.ok(cmds.some((c) => c.id === 'action-feedback-idea'));
  assert.ok(cmds.some((c) => c.id === 'action-feedback-bug'));
});

test('buildCommands: action-dev-widgets fires openDevWidgets host callback', () => {
  const { host, calls } = makeHost();
  buildCommands(host).find((c) => c.id === 'action-dev-widgets')!.run();
  assert.ok(calls.openDevWidgets);
});

test('buildCommands: streamPresets surface as Add commands with the right widget shape', () => {
  const { host, calls } = makeHost({
    streamPresets: [
      {
        id: 'sky-news',
        name: 'Sky News',
        url: 'https://youtube.com/@SkyNews',
        iconType: 'news',
        category: 'news',
        platform: 'youtube',
        channelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
        videoId: null,
        savedAt: 0,
      },
    ],
  });
  const cmds = buildCommands(host);
  const sky = cmds.find((c) => c.id === 'add-stream-sky-news');
  assert.ok(sky, 'expected an add-stream- command for the saved channel');
  assert.equal(sky!.section, 'add');
  sky!.run();
  assert.deepEqual(calls.setEditMode, [true]);
  const args = calls.addWidget as unknown[];
  assert.equal(args[0], 'video');
  const extra = args[3] as Record<string, unknown>;
  assert.equal(extra.url, 'https://youtube.com/@SkyNews');
  assert.equal(extra.isYouTube, true);
  assert.equal(extra.channelName, 'Sky News');
});

test('buildCommands: single page hides delete command', () => {
  const { host } = makeHost({
    pages: [{ id: 'p1', name: 'Home', widgets: [], isDefault: true }] as unknown as DashboardPage[],
    activePageId: 'p1',
  });
  const cmds = buildCommands(host);
  assert.ok(!cmds.some((c) => c.id === 'page-delete'));
});

test('buildCommands: add-widget command enters edit mode AND calls addWidget with template w/h', () => {
  const { host, calls } = makeHost();
  const cmds = buildCommands(host);
  const clock = cmds.find((c) => c.id === 'add-clock');
  assert.ok(clock);
  clock!.run();
  assert.deepEqual(calls.setEditMode, [true]);
  // template-clock = w:3 h:2
  assert.equal((calls.addWidget as unknown[])[0], 'clock');
  assert.equal((calls.addWidget as unknown[])[1], 3);
  assert.equal((calls.addWidget as unknown[])[2], 2);
});

test('buildCommands: pomodoro add-custom command passes URL + trusted flag', () => {
  const { host, calls } = makeHost();
  const cmds = buildCommands(host);
  const pomo = cmds.find((c) => c.id === 'add-custom-pomodoro');
  assert.ok(pomo);
  pomo!.run();
  assert.deepEqual(calls.setEditMode, [true]);
  const args = calls.addWidget as unknown[];
  assert.equal(args[0], 'custom_widget');
  const extra = args[3] as Record<string, unknown>;
  assert.equal(extra.customWidgetUrl, '/examples/widgets/pomodoro/index.html');
  assert.equal(extra.customWidgetTrusted, true);
});

test('buildCommands: action-edit-toggle flips edit mode based on host state', () => {
  const a = makeHost({ isEditMode: false });
  buildCommands(a.host).find((c) => c.id === 'action-edit-toggle')!.run();
  assert.deepEqual(a.calls.setEditMode, [true]);

  const b = makeHost({ isEditMode: true });
  buildCommands(b.host).find((c) => c.id === 'action-edit-toggle')!.run();
  assert.deepEqual(b.calls.setEditMode, [false]);
});

test('buildCommands: page-rename uses promptText return value', () => {
  const { host, calls } = makeHost();
  const cmds = buildCommands(host);
  const rename = cmds.find((c) => c.id === 'page-rename');
  rename!.run();
  assert.deepEqual(calls.onRenamePage, ['p1', 'NewName']);
});

test('buildCommands: page-delete is gated on confirm()', () => {
  const a = makeHost({ confirm: () => false });
  buildCommands(a.host).find((c) => c.id === 'page-delete')!.run();
  assert.equal(a.calls.onDeletePage, undefined);

  const b = makeHost({ confirm: () => true });
  buildCommands(b.host).find((c) => c.id === 'page-delete')!.run();
  assert.deepEqual(b.calls.onDeletePage, ['p1']);
});

// ─── filterAndGroup ───────────────────────────────────────────────────────

test('filterAndGroup: empty query returns sections ordered add/pages/actions', () => {
  const { host } = makeHost();
  const cmds = buildCommands(host);
  const out = filterAndGroup(cmds, '', []);
  const sections = out.groups.map((g) => g.section);
  assert.deepEqual(sections, ['add', 'pages', 'actions']);
});

test('filterAndGroup: recents float to top of their own section (not a separate group)', () => {
  const { host } = makeHost();
  const cmds = buildCommands(host);
  // 'add-clock' is in the add section, 'page-new' is in pages.
  const out = filterAndGroup(cmds, '', ['add-clock', 'page-new']);
  // No top-level "recent" section — recents are interleaved.
  const addGroup = out.groups.find((g) => g.section === 'add')!;
  const pagesGroup = out.groups.find((g) => g.section === 'pages')!;
  assert.equal(addGroup.items[0].id, 'add-clock', 'recent add command bubbles to top of Add');
  assert.equal(pagesGroup.items[0].id, 'page-new', 'recent page command bubbles to top of Pages');
});

test('filterAndGroup: empty query ignores recent ids that no longer exist', () => {
  const { host } = makeHost();
  const cmds = buildCommands(host);
  // 'nope' shouldn't crash or appear; 'add-clock' should still float to top.
  const out = filterAndGroup(cmds, '', ['nope', 'add-clock']);
  const addGroup = out.groups.find((g) => g.section === 'add')!;
  assert.equal(addGroup.items[0].id, 'add-clock');
});

test('filterAndGroup: non-empty query ranks "pomod" so Pomodoro is on top', () => {
  const { host } = makeHost();
  const cmds = buildCommands(host);
  const out = filterAndGroup(cmds, 'pomod', []);
  // Should include the pomodoro custom widget command in the add section
  const flat = out.groups.flatMap((g) => g.items);
  assert.ok(flat.length > 0);
  assert.equal(flat[0].id, 'add-custom-pomodoro');
});

test('filterAndGroup: query with no matches returns empty groups', () => {
  const { host } = makeHost();
  const cmds = buildCommands(host);
  const out = filterAndGroup(cmds, 'zzzqqqxyz', []);
  assert.equal(out.groups.length, 0);
});

// ─── Section labels exist for all sections ───────────────────────────────

test('SECTION_LABELS covers all three sections', () => {
  assert.ok(SECTION_LABELS.add);
  assert.ok(SECTION_LABELS.pages);
  assert.ok(SECTION_LABELS.actions);
});

// ─── isTypingTarget ───────────────────────────────────────────────────────

test('isTypingTarget: returns false for null / non-elements', () => {
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget({} as EventTarget), false);
});

// Positive cases — verify INPUT/TEXTAREA/contenteditable are correctly
// detected as typing targets so the ⌘K listener can bail out. We stub a
// minimal Element class so the helper's `instanceof` check succeeds in
// the headless node test environment.

test('isTypingTarget: returns true for INPUT, TEXTAREA, SELECT, contenteditable', () => {
  class FakeElement {}
  (globalThis as { Element?: unknown }).Element = FakeElement;

  const make = (tag: string, ce = false) => {
    const el = Object.create(FakeElement.prototype);
    el.tagName = tag;
    el.isContentEditable = ce;
    return el as EventTarget;
  };

  try {
    assert.equal(isTypingTarget(make('INPUT')), true);
    assert.equal(isTypingTarget(make('TEXTAREA')), true);
    assert.equal(isTypingTarget(make('SELECT')), true);
    assert.equal(isTypingTarget(make('DIV', true)), true);
    assert.equal(isTypingTarget(make('DIV', false)), false);
    assert.equal(isTypingTarget(make('BUTTON')), false);
  } finally {
    delete (globalThis as { Element?: unknown }).Element;
  }
});
