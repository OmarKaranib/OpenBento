// Dashboard shell — extracted from App.tsx during the
  // widget modularization refactor. Owns the dashboard tree:
  // auth/login modal wiring, drag-and-drop layout, the cloud-sync hook
  // call, and every per-widget add/edit/move/delete callback.
  //
  // App.tsx owns the route table and providers; this component is mounted
  // by the "/" and "/auth/reset-password" routes.
  import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
  import { useAuth } from '@/hooks/use-auth';
  import { LoginModal } from '@/components/login-modal';
  import { useViralAds } from '@/components/ad-block';
  import { searchChannelLiveStream } from '@/lib/stream-api';
  import { useLocation } from 'wouter';
  import MasterControlDashboard from '@/pages/dashboard';
  import { WidgetSidebar, TrendingChannel, WidgetTemplate } from '@/components/widget-sidebar';
  import { OnboardingFlow } from '@/components/onboarding-flow';
  import {
    DndContext, DragEndEvent, DragStartEvent, DragMoveEvent, DragOverlay,
    useSensor, useSensors, PointerSensor, UniqueIdentifier, rectIntersection,
  } from '@dnd-kit/core';
  import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
  import type { Widget, WidgetType } from '@/widgets/shared';
  import { WidgetRenderer } from '@/widgets/widget-renderer';
  import { useCloudSync } from '@/dashboard/use-cloud-sync';
  import {
    type DashboardPagesState,
    type DashboardPageWidget,
    PAGES_STORAGE_KEY,
    ACTIVE_PAGE_ID_KEY,
    LEGACY_WIDGETS_KEY,
    sanitizePages,
    migrateLegacyWidgets,
    makeEmptyState,
    getActivePage,
    updateActivePageWidgets,
    setActivePage as setActivePagePure,
    addPage as addPagePure,
    renamePage as renamePagePure,
    duplicatePage as duplicatePagePure,
    deletePage as deletePagePure,
    setDefaultPage as setDefaultPagePure,
    setPageThemeId as setPageThemeIdPure,
    setPageBackground as setPageBackgroundPure,
  } from '@shared/dashboard-pages';
  import type { DashboardPage as DashboardPageType } from '@shared/dashboard-pages';

  const GRID_COLS = 12;

  function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

  async function fetchYouTubeTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (!res.ok) throw new Error(`noembed ${res.status}`);
    const data = await res.json();
    if (data?.title && typeof data.title === 'string' && data.title.trim()) return data.title.trim();
  } catch (err) {
    console.warn('[fetchYouTubeTitle] Could not fetch title for', videoId, err);
  }
  return videoId;
}

  function stripLegacyPrefix(name: string | undefined): string | undefined {
  if (!name) return name;
  return name
    .replace(/^YouTube:\s*/i, '')
    .replace(/^Twitch:\s*/i, '')
    .replace(/^Kick:\s*/i, '')
    .trim() || undefined;
}

  export function DashboardShell() {
  const [sidebarOpen, setSidebarOpen]       = useState(false);
const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
const [activeId, setActiveId]             = useState<UniqueIdentifier | null>(null);
const [isEditMode, setIsEditMode]         = useState(false);
const [urlInputValue, setUrlInputValue]   = useState('');
const [isFullscreen, setIsFullscreen]     = useState(false);
const [ghostPosition, setGhostPosition]   = useState<{ x: number; y: number; w: number; h: number } | null>(null);
const [loginModalOpen, setLoginModalOpen]         = useState(false);
const [loginTriggerReason, setLoginTriggerReason] = useState<string | undefined>();
const [loginDefaultMode, setLoginDefaultMode]     = useState<'login' | 'signup' | 'reset' | 'verify'>('login');

const [location, setLocation] = useLocation();
const { user, isAuthenticated, logout, isLoading: authIsLoading } = useAuth();

useEffect(() => {
  if (location === '/auth/reset-password') {
    setLoginDefaultMode('reset');
    setLoginModalOpen(true);
  }
}, [location]);

const openLoginModal = useCallback((reason?: string) => {
  setLoginTriggerReason(reason);
  setLoginDefaultMode('login');
  setLoginModalOpen(true);
}, []);

const activeWidgetIdRef = useRef<string | null>(null);
const gridContainerRef  = useRef<HTMLDivElement | null>(null);
const ghostPositionRef  = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
const ghostValidRef     = useRef<boolean>(true);
const widgetsRef        = useRef<Widget[]>([]);

useEffect(() => { activeWidgetIdRef.current = activeWidgetId; }, [activeWidgetId]);
useEffect(() => { if (isFullscreen) setSidebarOpen(false); }, [isFullscreen]);

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
);

