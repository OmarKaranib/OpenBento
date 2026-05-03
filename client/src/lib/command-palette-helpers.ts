// Pure helpers for the Command Palette (⌘K). Kept out of the React
// component so they can be unit-tested without a DOM, and so the
// fuzzy matcher / command-builder logic has a single source of truth.
//
// A Command represents one selectable row. The runtime supplies the
// `run` callback; matching, ranking, and recents-bookkeeping are all
// done here on plain data.

import type { Widget, WidgetType } from '@/widgets/shared';
import type { DashboardPage } from '@shared/dashboard-pages';
import { WIDGET_TEMPLATES, type SavedChannel } from '@/components/widget-sidebar';
import { SAMPLE_CUSTOM_WIDGETS } from '@shared/widget-sdk-protocol';

export type CommandSection = 'add' | 'pages' | 'actions';

export interface Command {
  id: string;
  section: CommandSection;
  label: string;
  hint?: string;
  keywords?: string[];
  run: () => void;
}

// ─── Fuzzy matcher ────────────────────────────────────────────────────────
// Subsequence scorer with bonuses for:
//   - exact-prefix match on the label or any keyword
//   - matches at the start of a word (after space / hyphen / underscore)
//   - tightly clustered matches (smaller index gaps score higher)
// Returns null for non-matches so callers can filter cleanly.

export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);

  let qi = 0;
  let lastIdx = -1;
  let score = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      // Word-boundary bonus
      const prev = i === 0 ? ' ' : t[i - 1];
      if (prev === ' ' || prev === '-' || prev === '_' || prev === '.') {
        score += 20;
      } else {
        score += 5;
      }
      // Adjacency bonus
      if (lastIdx !== -1) {
        const gap = i - lastIdx;
        if (gap === 1) score += 15;
        else score -= Math.min(gap, 10);
      }
      lastIdx = i;
      qi++;
    }
  }
  if (qi < q.length) return null;
  // Penalize length so shorter targets win on equal subsequences.
  return Math.max(1, score - Math.floor((t.length - q.length) / 4));
}

export function rankCommand(query: string, cmd: Command): number | null {
  if (!query.trim()) return 0;
  const haystacks = [cmd.label, ...(cmd.keywords ?? [])];
  let best: number | null = null;
  for (const h of haystacks) {
    const s = fuzzyScore(query, h);
    if (s !== null && (best === null || s > best)) best = s;
  }
  return best;
}

// ─── Recents (localStorage) ──────────────────────────────────────────────

export const RECENTS_KEY = 'openBentoCommandPaletteRecents';
export const RECENTS_CAP = 5;

export function loadRecents(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null,
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENTS_CAP);
  } catch {
    return [];
  }
}

export function pushRecent(prev: string[], id: string, cap = RECENTS_CAP): string[] {
  const next = [id, ...prev.filter((x) => x !== id)];
  return next.slice(0, cap);
}

export function saveRecents(
  recents: string[],
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, RECENTS_CAP)));
  } catch {
    /* quota / disabled storage — silent */
  }
}

// ─── Command-list builder ────────────────────────────────────────────────
// Pure given the current dashboard state + a bag of host callbacks.
// Tests can pass spies for each callback and assert which command
// ran by checking the spy.

export interface CommandHostBag {
  isEditMode: boolean;
  isFullscreen: boolean;
  isDarkMode: boolean;
  pages: DashboardPage[];
  activePageId: string;
  // Add-widget — palette ALWAYS enters edit mode first so the new
  // widget is immediately drag/resize-ready, matching the sidebar UX.
  setEditMode: (on: boolean) => void;
  addWidget: (
    type: WidgetType,
    w?: number,
    h?: number,
    extraData?: Partial<Widget>,
  ) => string | null;
  // Curated live-stream presets — the user's saved/personal channels
  // surface as Add commands so they can drop a known good stream onto
  // the dashboard with a single keystroke.
  streamPresets: SavedChannel[];
  // Pages
  onAddPage: (name?: string) => void;
  onRenamePage: (id: string, name: string) => void;
  onDeletePage: (id: string) => void;
  onSetActivePage: (id: string) => void;
  onSetDefaultPage: (id: string) => void;
  // Actions
  setFullscreen: (on: boolean) => void;
  setDarkMode: (on: boolean) => void;
  openThemes: () => void;
  openBlockLibrary: () => void;
  openCastSettings: () => void;
  openDevWidgets: () => void;
  openFeedbackIdea: () => void;
  openFeedbackBug: () => void;
  // UI prompts (keep dialog logic out of helpers — host supplies them)
  promptText: (message: string, defaultValue?: string) => string | null;
  confirm: (message: string) => boolean;
}

