import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { LoginModal } from '@/components/login-modal';
import { MobileGuard } from '@/components/mobile-guard';
import { useViralAds, AdBlockData } from '@/components/ad-block';
import { searchChannelLiveStream } from '@/lib/stream-api';
import { getVerifiedChannel, getStaticLiveId, getFallbackVideoId } from '@/lib/channel-constants';

// ─── Static background ────────────────────────────────────────────────────────
const StaticBackground = () => {
  useEffect(() => {
    const body = document.body;
    body.style.backgroundColor = '#F8F9FA';
    body.style.backgroundImage = 'none';
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'fixed';
    body.style.minHeight = '100vh';
  }, []);
  return null;
};

import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import MasterControlDashboard from '@/pages/dashboard';
import Admin from '@/pages/admin';
import Terms from '@/pages/terms';
import Privacy from '@/pages/privacy';
import Feedback from '@/pages/feedback';
import { WidgetSidebar, TrendingChannel, WidgetTemplate, WIDGET_TEMPLATES } from '@/components/widget-sidebar';
import {
  DndContext, DragEndEvent, DragStartEvent, DragMoveEvent, DragOverlay,
  useSensor, useSensors, PointerSensor, UniqueIdentifier, rectIntersection,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

// ─── WidgetType ───────────────────────────────────────────────────────────────
// ALL values are strictly lowercase. Must exactly match widgetType strings used
// in widget-sidebar.tsx — a case mismatch is the root cause of ghost-box widgets.
//
//   'zoom'   → rendered as null  (ghost-box fix; kept for backwards-compat only)
//   'clock'  → rendered as <ClockWidget>  (live ticking clock, solid background)
//   'note'   → dashboard renders with solid bg-slate-900
//   'video'  → dashboard renders iframe/embed
//   'spacer' → dashboard renders transparent spacer
//   'image'  → dashboard renders <img>
export type WidgetType = 'video' | 'note' | 'spacer' | 'image' | 'zoom' | 'clock';

// ─── Widget Interface ─────────────────────────────────────────────────────────
export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  url?: string;
  isYouTube?: boolean;
  videoId?: string | null;
  youtubeChannelId?: string | null;
  channelName?: string;
  channelHandle?: string | null;
  isTwitch?: boolean;
  twitchChannel?: string | null;
  isKick?: boolean;
  kickChannel?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  volume: number;
  previousVolume?: number;
  error?: string | null;
  embedBlocked?: boolean;
  noteContent?: string;
  imageUrl?: string;
  lastRefresh?: number;
  // Nuclear Refresh Fix — use in JSX: key={`${widget.id}-${widget.refreshCounter ?? 0}`}
  refreshCounter?: number;
  isOffline?: boolean;
  isLive?: boolean;
  isPlayingLatestVideo?: boolean;
  usePureIframe?: boolean;
  latestVideoId?: string | null;
  verifiedLiveId?: string | null;
  isManualOverride?: boolean;
  customColor?: string;
  apiError?: boolean;
  isDeleting?: boolean;
  // Clock-only — toggled by handleToggleClockFormat → onToggleClockFormat
  clockUse24Hour?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ClockWidget
//
//  Defined here so WidgetRenderer (below) can reference it without a forward
//  declaration. Exported so dashboard.tsx can import it directly if desired.
//
//  Key implementation details:
//    • useState<Date> + setInterval(1 000 ms) — ticks every second
//    • backgroundColor: '#0f172a' (slate-900) is FULLY OPAQUE — the grid never
//      bleeds through, so there is never a "ghost box" effect
//    • 12h / 24h toggle button in the top-right corner
//
//  Usage in dashboard.tsx
//  ──────────────────────
//    import { WidgetRenderer } from '@/App';
//
//    // Call at the VERY TOP of your widget-cell render function:
//    const early = WidgetRenderer({ widget, onToggle24Hour: onToggleClockFormat });
//    if (early !== false) return early;   // null | JSX — already handled
//    // ... continue with your existing video / note / spacer / image rendering
// ─────────────────────────────────────────────────────────────────────────────

interface ClockWidgetProps {
  widget: Widget;
  onToggle24Hour: (widgetId: string) => void;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({ widget, onToggle24Hour }) => {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const use24 = widget.clockUse24Hour ?? false;

  // Tick every second — cleaned up automatically on unmount
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24,
  });

  const dateString = currentTime.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        // Solid slate-900 — NEVER transparent; grid never bleeds through
        backgroundColor: '#0f172a',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '1rem',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 12H / 24H label — top-left */}
      <div
        style={{
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          fontSize: '0.6rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: '#475569',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}
      >
        {use24 ? '24H' : '12H'}
      </div>

      {/* Format toggle — top-right */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle24Hour(widget.id); }}
        title={use24 ? 'Switch to 12-hour' : 'Switch to 24-hour'}
        aria-label="Toggle time format"
        style={{
          position: 'absolute',
          top: '0.4rem',
          right: '0.4rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#475569',
          padding: '0.3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.25rem',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
      >
        {/* Settings / gear icon */}
        <svg
          width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Time — clamp() scales gracefully inside small cells */}
      <div
        style={{
          fontSize: 'clamp(1.25rem, 5.5vw, 4.5rem)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: 700,
          color: '#f1f5f9',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          textAlign: 'center',
        }}
      >
        {timeString}
      </div>

      {/* Date */}
      <div
        style={{
          marginTop: '0.75rem',
          fontSize: 'clamp(0.55rem, 1.2vw, 0.875rem)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: '#64748b',
          textAlign: 'center',
          letterSpacing: '0.02em',
          lineHeight: 1.3,
        }}
      >
        {dateString}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  WidgetRenderer
//
//  Central switch statement for ALL widget types.
//
//  Call this at the VERY TOP of dashboard.tsx's widget-cell render function:
//
//    import { WidgetRenderer } from '@/App';
//
//    const early = WidgetRenderer({ widget, onToggle24Hour: onToggleClockFormat });
//    if (early !== false) return early;   // null | JSX — handled here
//    // ... continue with your existing video / note / spacer / image rendering
//
//  Return values
//  ─────────────
//    null    → render nothing at all       ('zoom' ghost-box fix)
//    JSX     → render the returned element ('clock')
//    false   → dashboard renders this type ('video', 'note', 'spacer', 'image')
//    <div>   → Unknown Widget Type debug tile for any unrecognised type string
//              (solid slate-900 background — never a transparent ghost box)
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetRendererProps {
  widget: Widget;
  onToggle24Hour: (widgetId: string) => void;
}

export function WidgetRenderer({
  widget,
  onToggle24Hour,
}: WidgetRendererProps): React.ReactElement | null | false {
  switch (widget.type) {

    // ── 'zoom': backwards-compat — render nothing at all (kills ghost box) ──
    case 'zoom':
      return null;

    // ── 'clock': live ticking clock with solid opaque background ────────────
    case 'clock':
      return (
        <ClockWidget
          key={widget.id}
          widget={widget}
          onToggle24Hour={onToggle24Hour}
        />
      );

    // ── Known dashboard-rendered types: signal the caller to handle these ───
    case 'video':
    case 'note':
    case 'spacer':
    case 'image':
      return false;

    // ── Default: unknown / future type — visible debug tile ─────────────────
    // Solid background ensures there is NEVER a transparent ghost box.
    default:
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0f172a', // solid slate-900 — never transparent
            borderRadius: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            border: '1px dashed #334155',
          }}
        >
          <p
            style={{
              color: '#f87171',
              fontSize: '0.85rem',
              fontWeight: 700,
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.35rem',
            }}
          >
            Unknown Widget Type
          </p>
          <p
            style={{
              color: '#475569',
              fontSize: '0.75rem',
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            type: &quot;{(widget as Widget).type}&quot;
          </p>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

function AppContent() {
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
  const { user, isAuthenticated, logout } = useAuth();

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

  const getDefaultWidgets = (): Widget[] => [];

  const [widgets, setWidgets] = useState<Widget[]>(() => {
    const saved = localStorage.getItem('openBentoWidgets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((w: Widget) => ({
          ...w,
          isMuted: w.isMuted ?? true,
          isPaused: w.isPaused ?? false,
          volume: w.volume ?? 0,
          previousVolume: w.previousVolume ?? 50,
          isOffline: w.isOffline ?? false,
          x: w.x ?? 0,
          y: w.y ?? 0,
          w: w.w ?? 3,
          h: w.h ?? 2,
          // Nuclear Refresh Fix: migrate legacy iframeKey field
          refreshCounter: (w as any).refreshCounter ?? (w as any).iframeKey ?? 0,
          channelName: stripLegacyPrefix(w.channelName),
          noteContent: w.type === 'note' ? (w.noteContent ?? '') : w.noteContent,
          clockUse24Hour: w.clockUse24Hour ?? false,
        }));
      } catch {
        return getDefaultWidgets();
      }
    }
    return getDefaultWidgets();
  });

  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);

  const { ad, skipAd, triggerAd, isAdActive } = useViralAds(false, widgets, setWidgets);

  // ── URL extractors ──────────────────────────────────────────────────────────
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

  // ── findSmartPosition ───────────────────────────────────────────────────────
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
      };

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
          if (x < widget.x + widget.w && x + 1 > widget.x && y < widget.y + widget.h && y + 1 > widget.y) { cellFree = false; break; }
        }
        if (cellFree && ad) {
          if (x < ad.x + ad.w && x + 1 > ad.x && y < ad.y + ad.h && y + 1 > ad.y) cellFree = false;
        }
        if (cellFree) return false;
      }
    }
    return true;
  }, [widgets, ad]);

  // ── addWidget ───────────────────────────────────────────────────────────────
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
          // Initialise type-specific fields so these widgets always have solid backgrounds
          ...(type === 'note'  && { noteContent: '' }),
          ...(type === 'clock' && { clockUse24Hour: false }),
          ...extraData,
        };
        return [...prev, newWidget];
      });
      return widgetId;
    },
    [findSmartPosition]
  );

  // ── Nuclear Refresh Fix ─────────────────────────────────────────────────────
  // Increment refreshCounter → React sees a new key → fully unmounts & remounts
  // the iframe. In dashboard.tsx use: key={`${widget.id}-${widget.refreshCounter ?? 0}`}
  const handleRefreshWidget = useCallback((widgetId: string) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId
          ? { ...w, refreshCounter: (w.refreshCounter ?? 0) + 1, lastRefresh: Date.now(), error: null, embedBlocked: false, apiError: false, isPaused: false, usePureIframe: false }
          : w
      )
    );
  }, []);

  // ── Clock 12h / 24h toggle ──────────────────────────────────────────────────
  // Passed through dashboardProps as onToggleClockFormat, then forwarded into
  // WidgetRenderer({ widget, onToggle24Hour: onToggleClockFormat }).
  const handleToggleClockFormat = useCallback((widgetId: string) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId ? { ...w, clockUse24Hour: !(w.clockUse24Hour ?? false) } : w
      )
    );
  }, []);

  // ── addVideoWidget ──────────────────────────────────────────────────────────
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
          isLive: false, error: null, embedBlocked: false, isPaused: false, isMuted: true, volume: 0, isOffline: false,
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

  // ── handleInlineUrlSubmit ───────────────────────────────────────────────────
  const handleInlineUrlSubmit = useCallback((widgetId: string, url: string) => {
    if (!url.trim()) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) finalUrl = 'https://' + finalUrl;

    const youtubeId        = extractYouTubeId(finalUrl);
    const youtubeChannelId = extractYouTubeChannelId(finalUrl);
    const twitchChannel    = extractTwitchChannel(finalUrl);
    const kickChannel      = extractKickChannel(finalUrl);

    let immediateName: string | undefined;
    if (twitchChannel) immediateName = twitchChannel;
    else if (kickChannel) immediateName = kickChannel;
    else if (youtubeId) immediateName = youtubeId;
    else { try { immediateName = new URL(finalUrl).hostname.replace(/^www\./, ''); } catch { immediateName = finalUrl; } }

    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? {
        ...w, type: 'video', url: finalUrl,
        isYouTube: !!youtubeId || !!youtubeChannelId, videoId: youtubeId, youtubeChannelId,
        channelName: w.channelName || immediateName,
        isTwitch: !!twitchChannel, twitchChannel,
        isKick: !!kickChannel, kickChannel,
        isLive: false, error: null, embedBlocked: false, isPaused: false, isMuted: true, volume: 0, isOffline: false,
        refreshCounter: (w.refreshCounter ?? 0) + 1,
        lastRefresh: Date.now(),
      } : w
    ));
    resolveAndPatchChannelName(widgetId, finalUrl, youtubeId, twitchChannel, kickChannel);
  }, [resolveAndPatchChannelName]);

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

    if (translated) { dragX = translated.left; dragY = translated.top; }
    else if (initial && event.delta) { dragX = initial.left + event.delta.x; dragY = initial.top + event.delta.y; }
    else return;

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
                    if (x < other.x + other.w && x + w.w > other.x && y < other.y + other.h && y + w.h > other.y) { collision = true; break; }
                  }
                  if (!collision && x < clampedX + previewW && x + w.w > clampedX && y < clampedY + previewH && y + w.h > clampedY) collision = true;
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

        if (!ghostValidRef.current) { ghostPositionRef.current = null; setGhostPosition(null); }
        else { ghostPositionRef.current = { x: clampedX, y: clampedY, w: previewW, h: previewH }; setGhostPosition(ghostPositionRef.current); }
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
        return x < widget.x + widget.w && x + w > widget.x && y < widget.y + widget.h && y + h > widget.y;
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
            if (x < other.x + other.w && x + widget.w > other.x && y < other.y + other.h && y + widget.h > other.y) { collision = true; break; }
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
          updatedWidgets = updatedWidgets.map(w => w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w);
        }
        return updatedWidgets;
      });
    }
  }, [addVideoWidget, addWidget, setWidgets, findCollidingWidgets, findNextAvailableSlot, ad]);

  // ── handleChannelClick ──────────────────────────────────────────────────────
  const handleChannelClick = useCallback(async (channel: TrendingChannel) => {
    const currentActiveWidgetId = activeWidgetIdRef.current;

    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
    setUrlInputValue('');

    if (channel.platform === 'youtube' && channel.channelId) {
      const verifiedChannel  = getVerifiedChannel(channel.channelId);
      const staticVideoId    = getStaticLiveId(channel.channelId);
      const fallbackVideoId  = getFallbackVideoId(channel.channelId);

      const immediateVideoId  = verifiedChannel?.liveId || channel.verifiedLiveId || staticVideoId || channel.videoId || null;
      const channelFallbackId = verifiedChannel?.fallbackId || fallbackVideoId || channel.latestVideoId || null;

      if (immediateVideoId) {
        const widgetData: Partial<Widget> = {
          url: `https://www.youtube.com/watch?v=${immediateVideoId}`,
          isYouTube: true, videoId: immediateVideoId,
          youtubeChannelId: channel.channelId, channelHandle: channel.channelId,
          channelName: stripLegacyPrefix(channel.name) || undefined,
          isTwitch: false, twitchChannel: null, isKick: false, kickChannel: null,
          isLive: true, isOffline: false,
          verifiedLiveId: verifiedChannel?.liveId || channel.verifiedLiveId || null,
          latestVideoId: channelFallbackId, isPlayingLatestVideo: false,
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

        if (channel.isManualOverride) return;

        searchChannelLiveStream(channel.channelId, false).then(result => {
          if (result.liveVideoId && result.liveVideoId !== immediateVideoId) {
            setWidgets(prev => prev.map(w =>
              w.channelHandle === channel.channelId ? {
                ...w, videoId: result.liveVideoId,
                url: `https://www.youtube.com/watch?v=${result.liveVideoId}`,
                isLive: true, isOffline: false, isPlayingLatestVideo: false,
                refreshCounter: (w.refreshCounter ?? 0) + 1, lastRefresh: Date.now(),
              } : w
            ));
          } else if (result.liveVideoId) {
            setWidgets(prev => prev.map(w => w.channelHandle === channel.channelId ? { ...w, isLive: true } : w));
          }
        }).catch(err => console.warn('[Background] Status check failed (non-blocking):', err));
        return;
      }

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

  // ─── dashboardProps ───────────────────────────────────────────────────────
  // onToggleClockFormat is forwarded into WidgetRenderer via:
  //
  //   import { WidgetRenderer } from '@/App';
  //
  //   // In dashboard.tsx, at the TOP of your widget-cell render function:
  //   const early = WidgetRenderer({ widget, onToggle24Hour: onToggleClockFormat });
  //   if (early !== false) return early;  // null | JSX — handled
  //   // ... rest of video / note / spacer / image rendering
  const dashboardProps = {
    widgets,
    setWidgets,
    isEditMode,
    setIsEditMode,
    sidebarOpen: sidebarOpen && !isFullscreen,
    activeId,
    handleOpenSidebar,
    onInlineUrlSubmit: handleInlineUrlSubmit,
    handleOpenSidebarToContent,
    addWidget,
    isFullscreen,
    setIsFullscreen,
    ghostPosition,
    gridContainerRef,
    isGridFull,
    user,
    onLogout: logout,
    isAuthenticated,
    openLoginModal,
    ad,
    skipAd,
    triggerAd,
    isAdActive,
    onRefreshWidget: handleRefreshWidget,
    // Clock 12h/24h toggle — wire into WidgetRenderer({ onToggle24Hour: onToggleClockFormat })
    onToggleClockFormat: handleToggleClockFormat,
  };

  return (
    <TooltipProvider>
      <StaticBackground />

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          if (location === '/auth/reset-password') setLocation('/');
        }}
        triggerReason={loginTriggerReason}
        defaultMode={loginDefaultMode}
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
          <Switch>
            <Route path="/">
              {() => <MasterControlDashboard {...dashboardProps} />}
            </Route>
            <Route path="/auth/reset-password">
              {() => <MasterControlDashboard {...dashboardProps} />}
            </Route>
            <Route path="/admin" component={Admin} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/feedback" component={Feedback} />
            <Route component={NotFound} />
          </Switch>
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
      <Toaster />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MobileGuard>
        <AppContent />
      </MobileGuard>
    </QueryClientProvider>
  );
}

export default App;