// Hydrate the widget array from a single legacy `openBentoWidgets`
// string, applying the same defaults the previous code applied.
function hydrateLegacyWidgets(saved: string | null): Widget[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((w: Widget) => (w.type as string) !== 'zoom')
      .map((w: Widget) => ({
        ...w,
        isMuted:        w.isMuted        ?? true,
        isPaused:       w.isPaused       ?? false,
        volume:         w.volume         ?? 0,
        previousVolume: w.previousVolume ?? 50,
        isOffline:      w.isOffline      ?? false,
        x:              w.x              ?? 0,
        y:              w.y              ?? 0,
        w:              w.w              ?? 3,
        h:              w.h              ?? 2,
        refreshCounter: w.refreshCounter ?? w.iframeKey ?? 0,
        channelName:    stripLegacyPrefix(w.channelName),
        noteContent:    w.type === 'note' ? (w.noteContent ?? '') : w.noteContent,
        clockUse24Hour: w.clockUse24Hour ?? false,
      }));
  } catch {
    return [];
  }
}

// Multi-Page Dashboards — pagesState is the source of truth. Hydration
// order: 1) `openBentoPages` (current schema) → 2) legacy
// `openBentoWidgets` wrapped as a Home page → 3) empty Home.
// `?page=` URL deep-link is applied below in an effect after wouter
// is mounted so it can override the persisted active page.
const [pagesState, setPagesState] = useState<DashboardPagesState>(() => {
  if (typeof window === 'undefined') return makeEmptyState();
  try {
    const raw = localStorage.getItem(PAGES_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizePages(JSON.parse(raw));
      if (parsed) {
        const persistedActive = localStorage.getItem(ACTIVE_PAGE_ID_KEY);
        if (persistedActive && parsed.pages.some(p => p.id === persistedActive)) {
          return { ...parsed, activePageId: persistedActive };
        }
        return parsed;
      }
    }
  } catch {/* fall through to legacy migration */}
  const legacy = hydrateLegacyWidgets(localStorage.getItem(LEGACY_WIDGETS_KEY));
  return migrateLegacyWidgets(legacy as unknown as DashboardPageWidget[]);
});

const pagesStateRef = useRef<DashboardPagesState>(pagesState);
useEffect(() => { pagesStateRef.current = pagesState; }, [pagesState]);

// Derived view-model — children continue to consume `widgets` /
// `setWidgets` so their internals are unaffected. `setWidgets` only
// writes to the active page so other pages stay isolated.
const widgets: Widget[] = useMemo(
  () => getActivePage(pagesState).widgets as unknown as Widget[],
  [pagesState],
);

const setWidgets = useCallback<React.Dispatch<React.SetStateAction<Widget[]>>>(
  (updater) => {
    setPagesState(prev => {
      const active = getActivePage(prev);
      const nextWidgets = typeof updater === 'function'
        ? (updater as (w: Widget[]) => Widget[])(active.widgets as unknown as Widget[])
        : updater;
      return updateActivePageWidgets(prev, nextWidgets as unknown as DashboardPageWidget[]);
    });
  },
  [],
);

useEffect(() => { widgetsRef.current = widgets; }, [widgets]);

// Persist pagesState to localStorage so guests + signed-in offline
// reloads land on the same page collection. Mirrors the legacy
// `openBentoWidgets` to the active page's widgets so any code paths
// still reading the legacy key (Cast snapshot helpers, etc.) keep
// working during the transition.
useEffect(() => {
  try {
    localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pagesState));
    localStorage.setItem(ACTIVE_PAGE_ID_KEY, pagesState.activePageId);
    const active = getActivePage(pagesState);
    localStorage.setItem(LEGACY_WIDGETS_KEY, JSON.stringify(active.widgets));
  } catch {/* private mode — accept loss */}
}, [pagesState]);

// ?page= deep-link — applied once after the first paint and whenever
// wouter's location changes. We *keep* the param in the URL after
// applying it (so the tab is bookmarkable / shareable) and rely on
// the second effect below to keep the URL in sync as the user switches
// tabs. Falls back silently when the requested page doesn't exist.
const deepLinkAppliedRef = useRef(false);
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (deepLinkAppliedRef.current) return;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('page');
  if (!requested) { deepLinkAppliedRef.current = true; return; }
  setPagesState(prev =>
    prev.pages.some(p => p.id === requested)
      ? setActivePagePure(prev, requested)
      : prev,
  );
  deepLinkAppliedRef.current = true;
}, [location]);

