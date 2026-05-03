// Auto-extracted from App.tsx during widget modularization.
  // Contains the Widget data model, the WidgetType union, and helpers
  // shared across multiple widget components (color/luminance, timezone
  // constants, the mono font stack, the timer chime, etc.).
  // ─── WidgetType ───────────────────────────────────────────────────────────────
// ALL values are strictly lowercase. Must exactly match widgetType strings used
// in widget-sidebar.tsx — a case mismatch is the root cause of ghost-box widgets.
export type WidgetType =
  | 'video'
  | 'note'
  | 'spacer'
  | 'image'
  | 'clock'
  | 'crisis_ticker'
  | 'weather'
  | 'dictionary'
  | 'qr_generator'
  | 'markets_ticker'
  | 'world_clocks'
  | 'countdown'
  | 'github_pulse'
  | 'rss_headlines'
  | 'habit_tracker'
  | 'quick_launch'
  | 'big_text_marquee'
  | 'network_light'
  | 'photo_loop'
  | 'focus_soundscape'
  | 'water_tracker'
  | 'mood_checkin'
  | 'standup_roller';

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
  // Legacy alias for refreshCounter from older saved layouts. Read in
  // dashboard-shell hydration; never written by new code.
  iframeKey?: number;
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
  // Markets Ticker — list of symbols to track (uppercase, e.g. ['BTC','SPY']).
  // Persisted with the widget; defaults to BTC/ETH/SPY/AAPL on first add.
  marketsSymbols?: string[];
  // Crisis Ticker — per-widget filter knobs forwarded as /api/news query
  // params. crisisSources is a comma-list of NewsAPI source IDs (mutually
  // exclusive with crisisCategory upstream). crisisCategory is one of
  // tech | markets | world | sports | all (mapped server-side).
  crisisSources?: string;
  crisisCategory?: string;
  // Clock — per-widget analog/digital face toggle on the Clock tab.
  // Defaults to false (digital). When true, an SVG analog clock with
  // hour/minute/second hands renders in place of the digital readout.
  clockShowAnalog?: boolean;
  // World Clocks widget — list of IANA timezone identifiers to display.
  // Defaults to ['America/New_York','Europe/London','Asia/Tokyo','Australia/Sydney']
  // when undefined or empty.
  worldClocksTzs?: string[];
  // Countdown widget — target moment as ISO 8601 string, optional
  // label (e.g. "Launch Day") and a single emoji (e.g. "🚀").
  countdownTarget?: string;
  countdownLabel?: string;
  countdownEmoji?: string;
  // ─── QR Portal v2 ──────────────────────────────────────────────────
  // qrMode controls which preset form is shown and which URI builder
  // runs. All other qr* fields hold the most recent values typed in
  // each preset, so switching modes preserves work in progress.
  qrMode?: 'url' | 'wifi' | 'vcard' | 'email' | 'geo';
  qrUrlValue?: string;
  qrWifiSsid?: string;
  qrWifiPassword?: string;
  qrWifiSecurity?: 'WPA' | 'WEP' | 'nopass';
  qrWifiHidden?: boolean;
  qrVcardName?: string;
  qrVcardPhone?: string;
  qrVcardEmail?: string;
  qrVcardOrg?: string;
  qrEmailTo?: string;
  qrEmailSubject?: string;
  qrEmailBody?: string;
  qrGeoLat?: string;
  qrGeoLon?: string;
  qrGeoLabel?: string;
  // Optional center logo (data: URL or remote URL). When present the
  // QR is rendered at error-correction level H so it remains scannable.
  qrLogoUrl?: string;
  // Optional fore/background color overrides. When undefined the QR
  // tracks the widget's color-droplet (bg becomes background, a
  // contrast-aware foreground is chosen).
  qrFgColor?: string;
  qrBgColor?: string;
  // Rolling history of the last 5 generated QR payloads, newest-first.
  // `fields` carries a mode-specific snapshot of the form values so a
  // history click fully reconstructs the editor (vCard, geo, wifi —
  // not just the URL or to-address). Older entries without `fields`
  // still degrade-restore via best-effort value parsing.
  qrHistory?: {
    mode: NonNullable<Widget['qrMode']>;
    value: string;
    label: string;
    ts: number;
    fields?: Partial<Widget>;
  }[];
  // ─── GitHub Pulse ─────────────────────────────────────────────────
  githubOwner?: string;
  githubRepo?: string;
  // ─── RSS Headlines ────────────────────────────────────────────────
  rssUrl?: string;
  // ─── Dictionary v2 ────────────────────────────────────────────────
  // Active search query (when set, overrides the daily-seeded rotation).
  dictionaryQuery?: string;
  // Favorite words pinned by the user; persisted with the widget.
  dictionaryFavorites?: string[];
  // ─── Habit Tracker ────────────────────────────────────────────────
  // List of named habits, each with the days (YYYY-MM-DD) on which
  // they were checked off. Days are stored as a string array rather
  // than a map so older entries roll off naturally when we trim to
  // the rolling 30-day window in the renderer.
  habits?: { id: string; name: string; days: string[] }[];
  // ─── Quick-Launch Grid ────────────────────────────────────────────
  // Tile entries plus grid size (2/3/4 columns). Each tile carries
  // an optional color override; otherwise the global widget color
  // droplet is used. Favicon is derived from URL host at render.
  quickLinks?: { id: string; label: string; url: string; color?: string }[];
  quickLaunchCols?: 2 | 3 | 4;
  // ─── Big-Text Marquee ─────────────────────────────────────────────
  marqueeText?: string;
  marqueeMode?: 'static' | 'scroll';
  // Pixels per second for scroll mode. Defaults to ~120.
  marqueeSpeed?: number;
  marqueeFgColor?: string;
  marqueeBgColor?: string;
  // ─── Network / Uptime Light ──────────────────────────────────────
  networkUrl?: string;
  // Polling interval in seconds — one of 10 / 30 / 60 / 300.
  networkIntervalSec?: number;
  // ─── Photo Loop ───────────────────────────────────────────────────
  photoUrls?: string[];
  // Crossfade interval in seconds — 0 means manual (no auto-advance).
  photoIntervalSec?: number;
  photoFit?: 'cover' | 'contain';
  // ─── Focus Soundscape ────────────────────────────────────────────
  // Procedurally-generated ambient loop (Web Audio). Honors the
  // master-mute (widget.isMuted) and per-widget volume already on
  // the base Widget. soundscape selects the noise/filter recipe.
  soundscape?: 'rain' | 'brown' | 'fire' | 'forest' | 'waves';
  // ─── Water Tracker ────────────────────────────────────────────────
  // Cups consumed per local-day (YYYY-MM-DD → integer cups). Streak
  // is derived from consecutive days that hit waterTarget.
  waterTarget?: number;
  waterDays?: Record<string, number>;
  // ─── Mood Check-in ────────────────────────────────────────────────
  // Emoji index (0..4) per local-day. Long-press to clear (delete key).
  moodDays?: Record<string, number>;
  // ─── Standup Roller ───────────────────────────────────────────────
  // Roster of names + last shuffle result (ordered names) and the
  // seed used to produce it (so the order is stable across reloads
  // and round-trips through cloud sync).
  standupNames?: string[];
  standupOrder?: string[];
  standupSeed?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Clock color presets
