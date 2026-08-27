// useTheme — single source of truth for the live "look" of the dashboard.
//
// Owns:
//   • Personal themes (saved by the user) in localStorage + Supabase.
//   • The currently-active theme id (which Theme is "applied" right now).
//   • applyTheme()    — atomically writes the theme's CSS vars + light-mode
//                       flag, persists, queues a Supabase upload.
//   • previewTheme()  — non-destructive 2-second hover preview.
//   • revertPreview() — restores whatever was applied before the preview.
//   • saveCurrentLook() — capture the running settings as a personal Theme.
//
// Side-effects (DOM writes) are intentionally concentrated in writeThemeToDom
// so the apply-reducer in shared/themes.ts can stay pure and testable.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Theme,
  type ThemeFont,
  BUILT_IN_THEMES,
  BUILT_IN_THEMES_BY_ID,
  PERSONAL_THEMES_KEY,
  ACTIVE_THEME_ID_KEY,
  THEME_FONT_STACKS,
  themeToCssVars,
  captureLookAsTheme,
  sanitizeThemes,
  isValidTheme,
} from '@shared/themes';

// Marker class added to <body> while a theme is active. The dashboard's
// outer container reads it via [data-themed] / .ob-theme-active to switch
// its hardcoded background off so the theme's body background shows
// through. Kept as a constant so the dashboard import stays in sync.
export const THEMED_BODY_CLASS = 'ob-theme-active';
export const THEME_OWNER_STORAGE_KEY = 'openBentoThemeOwnerId';

type SupabaseLike = {
  auth: {
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
  };
} | null | undefined;

interface UseThemeArgs {
  isAuthenticated: boolean;
  userId: string | undefined;
  supabaseClient: SupabaseLike;
  /** Bridge to the existing dark/light toggle in dashboard.tsx. */
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
}

export interface UseThemeApi {
  personalThemes: Theme[];
  activeThemeId: string | null;
  applyTheme: (theme: Theme) => void;
  previewTheme: (theme: Theme) => void;
  revertPreview: () => void;
  saveCurrentLook: (name: string) => Theme;
  deletePersonalTheme: (id: string) => void;
  renamePersonalTheme: (id: string, newName: string) => void;
}

export type ThemeHydrationStatus = 'idle' | 'loading' | 'ready' | 'failed';

export function canWriteCloudThemes(status: ThemeHydrationStatus): boolean {
  return status === 'ready';
}

export function canWriteCloudThemesForUser(
  status: ThemeHydrationStatus,
  hydratedUserId: string,
  currentUserId: string,
): boolean {
  return canWriteCloudThemes(status) && hydratedUserId === currentUserId;
}

export function canAdoptLocalThemes(
  localOwnerId: string | null,
  currentUserId: string,
): boolean {
  return !localOwnerId || localOwnerId === currentUserId;
}

export function shouldKeepGuestThemeValue(
  localOwnerId: string | null,
  remoteHasValue: boolean,
  localHasValue: boolean,
): boolean {
  return localOwnerId === null && !remoteHasValue && localHasValue;
}

function getLocalThemeOwner(): string | null {
  try {
    return localStorage.getItem(THEME_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberLocalThemeOwner(userId: string): void {
  try {
    localStorage.setItem(THEME_OWNER_STORAGE_KEY, userId);
  } catch {
    // Private browsing can disable localStorage. Cloud sync still works.
  }
}

// ─── DOM writer (the only side-effecting code in this module) ───────────────

// Exported so the integration test can drive it directly against a
// minimal document/window shim (see tests/client/use-theme-dom.test.mjs).
// Production code only calls it through applyTheme/previewTheme/revertPreview.
export function writeThemeToDom(theme: Theme, setIsDarkMode: (v: boolean) => void): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = themeToCssVars(theme);
  // 1) CSS variables — consumed by .dashboard-slot (--slot-bg-rgb) and by
  //    any theme-aware components that opt in to --ob-accent / --ob-accent-soft.
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  // 2) Global font — set on <body> so every descendant inherits it. The
  //    dashboard's title still pins Inter inline (legacy hero styling) but
  //    everything else inherits from the body and visibly changes.
  const body = document.body;
  if (body) {
    body.style.fontFamily = vars['--ob-font'];
    // 3) Background — body is the lowest layer; the dashboard outer div
    //    becomes transparent (see ob-theme-active class) so this shows.
    if (theme.background.kind === 'color') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = theme.background.value;
      body.style.backgroundAttachment = 'initial';
    } else {
      body.style.backgroundImage = theme.background.kind === 'image'
        ? `url("${theme.background.value}")`
        : theme.background.value;
      body.style.backgroundColor = 'transparent';
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    }
    body.classList.add(THEMED_BODY_CLASS);
  }
  // 4) Sync the existing dark/light toggle. The CSS true-light-mode rules
  //    already react to body.light-theme / .dark-theme, so this single
  //    call is enough to flip the rest of the UI's contrast palette.
  setIsDarkMode(!theme.lightMode);
}

export function clearThemeFromDom(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of Object.keys(themeToCssVars(BUILT_IN_THEMES[0]))) {
    root.style.removeProperty(key);
  }
  if (document.body) {
    document.body.style.fontFamily = '';
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '#F8F9FA';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.classList.remove(THEMED_BODY_CLASS);
  }
}