// Mirror the active page id into the URL as `?page=<id>` so reloads
// and shares re-open the same tab. Uses replaceState (not pushState)
// to avoid polluting browser history with every tab click — users
// rarely want a Back button per tab. Skips the write until the deep
// link has been resolved so we don't clobber the incoming param on
// first paint.
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (!deepLinkAppliedRef.current) return;
  try {
    const url = new URL(window.location.href);
    const current = url.searchParams.get('page');
    // Only write the param when the user has multiple pages — keeps
    // single-page URLs clean.
    if (pagesState.pages.length <= 1) {
      if (current) {
        url.searchParams.delete('page');
        window.history.replaceState(null, '', url.toString());
      }
      return;
    }
    if (current === pagesState.activePageId) return;
    url.searchParams.set('page', pagesState.activePageId);
    window.history.replaceState(null, '', url.toString());
  } catch {/* */}
}, [pagesState.activePageId, pagesState.pages.length]);

  // Cloud sync (logged-in users only). See client/src/dashboard/use-cloud-sync.ts
  // for the full hydrate-then-debounced-upload state machine.
  const { supabase: supabaseClient } = useAuth();
  useCloudSync({
    isAuthenticated,
    userId: user?.id,
    supabaseClient,
    pagesState,
    setPagesState,
    pagesStateRef,
  });

  // ── Page management API exposed to MasterControlDashboard ─────────────
  const handleAddPage     = useCallback((name?: string) => setPagesState(s => addPagePure(s, name ?? 'New Page')), []);
  const handleRenamePage  = useCallback((id: string, name: string) => setPagesState(s => renamePagePure(s, id, name)), []);
  const handleDuplicatePage = useCallback((id: string) => setPagesState(s => duplicatePagePure(s, id)), []);
  const handleDeletePage  = useCallback((id: string) => setPagesState(s => deletePagePure(s, id)), []);
  const handleSetDefaultPage = useCallback((id: string) => setPagesState(s => setDefaultPagePure(s, id)), []);
  const handleSetActivePage = useCallback((id: string) => setPagesState(s => setActivePagePure(s, id)), []);
  const handleSetPageTheme  = useCallback((id: string, themeId: string | null) => setPagesState(s => setPageThemeIdPure(s, id, themeId)), []);
  const handleSetPageBackground = useCallback(
    (id: string, bg: DashboardPageType['backgroundConfig']) =>
      setPagesState(s => setPageBackgroundPure(s, id, bg)),
    [],
  );

  const { ad, skipAd, triggerAd, isAdActive } = useViralAds(false, widgets, setWidgets);

// ── URL extractors ────────────────────────────────────────────────────────
const extractYouTubeId = (url: string): string | null => {
  const regExp = /^.*((youtu\.be\/)|(youtube(-nocookie)?\.com\/(v\/|u\/\w\/|embed\/|watch\?)))\??v?=?([^#&?]*).*/;
  const match  = url.match(regExp);
  return (match && match[6] && match[6].length === 11) ? match[6] : null;
};

const extractYouTubeChannelId = (url: string): string | null => {
  const m = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/) ||
            url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/) ||
            url.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
};

const extractTwitchChannel = (url: string): string | null => {
  const m = url.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/) ||
            url.match(/player\.twitch\.tv\/.*[?&]channel=([a-zA-Z0-9_]+)/);
  return m ? m[1] : null;
};