// ─────────────────────────────────────────────────────────────────────────────

export const CLOCK_COLOR_PRESETS: { name: string; bg: string }[] = [
  { name: 'Slate',    bg: '#0f172a' },
  { name: 'Navy',     bg: '#0d1b2a' },
  { name: 'Emerald',  bg: '#052e16' },
  { name: 'Purple',   bg: '#1e0a2e' },
  { name: 'Crimson',  bg: '#1c0808' },
  { name: 'Charcoal', bg: '#18181b' },
  { name: 'White',    bg: '#f8fafc' },
  { name: 'Sand',     bg: '#fef9f0' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Adaptive text colour helpers
// ─────────────────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  const full  = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  if (full.length !== 6) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/** Returns true when bg is light enough to need dark foreground text. */
export function isLightBg(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.35;
}

// ─────────────────────────────────────────────────────────────────────────────
//  playTimerChime — Web Audio API ascending 3-note ding on countdown zero.
// ─────────────────────────────────────────────────────────────────────────────

export function playTimerChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx   = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];       // C5 → E5 → G5
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const t = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      osc.start(t);
      osc.stop(t + 1.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch (err) {
    console.warn('[ClockWidget] Timer chime failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ClockWidget — "Time Tool Suite"
// ─────────────────────────────────────────────────────────────────────────────

export type ClockTab = 'clock' | 'world' | 'timer' | 'stopwatch';

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const WORLD_ZONES: { city: string; tz: string }[] = [
  { city: 'New York',     tz: 'America/New_York' },
  { city: 'Los Angeles',  tz: 'America/Los_Angeles' },
  { city: 'Chicago',      tz: 'America/Chicago' },
  { city: 'Toronto',      tz: 'America/Toronto' },
  { city: 'Vancouver',    tz: 'America/Vancouver' },
  { city: 'Mexico City',  tz: 'America/Mexico_City' },
  { city: 'São Paulo',    tz: 'America/Sao_Paulo' },
  { city: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
  { city: 'Reykjavik',    tz: 'Atlantic/Reykjavik' },
  { city: 'London',       tz: 'Europe/London' },
  { city: 'Paris',        tz: 'Europe/Paris' },
  { city: 'Berlin',       tz: 'Europe/Berlin' },
  { city: 'Madrid',       tz: 'Europe/Madrid' },
  { city: 'Rome',         tz: 'Europe/Rome' },
  { city: 'Stockholm',    tz: 'Europe/Stockholm' },
  { city: 'Moscow',       tz: 'Europe/Moscow' },
  { city: 'Istanbul',     tz: 'Europe/Istanbul' },
  { city: 'Cairo',        tz: 'Africa/Cairo' },
  { city: 'Lagos',        tz: 'Africa/Lagos' },
  { city: 'Nairobi',      tz: 'Africa/Nairobi' },
  { city: 'Cape Town',    tz: 'Africa/Johannesburg' },
  { city: 'Tehran',       tz: 'Asia/Tehran' },
  { city: 'Dubai',        tz: 'Asia/Dubai' },
  { city: 'Karachi',      tz: 'Asia/Karachi' },
  { city: 'Mumbai',       tz: 'Asia/Kolkata' },
  { city: 'Bangkok',      tz: 'Asia/Bangkok' },
  { city: 'Singapore',    tz: 'Asia/Singapore' },
  { city: 'Jakarta',      tz: 'Asia/Jakarta' },
  { city: 'Hong Kong',    tz: 'Asia/Hong_Kong' },
  { city: 'Shanghai',     tz: 'Asia/Shanghai' },
  { city: 'Manila',       tz: 'Asia/Manila' },
  { city: 'Seoul',        tz: 'Asia/Seoul' },
  { city: 'Tokyo',        tz: 'Asia/Tokyo' },
  { city: 'Sydney',       tz: 'Australia/Sydney' },
  { city: 'Auckland',     tz: 'Pacific/Auckland' },
  { city: 'Honolulu',     tz: 'Pacific/Honolulu' },
  { city: 'Anchorage',    tz: 'America/Anchorage' },
];

// Built once for O(1) lookup of city display name from a tz identifier.
export const TZ_TO_CITY: Record<string, string> = WORLD_ZONES.reduce(
  (acc, z) => { acc[z.tz] = z.city; return acc; },
  {} as Record<string, string>,
);

// Default 4-city set used when worldClocksTzs is undefined or empty.
export const DEFAULT_WORLD_CLOCK_TZS: string[] = [
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// Returns the local hour (0-23) in a given IANA timezone using Intl.
// Used by World Clocks day/night dot and Clock-tab analog face.
export function localHourIn(tz: string, d: Date = new Date()): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false, timeZone: tz,
    });
    const parts = fmt.formatToParts(d);
    const hourPart = parts.find(p => p.type === 'hour')?.value ?? '0';
    const h = parseInt(hourPart, 10);
    // Intl returns "24" at midnight in some runtimes — normalise.
    return Number.isFinite(h) ? h % 24 : 0;
  } catch {
    return d.getHours();
  }
}

/** Day if 6 ≤ local hour < 19, else night. Used for the day/night dot. */
export function isDaytimeIn(tz: string, d: Date = new Date()): boolean {
  const h = localHourIn(tz, d);
  return h >= 6 && h < 19;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

// Wellness pack helpers (date keys, streak math, seeded shuffle) live in
// a plain .ts module so node-only tests can import them without a JSX
// runtime. Re-export here so existing widget imports keep working.
export {
  dateKey,
  todayLocalKey,
  offsetLocalKey,
  computeStreak,
  mulberry32,
  seededShuffle,
} from './wellness-helpers';



  // ─── Cross-widget UI helpers (originally inline in QR / GitHub / QuickLaunch) ──

  import React from 'react';

  export const MONO_QR = "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace";

  export function qrInputStyle(fontSize: number): React.CSSProperties {
    return {
      padding: '6px 8px',
      background: 'rgba(15,23,42,0.55)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      color: '#e2e8f0',
      fontFamily: MONO_QR, fontSize, fontWeight: 500,
      outline: 'none', minWidth: 0, width: '100%',
      boxSizing: 'border-box',
    };
  }

  export function qrLabelStyle(): React.CSSProperties {
    return {
      fontFamily: MONO_QR, fontSize: 9, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
      display: 'block', marginBottom: 4,
    };
  }

  export function qrColorPickerStyle(): React.CSSProperties {
    return {
      width: '100%', height: 26, padding: 0, border: 'none',
      borderRadius: 4, background: 'transparent', cursor: 'pointer',
    };
  }

  export function qrIconBtnStyle(): React.CSSProperties {
    return {
      padding: '6px 8px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      color: '#cbd5e1',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
  }

  export function timeAgo(iso: string): string {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '';
    const sec = Math.max(0, (Date.now() - t) / 1000);
    if (sec < 60) return `${Math.floor(sec)}s ago`;
    const min = sec / 60; if (min < 60) return `${Math.floor(min)}m ago`;
    const hr  = min / 60; if (hr  < 24) return `${Math.floor(hr)}h ago`;
    const day = hr  / 24; if (day < 30) return `${Math.floor(day)}d ago`;
    const mo  = day / 30; if (mo  < 12) return `${Math.floor(mo)}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  }

  export function normalizeUrl(raw: string): string {
    const t = raw.trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
  }

  // Subtle dot shown next to a widget header while a background refresh is
  // in flight. Tooltip surfaces last-updated time and any background error
  // without stealing visual real-estate.
  export const RefreshIndicator: React.FC<{
    active: boolean;
    fetchedAt?: number;
    error?: string | null;
    color: string;
  }> = ({ active, fetchedAt, error, color }) => {
    const updated = fetchedAt
      ? `Updated ${timeAgo(new Date(fetchedAt).toISOString())}`
      : '';
    const tip = active
      ? `Refreshing…${updated ? ` (${updated})` : ''}`
      : error
        ? `${error}${updated ? ` — ${updated}` : ''}`
        : updated;
    const dotColor = error ? '#f85149' : color;
    return (
      <span
        title={tip || undefined}
        aria-label={tip || undefined}
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor,
          opacity: active ? 1 : error ? 0.8 : 0.35,
          flexShrink: 0,
          animation: active ? 'widget-refresh-pulse 1.2s ease-in-out infinite' : 'none',
          boxShadow: active ? `0 0 6px ${dotColor}` : 'none',
        }}
        data-testid="refresh-indicator"
      />
    );
  };
  