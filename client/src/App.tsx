import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { LoginModal } from '@/components/login-modal';
import { MobileGuard } from '@/components/mobile-guard';
import { useViralAds, AdBlockData } from '@/components/ad-block';
import { searchChannelLiveStream } from '@/lib/stream-api';

// Import channel constants from shared module to avoid circular imports
import {
  getVerifiedChannel,
  getStaticLiveId,
  getFallbackVideoId
} from '@/lib/channel-constants';


// Static background - High-contrast light mode
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

import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import MasterControlDashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Feedback from "@/pages/feedback";
import { WidgetSidebar, TrendingChannel, WidgetTemplate, WIDGET_TEMPLATES } from '@/components/widget-sidebar';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  UniqueIdentifier,
  rectIntersection
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';

// ─── WidgetType ───────────────────────────────────────────────────────────────
// 'zoom' is kept in the union for backwards-compatibility with stored widget
// data. The dashboard render layer returns null for zoom widgets so no
// visible ghost boxes appear.
// 'clock' is the World Clock widget type.
export type WidgetType = 'video' | 'note' | 'spacer' | 'image' | 'zoom' | 'clock';

// ─── Widget Interface ─────────────────────────────────────────────────────────
// noteContent?: string     → stores text for Note widgets ('' = blank note)
// clockUse24Hour?: boolean → whether the Clock widget shows 24-hour format
//
// ── Nuclear Refresh Fix ───────────────────────────────────────────────────────
// refreshCounter replaces the old iframeKey approach.
// In the dashboard/widget render layer, use:
//
//   <iframe
//     key={widget.id + '-' + widget.refreshCounter}   ← CRITICAL
//     src={buildEmbedUrl(widget)}
//     ...
//   />
//
// Incrementing refreshCounter forces React to fully unmount + remount the
// specific widget's iframe element, which is the only reliable way to
// restart a stubborn YouTube/Twitch player without reloading the page.
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
  // ── Nuclear Refresh Fix ───────────────────────────────────────────────────
  // Use in JSX: key={`${widget.id}-${widget.refreshCounter ?? 0}`}
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
  // ── Clock Widget Fields ───────────────────────────────────────────────────
  // Used exclusively by widgets with type === 'clock'.
  // clockUse24Hour toggles between 12-hour (default) and 24-hour display.
  clockUse24Hour?: boolean;
}