const extractKickChannel = (url: string): string | null => {
  const m = url.match(/(?:kick\.com\/)([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
};

// ── findSmartPosition ─────────────────────────────────────────────────────
const findSmartPosition = useCallback(
  (requestedW: number, requestedH: number, currentWidgets: Widget[]): { x: number; y: number; w: number; h: number } | null => {
    const GRID_ROWS = 6;
    const isPositionFree = (x: number, y: number, w: number, h: number): boolean => {
      if (x + w > GRID_COLS || y + h > GRID_ROWS) return false;
      for (const widget of currentWidgets) {
        if (x < widget.x + widget.w && x + w > widget.x && y < widget.y + widget.h && y + h > widget.y) return false;
      }
      if (ad) {
        if (x < ad.x + ad.w && x + w > ad.x && y < ad.y + ad.h && y + h > ad.y) return false;
      }
      return true;
    }
    for (let y = 0; y <= GRID_ROWS - requestedH; y++) {
      for (let x = 0; x <= GRID_COLS - requestedW; x++) {
        if (isPositionFree(x, y, requestedW, requestedH)) return { x, y, w: requestedW, h: requestedH };
      }
    }
    for (let tryH = requestedH; tryH >= 1; tryH--) {
      for (let tryW = requestedW; tryW >= 1; tryW--) {
        if (tryW === requestedW && tryH === requestedH) continue;
        for (let y = 0; y <= GRID_ROWS - tryH; y++) {
          for (let x = 0; x <= GRID_COLS - tryW; x++) {
            if (isPositionFree(x, y, tryW, tryH)) return { x, y, w: tryW, h: tryH };
          }
        }
      }
    }
    return null;
  },
  [ad]
);

const isGridFull = useMemo(() => {
  const GRID_ROWS = 6;
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      let cellFree = true;
      for (const widget of widgets) {
        if (x < widget.x + widget.w && x + 1 > widget.x && y < widget.y + widget.h && y + 1 > widget.y) {
          cellFree = false; break;
        }
      }
      if (cellFree && ad) {
        if (x < ad.x + ad.w && x + 1 > ad.x && y < ad.y + ad.h && y + 1 > ad.y) cellFree = false;
      }
      if (cellFree) return false;
    }
  }
  return true;
}, [widgets, ad]);

// ── addWidget ──────────────────────────────────────────────────────────────
const addWidget = useCallback(
  (type: WidgetType, w = 3, h = 2, extraData?: Partial<Widget>) => {
    const widgetId = generateWidgetId();
    setWidgets(prev => {
      const smartResult = findSmartPosition(Math.min(w, GRID_COLS), h, prev);
      if (!smartResult) { console.log('[SmartGrid] Grid is full — cannot add widget'); return prev; }
      const newWidget: Widget = {
        id: widgetId, type,
        x: smartResult.x, y: smartResult.y,
        w: smartResult.w, h: smartResult.h,
        isMuted: true, isPaused: false, volume: 0, previousVolume: 50, isOffline: false,
        refreshCounter: 0,
        ...(type === 'note'  && { noteContent: '' }),
        ...(type === 'clock' && { clockUse24Hour: false }),
        // Soundscape ships unmuted at a default audible volume so the
        // first play actually plays. Master mute can still be toggled.
        ...(type === 'focus_soundscape' && { isMuted: false, volume: 40, previousVolume: 40 }),
        ...extraData,
      };
      return [...prev, newWidget];
    });
    return widgetId;
  },
  [findSmartPosition]
);

// ── Nuclear Refresh Fix ───────────────────────────────────────────────────
const handleRefreshWidget = useCallback((widgetId: string) => {
  setWidgets(prev =>
    prev.map(w =>
      w.id === widgetId
        ? { ...w, refreshCounter: (w.refreshCounter ?? 0) + 1, lastRefresh: Date.now(), error: null, embedBlocked: false, apiError: false, isPaused: false, usePureIframe: false }
        : w
    )
  );
}, []);

// ── Clock 12h / 24h toggle ─────────────────────────────────────────────────
const handleToggleClockFormat = useCallback((widgetId: string) => {
  setWidgets(prev =>
    prev.map(w => w.id === widgetId ? { ...w, clockUse24Hour: !(w.clockUse24Hour ?? false) } : w)
  );
}, []);

// ── Clock background colour ────────────────────────────────────────────────
const handleClockColorChange = useCallback((widgetId: string, color: string) => {
  setWidgets(prev =>
    prev.map(w => w.id === widgetId ? { ...w, customColor: color } : w)
  );
}, []);

// ── addVideoWidget ─────────────────────────────────────────────────────────
const addVideoWidget = useCallback((channel: TrendingChannel, w = 3, h = 2) => {
  const videoId          = channel.videoId || extractYouTubeId(channel.url);
  const youtubeChannelId = channel.channelId || extractYouTubeChannelId(channel.url);
  const twitchChannel    = extractTwitchChannel(channel.url);
  const kickChannel      = extractKickChannel(channel.url);
  const isLiveStream     = channel.platform === 'twitch' || channel.platform === 'kick' || channel.isLive === true;
  addWidget('video', w, h, {
    url: channel.url, isYouTube: channel.platform === 'youtube',
    videoId, youtubeChannelId,
    channelName: stripLegacyPrefix(channel.name) || undefined,
    channelHandle: channel.channelId || null,
    isTwitch: channel.platform === 'twitch', twitchChannel,
    isKick: channel.platform === 'kick', kickChannel,
    isLive: isLiveStream, lastRefresh: Date.now(),
  });
}, [addWidget]);

const resolveAndPatchChannelName = useCallback(async (
  widgetId: string, finalUrl: string,
  youtubeId: string | null, twitchChannel: string | null, kickChannel: string | null,
) => {
  let resolvedName: string | undefined;
  if (youtubeId) {
    resolvedName = stripLegacyPrefix(await fetchYouTubeTitle(youtubeId));
  } else if (twitchChannel) {
    resolvedName = twitchChannel;
  } else if (kickChannel) {
    resolvedName = kickChannel;
  } else {
    try { resolvedName = new URL(finalUrl).hostname.replace(/^www\./, ''); }
    catch { resolvedName = finalUrl; }
  }
  if (resolvedName) {
    setWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, channelName: resolvedName } : w));
  }
}, [setWidgets]);