// Capture whatever theme-shaped state is currently on the DOM. Used so
// previewTheme() can revert to a synthetic snapshot when no Theme has
// been applied yet, and so saveCurrentLook() can grab the running font
// directly from the body when no active Theme exists. Reads computed
// styles (not inline) so we pick up CSS-defined defaults too.
function readDomSnapshot(): { accent: string; widgetTint: string; font: string } {
  if (typeof document === 'undefined') {
    return { accent: '', widgetTint: '', font: '' };
  }
  const inline = document.documentElement.style;
  const bodyStyle = document.body
    ? window.getComputedStyle(document.body).fontFamily
    : '';
  return {
    accent:     inline.getPropertyValue('--ob-accent').trim()      || '',
    widgetTint: inline.getPropertyValue('--ob-widget-tint').trim() || '',
    font:       (inline.getPropertyValue('--ob-font').trim() || bodyStyle || ''),
  };
}

// Reverse-lookup a ThemeFont key from a resolved font-family stack so
// saveCurrentLook can name the running font correctly. Falls back to
// 'inter' when nothing matches.
function fontKeyFromStack(stack: string): ThemeFont {
  const norm = stack.trim().toLowerCase();
  if (!norm) return 'inter';
  for (const key of Object.keys(THEME_FONT_STACKS) as ThemeFont[]) {
    if (THEME_FONT_STACKS[key].toLowerCase() === norm) return key;
  }
  // Heuristic match against the family name a CSS engine might leave behind.
  if (norm.includes('mono') || norm.includes('jetbrains') || norm.includes('fira')) return 'mono';
  if (norm.includes('serif') || norm.includes('georgia') || norm.includes('source serif')) return 'serif';
  if (norm.includes('nunito') || norm.includes('quicksand')) return 'rounded';
  return 'inter';
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useTheme(args: UseThemeArgs): UseThemeApi {
  const { isAuthenticated, userId, supabaseClient, isDarkMode, setIsDarkMode } = args;

  // Personal themes — hydrated from localStorage on mount, then optionally
  // overwritten by the cloud copy on sign-in.
  const [personalThemes, setPersonalThemes] = useState<Theme[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(PERSONAL_THEMES_KEY);
      return raw ? sanitizeThemes(JSON.parse(raw)) : [];
    } catch { return []; }
  });

  const [activeThemeId, setActiveThemeId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(ACTIVE_THEME_ID_KEY);
    } catch { return null; }
  });

  // Snapshot of the pre-preview theme. null when no preview is active.
  // We store the full Theme so revert is a simple writeThemeToDom call.
  const previewBackupRef = useRef<Theme | null>(null);
  const previewActiveRef = useRef<boolean>(false);

  // Cloud sync state. Mirrors the pattern in use-cloud-sync.
  const cloudUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUploadedRef     = useRef<string>('');
  const hydrationUserIdRef  = useRef<string>('');
  const hydrationReadyUserIdRef = useRef<string>('');
  const [cloudHydrationStatus, setCloudHydrationStatus] = useState<ThemeHydrationStatus>('idle');
  // Tracks the id of the theme currently written to the DOM so the
  // hydration effect can detect genuine activeThemeId changes (cross-
  // device cloud sync, late-arriving personal themes) without double-
  // writing on every render. Must be declared before applyTheme so the
  // callback can update it.
  const lastAppliedIdRef    = useRef<string | null>(null);

  // ── Apply + persist ─────────────────────────────────────────────────────

  const applyTheme = useCallback((theme: Theme) => {
    if (!isValidTheme(theme)) return;
    // Cancel any pending preview so its revert can't clobber the apply.
    previewActiveRef.current  = false;
    previewBackupRef.current  = null;
    writeThemeToDom(theme, setIsDarkMode);
    setActiveThemeId(theme.id);
    // Keep the hydration-effect's "what's currently on the DOM" tracker
    // in sync so the effect doesn't re-write the same theme moments
    // later when the activeThemeId state update flushes.
    lastAppliedIdRef.current = theme.id;
    try { localStorage.setItem(ACTIVE_THEME_ID_KEY, theme.id); } catch {/* private mode */}
  }, [setIsDarkMode]);

  const previewTheme = useCallback((theme: Theme) => {
    if (!isValidTheme(theme)) return;
    if (!previewActiveRef.current) {
      // Snapshot — prefer the active theme object, fall back to a synthesized
      // one from the current DOM so the revert always works even before the
      // user has explicitly applied anything.
      const allKnown: Theme[] = [...BUILT_IN_THEMES, ...personalThemes];
      const current = activeThemeId ? allKnown.find(t => t.id === activeThemeId) : undefined;
      const dom = readDomSnapshot();
      const snapshot: Theme = current ?? {
        id: '__pre_preview__',
        name: 'Previous',
        description: '',
        builtIn: false,
        background: { kind: 'color', value: '#0f172a' },
        accent:     dom.accent     || '#22d3ee',
        font:       fontKeyFromStack(dom.font),
        widgetTint: dom.widgetTint || '#0f172a',
        lightMode:  !isDarkMode,
      };
      previewBackupRef.current = snapshot;
      previewActiveRef.current = true;
    }
    writeThemeToDom(theme, setIsDarkMode);
  }, [activeThemeId, personalThemes, isDarkMode, setIsDarkMode]);

  const revertPreview = useCallback(() => {
    if (!previewActiveRef.current || !previewBackupRef.current) return;
    const backup = previewBackupRef.current;
    writeThemeToDom(backup, setIsDarkMode);
    // If we reverted to the synthetic "pre-preview" snapshot (i.e. no
    // theme had ever been applied), drop the marker class so the
    // dashboard goes back to its hardcoded backdrop too.
    if (!activeThemeId && backup.id === '__pre_preview__' && typeof document !== 'undefined') {
      document.body?.classList.remove(THEMED_BODY_CLASS);
    }
    previewActiveRef.current = false;
    previewBackupRef.current = null;
  }, [setIsDarkMode, activeThemeId]);

  // Re-apply the active theme whenever the resolved theme actually changes.
  // This covers three cases:
  //   1. First mount — returning user lands on their last look without an
  //      explicit click.
  //   2. Cloud hydration handoff — a signed-in user opens device B with
  //      a different active theme than device A's local state; the hook
  //      sees activeThemeId switch and writes the new look to the DOM.
  //   3. Personal-theme list arriving after activeThemeId — when the
  //      active id points at a personal theme that wasn't loaded yet,
  //      the resolution becomes valid only once personalThemes hydrates.
  // We track the last id we actually wrote to DOM (lastAppliedIdRef,
  // declared above) so explicit applyTheme() calls don't trigger a
  // redundant double-write, while genuine id changes always reach the DOM.
  useEffect(() => {
    if (!activeThemeId) return;
    const all: Theme[] = [...BUILT_IN_THEMES, ...personalThemes];
    const found = all.find(t => t.id === activeThemeId);
    if (!found) return;
    if (lastAppliedIdRef.current === activeThemeId) return;
    writeThemeToDom(found, setIsDarkMode);
    lastAppliedIdRef.current = activeThemeId;
  }, [activeThemeId, personalThemes, setIsDarkMode]);

  // ── Save / rename / delete personal themes ──────────────────────────────

  const persistPersonal = useCallback((next: Theme[]) => {
    try { localStorage.setItem(PERSONAL_THEMES_KEY, JSON.stringify(next)); }
    catch {/* private mode — accept loss */}
  }, []);

  const saveCurrentLook = useCallback((name: string): Theme => {
    // Prefer the active theme as the basis (richer metadata, including the
    // background's exact CSS expression). When no theme is active we
    // reconstruct from live DOM state — body background + computed font +
    // the accent/tint vars the last applied theme left on documentElement.
    const all: Theme[] = [...BUILT_IN_THEMES, ...personalThemes];
    const base = activeThemeId ? all.find(t => t.id === activeThemeId) : undefined;
    const dom  = readDomSnapshot();

    // Read live body background so guests who applied nothing still get
    // their actual look captured (not a hardcoded slate-900).
    let liveBg: Theme['background'] = { kind: 'color', value: '#0f172a' };
    if (typeof document !== 'undefined' && document.body) {
      const cs = window.getComputedStyle(document.body);
      const bgImage = cs.backgroundImage;
      const bgColor = cs.backgroundColor;
      if (bgImage && bgImage !== 'none') {
        // url("…") → image; everything else (gradient/etc) is a CSS expression.
        const urlMatch = bgImage.match(/^url\(["']?(.+?)["']?\)$/);
        if (urlMatch) {
          liveBg = { kind: 'image', value: urlMatch[1] };
        } else {
          liveBg = { kind: 'gradient', value: bgImage };
        }
      } else if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        liveBg = { kind: 'color', value: bgColor };
      }
    }

    const captured = captureLookAsTheme({
      name,
      background:  base?.background  ?? liveBg,
      accent:      base?.accent      ?? (dom.accent      || '#22d3ee'),
      font:        base?.font        ?? fontKeyFromStack(dom.font),
      widgetTint:  base?.widgetTint  ?? (dom.widgetTint  || '#0f172a'),
      lightMode:   !isDarkMode,
    });
    setPersonalThemes(prev => {
      const next = [...prev, captured];
      persistPersonal(next);
      return next;
    });
    return captured;
  }, [activeThemeId, personalThemes, isDarkMode, persistPersonal]);

  const deletePersonalTheme = useCallback((id: string) => {
    setPersonalThemes(prev => {
      const next = prev.filter(t => t.id !== id);
      persistPersonal(next);
      return next;
    });
    // If the deleted one was active, fall back to the default built-in.
    if (activeThemeId === id) {
      applyTheme(BUILT_IN_THEMES_BY_ID['midnight-ocean']);
    }
  }, [activeThemeId, applyTheme, persistPersonal]);

  const renamePersonalTheme = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim().slice(0, 60);
    if (!trimmed) return;
    setPersonalThemes(prev => {
      const next = prev.map(t => t.id === id ? { ...t, name: trimmed } : t);
      persistPersonal(next);
      return next;
    });
  }, [persistPersonal]);

  // ── Cloud sync (signed-in users) ────────────────────────────────────────

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!supabaseClient) return null;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      return session?.access_token ?? null;
    } catch { return null; }
  }, [supabaseClient]);

  // Reset hydration when the user signs out.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      hydrationUserIdRef.current = '';
      hydrationReadyUserIdRef.current = '';
      setCloudHydrationStatus('idle');
      lastUploadedRef.current  = '';
    }
  }, [isAuthenticated, userId]);

  // Hydrate themes from the cloud once per sign-in. Uses the same
  // /api/dashboard endpoint the layout sync relies on, so we don't add
  // extra round-trips for the common case.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (hydrationUserIdRef.current === userId) return;
    hydrationUserIdRef.current = userId;
    hydrationReadyUserIdRef.current = '';
    setCloudHydrationStatus('loading');
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) {
        setCloudHydrationStatus('failed');
        return;
      }
      try {
        const res = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (!res.ok) {
          setCloudHydrationStatus('failed');
          return;
        }
        const body = await res.json();
        if (!body || !Object.prototype.hasOwnProperty.call(body, 'dashboard')) {
          setCloudHydrationStatus('failed');
          return;
        }
        const remote = body.dashboard;
        const localOwnerId = getLocalThemeOwner();
        const mayAdoptLocal = canAdoptLocalThemes(localOwnerId, userId);
        if (remote) {
          // Cross-device deletion propagation: if the field is PRESENT
          // (even as an empty array), trust the remote as source of
          // truth so a user who cleared their themes on device A sees
          // them disappear on device B. We previously gated this on
          // `length > 0`, which left stale local themes intact and
          // caused them to be re-uploaded on the next debounce.
          if (Object.prototype.hasOwnProperty.call(remote, 'personalThemes') && !Array.isArray(remote.personalThemes)) {
            setCloudHydrationStatus('failed');
            return;
          }
          if (Array.isArray(remote.personalThemes)) {
            const remoteThemes = sanitizeThemes(remote.personalThemes);
            if (remoteThemes.length !== remote.personalThemes.length) {
              setCloudHydrationStatus('failed');
              return;
            }
            const keepGuestThemes = shouldKeepGuestThemeValue(
              localOwnerId,
              remoteThemes.length > 0,
              personalThemes.length > 0,
            );
            if (!keepGuestThemes) {
              setPersonalThemes(remoteThemes);
              persistPersonal(remoteThemes);
            }
          } else if (!mayAdoptLocal) {
            setPersonalThemes([]);
            persistPersonal([]);
          }
          if (Object.prototype.hasOwnProperty.call(remote, 'activeThemeId')) {
            const remoteActiveId = typeof remote.activeThemeId === 'string' && remote.activeThemeId
              ? remote.activeThemeId
              : null;
            const keepGuestActiveTheme = shouldKeepGuestThemeValue(
              localOwnerId,
              Boolean(remoteActiveId),
              Boolean(activeThemeId),
            );
            if (!keepGuestActiveTheme) {
              setActiveThemeId(remoteActiveId);
              try {
                if (remoteActiveId) localStorage.setItem(ACTIVE_THEME_ID_KEY, remoteActiveId);
                else localStorage.removeItem(ACTIVE_THEME_ID_KEY);
              } catch {/* */}
              if (!remoteActiveId) clearThemeFromDom();
            }
          } else if (!mayAdoptLocal) {
            setActiveThemeId(null);
            try { localStorage.removeItem(ACTIVE_THEME_ID_KEY); } catch {/* */}
            clearThemeFromDom();
          }
        } else if (!mayAdoptLocal) {
          setPersonalThemes([]);
          persistPersonal([]);
          setActiveThemeId(null);
          try { localStorage.removeItem(ACTIVE_THEME_ID_KEY); } catch {/* */}
          clearThemeFromDom();
        }
        rememberLocalThemeOwner(userId);
        hydrationReadyUserIdRef.current = userId;
        setCloudHydrationStatus('ready');
      } catch {
        // Never unlock writes after a failed read. That could replace the
        // only good cloud copy with stale browser data.
        if (!cancelled) setCloudHydrationStatus('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, userId, getToken, persistPersonal]);

  // Debounced upload. PATCH semantics let us send only the theme fields
  // without overwriting the widget layout owned by use-cloud-sync.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (!canWriteCloudThemesForUser(
      cloudHydrationStatus,
      hydrationReadyUserIdRef.current,
      userId,
    )) return;
    const payload = JSON.stringify({ personalThemes, activeThemeId });
    if (payload === lastUploadedRef.current) return;
    if (cloudUploadTimerRef.current) clearTimeout(cloudUploadTimerRef.current);
    cloudUploadTimerRef.current = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const themeBody = JSON.stringify({ personalThemes, activeThemeId });
      try {
        const res = await fetch('/api/dashboard', {
          method: 'PATCH',
          headers,
          body: themeBody,
        });
        if (res.ok) {
          lastUploadedRef.current = payload;
          return;
        }
        // 404 race: this user has no dashboard row yet (first sign-in
        // before use-cloud-sync has uploaded its initial widget payload).
        // PATCH won't auto-create the row, so fall back to POST with an
        // empty widgets array so the row exists; subsequent widget
        // changes will overwrite the widgets field via the cloud-sync
        // hook's normal POST/PATCH path.
        if (res.status === 404) {
          const created = await fetch('/api/dashboard', {
            method: 'POST',
            headers,
            body: JSON.stringify({ widgets: [], personalThemes, activeThemeId }),
          });
          if (created.ok) lastUploadedRef.current = payload;
        }
      } catch { /* silent — localStorage stays the source of truth */ }
    }, 1500);
    return () => {
      if (cloudUploadTimerRef.current) clearTimeout(cloudUploadTimerRef.current);
    };
  }, [personalThemes, activeThemeId, isAuthenticated, userId, cloudHydrationStatus, getToken]);

  return {
    personalThemes,
    activeThemeId,
    applyTheme,
    previewTheme,
    revertPreview,
    saveCurrentLook,
    deletePersonalTheme,
    renamePersonalTheme,
  };
}