// ─── ClockWidget ──────────────────────────────────────────────────────────────
// Self-contained clock component rendered inside the dashboard grid cell.
// Updates every second via setInterval. Supports 12h / 24h toggle.
//
// Styling: solid #0f172a background (slate-900) — no transparency so grid
// lines never show through. Matches the Note widget's opaque look.
//
// The gear icon in the top-right corner toggles hour format in-place without
// opening a modal. The format badge (12H / 24H) sits in the top-left corner.
//
// Dashboard integration:
//   import { ClockWidget } from '@/App';
//   ...
//   if (widget.type === 'zoom') return null;   // ← hide zoom ghost boxes
//   if (widget.type === 'clock') {
//     return (
//       <ClockWidget widget={widget} onToggle24Hour={onToggleClockFormat} />
//     );
//   }
interface ClockWidgetProps {
  widget: Widget;
  onToggle24Hour: (widgetId: string) => void;
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ widget, onToggle24Hour }) => {
  const [now, setNow] = useState(() => new Date());
  const use24 = widget.clockUse24Hour ?? false;

  // Tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Time string (12h or 24h) ───────────────────────────────────────────
  const timeString = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24,
  });

  // ── Date string (e.g. "Sunday, February 22, 2026") ────────────────────
  const dateString = now.toLocaleDateString([], {
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
        // Solid slate-900 — no alpha so the grid never bleeds through.
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
      }}
    >
      {/* ── Format badge (top-left) ──────────────────────────────────────── */}
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

      {/* ── Settings / format toggle (top-right) ─────────────────────────── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle24Hour(widget.id);
        }}
        title={use24 ? 'Switch to 12-hour format' : 'Switch to 24-hour format'}
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
        {/* Gear / settings icon (inline SVG — no extra dependency) */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* ── Time display ─────────────────────────────────────────────────── */}
      {/* clamp() keeps it readable at any widget size: min 1.5rem, max 3.75rem */}
      <div
        style={{
          fontSize: 'clamp(1.5rem, 4vw, 3.75rem)',
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

      {/* ── Date display ─────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: 'clamp(0.6rem, 1.1vw, 0.875rem)',
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

// Export ClockWidget so dashboard.tsx can import and render it directly.
export { ClockWidget };

const GRID_COLS = 12;

function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ─── fetchYouTubeTitle ────────────────────────────────────────────────────────
// Resolves a human-readable title for a YouTube video via the noembed oEmbed
// endpoint (no API key required).
//
// Title Cleanup Rules:
//   • NEVER prefixes the returned string with "YouTube:" or any platform label.
//   • Falls back to the videoId string so the saved library entry is at least
//     uniquely identifiable.
async function fetchYouTubeTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    );
    if (!res.ok) throw new Error(`noembed ${res.status}`);
    const data = await res.json();
    if (data?.title && typeof data.title === 'string' && data.title.trim()) {
      return data.title.trim();
    }
  } catch (err) {
    console.warn('[fetchYouTubeTitle] Could not fetch title for', videoId, err);
  }
  return videoId;
}

// ─── stripLegacyPrefix ───────────────────────────────────────────────────────
// Removes any legacy "YouTube: " / "Twitch: " / "Kick: " prefix that may have
// been written to channelName in old widget state or in localStorage.
function stripLegacyPrefix(name: string | undefined): string | undefined {
  if (!name) return name;
  return name
    .replace(/^YouTube:\s*/i, '')
    .replace(/^Twitch:\s*/i, '')
    .replace(/^Kick:\s*/i, '')
    .trim() || undefined;
}

// Inner App component that uses hooks requiring QueryClientProvider
function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginTriggerReason, setLoginTriggerReason] = useState<string | undefined>();
  const [loginDefaultMode, setLoginDefaultMode] = useState<'login' | 'signup' | 'reset' | 'verify'>('login');

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
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const ghostPositionRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const ghostValidRef = useRef<boolean>(true);

  // ── widgetsRef ────────────────────────────────────────────────────────────
  // Mutable ref kept in sync with the latest widgets state so async callbacks
  // can read current data without stale-closure issues.
  const widgetsRef = useRef<Widget[]>([]);

  useEffect(() => {
    activeWidgetIdRef.current = activeWidgetId;
  }, [activeWidgetId]);

  useEffect(() => {
    if (isFullscreen) {
      setSidebarOpen(false);
    }
  }, [isFullscreen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const getDefaultWidgets = (): Widget[] => {
    return [];
  };

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
          // ── Nuclear Refresh Fix ──────────────────────────────────────────
          // Migrate old iframeKey values into refreshCounter on load.
          refreshCounter: (w as any).refreshCounter ?? (w as any).iframeKey ?? 0,
          // Title Cleanup: strip any legacy "YouTube: " prefix from stored names
          channelName: stripLegacyPrefix(w.channelName),
          // Ensure noteContent is always a string for note widgets
          noteContent: w.type === 'note' ? (w.noteContent ?? '') : w.noteContent,
          // Clock widget defaults
          clockUse24Hour: w.clockUse24Hour ?? false,
        }));
      } catch {
        return getDefaultWidgets();
      }
    }
    return getDefaultWidgets();
  });

  // Keep widgetsRef in sync with latest state
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const { ad, skipAd, triggerAd, isAdActive } = useViralAds(false, widgets, setWidgets);

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu\.be\/)|(youtube(-nocookie)?\.com\/(v\/|u\/\w\/|embed\/|watch\?)))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[6] && match[6].length === 11) ? match[6] : null;
  };

  const extractYouTubeChannelId = (url: string): string | null => {
    const channelRegex2 = /youtube\.com\/@([a-zA-Z0-9_-]+)/;
    const channelRegex3 = /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/;
    const channelRegex4 = /youtube\.com\/c\/([a-zA-Z0-9_-]+)/;
    const match = url.match(channelRegex2) || url.match(channelRegex3) || url.match(channelRegex4);
    return match ? match[1] : null;
  };

  const extractTwitchChannel = (url: string): string | null => {
    const twitchRegex = /(?:twitch\.tv\/)([a-zA-Z0-9_]+)/;
    const playerRegex = /player\.twitch\.tv\/.*[?&]channel=([a-zA-Z0-9_]+)/;
    const match = url.match(twitchRegex) || url.match(playerRegex);
    return match ? match[1] : null;
  };

  const extractKickChannel = (url: string): string | null => {
    const kickRegex = /(?:kick\.com\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(kickRegex);
    return match ? match[1] : null;
  };

  // ─── findSmartPosition ────────────────────────────────────────────────────
  // Solid 3x2 grid collision — ads and widgets are treated identically.
  // First scans for a perfect fit, then shrinks to the largest available slot.
  const findSmartPosition = useCallback((requestedW: number, requestedH: number, currentWidgets: Widget[]): { x: number; y: number; w: number; h: number } | null => {
    const GRID_ROWS = 6;

    const isPositionFree = (x: number, y: number, w: number, h: number): boolean => {
      if (x + w > GRID_COLS || y + h > GRID_ROWS) return false;
      for (const widget of currentWidgets) {
        const widgetRight = widget.x + widget.w;
        const widgetBottom = widget.y + widget.h;
        const newRight = x + w;
        const newBottom = y + h;
        if (x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y) {
          return false;
        }
      }
      if (ad) {
        const adRight = ad.x + ad.w;
        const adBottom = ad.y + ad.h;
        const newRight = x + w;
        const newBottom = y + h;
        if (x < adRight && newRight > ad.x && y < adBottom && newBottom > ad.y) {
          return false;
        }
      }
      return true;
    };

    for (let y = 0; y <= GRID_ROWS - requestedH; y++) {
      for (let x = 0; x <= GRID_COLS - requestedW; x++) {
        if (isPositionFree(x, y, requestedW, requestedH)) {
          return { x, y, w: requestedW, h: requestedH };
        }
      }
    }

    // Shrink to fit if no exact slot is available
    for (let tryH = requestedH; tryH >= 1; tryH--) {
      for (let tryW = requestedW; tryW >= 1; tryW--) {
        if (tryW === requestedW && tryH === requestedH) continue;
        for (let y = 0; y <= GRID_ROWS - tryH; y++) {
          for (let x = 0; x <= GRID_COLS - tryW; x++) {
            if (isPositionFree(x, y, tryW, tryH)) {
              console.log(`[SmartGrid] Shrunk widget from ${requestedW}x${requestedH} to ${tryW}x${tryH} to fit`);
              return { x, y, w: tryW, h: tryH };
            }
          }
        }
      }
    }

    return null;
  }, [ad]);

  const isGridFull = useMemo(() => {
    const GRID_ROWS = 6;
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        let cellFree = true;
        for (const widget of widgets) {
          const widgetRight = widget.x + widget.w;
          const widgetBottom = widget.y + widget.h;
          if (x < widgetRight && x + 1 > widget.x && y < widgetBottom && y + 1 > widget.y) {
            cellFree = false;
            break;
          }
        }
        if (cellFree && ad) {
          const adRight = ad.x + ad.w;
          const adBottom = ad.y + ad.h;
          if (x < adRight && x + 1 > ad.x && y < adBottom && y + 1 > ad.y) {
            cellFree = false;
          }
        }
        if (cellFree) return false;
      }
    }
    return true;
  }, [widgets, ad]);

  // ─── addWidget ────────────────────────────────────────────────────────────
  // Handles all widget types:
  //   'note'  → auto-inits noteContent: ''
  //   'clock' → auto-inits clockUse24Hour: false
  //   'zoom'  → type preserved for backwards-compat; dashboard renders null
  //
  // Grid collision treats all block types identically (AABB on x, y, w, h).
  const addWidget = useCallback((type: WidgetType, w = 3, h = 2, extraData?: Partial<Widget>) => {
    const widgetId = generateWidgetId();
    setWidgets(prev => {
      const smartResult = findSmartPosition(Math.min(w, GRID_COLS), h, prev);

      if (!smartResult) {
        console.log('[SmartGrid] Grid is full - cannot add widget');
        return prev;
      }

      const newWidget: Widget = {
        id: widgetId,
        type,
        x: smartResult.x,
        y: smartResult.y,
        w: smartResult.w,
        h: smartResult.h,
        isMuted: true,
        isPaused: false,
        volume: 0,
        previousVolume: 50,
        isOffline: false,
        // ── Nuclear Refresh Fix ─────────────────────────────────────────────
        refreshCounter: 0,
        // ── Type-specific defaults ───────────────────────────────────────────
        ...(type === 'note'  && { noteContent: '' }),
        ...(type === 'clock' && { clockUse24Hour: false }),
        // extraData is applied last so callers can override any default.
        ...extraData,
      };
      return [...prev, newWidget];
    });
    return widgetId;
  }, [findSmartPosition]);

  // ─── handleRefreshWidget ─────────────────────────────────────────────────
  // Nuclear Refresh Fix:
  // Increments `refreshCounter` on a single widget. The dashboard MUST use
  // this counter as part of the React key on the iframe element:
  //
  //   <iframe
  //     key={`${widget.id}-${widget.refreshCounter ?? 0}`}   ← REQUIRED
  //     src={buildEmbedUrl(widget)}
  //     ...
  //   />
  //
  // Changing the key causes React to fully unmount and remount the DOM node,
  // which is the only reliable way to restart a stubborn YouTube player.
  const handleRefreshWidget = useCallback((widgetId: string) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId
          ? {
              ...w,
              // ── Nuclear Refresh Fix ──────────────────────────────────────
              refreshCounter: (w.refreshCounter ?? 0) + 1,
              lastRefresh: Date.now(),
              error: null,
              embedBlocked: false,
              apiError: false,
              isPaused: false,
              usePureIframe: false,
            }
          : w
      )
    );
  }, []);

  // ─── handleToggleClockFormat ──────────────────────────────────────────────
  // Toggles the clockUse24Hour flag on a specific clock widget.
  // Called by ClockWidget's settings gear icon button via the dashboardProps
  // onToggleClockFormat callback.
  const handleToggleClockFormat = useCallback((widgetId: string) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId
          ? { ...w, clockUse24Hour: !(w.clockUse24Hour ?? false) }
          : w
      )
    );
  }, []);

  // ─── addVideoWidget ───────────────────────────────────────────────────────
  // Adds a video widget from a TrendingChannel. Always stores channelName and
  // channelHandle so the Personal Library renders the correct label.
  const addVideoWidget = useCallback((channel: TrendingChannel, w = 3, h = 2) => {
    const videoId = channel.videoId || extractYouTubeId(channel.url);
    const youtubeChannelId = channel.channelId || extractYouTubeChannelId(channel.url);
    const twitchChannel = extractTwitchChannel(channel.url);
    const kickChannel = extractKickChannel(channel.url);
    const isLiveStream = channel.platform === 'twitch' || channel.platform === 'kick' || channel.isLive === true;

    addWidget('video', w, h, {
      url: channel.url,
      isYouTube: channel.platform === 'youtube',
      videoId,
      youtubeChannelId,
      // Always persist human-readable name (stripped of any legacy prefix).
      channelName: stripLegacyPrefix(channel.name) || undefined,
      channelHandle: channel.channelId || null,
      isTwitch: channel.platform === 'twitch',
      twitchChannel,
      isKick: channel.platform === 'kick',
      kickChannel,
      isLive: isLiveStream,
      lastRefresh: Date.now(),
    });
  }, [addWidget]);

  // ─── resolveAndPatchChannelName ───────────────────────────────────────────
  // For direct URL submissions, asynchronously resolves a meaningful display
  // name and patches it onto the widget.
  const resolveAndPatchChannelName = useCallback(async (
    widgetId: string,
    finalUrl: string,
    youtubeId: string | null,
    twitchChannel: string | null,
    kickChannel: string | null,
  ) => {
    let resolvedName: string | undefined;

    if (youtubeId) {
      const rawTitle = await fetchYouTubeTitle(youtubeId);
      resolvedName = stripLegacyPrefix(rawTitle);
    } else if (twitchChannel) {
      resolvedName = twitchChannel;
    } else if (kickChannel) {
      resolvedName = kickChannel;
    } else {
      try {
        resolvedName = new URL(finalUrl).hostname.replace(/^www\./, '');
      } catch {
        resolvedName = finalUrl;
      }
    }

    if (resolvedName) {
      setWidgets(prev =>
        prev.map(w =>
          w.id === widgetId ? { ...w, channelName: resolvedName } : w
        )
      );
    }
  }, [setWidgets]);

  const handleSubmitUrl = useCallback((url: string) => {
    if (!url.trim()) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    const youtubeId = extractYouTubeId(finalUrl);
    const youtubeChannelId = extractYouTubeChannelId(finalUrl);
    const twitchChannel = extractTwitchChannel(finalUrl);
    const kickChannel = extractKickChannel(finalUrl);
    const currentActiveWidgetId = activeWidgetIdRef.current;

    // Immediate best-effort name (placeholder while async fetch is in-flight)
    let immediateName: string | undefined;
    if (twitchChannel) {
      immediateName = twitchChannel;
    } else if (kickChannel) {
      immediateName = kickChannel;
    } else if (youtubeId) {
      immediateName = youtubeId; // replaced async below
    } else {
      try {
        immediateName = new URL(finalUrl).hostname.replace(/^www\./, '');
      } catch {
        immediateName = finalUrl;
      }
    }

    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w =>
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'video',
          url: finalUrl,
          isYouTube: !!youtubeId || !!youtubeChannelId,
          videoId: youtubeId,
          youtubeChannelId,
          channelName: w.channelName || immediateName,
          isTwitch: !!twitchChannel,
          twitchChannel,
          isKick: !!kickChannel,
          kickChannel,
          isLive: false,
          error: null,
          embedBlocked: false,
          isPaused: false,
          isMuted: true,
          volume: 0,
          isOffline: false,
          // ── Nuclear Refresh Fix ──────────────────────────────────────────
          refreshCounter: (w.refreshCounter ?? 0) + 1,
          lastRefresh: Date.now(),
        } : w
      ));

      resolveAndPatchChannelName(currentActiveWidgetId, finalUrl, youtubeId, twitchChannel, kickChannel);
    } else {
      const newWidgetId = addWidget('video', 3, 2, {
        url: finalUrl,
        isYouTube: !!youtubeId || !!youtubeChannelId,
        videoId: youtubeId,
        youtubeChannelId,
        channelName: immediateName,
        isTwitch: !!twitchChannel,
        twitchChannel,
        isKick: !!kickChannel,
        kickChannel,
        isLive: false,
        lastRefresh: Date.now(),
      });

      if (newWidgetId) {
        resolveAndPatchChannelName(newWidgetId, finalUrl, youtubeId, twitchChannel, kickChannel);
      }
    }

    setUrlInputValue('');
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
  }, [addWidget, resolveAndPatchChannelName]);

  // ─── handleInlineUrlSubmit ────────────────────────────────────────────────
  // Same title-resolution logic as handleSubmitUrl but targets a specific
  // existing widget by ID (used by the inline URL bar inside a widget slot).
  const handleInlineUrlSubmit = useCallback((widgetId: string, url: string) => {
    if (!url.trim()) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    const youtubeId = extractYouTubeId(finalUrl);
    const youtubeChannelId = extractYouTubeChannelId(finalUrl);
    const twitchChannel = extractTwitchChannel(finalUrl);
    const kickChannel = extractKickChannel(finalUrl);

    let immediateName: string | undefined;
    if (twitchChannel) {
      immediateName = twitchChannel;
    } else if (kickChannel) {
      immediateName = kickChannel;
    } else if (youtubeId) {
      immediateName = youtubeId;
    } else {
      try {
        immediateName = new URL(finalUrl).hostname.replace(/^www\./, '');
      } catch {
        immediateName = finalUrl;
      }
    }

    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? {
        ...w,
        type: 'video',
        url: finalUrl,
        isYouTube: !!youtubeId || !!youtubeChannelId,
        videoId: youtubeId,
        youtubeChannelId,
        channelName: w.channelName || immediateName,
        isTwitch: !!twitchChannel,
        twitchChannel,
        isKick: !!kickChannel,
        kickChannel,
        isLive: false,
        error: null,
        embedBlocked: false,
        isPaused: false,
        isMuted: true,
        volume: 0,
        isOffline: false,
        // ── Nuclear Refresh Fix ────────────────────────────────────────────
        refreshCounter: (w.refreshCounter ?? 0) + 1,
        lastRefresh: Date.now(),
      } : w
    ));

    resolveAndPatchChannelName(widgetId, finalUrl, youtubeId, twitchChannel, kickChannel);
  }, [resolveAndPatchChannelName]);

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
      if (widget) {
        ghostPos = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
      } else {
        ghostPos = { x: 0, y: 0, w: 3, h: 2 };
      }
    }

    ghostPositionRef.current = ghostPos;
    setGhostPosition(ghostPos);
  }, [widgets]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!gridContainerRef.current) return;
    if (!ghostPositionRef.current) return;

    const gridRect = gridContainerRef.current.getBoundingClientRect();
    let dragX = 0;
    let dragY = 0;

    const translated = event.active.rect.current.translated;
    const initial = event.active.rect.current.initial;

    if (translated) {
      dragX = translated.left;
      dragY = translated.top;
    } else if (initial && event.delta) {
      dragX = initial.left + event.delta.x;
      dragY = initial.top + event.delta.y;
    } else {
      return;
    }

    const cellWidth = gridRect.width / GRID_COLS;
    const cellHeight = gridRect.height / 6;
    const relativeX = dragX - gridRect.left;
    const relativeY = dragY - gridRect.top;
    const gridX = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(relativeX / cellWidth)));
    const gridY = Math.max(0, Math.min(5, Math.floor(relativeY / cellHeight)));

    const activeData = event.active.data.current;
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
          const widgetRight = widget.x + widget.w;
          const widgetBottom = widget.y + widget.h;
          const previewRight = clampedX + previewW;
          const previewBottom = clampedY + previewH;
          return clampedX < widgetRight && previewRight > widget.x && clampedY < widgetBottom && previewBottom > widget.y;
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
                      collision = true;
                      break;
                    }
                  }
                  if (!collision && x < clampedX + previewW && x + w.w > clampedX && y < clampedY + previewH && y + w.h > clampedY) {
                    collision = true;
                  }
                  if (!collision) {
                    return { x, y };
                  }
                }
              }
              return null;
            };

            let invalid = false;
            for (const collidingWidget of collidingWidgets) {
              const newSlot = findSlot(collidingWidget, updatedWidgets, [collidingWidget.id, draggedWidgetId]);
              if (newSlot) {
                updatedWidgets = updatedWidgets.map(w =>
                  w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w
                );
              } else {
                invalid = true;
                break;
              }
            }

            if (invalid) {
              ghostValidRef.current = false;
              return currentWidgets;
            }
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

  const isPositionOccupied = useCallback((x: number, y: number, w: number, h: number, excludeWidgetId: string, currentWidgets: Widget[]): boolean => {
    for (const widget of currentWidgets) {
      if (widget.id === excludeWidgetId) continue;
      const widgetRight = widget.x + widget.w;
      const widgetBottom = widget.y + widget.h;
      const newRight = x + w;
      const newBottom = y + h;
      if (x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y) {
        return true;
      }
    }
    return false;
  }, []);

  const findNearestAvailable = useCallback((targetX: number, targetY: number, w: number, h: number, excludeWidgetId: string, currentWidgets: Widget[]): { x: number; y: number } => {
    const GRID_ROWS = 6;
    if (!isPositionOccupied(targetX, targetY, w, h, excludeWidgetId, currentWidgets)) {
      return { x: targetX, y: targetY };
    }
    for (let distance = 1; distance < Math.max(GRID_COLS, GRID_ROWS); distance++) {
      for (let dx = -distance; dx <= distance; dx++) {
        for (let dy = -distance; dy <= distance; dy++) {
          if (Math.abs(dx) !== distance && Math.abs(dy) !== distance) continue;
          const newX = targetX + dx;
          const newY = targetY + dy;
          const clampedX = Math.max(0, Math.min(GRID_COLS - w, newX));
          const clampedY = Math.max(0, Math.min(GRID_ROWS - h, newY));
          if (!isPositionOccupied(clampedX, clampedY, w, h, excludeWidgetId, currentWidgets)) {
            return { x: clampedX, y: clampedY };
          }
        }
      }
    }
    return { x: targetX, y: targetY };
  }, [isPositionOccupied]);

  const findCollidingWidgets = useCallback((x: number, y: number, w: number, h: number, excludeWidgetId: string, currentWidgets: Widget[]): Widget[] => {
    return currentWidgets.filter(widget => {
      if (widget.id === excludeWidgetId) return false;
      const widgetRight = widget.x + widget.w;
      const widgetBottom = widget.y + widget.h;
      const newRight = x + w;
      const newBottom = y + h;
      return x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y;
    });
  }, []);

  const findNextAvailableSlot = useCallback((widget: Widget, allWidgets: Widget[], excludeIds: string[]): { x: number; y: number } | null => {
    const GRID_ROWS = 6;
    for (let y = 0; y <= GRID_ROWS - widget.h; y++) {
      for (let x = 0; x <= GRID_COLS - widget.w; x++) {
        let collision = false;
        for (const other of allWidgets) {
          if (excludeIds.includes(other.id)) continue;
          const widgetRight = other.x + other.w;
          const widgetBottom = other.y + other.h;
          const newRight = x + widget.w;
          const newBottom = y + widget.h;
          if (x < widgetRight && newRight > other.x && y < widgetBottom && newBottom > other.y) {
            collision = true;
            break;
          }
        }
        if (!collision && ad) {
          const adRight = ad.x + ad.w;
          const adBottom = ad.y + ad.h;
          const newRight = x + widget.w;
          const newBottom = y + widget.h;
          if (x < adRight && newRight > ad.x && y < adBottom && newBottom > ad.y) {
            collision = true;
          }
        }
        if (!collision) {
          return { x, y };
        }
      }
    }
    return null;
  }, [ad]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active } = event;
    const finalGhostPosition = ghostPositionRef.current;

    setActiveId(null);
    setGhostPosition(null);
    ghostPositionRef.current = null;

    const activeData = active.data.current;

    if (activeData?.type === 'channel') {
      const channel = activeData.channel as TrendingChannel;
      addVideoWidget(channel, 3, 2);
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

      setWidgets((currentWidgets) => {
        const widgetIndex = currentWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex === -1) return currentWidgets;

        const widget = currentWidgets[widgetIndex];
        const targetX = finalGhostPosition.x;
        const targetY = finalGhostPosition.y;

        if (ad) {
          const adRight = ad.x + ad.w;
          const adBottom = ad.y + ad.h;
          const widgetRight = targetX + widget.w;
          const widgetBottom = targetY + widget.h;
          const collidesWithAd = targetX < adRight && widgetRight > ad.x && targetY < adBottom && widgetBottom > ad.y;
          if (collidesWithAd) {
            return currentWidgets;
          }
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
          if (newSlot === null) {
            return currentWidgets;
          }
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

    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
    setUrlInputValue('');

    if (channel.platform === 'youtube' && channel.channelId) {
      const verifiedChannel = getVerifiedChannel(channel.channelId);
      const staticVideoId = getStaticLiveId(channel.channelId);
      const fallbackVideoId = getFallbackVideoId(channel.channelId);

      const immediateVideoId = verifiedChannel?.liveId || channel.verifiedLiveId || staticVideoId || channel.videoId || null;
      const channelFallbackId = verifiedChannel?.fallbackId || fallbackVideoId || channel.latestVideoId || null;

      if (immediateVideoId) {
        const source = verifiedChannel?.liveId ? 'VERIFIED_MANUAL' : channel.verifiedLiveId ? 'VERIFIED' : staticVideoId ? 'STATIC' : 'SAVED';
        console.log(`[ChannelClick] ZERO-GATE RENDER (${source}): @${channel.channelId} -> ${immediateVideoId} (no wait)`);

        const widgetData: Partial<Widget> = {
          url: `https://www.youtube.com/watch?v=${immediateVideoId}`,
          isYouTube: true,
          videoId: immediateVideoId,
          youtubeChannelId: channel.channelId,
          channelHandle: channel.channelId,
          channelName: stripLegacyPrefix(channel.name) || undefined,
          isTwitch: false,
          twitchChannel: null,
          isKick: false,
          kickChannel: null,
          isLive: true,
          isOffline: false,
          verifiedLiveId: verifiedChannel?.liveId || channel.verifiedLiveId || null,
          latestVideoId: channelFallbackId,
          isPlayingLatestVideo: false,
          isManualOverride: channel.isManualOverride || false,
          apiError: false,
          error: null,
          embedBlocked: false,
          // ── Nuclear Refresh Fix ──────────────────────────────────────────
          lastRefresh: Date.now(),
        };

        if (currentActiveWidgetId) {
          setWidgets(prev => prev.map(w =>
            w.id === currentActiveWidgetId ? {
              ...w,
              type: 'video',
              ...widgetData,
              isPaused: false,
              isMuted: true,
              volume: 0,
              // Nuclear Refresh Fix: bump counter to force iframe remount
              refreshCounter: (w.refreshCounter ?? 0) + 1,
            } : w
          ));
        } else {
          addWidget('video', 3, 2, widgetData);
        }

        if (channel.isManualOverride) {
          console.log(`[ChannelClick] MANUAL OVERRIDE for @${channel.channelId} — skipping ALL background checks`);
          return;
        }

        searchChannelLiveStream(channel.channelId, false).then(result => {
          if (result.liveVideoId && result.liveVideoId !== immediateVideoId) {
            console.log(`[Background] NEW live ID discovered: ${result.liveVideoId} \u2192 updating immediately`);
            setWidgets(prev => prev.map(w =>
              w.channelHandle === channel.channelId ? {
                ...w,
                videoId: result.liveVideoId,
                url: `https://www.youtube.com/watch?v=${result.liveVideoId}`,
                isLive: true,
                isOffline: false,
                isPlayingLatestVideo: false,
                // ── Nuclear Refresh Fix ────────────────────────────────────
                refreshCounter: (w.refreshCounter ?? 0) + 1,
                lastRefresh: Date.now(),
              } : w
            ));
          } else if (result.liveVideoId) {
            setWidgets(prev => prev.map(w =>
              w.channelHandle === channel.channelId ? { ...w, isLive: true } : w
            ));
          }
        }).catch(err => console.warn('[Background] Status check failed (non-blocking):', err));
        return;
      }

      console.log(`[ChannelClick] No saved videoId \u2014 searching for @${channel.channelId}`);

      try {
        const result = await searchChannelLiveStream(channel.channelId, false);
        const videoId = result.liveVideoId || result.latestVideoId || null;
        const isLive = !!result.liveVideoId;
        const isPlayingLatestVideo = !result.liveVideoId && !!result.latestVideoId;
        const hasVideoId = !!videoId;
        const isOffline = !hasVideoId;

        console.log(`[ChannelClick] @${channel.channelId}: liveVideoId=${result.liveVideoId}, latestVideoId=${result.latestVideoId}, using=${videoId}, isLive=${isLive}, isPlayingLatestVideo=${isPlayingLatestVideo}`);

        const widgetData: Partial<Widget> = {
          url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
          isYouTube: true,
          videoId: videoId,
          youtubeChannelId: result.channelId || channel.channelId,
          channelHandle: channel.channelId,
          channelName: stripLegacyPrefix(channel.name) || undefined,
          isTwitch: false,
          twitchChannel: null,
          isKick: false,
          kickChannel: null,
          isLive: isLive,
          isPlayingLatestVideo: isPlayingLatestVideo,
          isOffline: isOffline,
          isManualOverride: channel.isManualOverride || false,
          apiError: false,
          error: null,
          embedBlocked: false,
          // ── Nuclear Refresh Fix ──────────────────────────────────────────
          lastRefresh: Date.now(),
        };

        if (currentActiveWidgetId) {
          setWidgets(prev => prev.map(w =>
            w.id === currentActiveWidgetId ? {
              ...w,
              type: 'video',
              ...widgetData,
              isPaused: false,
              isMuted: true,
              volume: 0,
              // Nuclear Refresh Fix: bump counter to force iframe remount
              refreshCounter: (w.refreshCounter ?? 0) + 1,
            } : w
          ));
        } else {
          addWidget('video', 3, 2, widgetData);
        }
        return;
      } catch (error) {
        console.error('[ChannelClick] Error searching for live stream:', error);
      }
    }

    if (currentActiveWidgetId) {
      activeWidgetIdRef.current = currentActiveWidgetId;
    }
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

  // ─── handleTemplateClick ──────────────────────────────────────────────────
  // Passes template directly to addWidget, which handles type-specific
  // initialization (noteContent: '' for 'note', clockUse24Hour: false for
  // 'clock', etc.).
  const handleTemplateClick = useCallback((template: WidgetTemplate) => {
    addWidget(template.widgetType, template.w || 3, template.h || 2);
    setSidebarOpen(false);
  }, [addWidget]);

  const handleImageUpload = useCallback((imageUrl: string) => {
    const currentActiveWidgetId = activeWidgetIdRef.current;
    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w =>
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'image',
          imageUrl,
          url: undefined,
          isYouTube: false,
          videoId: null,
          isTwitch: false,
          twitchChannel: null,
        } : w
      ));
    } else {
      addWidget('image', 3, 2, { imageUrl });
    }
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
  }, [addWidget]);

  // ─── Shared dashboard props ───────────────────────────────────────────────
  //
  // ── Nuclear Refresh Fix — REQUIRED in dashboard iframe rendering ──────────
  // Every <iframe> rendered for a video widget MUST use refreshCounter in its
  // React key so only the targeted widget remounts on refresh:
  //
  //   <iframe
  //     key={`${widget.id}-${widget.refreshCounter ?? 0}`}   ← REQUIRED
  //     src={buildEmbedUrl(widget)}
  //     ...
  //   />
  //
  // ── Zoom Widget — ghost box removal ──────────────────────────────────────
  // In dashboard.tsx's widget render switch / map, add this guard at the top
  // of the render function for each widget:
  //
  //   if (widget.type === 'zoom') return null;
  //
  // This hides zoom widgets stored in localStorage cleanly, without deleting
  // them. The grid stays clean — no empty space, no ghost boxes appear.
  //
  // ── Clock Widget — dashboard rendering requirement ────────────────────────
  // Import ClockWidget from this file and use it in the widget render switch:
  //
  //   import { ClockWidget } from '@/App';
  //
  //   // Inside the widget render switch / map:
  //   if (widget.type === 'zoom')  return null;      // ← hide ghost boxes
  //   if (widget.type === 'clock') {
  //     return (
  //       <ClockWidget
  //         key={widget.id}
  //         widget={widget}
  //         onToggle24Hour={onToggleClockFormat}
  //       />
  //     );
  //   }
  //
  // onToggleClockFormat below maps to handleToggleClockFormat, which flips
  // widget.clockUse24Hour and persists to localStorage via setWidgets.
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
    // ── Nuclear Refresh Fix ───────────────────────────────────────────────
    // Dashboard MUST use widget.refreshCounter in every iframe's React key.
    onRefreshWidget: handleRefreshWidget,
    // ── Clock Widget callback ─────────────────────────────────────────────
    // Flip between 12h and 24h display. Pass as onToggle24Hour to ClockWidget.
    onToggleClockFormat: handleToggleClockFormat,
  };

  return (
    <TooltipProvider>
      <StaticBackground />

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          if (location === '/auth/reset-password') {
            setLocation('/');
          }
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
              style={{
                width: '12rem',
                height: '8rem',
                opacity: 0.9,
                zIndex: 1000000,
                pointerEvents: 'none',
              }}
            >
              <div className="flex items-center justify-center h-full">
                <span className="text-cyan-400 font-bold text-[1.2rem]">
                  {String(activeId).includes('channel-')
                    ? 'Channel'
                    : String(activeId).includes('template-')
                      ? 'Widget'
                      : 'Widget'
                  }
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