// ── handleSubmitUrl ─────────────────────────────────────────────────────────
const handleSubmitUrl = useCallback((url: string) => {
  if (!url.trim()) return;
  let finalUrl = url.trim();
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) finalUrl = 'https://' + finalUrl;

  const youtubeId        = extractYouTubeId(finalUrl);
  const youtubeChannelId = extractYouTubeChannelId(finalUrl);
  const twitchChannel    = extractTwitchChannel(finalUrl);
  const kickChannel      = extractKickChannel(finalUrl);
  const currentActiveId  = activeWidgetIdRef.current;

  let immediateName: string | undefined;
  if (twitchChannel) immediateName = twitchChannel;
  else if (kickChannel) immediateName = kickChannel;
  else if (youtubeId) immediateName = youtubeId;
  else { try { immediateName = new URL(finalUrl).hostname.replace(/^www\./, ''); } catch { immediateName = finalUrl; } }

  if (currentActiveId) {
    setWidgets(prev => prev.map(w =>
      w.id === currentActiveId ? {
        ...w, type: 'video', url: finalUrl,
        isYouTube: !!youtubeId || !!youtubeChannelId, videoId: youtubeId, youtubeChannelId,
        channelName: w.channelName || immediateName,
        isTwitch: !!twitchChannel, twitchChannel,
        isKick: !!kickChannel, kickChannel,
        isLive: false, error: null, embedBlocked: false, isPaused: false,
        isMuted: true, volume: 0, isOffline: false,
        refreshCounter: (w.refreshCounter ?? 0) + 1,
        lastRefresh: Date.now(),
      } : w
    ));
    resolveAndPatchChannelName(currentActiveId, finalUrl, youtubeId, twitchChannel, kickChannel);
  } else {
    const newWidgetId = addWidget('video', 3, 2, {
      url: finalUrl,
      isYouTube: !!youtubeId || !!youtubeChannelId, videoId: youtubeId, youtubeChannelId,
      channelName: immediateName,
      isTwitch: !!twitchChannel, twitchChannel,
      isKick: !!kickChannel, kickChannel,
      isLive: false, lastRefresh: Date.now(),
    });
    if (newWidgetId) resolveAndPatchChannelName(newWidgetId, finalUrl, youtubeId, twitchChannel, kickChannel);
  }

  setUrlInputValue('');
  setSidebarOpen(false);
  activeWidgetIdRef.current = null;
  setActiveWidgetId(null);
}, [addWidget, resolveAndPatchChannelName]);

const handleInlineUrlSubmit = useCallback((widgetId: string, url: string) => {
  activeWidgetIdRef.current = widgetId;
  setActiveWidgetId(widgetId);
  handleSubmitUrl(url);
}, [handleSubmitUrl]);

// ── Drag handlers ───────────────────────────────────────────────────────────
const handleDragStart = useCallback((event: DragStartEvent) => {
  setActiveId(event.active.id);
  const activeData = event.active.data.current;
  let ghostPos: { x: number; y: number; w: number; h: number };

  if (activeData?.type === 'channel' || activeData?.type === 'widget-template') {
    const template = activeData.template as WidgetTemplate | undefined;
    ghostPos = { x: 0, y: 0, w: template?.w || 3, h: template?.h || 2 };
  } else if (activeData?.type === 'sortable-widget') {
    const widget = activeData.widget as Widget;
    ghostPos = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
  } else {
    const widget = widgets.find(w => w.id === event.active.id);
    ghostPos = widget ? { x: widget.x, y: widget.y, w: widget.w, h: widget.h } : { x: 0, y: 0, w: 3, h: 2 };
  }

  ghostPositionRef.current = ghostPos;
  setGhostPosition(ghostPos);
}, [widgets]);

