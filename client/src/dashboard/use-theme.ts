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

// ─── DOM writer (the only side-effecting code in this module) ───────────────

function writeThemeToDom(theme: Theme, setIsDarkMode: (v: boolean) => void): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = themeToCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  // Apply background to <body> directly so the existing static-bg reset
  // in App.tsx doesn't fight us. Use background-image for gradients/images,
  // background-color for solids.
  const body = document.body;
  if (body) {
    if (theme.background.kind === 'color') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = theme.background.value;
    } else {
      body.style.backgroundImage = theme.background.kind === 'image'
        ? `url("${theme.background.value}")`
        : theme.background.value;
      body.style.backgroundColor = 'transparent';
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    }
  }
  // Sync the existing dark/light toggle. The CSS true-light mode rules
  // already react to body.light-theme / .dark-theme, so this single call
  // is enough to flip the whole UI.
  setIsDarkMode(!theme.lightMode);
}

// Capture whatever theme-shaped state is currently on the DOM. Used so
// previewTheme() can revert to the previous look on hover-out.
function readThemeSnapshotFromDom(): Partial<Theme> {
  if (typeof document === 'undefined') return {};
  const root = document.documentElement;
  const cs   = root.style;
  return {
    accent:     cs.getPropertyValue('--ob-accent').trim() || '',
    widgetTint: cs.getPropertyValue('--ob-widget-tint').trim() || '',
  };
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
  const hydrationDoneRef    = useRef<boolean>(false);

  // ── Apply + persist ─────────────────────────────────────────────────────

  const applyTheme = useCallback((theme: Theme) => {
    if (!isValidTheme(theme)) return;
    // Cancel any pending preview so its revert can't clobber the apply.
    previewActiveRef.current  = false;
    previewBackupRef.current  = null;
    writeThemeToDom(theme, setIsDarkMode);
    setActiveThemeId(theme.id);
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
      const snapshot: Theme = current ?? {
        id: '__pre_preview__',
        name: 'Previous',
        description: '',
        builtIn: false,
        background: { kind: 'color', value: '#0f172a' },
        accent:     readThemeSnapshotFromDom().accent     || '#22d3ee',
        font:       'inter' as ThemeFont,
        widgetTint: readThemeSnapshotFromDom().widgetTint || '#0f172a',
        lightMode:  !isDarkMode,
      };
      previewBackupRef.current = snapshot;
      previewActiveRef.current = true;
    }
    writeThemeToDom(theme, setIsDarkMode);
  }, [activeThemeId, personalThemes, isDarkMode, setIsDarkMode]);

  const revertPreview = useCallback(() => {
    if (!previewActiveRef.current || !previewBackupRef.current) return;
    writeThemeToDom(previewBackupRef.current, setIsDarkMode);
    previewActiveRef.current = false;
    previewBackupRef.current = null;
  }, [setIsDarkMode]);

  // Re-apply the active theme on first mount so a returning user lands on
  // their last look without an explicit click. We also re-apply whenever
  // personalThemes changes and the active id resolves to a personal theme
  // (covers the cloud-hydration handoff).
  const initialApplyDoneRef = useRef(false);
  useEffect(() => {
    if (!activeThemeId) return;
    const all: Theme[] = [...BUILT_IN_THEMES, ...personalThemes];
    const found = all.find(t => t.id === activeThemeId);
    if (!found) return;
    // Only the very first resolution writes to DOM here — subsequent
    // changes flow through applyTheme/previewTheme which are explicit.
    if (!initialApplyDoneRef.current) {
      writeThemeToDom(found, setIsDarkMode);
      initialApplyDoneRef.current = true;
    }
  }, [activeThemeId, personalThemes, setIsDarkMode]);

  // ── Save / rename / delete personal themes ──────────────────────────────

  const persistPersonal = useCallback((next: Theme[]) => {
    try { localStorage.setItem(PERSONAL_THEMES_KEY, JSON.stringify(next)); }
    catch {/* private mode — accept loss */}
  }, []);

  const saveCurrentLook = useCallback((name: string): Theme => {
    // Prefer the active theme as the basis (richer metadata) and fall
    // back to a DOM read so the capture still works even if no theme
    // has been applied yet.
    const all: Theme[] = [...BUILT_IN_THEMES, ...personalThemes];
    const base = activeThemeId ? all.find(t => t.id === activeThemeId) : undefined;
    const dom  = readThemeSnapshotFromDom();
    const captured = captureLookAsTheme({
      name,
      background:  base?.background  ?? { kind: 'color', value: '#0f172a' },
      accent:      base?.accent      ?? dom.accent      ?? '#22d3ee',
      font:        base?.font        ?? 'inter',
      widgetTint:  base?.widgetTint  ?? dom.widgetTint  ?? '#0f172a',
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
      hydrationDoneRef.current = false;
      lastUploadedRef.current  = '';
    }
  }, [isAuthenticated, userId]);

  // Hydrate themes from the cloud once per sign-in. Uses the same
  // /api/dashboard endpoint the layout sync relies on, so we don't add
  // extra round-trips for the common case.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (hydrationDoneRef.current) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) { hydrationDoneRef.current = true; return; }
      try {
        const res = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          const remote = body?.dashboard;
          if (remote) {
            const remoteThemes = sanitizeThemes(remote.personalThemes);
            if (remoteThemes.length > 0) {
              setPersonalThemes(remoteThemes);
              persistPersonal(remoteThemes);
            }
            if (typeof remote.activeThemeId === 'string' && remote.activeThemeId) {
              setActiveThemeId(remote.activeThemeId);
              try { localStorage.setItem(ACTIVE_THEME_ID_KEY, remote.activeThemeId); } catch {/* */}
            }
          }
        }
      } catch {
        // Network failure — keep localStorage values, retry on next sign-in.
      }
      hydrationDoneRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, userId, getToken, persistPersonal]);

  // Debounced upload. PATCH semantics let us send only the theme fields
  // without overwriting the widget layout owned by use-cloud-sync.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (!hydrationDoneRef.current) return;
    const payload = JSON.stringify({ personalThemes, activeThemeId });
    if (payload === lastUploadedRef.current) return;
    if (cloudUploadTimerRef.current) clearTimeout(cloudUploadTimerRef.current);
    cloudUploadTimerRef.current = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/dashboard', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ personalThemes, activeThemeId }),
        });
        if (res.ok) lastUploadedRef.current = payload;
      } catch { /* silent — localStorage stays the source of truth */ }
    }, 1500);
    return () => {
      if (cloudUploadTimerRef.current) clearTimeout(cloudUploadTimerRef.current);
    };
  }, [personalThemes, activeThemeId, isAuthenticated, userId, getToken]);

  // Keep the (unused-here) font stack export referenced so tree-shakers
  // don't drop it — themes-modal.tsx imports it directly anyway.
  void THEME_FONT_STACKS;

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
