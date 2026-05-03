// Multi-page dashboards — shared between client, server, tests.
// Pure / framework-free. Widgets are a passthrough shape so the
// server doesn't need to import the client's Widget type.

export const PAGES_STORAGE_KEY = 'openBentoPages';
export const ACTIVE_PAGE_ID_KEY = 'openBentoActivePageId';
export const LEGACY_WIDGETS_KEY = 'openBentoWidgets';

export interface DashboardPageWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

export interface DashboardPage {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardPageWidget[];
  layoutMeta?: { gridCols?: number; gridRows?: number };
  backgroundConfig?: {
    kind: 'color' | 'image' | 'gradient';
    value: string;
  } | null;
  themeId?: string | null;
  createdAt: number;
}

export interface DashboardPagesState {
  pages: DashboardPage[];
  activePageId: string;
}

export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'page';
}

export function newPageId(name: string, existing: ReadonlyArray<{ id: string }> = []): string {
  const base = `page-${slugify(name)}`;
  const taken = new Set(existing.map(p => p.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function makeDefaultPage(name = 'Home', widgets: DashboardPageWidget[] = []): DashboardPage {
  return {
    id: newPageId(name),
    name,
    isDefault: true,
    widgets,
    createdAt: Date.now(),
    backgroundConfig: null,
    themeId: null,
  };
}

export function makeEmptyState(): DashboardPagesState {
  const home = makeDefaultPage('Home', []);
  return { pages: [home], activePageId: home.id };
}

// Migrate the legacy single-array `openBentoWidgets` into a one-page
// state. Widgets are passed through verbatim so existing per-widget
// behavior is preserved.
export function migrateLegacyWidgets(
  widgets: DashboardPageWidget[] | null | undefined,
  name = 'Home',
): DashboardPagesState {
  const safe = Array.isArray(widgets) ? widgets : [];
  const page = makeDefaultPage(name, safe);
  return { pages: [page], activePageId: page.id };
}

function isPageLike(v: unknown): v is DashboardPage {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string'
    && typeof r.name === 'string'
    && Array.isArray(r.widgets);
}

// Defensive sanitizer — accepts arbitrary JSON (from localStorage,
// older builds, or the cloud) and produces a valid state, or null
// when the input is unrecoverable so the caller can fall through to
// migration / empty defaults.
export function sanitizePages(raw: unknown): DashboardPagesState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawPages = Array.isArray(r.pages) ? r.pages : null;
  if (!rawPages || rawPages.length === 0) return null;

  const cleaned: DashboardPage[] = [];
  for (const p of rawPages) {
    if (!isPageLike(p)) continue;
    const widgets = (p.widgets as unknown[])
      .filter((w): w is DashboardPageWidget =>
        !!w && typeof w === 'object' && typeof (w as { id?: unknown }).id === 'string'
        && typeof (w as { type?: unknown }).type === 'string',
      )
      .map(w => ({ ...w }));
    cleaned.push({
      id: String(p.id),
      name: String(p.name).slice(0, 60) || 'Page',
      isDefault: !!p.isDefault,
      widgets,
      layoutMeta: (p.layoutMeta && typeof p.layoutMeta === 'object')
        ? (p.layoutMeta as DashboardPage['layoutMeta'])
        : undefined,
      backgroundConfig: (p.backgroundConfig && typeof p.backgroundConfig === 'object')
        ? (p.backgroundConfig as DashboardPage['backgroundConfig'])
        : null,
      themeId: typeof p.themeId === 'string' ? p.themeId : null,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    });
  }
  if (cleaned.length === 0) return null;

  // Exactly one default — first page wins if multiple/none claim it.
  let foundDefault = false;
  for (const p of cleaned) {
    if (p.isDefault && !foundDefault) { foundDefault = true; continue; }
    p.isDefault = false;
  }
  if (!foundDefault) cleaned[0].isDefault = true;

  const requestedActive = typeof r.activePageId === 'string' ? r.activePageId : '';
  const active = cleaned.find(p => p.id === requestedActive)?.id
    ?? cleaned.find(p => p.isDefault)?.id
    ?? cleaned[0].id;

  return { pages: cleaned, activePageId: active };
}

// ── Pure operations on the state — used by both UI and tests ───────────

export function getActivePage(state: DashboardPagesState): DashboardPage {
  return state.pages.find(p => p.id === state.activePageId) ?? state.pages[0];
}

export function setActivePage(state: DashboardPagesState, pageId: string): DashboardPagesState {
  if (!state.pages.some(p => p.id === pageId)) return state;
  if (state.activePageId === pageId) return state;
  return { ...state, activePageId: pageId };
}

export function updateActivePageWidgets(
  state: DashboardPagesState,
  widgets: DashboardPageWidget[],
): DashboardPagesState {
  return {
    ...state,
    pages: state.pages.map(p =>
      p.id === state.activePageId ? { ...p, widgets } : p,
    ),
  };
}

export function addPage(
  state: DashboardPagesState,
  name = 'New Page',
): DashboardPagesState {
  const trimmed = (name || '').trim().slice(0, 60) || 'New Page';
  const page: DashboardPage = {
    id: newPageId(trimmed, state.pages),
    name: trimmed,
    isDefault: false,
    widgets: [],
    createdAt: Date.now(),
    backgroundConfig: null,
    themeId: null,
  };
  return { pages: [...state.pages, page], activePageId: page.id };
}

export function renamePage(
  state: DashboardPagesState,
  pageId: string,
  newName: string,
): DashboardPagesState {
  const trimmed = (newName || '').trim().slice(0, 60);
  if (!trimmed) return state;
  return {
    ...state,
    pages: state.pages.map(p => p.id === pageId ? { ...p, name: trimmed } : p),
  };
}

export function duplicatePage(
  state: DashboardPagesState,
  pageId: string,
): DashboardPagesState {
  const src = state.pages.find(p => p.id === pageId);
  if (!src) return state;
  const name = `${src.name} copy`.slice(0, 60);
  const copy: DashboardPage = {
    id: newPageId(name, state.pages),
    name,
    isDefault: false,
    // Deep-clone widgets with fresh ids so DnD/keyed renders don't collide.
    widgets: src.widgets.map(w => ({
      ...w,
      id: `${w.id}-copy-${Math.random().toString(36).slice(2, 8)}`,
    })),
    layoutMeta: src.layoutMeta ? { ...src.layoutMeta } : undefined,
    backgroundConfig: src.backgroundConfig ? { ...src.backgroundConfig } : null,
    themeId: src.themeId ?? null,
    createdAt: Date.now(),
  };
  return { pages: [...state.pages, copy], activePageId: copy.id };
}

export function deletePage(
  state: DashboardPagesState,
  pageId: string,
): DashboardPagesState {
  // Never allow removing the last page — UX guarantee.
  if (state.pages.length <= 1) return state;
  const idx = state.pages.findIndex(p => p.id === pageId);
  if (idx < 0) return state;
  const wasDefault = state.pages[idx].isDefault;
  const remaining = state.pages.filter(p => p.id !== pageId);
  // Promote the *neighbor* of the deleted page when it was default
  // (page after it, or the one before if it was last) so the visible
  // tab order stays intuitive instead of jumping back to remaining[0].
  if (wasDefault) {
    const neighborIdx = Math.min(idx, remaining.length - 1);
    remaining[neighborIdx] = { ...remaining[neighborIdx], isDefault: true };
    // Make sure no other page lingers as default.
    for (let i = 0; i < remaining.length; i++) {
      if (i !== neighborIdx && remaining[i].isDefault) {
        remaining[i] = { ...remaining[i], isDefault: false };
      }
    }
  }
  const active = state.activePageId === pageId
    ? (remaining.find(p => p.isDefault)?.id ?? remaining[0].id)
    : state.activePageId;
  return { pages: remaining, activePageId: active };
}

export function setDefaultPage(
  state: DashboardPagesState,
  pageId: string,
): DashboardPagesState {
  if (!state.pages.some(p => p.id === pageId)) return state;
  return {
    ...state,
    pages: state.pages.map(p => ({ ...p, isDefault: p.id === pageId })),
  };
}