const handleDragMove = useCallback((event: DragMoveEvent) => {
  if (!gridContainerRef.current || !ghostPositionRef.current) return;

  const gridRect = gridContainerRef.current.getBoundingClientRect();
  let dragX = 0, dragY = 0;
  const translated = event.active.rect.current.translated;
  const initial    = event.active.rect.current.initial;

  if (translated) {
    dragX = translated.left; dragY = translated.top;
  } else if (initial && event.delta) {
    dragX = initial.left + event.delta.x; dragY = initial.top + event.delta.y;
  } else return;

  const cellWidth  = gridRect.width  / GRID_COLS;
  const cellHeight = gridRect.height / 6;
  const gridX = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((dragX - gridRect.left) / cellWidth)));
  const gridY = Math.max(0, Math.min(5,             Math.floor((dragY - gridRect.top)  / cellHeight)));

  const activeData      = event.active.data.current;
  const draggedWidgetId = event.active.id as string;

  if (activeData?.type === 'sortable-widget') {
    const draggedWidget = widgets.find(w => w.id === draggedWidgetId);
    if (draggedWidget) {
      const previewW = draggedWidget.w;
      const previewH = draggedWidget.h;
      const clampedX = Math.max(0, Math.min(GRID_COLS - previewW, gridX));
      const clampedY = Math.max(0, Math.min(5 - previewH + 1, gridY));

      const collidingWidgets = widgets.filter(widget => {
        if (widget.id === draggedWidgetId) return false;
        return clampedX < widget.x + widget.w && clampedX + previewW > widget.x &&
               clampedY < widget.y + widget.h && clampedY + previewH > widget.y;
      });

      if (collidingWidgets.length > 0) {
        setWidgets(currentWidgets => {
          let updatedWidgets = [...currentWidgets];
          const GRID_ROWS = 6;

          const findSlot = (w: Widget, allWidgets: Widget[], excludeIds: string[]): { x: number; y: number } | null => {
            for (let y = 0; y <= GRID_ROWS - w.h; y++) {
              for (let x = 0; x <= GRID_COLS - w.w; x++) {
                let collision = false;
                for (const other of allWidgets) {
                  if (excludeIds.includes(other.id)) continue;
                  if (x < other.x + other.w && x + w.w > other.x && y < other.y + other.h && y + w.h > other.y) {
                    collision = true; break;
                  }
                }
                if (!collision && x < clampedX + previewW && x + w.w > clampedX && y < clampedY + previewH && y + w.h > clampedY) {
                  collision = true;
                }
                if (!collision) return { x, y };
              }
            }
            return null;
          };

          let invalid = false;
          for (const collidingWidget of collidingWidgets) {
            const newSlot = findSlot(collidingWidget, updatedWidgets, [collidingWidget.id, draggedWidgetId]);
            if (newSlot) {
              updatedWidgets = updatedWidgets.map(w => w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w);
            } else { invalid = true; break; }
          }

          if (invalid) { ghostValidRef.current = false; return currentWidgets; }
          ghostValidRef.current = true;
          return updatedWidgets;
        });
      } else {
        ghostValidRef.current = true;
      }

      if (!ghostValidRef.current) {
        ghostPositionRef.current = null;
        setGhostPosition(null);
      } else {
        ghostPositionRef.current = { x: clampedX, y: clampedY, w: previewW, h: previewH };
        setGhostPosition(ghostPositionRef.current);
      }
      return;
    }
  }

  ghostPositionRef.current = { ...ghostPositionRef.current, x: gridX, y: gridY };
  setGhostPosition(ghostPositionRef.current);
}, [widgets, setWidgets]);

const findCollidingWidgets = useCallback(
  (x: number, y: number, w: number, h: number, excludeId: string, currentWidgets: Widget[]): Widget[] =>
    currentWidgets.filter(widget => {
      if (widget.id === excludeId) return false;
      return x < widget.x + widget.w && x + w > widget.x &&
             y < widget.y + widget.h && y + h > widget.y;
    }),
  []
);

const findNextAvailableSlot = useCallback(
  (widget: Widget, allWidgets: Widget[], excludeIds: string[]): { x: number; y: number } | null => {
    const GRID_ROWS = 6;
    for (let y = 0; y <= GRID_ROWS - widget.h; y++) {
      for (let x = 0; x <= GRID_COLS - widget.w; x++) {
        let collision = false;
        for (const other of allWidgets) {
          if (excludeIds.includes(other.id)) continue;
          if (x < other.x + other.w && x + widget.w > other.x && y < other.y + other.h && y + widget.h > other.y) {
            collision = true; break;
          }
        }
        if (!collision && ad) {
          if (x < ad.x + ad.w && x + widget.w > ad.x && y < ad.y + ad.h && y + widget.h > ad.y) collision = true;
        }
        if (!collision) return { x, y };
      }
    }
    return null;
  },
  [ad]
);