export function buildCommands(host: CommandHostBag): Command[] {
  const out: Command[] = [];

  // ── Add widget (templates + custom samples) ───────────────────────────
  for (const tpl of WIDGET_TEMPLATES) {
    out.push({
      id: `add-${tpl.widgetType}`,
      section: 'add',
      label: `Add ${tpl.name} widget`,
      hint: tpl.widgetType,
      keywords: [tpl.name, tpl.widgetType, 'add', 'new', 'widget'],
      run: () => {
        host.setEditMode(true);
        host.addWidget(tpl.widgetType, tpl.w, tpl.h);
      },
    });
  }
  for (const sample of SAMPLE_CUSTOM_WIDGETS) {
    out.push({
      id: `add-custom-${sample.id}`,
      section: 'add',
      label: `Add ${sample.name} widget`,
      hint: 'Custom widget',
      keywords: [sample.name, 'custom', 'pomodoro', sample.id],
      run: () => {
        host.setEditMode(true);
        host.addWidget('custom_widget', 4, 4, {
          customWidgetUrl: sample.url,
          customWidgetTrusted: true,
          customWidgetState: {},
        });
      },
    });
  }
  out.push({
    id: 'add-custom-from-url',
    section: 'add',
    label: 'Add custom widget from URL…',
    hint: 'Block Library',
    keywords: ['custom', 'widget', 'sdk', 'iframe', 'url'],
    run: () => host.openBlockLibrary(),
  });

  // Curated live-stream presets (saved channels). Each becomes a single
  // command that drops a video widget pointed at the channel URL — the
  // same flow as clicking the channel in the Block Library Streams tab.
  for (const ch of host.streamPresets) {
    out.push({
      id: `add-stream-${ch.id}`,
      section: 'add',
      label: `Add ${ch.name} stream`,
      hint: ch.platform === 'youtube' ? 'YouTube' : ch.platform === 'twitch' ? 'Twitch' : 'Kick',
      keywords: [ch.name, 'stream', 'video', ch.platform, ch.category, 'live', 'channel'],
      run: () => {
        host.setEditMode(true);
        // Mirror dashboard-shell.addVideoWidget shape so the resulting
        // widget renders identically to a Block-Library click.
        host.addWidget('video', 3, 2, {
          url: ch.url,
          isYouTube: ch.platform === 'youtube',
          videoId: ch.videoId ?? null,
          youtubeChannelId: ch.channelId ?? null,
          channelName: ch.name,
          channelHandle: ch.channelId ?? null,
          isTwitch: ch.platform === 'twitch',
          twitchChannel: ch.platform === 'twitch' ? (ch.channelId ?? ch.name) : null,
          isKick: ch.platform === 'kick',
          kickChannel: ch.platform === 'kick' ? (ch.channelId ?? ch.name) : null,
          isLive: ch.platform === 'twitch' || ch.platform === 'kick',
          lastRefresh: Date.now(),
        } as Partial<Widget>);
      },
    });
  }

  // ── Pages ────────────────────────────────────────────────────────────
  for (const p of host.pages) {
    if (p.id === host.activePageId) continue;
    out.push({
      id: `page-switch-${p.id}`,
      section: 'pages',
      label: `Switch to ${p.name}`,
      hint: 'Page',
      keywords: ['switch', 'page', 'go to', p.name],
      run: () => host.onSetActivePage(p.id),
    });
  }
  out.push({
    id: 'page-new',
    section: 'pages',
    label: 'New page',
    keywords: ['add', 'page', 'create', 'tab'],
    run: () => {
      const name = host.promptText('Name your new page', 'New Page');
      if (name && name.trim()) host.onAddPage(name.trim());
    },
  });
  const active = host.pages.find((p) => p.id === host.activePageId);
  if (active) {
    out.push({
      id: 'page-rename',
      section: 'pages',
      label: `Rename "${active.name}"`,
      keywords: ['rename', 'page', 'edit name'],
      run: () => {
        const name = host.promptText('Rename this page', active.name);
        if (name && name.trim()) host.onRenamePage(active.id, name.trim());
      },
    });
    if (host.pages.length > 1) {
      out.push({
        id: 'page-delete',
        section: 'pages',
        label: `Delete "${active.name}"`,
        keywords: ['delete', 'remove', 'page'],
        run: () => {
          if (host.confirm(`Delete page "${active.name}"? This cannot be undone.`)) {
            host.onDeletePage(active.id);
          }
        },
      });
    }
    out.push({
      id: 'page-set-default',
      section: 'pages',
      label: `Set "${active.name}" as default page`,
      keywords: ['default', 'home', 'page'],
      run: () => host.onSetDefaultPage(active.id),
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────
  out.push({
    id: 'action-edit-toggle',
    section: 'actions',
    label: host.isEditMode ? 'Save layout (exit edit mode)' : 'Edit layout',
    keywords: ['edit', 'save', 'layout', 'lock', 'unlock'],
    run: () => host.setEditMode(!host.isEditMode),
  });
  out.push({
    id: 'action-fullscreen',
    section: 'actions',
    label: host.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
    keywords: ['fullscreen', 'full screen', 'present'],
    run: () => host.setFullscreen(!host.isFullscreen),
  });
  out.push({
    id: 'action-dark-toggle',
    section: 'actions',
    label: host.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode',
    keywords: ['dark', 'light', 'theme', 'mode'],
    run: () => host.setDarkMode(!host.isDarkMode),
  });
  out.push({
    id: 'action-themes',
    section: 'actions',
    label: 'Open Themes Marketplace',
    keywords: ['themes', 'marketplace', 'look', 'palette'],
    run: () => host.openThemes(),
  });
  out.push({
    id: 'action-cast',
    section: 'actions',
    label: 'Open Cast Settings',
    keywords: ['cast', 'tv', 'screen', 'mirror'],
    run: () => host.openCastSettings(),
  });
  out.push({
    id: 'action-block-library',
    section: 'actions',
    label: 'Open Block Library',
    keywords: ['block', 'library', 'sidebar', 'widgets', 'streams'],
    run: () => host.openBlockLibrary(),
  });
  out.push({
    id: 'action-dev-widgets',
    section: 'actions',
    label: 'Open /dev/widgets',
    hint: 'Developer',
    keywords: ['dev', 'widgets', 'developer', 'sdk', 'docs', 'sandbox'],
    run: () => host.openDevWidgets(),
  });
  out.push({
    id: 'action-feedback-idea',
    section: 'actions',
    label: 'Submit feedback (idea)',
    keywords: ['feedback', 'idea', 'request', 'suggest'],
    run: () => host.openFeedbackIdea(),
  });
  out.push({
    id: 'action-feedback-bug',
    section: 'actions',
    label: 'Report a bug',
    keywords: ['bug', 'feedback', 'issue', 'report'],
    run: () => host.openFeedbackBug(),
  });

  return out;
}

// ─── Filter + group ──────────────────────────────────────────────────────
// Returns commands grouped by section. Per the spec, recently-used
// commands "float to the top of their section" — they're not extracted
// into a separate Recent group.
//   - When query is empty: each section is sorted [recents-in-recent-order,
//     then the rest in natural order].
//   - When query is non-empty: each section is sorted by fuzzyScore desc.
//     Recency is *not* used here — the user is searching, so relevance wins.

export interface FilteredCommands {
  groups: { section: CommandSection; items: Command[] }[];
}

const SECTION_ORDER: CommandSection[] = ['add', 'pages', 'actions'];

export function filterAndGroup(
  commands: Command[],
  query: string,
  recentIds: string[],
): FilteredCommands {
  const trimmed = query.trim();

  if (!trimmed) {
    // Map id → recency rank (lower = more recent). Unknown ids = +Infinity.
    const recentRank = new Map<string, number>();
    recentIds.forEach((id, i) => recentRank.set(id, i));
    const groups = SECTION_ORDER.map((section) => {
      const items = commands.filter((c) => c.section === section);
      // Stable partition: recents (preserving recents order) then the rest
      // in natural insertion order.
      const recent = items
        .filter((c) => recentRank.has(c.id))
        .sort((a, b) => (recentRank.get(a.id)! - recentRank.get(b.id)!));
      const rest = items.filter((c) => !recentRank.has(c.id));
      return { section, items: [...recent, ...rest] };
    }).filter((g) => g.items.length > 0);
    return { groups };
  }

  const scored: { cmd: Command; score: number }[] = [];
  for (const cmd of commands) {
    const s = rankCommand(trimmed, cmd);
    if (s !== null) scored.push({ cmd, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  const groups = SECTION_ORDER.map((section) => ({
    section,
    items: scored.filter((s) => s.cmd.section === section).map((s) => s.cmd),
  })).filter((g) => g.items.length > 0);
  return { groups };
}

export const SECTION_LABELS: Record<CommandSection, string> = {
  add: 'Add Widget',
  pages: 'Pages',
  actions: 'Actions',
};

// ─── Keyboard guard ──────────────────────────────────────────────────────
// Returns true when the active element is a place where typing should NOT
// be intercepted (input, textarea, contenteditable). Pure for testability.

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  // Guard for non-DOM environments (node tests).
  const ElementCtor = (globalThis as { Element?: typeof Element }).Element;
  if (!ElementCtor || !(target instanceof ElementCtor)) return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}