const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active }         = event;
  const finalGhostPosition = ghostPositionRef.current;

  setActiveId(null);
  setGhostPosition(null);
  ghostPositionRef.current = null;

  const activeData = active.data.current;

  if (activeData?.type === 'channel') {
    addVideoWidget(activeData.channel as TrendingChannel, 3, 2);
    setSidebarOpen(false);
    return;
  } else if (activeData?.type === 'widget-template') {
    const template = activeData.template as WidgetTemplate;
    addWidget(template.widgetType, template.w || 3, template.h || 2);
    setSidebarOpen(false);
    return;
  }

  if (activeData?.type === 'sortable-widget' && finalGhostPosition) {
    const widgetId = active.id as string;
    setWidgets(currentWidgets => {
      const widgetIndex = currentWidgets.findIndex(w => w.id === widgetId);
      if (widgetIndex === -1) return currentWidgets;

      const widget  = currentWidgets[widgetIndex];
      const targetX = finalGhostPosition.x;
      const targetY = finalGhostPosition.y;

      if (ad) {
        if (targetX < ad.x + ad.w && targetX + widget.w > ad.x && targetY < ad.y + ad.h && targetY + widget.h > ad.y) return currentWidgets;
      }

      const collidingWidgets = findCollidingWidgets(targetX, targetY, widget.w, widget.h, widgetId, currentWidgets);

      if (collidingWidgets.length === 0) {
        const updatedWidgets = [...currentWidgets];
        updatedWidgets[widgetIndex] = { ...widget, x: targetX, y: targetY };
        return updatedWidgets;
      }

      let updatedWidgets = [...currentWidgets];
      updatedWidgets[widgetIndex] = { ...widget, x: targetX, y: targetY };
      for (const collidingWidget of collidingWidgets) {
        const newSlot = findNextAvailableSlot(collidingWidget, updatedWidgets, [collidingWidget.id]);
        if (newSlot === null) return currentWidgets;
        updatedWidgets = updatedWidgets.map(w =>
          w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w
        );
      }
      return updatedWidgets;
    });
  }
}, [addVideoWidget, addWidget, setWidgets, findCollidingWidgets, findNextAvailableSlot, ad]);

const handleChannelClick = useCallback(async (channel: TrendingChannel) => {
  const currentActiveWidgetId = activeWidgetIdRef.current;

  if (channel.platform === 'youtube' && channel.channelId) {
    try {
      const result               = await searchChannelLiveStream(channel.channelId, false);
      const videoId              = result.liveVideoId || result.latestVideoId || null;
      const isLive               = !!result.liveVideoId;
      const isPlayingLatestVideo = !result.liveVideoId && !!result.latestVideoId;
      const isOffline            = !videoId;

      const widgetData: Partial<Widget> = {
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
        isYouTube: true, videoId,
        youtubeChannelId: result.channelId || channel.channelId, channelHandle: channel.channelId,
        channelName: stripLegacyPrefix(channel.name) || undefined,
        isTwitch: false, twitchChannel: null, isKick: false, kickChannel: null,
        isLive, isPlayingLatestVideo, isOffline,
        isManualOverride: channel.isManualOverride || false,
        apiError: false, error: null, embedBlocked: false, lastRefresh: Date.now(),
      };

      if (currentActiveWidgetId) {
        setWidgets(prev => prev.map(w =>
          w.id === currentActiveWidgetId
            ? { ...w, type: 'video', ...widgetData, isPaused: false, isMuted: true, volume: 0, refreshCounter: (w.refreshCounter ?? 0) + 1 }
            : w
        ));
      } else {
        addWidget('video', 3, 2, widgetData);
      }
      return;
    } catch (error) {
      console.error('[ChannelClick] Error searching for live stream:', error);
    }
  }

  if (currentActiveWidgetId) activeWidgetIdRef.current = currentActiveWidgetId;
  handleSubmitUrl(channel.url);
}, [handleSubmitUrl, addWidget, setWidgets]);

const dashboardOnlyMode = false;

const handleOpenSidebar = useCallback((widgetId?: string) => {
  if (dashboardOnlyMode) return;
  const id = widgetId || null;
  activeWidgetIdRef.current = id;
  setActiveWidgetId(id);
  setSidebarOpen(true);
}, []);

const handleOpenSidebarToContent = useCallback(() => {
  if (dashboardOnlyMode) return;
  activeWidgetIdRef.current = null;
  setActiveWidgetId(null);
  setSidebarOpen(true);
}, []);

const handleTemplateClick = useCallback((template: WidgetTemplate) => {
  addWidget(template.widgetType, template.w || 3, template.h || 2);
  setSidebarOpen(false);
}, [addWidget]);

const handleImageUpload = useCallback((imageUrl: string) => {
  const currentActiveWidgetId = activeWidgetIdRef.current;
  if (currentActiveWidgetId) {
    setWidgets(prev => prev.map(w =>
      w.id === currentActiveWidgetId
        ? { ...w, type: 'image', imageUrl, url: undefined, isYouTube: false, videoId: null, isTwitch: false, twitchChannel: null }
        : w
    ));
  } else {
    addWidget('image', 3, 2, { imageUrl });
  }
  setSidebarOpen(false);
  activeWidgetIdRef.current = null;
  setActiveWidgetId(null);
}, [addWidget]);

const dashboardProps = {
  widgets,
  setWidgets,
  isEditMode,
  setIsEditMode,
  sidebarOpen: sidebarOpen && !isFullscreen,
  activeId,
  handleOpenSidebar,
  onInlineUrlSubmit:          handleInlineUrlSubmit,
  handleOpenSidebarToContent,
  addWidget,
  isFullscreen,
  setIsFullscreen,
  ghostPosition,
  gridContainerRef,
  isGridFull,
  user,
  onLogout:            logout,
  isAuthenticated,
  openLoginModal,
  ad,
  skipAd,
  triggerAd,
  isAdActive,
  // Pass the shared supabase client through props so the dashboard
  // doesn't have to call useAuth() a second time just to get it. This
  // keeps a single auth-hook subscription per render tree.
  supabaseClient,
  onRefreshWidget:     handleRefreshWidget,
  onToggleClockFormat: handleToggleClockFormat,
  onColorChange:       handleClockColorChange,
  // Multi-Page Dashboards — pages collection + management API
  pages:               pagesState.pages,
  activePageId:        pagesState.activePageId,
  onAddPage:           handleAddPage,
  onRenamePage:        handleRenamePage,
  onDuplicatePage:     handleDuplicatePage,
  onDeletePage:        handleDeletePage,
  onSetDefaultPage:    handleSetDefaultPage,
  onSetActivePage:     handleSetActivePage,
  onSetPageTheme:      handleSetPageTheme,
  onSetPageBackground: handleSetPageBackground,
};

return (
  <>
    <LoginModal
      isOpen={loginModalOpen}
      onClose={() => {
        setLoginModalOpen(false);
        if (location === '/auth/reset-password') setLocation('/');
      }}
      triggerReason={loginTriggerReason}
      defaultMode={loginDefaultMode}
    />

    <OnboardingFlow
      setWidgets={setWidgets}
      hasWidgets={widgets.length > 0}
      isAuthenticated={isAuthenticated}
      authIsLoading={authIsLoading}
      isDashboardRoute={location === '/' || location === '/auth/reset-password'}
    />

    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
        {!dashboardOnlyMode && (
          <WidgetSidebar
            isOpen={sidebarOpen}
            onClose={() => {
              setSidebarOpen(false);
              activeWidgetIdRef.current = null;
              setActiveWidgetId(null);
              setUrlInputValue('');
            }}
            onChannelClick={handleChannelClick}
            onTemplateClick={handleTemplateClick}
            urlValue={urlInputValue}
            onUrlChange={setUrlInputValue}
            onUrlSubmit={handleSubmitUrl}
            activeWidgetId={activeWidgetId}
            onImageUpload={handleImageUpload}
            isAuthenticated={isAuthenticated}
            openLoginModal={openLoginModal}
          />
        )}
        <MasterControlDashboard {...dashboardProps} />
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <div
            className="dashboard-slot bg-slate-900/80 backdrop-blur-sm border border-cyan-400 shadow-2xl shadow-cyan-500/40 pointer-events-none"
            style={{ width: '12rem', height: '8rem', opacity: 0.9, zIndex: 1000000, pointerEvents: 'none' }}
          >
            <div className="flex items-center justify-center h-full">
              <span className="text-cyan-400 font-bold text-[1.2rem]">
                {String(activeId).includes('channel-') ? 'Channel' : 'Widget'}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  </>
);
}
