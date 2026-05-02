          import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense, lazy } from 'react';
          import { useAuth } from '@/hooks/use-auth';
          import { LoginModal } from '@/components/login-modal';
          import { MobileGuard } from '@/components/mobile-guard';
          import { useViralAds, AdBlockData } from '@/components/ad-block';
          import { searchChannelLiveStream } from '@/lib/stream-api';
          import { getVerifiedChannel, getStaticLiveId, getFallbackVideoId } from '@/lib/channel-constants';
          import {
            addSymbol as addSymbolHelper,
            removeSymbol as removeSymbolHelper,
            moveSymbol as moveSymbolHelper,
          } from '@/lib/markets-symbols';
          import {
            Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, CloudDrizzle, Cloudy, Search, QrCode,
            Settings as SettingsIcon, ExternalLink, TrendingUp, ArrowUp, ArrowDown, Plus as PlusIcon, X as XIcon,
            Globe, Hourglass, X,
            Wifi, Mail, MapPin, User as UserIcon, Link2, Copy, Check, History as HistoryIcon, Trash2,
            Upload, Github, Rss, Star, Volume2, RefreshCw, ChevronDown, GitPullRequest, GitCommit, Tag,
            CheckSquare, Square as SquareIcon, Flame, Grid3x3, Megaphone, Activity, Image as ImageIconLR,
            ChevronLeft, ChevronRight, Pause as PauseIcon, Play as PlayIcon,
          } from 'lucide-react';
          import { QRCodeSVG } from 'qrcode.react';
          import { Switch, Route, useLocation } from 'wouter';
          import { queryClient } from './lib/queryClient';
          import { QueryClientProvider } from '@tanstack/react-query';
          import { Toaster } from '@/components/ui/toaster';
          import { TooltipProvider } from '@/components/ui/tooltip';
          import { useToast } from '@/hooks/use-toast';
          import NotFound from '@/pages/not-found';
          import MasterControlDashboard from '@/pages/dashboard';
          import Admin from '@/pages/admin';
          import Terms from '@/pages/terms';
          import Privacy from '@/pages/privacy';
          import Feedback from '@/pages/feedback';
          // Lazy-load /cast to break the App ↔ cast.tsx module cycle
          // (cast.tsx imports WidgetRenderer + Widget type from this file).
          const CastPage = lazy(() => import('@/pages/cast'));
          import { WidgetSidebar, TrendingChannel, WidgetTemplate, WIDGET_TEMPLATES } from '@/components/widget-sidebar';
          import { OnboardingFlow } from '@/components/onboarding-flow';
          import {
            DndContext, DragEndEvent, DragStartEvent, DragMoveEvent, DragOverlay,
            useSensor, useSensors, PointerSensor, UniqueIdentifier, rectIntersection,
          } from '@dnd-kit/core';
          import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

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
            | 'photo_loop';

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
          }

          // ─────────────────────────────────────────────────────────────────────────────
          //  Clock color presets
          // ─────────────────────────────────────────────────────────────────────────────

          const CLOCK_COLOR_PRESETS: { name: string; bg: string }[] = [
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

          function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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

          function getRelativeLuminance(hex: string): number {
            const rgb = hexToRgb(hex);
            if (!rgb) return 0;
            const toLinear = (c: number) => {
              const s = c / 255;
              return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
          }

          /** Returns true when bg is light enough to need dark foreground text. */
          function isLightBg(hex: string): boolean {
            return getRelativeLuminance(hex) > 0.35;
          }

          // ─────────────────────────────────────────────────────────────────────────────
          //  playTimerChime — Web Audio API ascending 3-note ding on countdown zero.
          // ─────────────────────────────────────────────────────────────────────────────

          function playTimerChime(): void {
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

          type ClockTab = 'clock' | 'world' | 'timer' | 'stopwatch';

          const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

          const WORLD_ZONES: { city: string; tz: string }[] = [
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
          const TZ_TO_CITY: Record<string, string> = WORLD_ZONES.reduce(
            (acc, z) => { acc[z.tz] = z.city; return acc; },
            {} as Record<string, string>,
          );

          // Default 4-city set used when worldClocksTzs is undefined or empty.
          const DEFAULT_WORLD_CLOCK_TZS: string[] = [
            'America/New_York',
            'Europe/London',
            'Asia/Tokyo',
            'Australia/Sydney',
          ];

          // Returns the local hour (0-23) in a given IANA timezone using Intl.
          // Used by World Clocks day/night dot and Clock-tab analog face.
          function localHourIn(tz: string, d: Date = new Date()): number {
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
          function isDaytimeIn(tz: string, d: Date = new Date()): boolean {
            const h = localHourIn(tz, d);
            return h >= 6 && h < 19;
          }

          const pad2 = (n: number) => String(n).padStart(2, '0');

          interface ClockWidgetProps {
            widget: Widget;
            onToggle24Hour: (widgetId: string) => void;
            // Generic per-widget patcher — used here to persist clockShowAnalog
            // (analog/digital face toggle) on the widget object.
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const ClockWidget: React.FC<ClockWidgetProps> = ({
            widget,
            onToggle24Hour,
            onUpdate,
          }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [cw, setCw]  = useState(240);
            const [ch, setCh]  = useState(160);

            const [isHovered, setIsHovered] = useState(false);

            const bgColor = widget.customColor ?? CLOCK_COLOR_PRESETS[0].bg;

            // ── Adaptive colour tokens derived from background luminance ──────────────
            const light = isLightBg(bgColor);

            const clrPrimary    = light ? '#0f172a' : '#f1f5f9';
            const clrSecondary  = light ? '#334155' : '#94a3b8';
            const clrSubtle     = light ? '#64748b' : '#475569';
            const clrAccent     = light ? '#0284c7' : '#38bdf8';
            const clrBorder     = light ? 'rgba(0,0,0,0.12)' : '#1e293b';
            const clrInputBg    = light ? 'rgba(0,0,0,0.06)' : 'rgba(148,163,184,0.12)';
            const clrInputBdr   = light ? '#94a3b8' : '#334155';
            const clrBtnPassive = light ? 'rgba(0,0,0,0.07)' : 'rgba(148,163,184,0.15)';
            const clrSelectBg   = light ? '#e2e8f0' : '#1e293b';

            const [tab, setTab] = useState<ClockTab>('clock');
            const [now, setNow] = useState<Date>(() => new Date());
            const use24       = widget.clockUse24Hour ?? false;
            const showAnalog  = widget.clockShowAnalog ?? false;

            const [worldZone, setWorldZone] = useState(WORLD_ZONES[0].tz);

            const [timerTotal,   setTimerTotal]   = useState(300);
            const [timerLeft,    setTimerLeft]    = useState(300);
            const [timerRunning, setTimerRunning] = useState(false);
            const [timerSetMin,  setTimerSetMin]  = useState('5');
            const [timerSetSec,  setTimerSetSec]  = useState('0');

            // Pomodoro state: null = not running pomodoro, otherwise the active phase.
            // Focus = 25min, Break = 5min. When the countdown hits 0 in pomo mode the
            // effect auto-flips the phase, plays the chime, and keeps the timer running.
            const [pomodoroPhase, setPomodoroPhase] = useState<'focus' | 'break' | null>(null);
            const POMO_FOCUS_SEC = 25 * 60;
            const POMO_BREAK_SEC = 5 * 60;

            const [swElapsed, setSwElapsed] = useState(0);
            const [swRunning, setSwRunning] = useState(false);
            const swStartRef = useRef<number>(0);

            // Stopwatch laps — each entry is the cumulative ms elapsed at lap time.
            // Only the last 5 are rendered; oldest fall off the bottom of the list.
            const [swLaps, setSwLaps] = useState<number[]>([]);

            // ── ResizeObserver ────────────────────────────────────────────────────────
            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                const r = entries[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              setCw(el.offsetWidth);
              setCh(el.offsetHeight);
              return () => ro.disconnect();
            }, []);

            // ── Wall-clock tick ───────────────────────────────────────────────────────
            // The Clock tab always renders seconds (digital readout includes the
            // ticking colon and the analog face has a sweeping second hand), so we
            // drive ticks with requestAnimationFrame whenever that tab is visible —
            // smooth seconds for both digital and analog. Other tabs (timer,
            // stopwatch, world clocks aren't this widget) only need a 1s tick.
            useEffect(() => {
              const useRaf = tab === 'clock';
              if (useRaf) {
                let raf = 0;
                const tick = () => { setNow(new Date()); raf = requestAnimationFrame(tick); };
                raf = requestAnimationFrame(tick);
                return () => cancelAnimationFrame(raf);
              }
              const id = setInterval(() => setNow(new Date()), 1_000);
              return () => clearInterval(id);
            }, [tab]);

            // ── Countdown with chime + Pomodoro auto-cycle ────────────────────────────
            // When pomodoroPhase is set and the timer reaches 0, the chime plays and
            // the phase flips (focus⇄break) with the new duration loaded — the timer
            // stays running. Outside pomodoro mode, behaviour is identical to before:
            // chime + stop at 0.
            useEffect(() => {
              if (!timerRunning) return;
              const id = setInterval(() => {
                setTimerLeft(prev => {
                  if (prev > 1) return prev - 1;
                  playTimerChime();
                  if (pomodoroPhase) {
                    const nextPhase: 'focus' | 'break' =
                      pomodoroPhase === 'focus' ? 'break' : 'focus';
                    const nextTotal = nextPhase === 'focus' ? POMO_FOCUS_SEC : POMO_BREAK_SEC;
                    setPomodoroPhase(nextPhase);
                    setTimerTotal(nextTotal);
                    return nextTotal;
                  }
                  setTimerRunning(false);
                  return 0;
                });
              }, 1_000);
              return () => clearInterval(id);
            }, [timerRunning, pomodoroPhase, POMO_FOCUS_SEC, POMO_BREAK_SEC]);

            // ── Stopwatch ─────────────────────────────────────────────────────────────
            useEffect(() => {
              if (!swRunning) return;
              swStartRef.current = Date.now() - swElapsed;
              const id = setInterval(() => setSwElapsed(Date.now() - swStartRef.current), 47);
              return () => clearInterval(id);
            }, [swRunning]);

            // ── Responsive scale ─────────────────────────────────────────────────────
            const s = Math.min(cw, ch);

            const sz = {
              tabFont:    Math.max(9,  s * 0.055),
              tabPad:     Math.max(3,  s * 0.025),
              bigTime:    Math.max(18, Math.min(s * 0.28, cw * 0.155, ch * 0.36)),
              dateFont:   Math.max(9,  s * 0.065),
              btnFont:    Math.max(10, s * 0.065),
              btnPadV:    Math.max(4,  s * 0.03),
              btnPadH:    Math.max(8,  s * 0.06),
              btnRadius:  Math.max(4,  s * 0.025),
              btnGap:     Math.max(6,  s * 0.035),
              inputW:     Math.max(48, s * 0.17),
              inputH:     Math.max(34, s * 0.14),
              inputFont:  Math.max(13, s * 0.078),
              inputPadH:  Math.max(6,  s * 0.03),
              labelFont:  Math.max(9,  s * 0.055),
              selectFont: Math.max(10, s * 0.06),
              selectPad:  Math.max(4,  s * 0.025),
              contentGap: Math.max(4,  s * 0.04),
              toggleFont: Math.max(9,  s * 0.052),
            };

            const tabRowH = sz.tabPad * 2 + sz.tabFont + 6;

            // ── Formatters ────────────────────────────────────────────────────────────
            const fmtTime = (d: Date, tz?: string) => {
              const opts: Intl.DateTimeFormatOptions = {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !use24,
              };
              if (tz) opts.timeZone = tz;
              return d.toLocaleTimeString([], opts);
            };

            const fmtDate = (d: Date, tz?: string) => {
              const opts: Intl.DateTimeFormatOptions = {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              };
              if (tz) opts.timeZone = tz;
              return d.toLocaleDateString([], opts);
            };

            const fmtTimer = (sec: number) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

            const fmtSw = (ms: number) => {
              const totalSec = Math.floor(ms / 1000);
              const h   = Math.floor(totalSec / 3600);
              const m   = Math.floor((totalSec % 3600) / 60);
              const sec = totalSec % 60;
              const cs  = Math.floor((ms % 1000) / 10);
              return h > 0
                ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}.${pad2(cs)}`
                : `${pad2(m)}:${pad2(sec)}.${pad2(cs)}`;
            };

            // ── Style factories ───────────────────────────────────────────────────────
            const tabStyle = (t: ClockTab): React.CSSProperties => ({
              flex: 1,
              padding: `${sz.tabPad}px 0`,
              fontSize: `${sz.tabFont}px`,
              fontFamily: MONO,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? clrAccent : clrSubtle,
              background: tab === t ? (light ? 'rgba(2,132,199,0.1)' : 'rgba(56,189,248,0.1)') : 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${clrAccent}` : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              transition: 'all 0.15s ease',
            });

            const btnStyle = (active?: boolean): React.CSSProperties => ({
              padding:      `${sz.btnPadV}px ${sz.btnPadH}px`,
              fontSize:     `${sz.btnFont}px`,
              fontFamily:   MONO,
              fontWeight:   600,
              color:        active ? (light ? '#ffffff' : '#0f172a') : clrSecondary,
              background:   active ? clrAccent : clrBtnPassive,
              border:       'none',
              borderRadius: `${sz.btnRadius}px`,
              cursor:       'pointer',
              transition:   'all 0.15s ease',
            });

            const startTimer = () => {
              const mins  = Math.max(0, Math.min(99, parseInt(timerSetMin) || 0));
              const secs  = Math.max(0, Math.min(59, parseInt(timerSetSec) || 0));
              const total = mins * 60 + secs;
              if (total <= 0) return;
              setPomodoroPhase(null); // manual timer takes precedence over pomo
              setTimerTotal(total);
              setTimerLeft(total);
              setTimerRunning(true);
            };

            const startPomodoro = () => {
              setPomodoroPhase('focus');
              setTimerTotal(POMO_FOCUS_SEC);
              setTimerLeft(POMO_FOCUS_SEC);
              setTimerRunning(true);
            };

            const stopPomodoro = () => {
              setPomodoroPhase(null);
              setTimerRunning(false);
              setTimerLeft(timerTotal);
            };

            const recordLap = () => {
              if (!swRunning) return;
              setSwLaps(prev => [...prev, swElapsed]);
            };

            const inputStyle: React.CSSProperties = {
              width:        `${sz.inputW}px`,
              height:       `${sz.inputH}px`,
              padding:      `0 ${sz.inputPadH}px`,
              fontSize:     `${sz.inputFont}px`,
              fontFamily:   MONO,
              fontWeight:   600,
              color:        clrPrimary,
              background:   clrInputBg,
              border:       `1px solid ${clrInputBdr}`,
              borderRadius: `${sz.btnRadius}px`,
              textAlign:    'center' as const,
              outline:      'none',
              boxSizing:    'border-box' as const,
              MozAppearance: 'textfield' as const,
              appearance:   'textfield' as const,
            };

            // ─────────────────────────────────────────────────────────────────────────
            return (
              <div
                ref={containerRef}
                style={{
                  width:           '100%',
                  height:          '100%',
                  backgroundColor: bgColor,
                  borderRadius:    '0.5rem',
                  display:         'flex',
                  flexDirection:   'column',
                  position:        'relative',
                  userSelect:      'none',
                  overflow:        'hidden',
                  boxSizing:       'border-box',
                  transition:      'background-color 0.3s ease',
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                data-testid={`clock-widget-${widget.id}`}
              >
                {/* ── Ghost Navbar ───────────────────────────────────────────────────── */}
                <div
                  style={{
                    display:       'flex',
                    borderBottom:  `1px solid ${clrBorder}`,
                    flexShrink:    0,
                    minHeight:     `${tabRowH}px`,
                    opacity:       isHovered ? 1 : 0,
                    pointerEvents: isHovered ? 'auto' : 'none',
                    transition:    'opacity 0.2s ease',
                  }}
                >
                  <button style={tabStyle('clock')}     onClick={(e) => { e.stopPropagation(); setTab('clock'); }}     data-testid="tab-clock">Clock</button>
                  <button style={tabStyle('world')}     onClick={(e) => { e.stopPropagation(); setTab('world'); }}     data-testid="tab-world">World</button>
                  <button style={tabStyle('timer')}     onClick={(e) => { e.stopPropagation(); setTab('timer'); }}     data-testid="tab-timer">Timer{timerRunning ? ' ⏱' : ''}</button>
                  <button style={tabStyle('stopwatch')} onClick={(e) => { e.stopPropagation(); setTab('stopwatch'); }} data-testid="tab-stopwatch">Stop{swRunning ? ' ⏱' : ''}</button>
                </div>

                {/* ── Main content area ─────────────────────────────────────────────── */}
                <div
                  style={{
                    flex:           1,
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'center',
                    justifyContent: 'center',
                    padding:        `${Math.max(6, s * 0.04)}px ${Math.max(8, s * 0.05)}px`,
                    paddingBottom:  tab === 'clock'
                      ? `${Math.max(28, s * 0.13)}px`
                      : `${Math.max(6, s * 0.04)}px`,
                    gap:            `${sz.contentGap}px`,
                    minHeight:      0,
                  }}
                >
                  {/* ─── CLOCK TAB ────────────────────────────────────────────────── */}
                  {tab === 'clock' && !showAnalog && (
                    <>
                      <div style={{ fontSize: `${sz.bigTime}px`, fontFamily: MONO, fontWeight: 700, color: clrPrimary, letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'center' }}>
                        {fmtTime(now)}
                      </div>
                      <div style={{ fontSize: `${sz.dateFont}px`, fontFamily: MONO, color: clrSubtle, textAlign: 'center', letterSpacing: '0.02em', lineHeight: 1.3 }}>
                        {fmtDate(now)}
                      </div>
                    </>
                  )}

                  {tab === 'clock' && showAnalog && (
                    <>
                      <AnalogClockFace
                        date={now}
                        size={Math.max(72, Math.min(s * 0.85, ch * 0.62, cw * 0.72))}
                        primary={clrPrimary}
                        secondary={clrSecondary}
                        accent={clrAccent}
                        ticks={clrSubtle}
                      />
                      <div style={{ fontSize: `${sz.dateFont}px`, fontFamily: MONO, color: clrSubtle, textAlign: 'center', letterSpacing: '0.02em', lineHeight: 1.3 }}>
                        {fmtDate(now)}
                      </div>
                    </>
                  )}

                  {/* ─── WORLD TAB ────────────────────────────────────────────────── */}
                  {tab === 'world' && (
                    <>
                      <select
                        value={worldZone}
                        onChange={(e) => { e.stopPropagation(); setWorldZone(e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: `${sz.selectPad}px ${sz.selectPad * 2}px`,
                          fontSize: `${sz.selectFont}px`,
                          fontFamily: MONO, fontWeight: 600,
                          color: clrPrimary, background: clrSelectBg,
                          border: `1px solid ${clrInputBdr}`,
                          borderRadius: `${sz.btnRadius}px`,
                          cursor: 'pointer', outline: 'none', maxWidth: '90%',
                        }}
                        data-testid="select-timezone"
                      >
                        {WORLD_ZONES.map(z => <option key={z.tz} value={z.tz}>{z.city}</option>)}
                      </select>
                      <div style={{ fontSize: `${sz.bigTime * 0.9}px`, fontFamily: MONO, fontWeight: 700, color: clrPrimary, letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'center' }}>
                        {fmtTime(now, worldZone)}
                      </div>
                      <div style={{ fontSize: `${sz.dateFont}px`, fontFamily: MONO, color: clrSubtle, textAlign: 'center', lineHeight: 1.3 }}>
                        {fmtDate(now, worldZone)}
                      </div>
                    </>
                  )}

                  {/* ─── TIMER TAB ────────────────────────────────────────────────── */}
                  {tab === 'timer' && (
                    <>
                      {/* Pomodoro phase pill — visible whenever we're inside a pomo cycle. */}
                      {pomodoroPhase && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: `${Math.max(2, s * 0.012)}px ${Math.max(8, s * 0.04)}px`,
                          fontFamily: MONO, fontSize: `${sz.labelFont}px`, fontWeight: 700,
                          color: pomodoroPhase === 'focus' ? '#f87171' : '#4ade80',
                          background: pomodoroPhase === 'focus' ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)',
                          border: `1px solid ${pomodoroPhase === 'focus' ? 'rgba(248,113,113,0.35)' : 'rgba(74,222,128,0.35)'}`,
                          borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}
                        data-testid="pill-pomo-phase">
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: pomodoroPhase === 'focus' ? '#f87171' : '#4ade80',
                            animation: timerRunning ? 'pomoPulse 1.6s ease-in-out infinite' : 'none',
                          }} />
                          {pomodoroPhase === 'focus' ? 'Focus 25' : 'Break 5'}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize:   `${timerRunning || timerLeft !== timerTotal ? sz.bigTime : sz.bigTime * 0.65}px`,
                          fontFamily: MONO, fontWeight: 700, lineHeight: 1, textAlign: 'center',
                          color: timerLeft === 0 ? '#f87171' : timerRunning ? clrAccent : clrPrimary,
                        }}
                      >
                        {timerLeft === 0 && !timerRunning ? 'TIME UP!' : fmtTimer(timerLeft)}
                      </div>

                      <style>{`@keyframes pomoPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>

                      {!timerRunning && timerLeft === timerTotal && !pomodoroPhase && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${sz.btnGap * 0.6}px`, marginTop: `${sz.contentGap * 0.5}px` }}>
                          <div style={{ display: 'flex', alignItems: 'center', height: `${sz.inputH}px` }}>
                            <input
                              type="number" min="0" max="99"
                              value={timerSetMin}
                              onChange={(e) => setTimerSetMin(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={inputStyle}
                              data-testid="input-timer-min"
                            />
                          </div>
                          <span style={{ color: clrSubtle, fontFamily: MONO, fontSize: `${sz.labelFont}px`, lineHeight: 1 }}>m</span>
                          <div style={{ display: 'flex', alignItems: 'center', height: `${sz.inputH}px` }}>
                            <input
                              type="number" min="0" max="59"
                              value={timerSetSec}
                              onChange={(e) => setTimerSetSec(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={inputStyle}
                              data-testid="input-timer-sec"
                            />
                          </div>
                          <span style={{ color: clrSubtle, fontFamily: MONO, fontSize: `${sz.labelFont}px`, lineHeight: 1 }}>s</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: `${sz.btnGap}px`, marginTop: `${sz.contentGap * 0.5}px`, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {!timerRunning && timerLeft === timerTotal && !pomodoroPhase && (
                          <>
                            <button style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); startTimer(); }} data-testid="btn-timer-start">Start</button>
                            <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); startPomodoro(); }} data-testid="btn-pomo-start" title="Start a 25/5 Pomodoro cycle">🍅 Pomodoro</button>
                          </>
                        )}
                        {timerRunning && (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setTimerRunning(false); }} data-testid="btn-timer-pause">Pause</button>
                        )}
                        {!timerRunning && timerLeft > 0 && (timerLeft < timerTotal || pomodoroPhase) && (
                          <button style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); setTimerRunning(true); }} data-testid="btn-timer-resume">Resume</button>
                        )}
                        {timerLeft < timerTotal && !pomodoroPhase && (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setTimerRunning(false); setTimerLeft(timerTotal); }} data-testid="btn-timer-reset">Reset</button>
                        )}
                        {pomodoroPhase && (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); stopPomodoro(); }} data-testid="btn-pomo-stop">End Pomodoro</button>
                        )}
                      </div>
                    </>
                  )}

                  {/* ─── STOPWATCH TAB ────────────────────────────────────────────── */}
                  {tab === 'stopwatch' && (
                    <>
                      <div style={{ fontSize: `${sz.bigTime * 0.9}px`, fontFamily: MONO, fontWeight: 700, color: swRunning ? '#4ade80' : clrPrimary, lineHeight: 1, textAlign: 'center' }}>
                        {fmtSw(swElapsed)}
                      </div>
                      <div style={{ display: 'flex', gap: `${sz.btnGap}px`, marginTop: `${sz.contentGap * 0.5}px`, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {!swRunning ? (
                          <button style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); setSwRunning(true); }} data-testid="btn-sw-start">
                            {swElapsed > 0 ? 'Resume' : 'Start'}
                          </button>
                        ) : (
                          <>
                            <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setSwRunning(false); }} data-testid="btn-sw-stop">Stop</button>
                            <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); recordLap(); }} data-testid="btn-sw-lap">Lap</button>
                          </>
                        )}
                        {swElapsed > 0 && !swRunning && (
                          <button
                            style={btnStyle()}
                            onClick={(e) => { e.stopPropagation(); setSwElapsed(0); setSwLaps([]); }}
                            data-testid="btn-sw-reset"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Last 5 laps — newest first; split = ms since previous lap. */}
                      {swLaps.length > 0 && ch >= 180 && (
                        <div
                          style={{
                            marginTop: `${sz.contentGap * 0.5}px`,
                            width: '100%',
                            maxWidth: `${Math.min(cw - 24, 320)}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontFamily: MONO,
                            fontSize: `${Math.max(8, sz.labelFont * 0.92)}px`,
                            color: clrSecondary,
                          }}
                          data-testid="list-sw-laps"
                        >
                          {swLaps.slice(-5).reverse().map((cum, idx, arr) => {
                            const lapNumber = swLaps.length - idx;
                            const prev = arr[idx + 1] ?? swLaps[swLaps.length - swLaps.slice(-5).length - 1] ?? 0;
                            const split = cum - prev;
                            return (
                              <div
                                key={`lap-${lapNumber}`}
                                style={{
                                  display: 'flex', justifyContent: 'space-between',
                                  padding: '2px 6px',
                                  background: idx === 0 ? clrBtnPassive : 'transparent',
                                  borderRadius: '4px',
                                }}
                                data-testid={`lap-row-${lapNumber}`}
                              >
                                <span style={{ color: clrSubtle, fontWeight: 600 }}>L{lapNumber}</span>
                                <span style={{ color: clrPrimary, fontWeight: 600 }}>{fmtSw(split)}</span>
                                <span>{fmtSw(cum)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── 12h/24h + Analog/Digital toggles: BOTTOM-CENTER, clock tab only ── */}
                {tab === 'clock' && (
                  <div
                    style={{
                      position:      'absolute',
                      bottom:        `${Math.max(5, s * 0.026)}px`,
                      left:          '50%',
                      transform:     'translateX(-50%)',
                      opacity:       isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition:    'opacity 0.2s ease',
                      zIndex:        10,
                      display:       'flex',
                      gap:           `${Math.max(4, s * 0.025)}px`,
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggle24Hour(widget.id); }}
                      title={use24 ? 'Switch to 12-hour' : 'Switch to 24-hour'}
                      style={{
                        background:    light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
                        border:        `1px solid ${clrInputBdr}`,
                        cursor:        'pointer',
                        color:         clrSecondary,
                        fontSize:      `${sz.toggleFont}px`,
                        fontFamily:    MONO,
                        fontWeight:    600,
                        padding:       `${Math.max(2, s * 0.012)}px ${Math.max(8, s * 0.045)}px`,
                        borderRadius:  `${sz.btnRadius}px`,
                        transition:    'color 0.15s, background 0.15s',
                        letterSpacing: '0.06em',
                        whiteSpace:    'nowrap',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = clrPrimary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = clrSecondary)}
                      data-testid="btn-toggle-24h"
                    >
                      {use24 ? '24H' : '12H'}
                    </button>
                    {onUpdate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(widget.id, { clockShowAnalog: !showAnalog });
                        }}
                        title={showAnalog ? 'Switch to digital face' : 'Switch to analog face'}
                        style={{
                          background:    light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
                          border:        `1px solid ${clrInputBdr}`,
                          cursor:        'pointer',
                          color:         clrSecondary,
                          fontSize:      `${sz.toggleFont}px`,
                          fontFamily:    MONO,
                          fontWeight:    600,
                          padding:       `${Math.max(2, s * 0.012)}px ${Math.max(8, s * 0.045)}px`,
                          borderRadius:  `${sz.btnRadius}px`,
                          transition:    'color 0.15s, background 0.15s',
                          letterSpacing: '0.06em',
                          whiteSpace:    'nowrap',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = clrPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = clrSecondary)}
                        data-testid="btn-toggle-analog"
                      >
                        {showAnalog ? 'DIGITAL' : 'ANALOG'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  AnalogClockFace — pure SVG analog clock with hour/minute/second hands.
          //  Used by ClockWidget when widget.clockShowAnalog is true. The second
          //  hand uses sub-second precision so that ClockWidget's rAF tick produces
          //  smooth, sweeping motion.
          // ─────────────────────────────────────────────────────────────────────────────
          interface AnalogClockFaceProps {
            date: Date;
            size: number;
            primary: string;
            secondary: string;
            accent: string;
            ticks: string;
          }

          const AnalogClockFace: React.FC<AnalogClockFaceProps> = ({
            date, size, primary, secondary, accent, ticks,
          }) => {
            const ms       = date.getMilliseconds();
            const seconds  = date.getSeconds() + ms / 1000;
            const minutes  = date.getMinutes() + seconds / 60;
            const hours    = (date.getHours() % 12) + minutes / 60;

            const secAngle = seconds * 6;       // 360 / 60
            const minAngle = minutes * 6;
            const hrAngle  = hours * 30;        // 360 / 12

            const cx = 50, cy = 50;
            const tickEls: React.ReactElement[] = [];
            for (let i = 0; i < 60; i++) {
              const isHour = i % 5 === 0;
              const angle  = (i * 6 - 90) * (Math.PI / 180);
              const inner  = isHour ? 41 : 43.5;
              const outer  = 46;
              const x1 = cx + Math.cos(angle) * inner;
              const y1 = cy + Math.sin(angle) * inner;
              const x2 = cx + Math.cos(angle) * outer;
              const y2 = cy + Math.sin(angle) * outer;
              tickEls.push(
                <line
                  key={`tick-${i}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isHour ? primary : ticks}
                  strokeWidth={isHour ? 1.4 : 0.6}
                  strokeLinecap="round"
                />
              );
            }

            return (
              <svg
                viewBox="0 0 100 100"
                width={size}
                height={size}
                style={{ display: 'block' }}
                data-testid="clock-analog-face"
              >
                <circle cx={cx} cy={cy} r={47} fill="none" stroke={secondary} strokeOpacity={0.3} strokeWidth={0.7} />
                {tickEls}
                {/* Hour hand */}
                <line
                  x1={cx} y1={cy + 6}
                  x2={cx} y2={cy - 24}
                  stroke={primary} strokeWidth={3.4} strokeLinecap="round"
                  transform={`rotate(${hrAngle} ${cx} ${cy})`}
                />
                {/* Minute hand */}
                <line
                  x1={cx} y1={cy + 8}
                  x2={cx} y2={cy - 34}
                  stroke={primary} strokeWidth={2.2} strokeLinecap="round"
                  transform={`rotate(${minAngle} ${cx} ${cy})`}
                />
                {/* Second hand */}
                <line
                  x1={cx} y1={cy + 10}
                  x2={cx} y2={cy - 40}
                  stroke={accent} strokeWidth={1} strokeLinecap="round"
                  transform={`rotate(${secAngle} ${cx} ${cy})`}
                />
                <circle cx={cx} cy={cy} r={2.4} fill={primary} />
                <circle cx={cx} cy={cy} r={1.0} fill={accent} />
              </svg>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  WorldClocksWidget — grid of city clocks with day/night dot.
          //
          //  • Default cities: NY / London / Tokyo / Sydney; persisted as
          //    widget.worldClocksTzs (array of IANA tz IDs).
          //  • Each cell shows city name, current local time, and a small dot
          //    coloured amber for day / indigo for night based on local hour.
          //  • Settings cog opens an in-widget panel: search the WORLD_ZONES
          //    catalog and add/remove cities. Capped at 6 cities per widget.
          // ─────────────────────────────────────────────────────────────────────────────
          const WORLD_CLOCKS_MAX = 6;

          interface WorldClocksWidgetProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const WorldClocksWidget: React.FC<WorldClocksWidgetProps> = ({
            widget, onUpdate,
          }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [cw, setCw] = useState(320);
            const [ch, setCh] = useState(220);
            const [now, setNow] = useState<Date>(() => new Date());
            const [showSettings, setShowSettings] = useState(false);
            const [search, setSearch] = useState('');
            const [isHovered, setIsHovered] = useState(false);

            const bgColor = widget.customColor ?? '#0f172a';
            const light   = isLightBg(bgColor);
            const clrPrimary   = light ? '#0f172a' : '#f1f5f9';
            const clrSubtle    = light ? '#475569' : '#94a3b8';
            const clrBorder    = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
            const clrCellBg    = light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
            const clrInputBg   = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
            const clrInputBdr  = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)';

            const tzs = (widget.worldClocksTzs && widget.worldClocksTzs.length > 0)
              ? widget.worldClocksTzs
              : DEFAULT_WORLD_CLOCK_TZS;

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                const r = entries[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              setCw(el.offsetWidth);
              setCh(el.offsetHeight);
              return () => ro.disconnect();
            }, []);

            useEffect(() => {
              const id = setInterval(() => setNow(new Date()), 1_000);
              return () => clearInterval(id);
            }, []);

            // Memoize one formatter per (tz × use24h) — rebuilding these on every
            // tick at max-cities is otherwise the dominant cost in this widget.
            const use24 = widget.clockUse24Hour ?? false;
            const timeFormatters = useMemo(() => {
              const m = new Map<string, Intl.DateTimeFormat>();
              for (const tz of tzs) {
                try {
                  m.set(tz, new Intl.DateTimeFormat([], {
                    hour: '2-digit', minute: '2-digit', hour12: !use24, timeZone: tz,
                  }));
                } catch { /* invalid tz — fmtCellTime will return em-dash */ }
              }
              return m;
            }, [tzs, use24]);

            const dateFormatters = useMemo(() => {
              const m = new Map<string, Intl.DateTimeFormat>();
              for (const tz of tzs) {
                try {
                  m.set(tz, new Intl.DateTimeFormat([], {
                    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
                  }));
                } catch { /* invalid tz — fmtCellDate will return '' */ }
              }
              return m;
            }, [tzs]);

            const fmtCellTime = (tz: string) => {
              const f = timeFormatters.get(tz);
              return f ? f.format(now) : '—';
            };

            const fmtCellDate = (tz: string) => {
              const f = dateFormatters.get(tz);
              return f ? f.format(now) : '';
            };

            const addTz = (tz: string) => {
              if (tzs.includes(tz)) return;
              if (tzs.length >= WORLD_CLOCKS_MAX) return;
              onUpdate?.(widget.id, { worldClocksTzs: [...tzs, tz] });
            };

            const removeTz = (tz: string) => {
              const next = tzs.filter(t => t !== tz);
              onUpdate?.(widget.id, { worldClocksTzs: next });
            };

            // Responsive layout — choose 1/2/3 columns based on width.
            const cols = cw < 240 ? 1 : cw < 400 ? 2 : 3;
            const cellGap = 8;
            const headerH = 28;
            const cellPadV = 8, cellPadH = 10;
            const cityFont = Math.max(10, Math.min(cw / cols * 0.085, 14));
            const timeFont = Math.max(16, Math.min(cw / cols * 0.18, 28));
            const dateFont = Math.max(8,  Math.min(cw / cols * 0.06, 11));

            const filtered = WORLD_ZONES.filter(z => {
              const q = search.trim().toLowerCase();
              if (!q) return true;
              return z.city.toLowerCase().includes(q) || z.tz.toLowerCase().includes(q);
            });

            return (
              <div
                ref={containerRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                  width: '100%', height: '100%',
                  background: bgColor,
                  border: `1px solid ${clrBorder}`,
                  borderRadius: '0.5rem',
                  position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  padding: '10px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  userSelect: 'none',
                }}
                data-testid={`world-clocks-widget-${widget.id}`}
              >
                {/* Header — title + settings cog */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  height: `${headerH}px`, flexShrink: 0,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: clrSubtle, fontFamily: MONO, fontSize: '11px',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    <Globe size={12} strokeWidth={2.4} />
                    World Clocks
                  </div>
                  {onUpdate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="Configure world clocks"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: clrSubtle, padding: '4px',
                        opacity: isHovered || showSettings ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                      }}
                      data-testid={`btn-world-clocks-settings-${widget.id}`}
                    >
                      <SettingsIcon size={14} strokeWidth={2.2} />
                    </button>
                  )}
                </div>

                {/* Cells grid */}
                <div style={{
                  flex: 1, minHeight: 0,
                  marginTop: '8px',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap: `${cellGap}px`,
                  alignContent: 'start',
                  overflowY: 'auto',
                }}>
                  {tzs.map(tz => {
                    const day  = isDaytimeIn(tz, now);
                    const city = TZ_TO_CITY[tz] ?? tz.split('/').slice(-1)[0]?.replace(/_/g, ' ') ?? tz;
                    return (
                      <div
                        key={tz}
                        style={{
                          background: clrCellBg,
                          border: `1px solid ${clrBorder}`,
                          borderRadius: '8px',
                          padding: `${cellPadV}px ${cellPadH}px`,
                          display: 'flex', flexDirection: 'column', gap: '2px',
                          position: 'relative',
                        }}
                        data-testid={`world-clock-cell-${tz}`}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '6px',
                        }}>
                          <span style={{
                            fontFamily: MONO, fontSize: `${cityFont}px`, fontWeight: 600,
                            color: clrPrimary, letterSpacing: '0.02em',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{city}</span>
                          <span
                            title={day ? 'Daytime' : 'Night'}
                            style={{
                              flexShrink: 0,
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: day ? '#fbbf24' : '#6366f1',
                              boxShadow: day
                                ? '0 0 6px rgba(251,191,36,0.6)'
                                : '0 0 6px rgba(99,102,241,0.6)',
                            }}
                            data-testid={`day-night-${tz}-${day ? 'day' : 'night'}`}
                          />
                        </div>
                        <div style={{
                          fontFamily: MONO, fontSize: `${timeFont}px`, fontWeight: 700,
                          color: clrPrimary, letterSpacing: '-0.02em', lineHeight: 1.05,
                        }}>{fmtCellTime(tz)}</div>
                        <div style={{
                          fontFamily: MONO, fontSize: `${dateFont}px`, color: clrSubtle,
                          letterSpacing: '0.02em',
                        }}>{fmtCellDate(tz)}</div>
                      </div>
                    );
                  })}
                  {tzs.length === 0 && (
                    <div style={{
                      gridColumn: `1 / span ${cols}`,
                      textAlign: 'center', color: clrSubtle,
                      fontFamily: MONO, fontSize: '11px', padding: '20px',
                    }}>
                      No cities — open settings to add some.
                    </div>
                  )}
                </div>

                {/* Settings panel */}
                {showSettings && onUpdate && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', inset: '0',
                      background: light ? 'rgba(248,250,252,0.97)' : 'rgba(15,23,42,0.97)',
                      backdropFilter: 'blur(6px)',
                      borderRadius: '0.5rem',
                      padding: '12px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      zIndex: 5,
                    }}
                    data-testid={`world-clocks-settings-panel-${widget.id}`}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{
                        fontFamily: MONO, fontSize: '12px', fontWeight: 700,
                        color: clrPrimary, textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        Cities ({tzs.length}/{WORLD_CLOCKS_MAX})
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        style={{
                          background: 'transparent', border: 'none', color: clrSubtle,
                          cursor: 'pointer', padding: '4px',
                        }}
                        data-testid={`btn-close-world-clocks-settings-${widget.id}`}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Active cities — chips with remove */}
                    {tzs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {tzs.map(tz => (
                          <span key={tz} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: clrInputBg, border: `1px solid ${clrInputBdr}`,
                            borderRadius: '999px', padding: '2px 8px',
                            fontFamily: MONO, fontSize: '10px', color: clrPrimary,
                          }}>
                            {TZ_TO_CITY[tz] ?? tz}
                            <button
                              onClick={() => removeTz(tz)}
                              style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: clrSubtle, padding: 0, lineHeight: 1,
                              }}
                              data-testid={`btn-remove-tz-${tz}`}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search city…"
                      style={{
                        background: clrInputBg, border: `1px solid ${clrInputBdr}`,
                        borderRadius: '6px', padding: '6px 8px', outline: 'none',
                        color: clrPrimary, fontFamily: MONO, fontSize: '12px',
                      }}
                      data-testid={`input-world-clocks-search-${widget.id}`}
                    />

                    <div style={{
                      flex: 1, minHeight: 0, overflowY: 'auto',
                      border: `1px solid ${clrBorder}`, borderRadius: '6px',
                    }}>
                      {filtered.map(z => {
                        const active = tzs.includes(z.tz);
                        const full   = tzs.length >= WORLD_CLOCKS_MAX;
                        return (
                          <button
                            key={z.tz}
                            onClick={() => active ? removeTz(z.tz) : addTz(z.tz)}
                            disabled={!active && full}
                            style={{
                              width: '100%', textAlign: 'left',
                              background: active ? (light ? 'rgba(2,132,199,0.10)' : 'rgba(56,189,248,0.10)') : 'transparent',
                              border: 'none', cursor: !active && full ? 'not-allowed' : 'pointer',
                              padding: '6px 10px',
                              fontFamily: MONO, fontSize: '11px',
                              color: !active && full ? clrSubtle : clrPrimary,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              opacity: !active && full ? 0.5 : 1,
                            }}
                            data-testid={`btn-toggle-tz-${z.tz}`}
                          >
                            <span>{z.city}</span>
                            <span style={{ color: clrSubtle, fontSize: '10px' }}>
                              {active ? '✓' : '+'}
                            </span>
                          </button>
                        );
                      })}
                      {filtered.length === 0 && (
                        <div style={{
                          padding: '12px', textAlign: 'center', color: clrSubtle,
                          fontFamily: MONO, fontSize: '11px',
                        }}>
                          No matches.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  CountdownWidget — counts down to a user-set target moment.
          //
          //  • Defaults to "Launch Day" / 🚀 / 7 days from first render.
          //  • Live D / H / M / S display, ticking once a second.
          //  • Once the target passes, shows a celebratory "Reached!" state.
          //  • Settings panel (cog): label, emoji (preset palette + custom),
          //    target datetime via the native datetime-local input.
          // ─────────────────────────────────────────────────────────────────────────────
          interface CountdownWidgetProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          const COUNTDOWN_EMOJI_PRESETS = ['🚀', '🎉', '🎂', '🎄', '✈️', '💍', '🏆', '⏰'];

          // Convert ISO -> "YYYY-MM-DDTHH:mm" string for <input type="datetime-local">.
          // Returns '' if iso is missing or unparseable.
          function isoToLocalInputValue(iso: string | undefined): string {
            if (!iso) return '';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '';
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          }

          export const CountdownWidget: React.FC<CountdownWidgetProps> = ({
            widget, onUpdate,
          }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [cw, setCw] = useState(280);
            const [ch, setCh] = useState(180);
            const [now, setNow] = useState<Date>(() => new Date());
            const [showSettings, setShowSettings] = useState(false);
            const [isHovered, setIsHovered] = useState(false);

            const bgColor = widget.customColor ?? '#0f172a';
            const light   = isLightBg(bgColor);
            const clrPrimary  = light ? '#0f172a' : '#f1f5f9';
            const clrSubtle   = light ? '#475569' : '#94a3b8';
            const clrBorder   = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
            const clrAccent   = light ? '#0284c7' : '#38bdf8';
            const clrInputBg  = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
            const clrInputBdr = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)';

            // First-mount default — if the widget has no target set we initialise
            // it to "1 week from now" via a one-shot onUpdate. We only do this
            // when onUpdate is available; otherwise the widget renders the
            // target derived in-memory below.
            const fallbackTargetRef = useRef<string>(
              widget.countdownTarget ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            );
            useEffect(() => {
              if (!widget.countdownTarget && onUpdate) {
                onUpdate(widget.id, {
                  countdownTarget: fallbackTargetRef.current,
                  countdownLabel:  widget.countdownLabel ?? 'Launch Day',
                  countdownEmoji:  widget.countdownEmoji ?? '🚀',
                });
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);

            const targetIso  = widget.countdownTarget ?? fallbackTargetRef.current;
            const target     = useMemo(() => {
              const d = new Date(targetIso);
              if (isNaN(d.getTime())) {
                const fb = new Date(fallbackTargetRef.current);
                return isNaN(fb.getTime())
                  ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  : fb;
              }
              return d;
            }, [targetIso]);
            const label      = widget.countdownLabel ?? 'Launch Day';
            const emoji      = widget.countdownEmoji ?? '🚀';

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                const r = entries[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              setCw(el.offsetWidth);
              setCh(el.offsetHeight);
              return () => ro.disconnect();
            }, []);

            useEffect(() => {
              const id = setInterval(() => setNow(new Date()), 1_000);
              return () => clearInterval(id);
            }, []);

            const diffMs = target.getTime() - now.getTime();
            const reached = diffMs <= 0;

            const totalSec = Math.max(0, Math.floor(diffMs / 1000));
            const days     = Math.floor(totalSec / 86400);
            const hours    = Math.floor((totalSec % 86400) / 3600);
            const mins     = Math.floor((totalSec % 3600) / 60);
            const secs     = totalSec % 60;

            const s = Math.min(cw, ch);
            const labelFont = Math.max(11, Math.min(s * 0.10, cw * 0.08, 22));
            const emojiFont = Math.max(22, Math.min(s * 0.34, ch * 0.42, 80));
            const numFont   = Math.max(18, Math.min(s * 0.22, cw * 0.13, 44));
            const unitFont  = Math.max(8,  Math.min(s * 0.07, 12));

            const cells: { label: string; value: number }[] = [
              { label: 'D', value: days  },
              { label: 'H', value: hours },
              { label: 'M', value: mins  },
              { label: 'S', value: secs  },
            ];

            return (
              <div
                ref={containerRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                  width: '100%', height: '100%',
                  background: bgColor,
                  border: `1px solid ${clrBorder}`,
                  borderRadius: '0.5rem',
                  position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  padding: '12px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  userSelect: 'none',
                }}
                data-testid={`countdown-widget-${widget.id}`}
              >
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: clrSubtle, fontFamily: MONO, fontSize: '11px',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    <Hourglass size={12} strokeWidth={2.4} />
                    Countdown
                  </div>
                  {onUpdate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="Configure countdown"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: clrSubtle, padding: '4px',
                        opacity: isHovered || showSettings ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                      }}
                      data-testid={`btn-countdown-settings-${widget.id}`}
                    >
                      <SettingsIcon size={14} strokeWidth={2.2} />
                    </button>
                  )}
                </div>

                {/* Body */}
                <div style={{
                  flex: 1, minHeight: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '6px', textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: `${emojiFont}px`, lineHeight: 1,
                  }}>{emoji}</div>
                  <div style={{
                    fontFamily: MONO, fontSize: `${labelFont}px`, fontWeight: 700,
                    color: clrPrimary, letterSpacing: '0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }} data-testid={`countdown-label-${widget.id}`}>
                    {label}
                  </div>

                  {reached ? (
                    <div style={{
                      fontFamily: MONO, fontSize: `${numFont}px`, fontWeight: 800,
                      color: clrAccent, letterSpacing: '0.04em',
                      animation: 'reachedPulse 1.6s ease-in-out infinite',
                    }} data-testid={`countdown-reached-${widget.id}`}>
                      Reached!
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
                    }} data-testid={`countdown-readout-${widget.id}`}>
                      {cells.map(c => (
                        <div key={c.label} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          minWidth: `${numFont * 1.4}px`,
                        }}>
                          <span style={{
                            fontFamily: MONO, fontSize: `${numFont}px`, fontWeight: 700,
                            color: clrPrimary, lineHeight: 1, letterSpacing: '-0.02em',
                          }}>{pad2(c.value)}</span>
                          <span style={{
                            fontFamily: MONO, fontSize: `${unitFont}px`, color: clrSubtle,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                          }}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <style>{`@keyframes reachedPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }`}</style>

                {/* Settings panel */}
                {showSettings && onUpdate && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', inset: '0',
                      background: light ? 'rgba(248,250,252,0.97)' : 'rgba(15,23,42,0.97)',
                      backdropFilter: 'blur(6px)',
                      borderRadius: '0.5rem',
                      padding: '12px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      zIndex: 5,
                    }}
                    data-testid={`countdown-settings-panel-${widget.id}`}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{
                        fontFamily: MONO, fontSize: '12px', fontWeight: 700,
                        color: clrPrimary, textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        Countdown
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        style={{
                          background: 'transparent', border: 'none', color: clrSubtle,
                          cursor: 'pointer', padding: '4px',
                        }}
                        data-testid={`btn-close-countdown-settings-${widget.id}`}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Label */}
                    <label style={{
                      fontFamily: MONO, fontSize: '10px', color: clrSubtle,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>Label</label>
                    <input
                      type="text"
                      value={label}
                      maxLength={40}
                      onChange={(e) => onUpdate(widget.id, { countdownLabel: e.target.value })}
                      style={{
                        background: clrInputBg, border: `1px solid ${clrInputBdr}`,
                        borderRadius: '6px', padding: '6px 8px', outline: 'none',
                        color: clrPrimary, fontFamily: MONO, fontSize: '12px',
                      }}
                      data-testid={`input-countdown-label-${widget.id}`}
                    />

                    {/* Target */}
                    <label style={{
                      fontFamily: MONO, fontSize: '10px', color: clrSubtle,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>Target</label>
                    <input
                      type="datetime-local"
                      value={isoToLocalInputValue(targetIso)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const d = new Date(v);
                        if (Number.isNaN(d.getTime())) return;
                        onUpdate(widget.id, { countdownTarget: d.toISOString() });
                      }}
                      style={{
                        background: clrInputBg, border: `1px solid ${clrInputBdr}`,
                        borderRadius: '6px', padding: '6px 8px', outline: 'none',
                        color: clrPrimary, fontFamily: MONO, fontSize: '12px',
                        colorScheme: light ? 'light' : 'dark',
                      }}
                      data-testid={`input-countdown-target-${widget.id}`}
                    />

                    {/* Emoji presets */}
                    <label style={{
                      fontFamily: MONO, fontSize: '10px', color: clrSubtle,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>Emoji</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {COUNTDOWN_EMOJI_PRESETS.map(em => (
                        <button
                          key={em}
                          onClick={() => onUpdate(widget.id, { countdownEmoji: em })}
                          style={{
                            background: em === emoji ? (light ? 'rgba(2,132,199,0.15)' : 'rgba(56,189,248,0.15)') : clrInputBg,
                            border: `1px solid ${em === emoji ? clrAccent : clrInputBdr}`,
                            borderRadius: '6px', padding: '4px 8px',
                            fontSize: '16px', cursor: 'pointer', lineHeight: 1,
                          }}
                          data-testid={`btn-countdown-emoji-${em}`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  CrisisTickerWidget — vertically scrolling breaking-news feed
          //
          //  • Glassmorphism background with backdrop-blur.
          //  • Blinking red "LIVE INTEL" badge in the header.
          //  • Headlines containing 'Crisis' or 'Alert' render in red; others in slate-100.
          //  • Pause-on-hover: animation-play-state paused when mouse is over widget.
          //  • Smooth infinite scroll; resets seamlessly.
          //  • All font sizes and icon sizes scale with container dimensions.
          // ─────────────────────────────────────────────────────────────────────────────

          const FALLBACK_HEADLINES: Headline[] = [
            { id: 1,  text: 'BREAKING: Major earthquake strikes Pacific Rim \u2014 tsunami Alert issued for coastal regions' },
            { id: 2,  text: 'Markets surge 3% on surprise Fed rate hold; tech sector leads gains' },
            { id: 3,  text: 'Crisis declared in southern provinces as flooding displaces 40,000 residents' },
            { id: 4,  text: 'International summit agrees on new climate finance framework' },
            { id: 5,  text: 'Cyber Alert: Critical zero-day vulnerability found in widely-used enterprise software' },
            { id: 6,  text: 'Space agency confirms successful orbital rendezvous \u2014 crew safe aboard station' },
          ];

          interface Headline {
            id: number;
            text: string;
            url?: string;
            source?: string;
          }

          const isBreakingHeadline = (text: string) =>
            /\b(breaking|alert|urgent|emergency)\b/i.test(text);

          const isCrisisHeadline = (text: string) =>
            /crisis|alert|breaking|urgent|emergency/i.test(text);

          // Maps the widget's category preset to the NewsAPI `category` value the
          // server forwards. 'world' and 'all' both fall through to no category.
          const CRISIS_CATEGORIES: { value: string; label: string }[] = [
            { value: 'all',     label: 'All'     },
            { value: 'tech',    label: 'Tech'    },
            { value: 'markets', label: 'Markets' },
            { value: 'world',   label: 'World'   },
            { value: 'sports',  label: 'Sports'  },
          ];

          // Curated NewsAPI source IDs the per-widget filter exposes. Empty string
          // (default) means "All sources" and forwards no `sources` param.
          const CRISIS_SOURCES: { value: string; label: string }[] = [
            { value: '',                   label: 'All sources'        },
            { value: 'bbc-news',           label: 'BBC'                },
            { value: 'reuters',            label: 'Reuters'            },
            { value: 'associated-press',   label: 'AP'                 },
            { value: 'cnn',                label: 'CNN'                },
            { value: 'al-jazeera-english', label: 'Al Jazeera'         },
            { value: 'the-wall-street-journal', label: 'WSJ'           },
            { value: 'bloomberg',          label: 'Bloomberg'          },
          ];

          // World maps to a curated bundle of international newswire sources
          // rather than a NewsAPI category, since NewsAPI has no "world" bucket.
          // This keeps the preset functionally distinct from "All".
          const CRISIS_WORLD_SOURCES = 'bbc-news,reuters,associated-press,al-jazeera-english';

          interface CrisisQuery {
            sources?: string;
            category?: string;
          }

          function mapCrisisCategoryToApi(category: string | undefined): CrisisQuery {
            switch (category) {
              case 'tech':    return { category: 'technology' };
              case 'markets': return { category: 'business'   };
              case 'sports':  return { category: 'sports'     };
              case 'world':   return { sources:  CRISIS_WORLD_SOURCES };
              case 'all':     return {};
              default:        return {};
            }
          }

          interface CrisisTickerWidgetProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const CrisisTickerWidget: React.FC<CrisisTickerWidgetProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const scrollRef    = useRef<HTMLDivElement>(null);
            const [cw, setCw]  = useState(320);
            const [ch, setCh]  = useState(200);
            const [blink, setBlink] = useState(true);
            const [hovered, setHovered] = useState(false);
            const [settingsOpen, setSettingsOpen] = useState(false);
            const [liveHeadlines, setLiveHeadlines] = useState<Headline[] | null>(null);
            const [newsError, setNewsError] = useState(false);

            const sources  = widget.crisisSources  ?? '';
            const category = widget.crisisCategory ?? 'all';

            // Re-fetch whenever the per-widget filter knobs change. Sources wins
            // over category server-side (NewsAPI rule).
            useEffect(() => {
              let mounted = true;
              const fetchNews = async () => {
                try {
                  const params = new URLSearchParams();
                  if (sources) {
                    // Explicit per-widget source override always wins.
                    params.set('sources', sources);
                  } else {
                    // Otherwise resolve the category preset, which may itself
                    // produce either a category or a curated source bundle
                    // (e.g. 'world' -> international newswires).
                    const q = mapCrisisCategoryToApi(category);
                    if (q.sources)  params.set('sources',  q.sources);
                    if (q.category) params.set('category', q.category);
                  }
                  const qs = params.toString();
                  const resp = await fetch(qs ? `/api/news?${qs}` : '/api/news');
                  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                  const data = await resp.json();
                  if (mounted && data.articles?.length > 0) {
                    setLiveHeadlines(data.articles);
                    setNewsError(false);
                  } else if (mounted) {
                    // Empty result for this filter — surface as fallback rather
                    // than silently keeping the previous unrelated batch.
                    setLiveHeadlines([]);
                    setNewsError(false);
                  }
                } catch (err) {
                  console.warn('[CrisisTickerWidget] News fetch failed, using fallback:', err);
                  if (mounted) setNewsError(true);
                }
              };
              fetchNews();
              const interval = setInterval(fetchNews, 10 * 60 * 1000);
              return () => { mounted = false; clearInterval(interval); };
            }, [sources, category]);

            const CRISIS_HEADLINES: Headline[] =
              liveHeadlines && liveHeadlines.length > 0
                ? liveHeadlines
                : (liveHeadlines && liveHeadlines.length === 0 && !newsError
                    ? [{ id: 0, text: 'No headlines for this filter — try a different source or category.' }]
                    : FALLBACK_HEADLINES);

            // ── ResizeObserver ────────────────────────────────────────────────────────
            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                const r = entries[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              setCw(el.offsetWidth);
              setCh(el.offsetHeight);
              return () => ro.disconnect();
            }, []);

            // ── Blinking LIVE dot ─────────────────────────────────────────────────────
            useEffect(() => {
              const id = setInterval(() => setBlink(b => !b), 700);
              return () => clearInterval(id);
            }, []);

            // ── Infinite scroll animation via CSS animation ───────────────────────────
            // We render the list twice so the animation loops seamlessly.
            const s = Math.min(cw, ch);

            const headerH   = Math.max(26, s * 0.13);
            const rowH      = Math.max(32, s * 0.16);
            const fontSize  = Math.max(11, Math.min(s * 0.08, cw * 0.044));
            const badgeFont = Math.max(9,  s * 0.06);
            const dotSize   = Math.max(7,  s * 0.05);

            // Duration scales with number of items & row height so it looks consistent
            const scrollDuration = CRISIS_HEADLINES.length * Math.max(2.5, rowH * 0.08);

            const headlines = [...CRISIS_HEADLINES, ...CRISIS_HEADLINES]; // doubled for seamless loop

            return (
              <div
                ref={containerRef}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 100%)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                  position: 'relative',
                }}
                data-testid={`crisis-ticker-widget-${widget.id}`}
              >
                {/* ── Header ─────────────────────────────────────────────────────────── */}
                <div style={{
                  height:          `${headerH}px`,
                  minHeight:       `${headerH}px`,
                  flexShrink:      0,
                  display:         'flex',
                  alignItems:      'center',
                  gap:             `${Math.max(6, s * 0.03)}px`,
                  padding:         `0 ${Math.max(8, s * 0.045)}px`,
                  borderBottom:    '1px solid rgba(30,41,59,0.6)',
                  backgroundColor: 'rgba(10,15,26,0.7)',
                }}>
                  {/* Blinking red dot */}
                  <span style={{
                    width:           `${dotSize}px`,
                    height:          `${dotSize}px`,
                    borderRadius:    '50%',
                    backgroundColor: blink ? '#ef4444' : 'transparent',
                    border:          '2px solid #ef4444',
                    display:         'inline-block',
                    flexShrink:      0,
                    transition:      'background-color 0.15s ease',
                    boxShadow:       blink ? '0 0 6px 2px rgba(239,68,68,0.6)' : 'none',
                  }} />
                  <span style={{
                    fontFamily:    MONO,
                    fontWeight:    700,
                    fontSize:      `${badgeFont}px`,
                    color:         '#ef4444',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight:    1,
                  }}>
                    Live Intel
                  </span>
                  <span style={{
                    marginLeft:    'auto',
                    fontFamily:    MONO,
                    fontSize:      `${Math.max(8, s * 0.048)}px`,
                    color:         newsError ? '#f59e0b' : '#334155',
                    letterSpacing: '0.05em',
                  }}>
                    {newsError ? 'Fallback Mode' : (liveHeadlines ? 'LIVE' : new Date().toUTCString().slice(0, 16) + ' UTC')}
                  </span>
                  {/* Settings cog — only when an updater is wired through. */}
                  {onUpdate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSettingsOpen(o => !o); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="Filter sources & category"
                      data-testid={`crisis-settings-${widget.id}`}
                      style={{
                        marginLeft: `${Math.max(4, s * 0.02)}px`,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: settingsOpen ? '#f87171' : '#64748b',
                        padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}
                    >
                      <SettingsIcon size={Math.max(11, s * 0.055)} />
                    </button>
                  )}
                </div>

                {/* ── Settings panel (anchored under header) ──────────────────────── */}
                {onUpdate && settingsOpen && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: `${headerH + 4}px`, right: '6px',
                      zIndex: 5, minWidth: '180px',
                      background: 'rgba(10,15,26,0.97)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      fontFamily: MONO,
                    }}
                    data-testid={`crisis-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Source
                      </label>
                      <select
                        value={sources}
                        onChange={(e) => onUpdate?.(widget.id, { crisisSources: e.target.value })}
                        style={{
                          background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(148,163,184,0.2)',
                          color: '#e2e8f0', borderRadius: '6px', padding: '6px 8px',
                          fontSize: '12px', fontFamily: MONO, outline: 'none', cursor: 'pointer',
                        }}
                        data-testid={`crisis-source-select-${widget.id}`}
                      >
                        {CRISIS_SOURCES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>

                      <label style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Category
                      </label>
                      <select
                        value={category}
                        disabled={!!sources}
                        onChange={(e) => onUpdate?.(widget.id, { crisisCategory: e.target.value })}
                        style={{
                          background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(148,163,184,0.2)',
                          color: sources ? '#475569' : '#e2e8f0', borderRadius: '6px', padding: '6px 8px',
                          fontSize: '12px', fontFamily: MONO, outline: 'none',
                          cursor: sources ? 'not-allowed' : 'pointer',
                        }}
                        data-testid={`crisis-category-select-${widget.id}`}
                      >
                        {CRISIS_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      {sources && (
                        <span style={{ fontSize: '9px', color: '#64748b', lineHeight: 1.3 }}>
                          Category disabled while a source is selected.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Scrolling feed ──────────────────────────────────────────────────── */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  {/* Top fade */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: `${Math.max(16, rowH * 0.5)}px`,
                    background: 'linear-gradient(to bottom, rgba(15,23,42,0.95), transparent)',
                    zIndex: 2, pointerEvents: 'none',
                  }} />
                  {/* Bottom fade */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${Math.max(16, rowH * 0.5)}px`,
                    background: 'linear-gradient(to top, rgba(15,23,42,0.95), transparent)',
                    zIndex: 2, pointerEvents: 'none',
                  }} />

                  {/* Smoother-hover indicator overlay — fades in when the widget
                      is hovered so the pause feels intentional rather than
                      abrupt. The actual scroll-pause still fires immediately. */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(248,113,113,0.06) 0%, rgba(248,113,113,0.02) 100%)',
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 250ms ease',
                    zIndex: 1, pointerEvents: 'none',
                  }} />

                  <style>{`
                    @keyframes crisis-scroll-${widget.id} {
                      0%   { transform: translateY(0); }
                      100% { transform: translateY(-50%); }
                    }
                    .crisis-row-${widget.id} {
                      transition: background-color 220ms ease, color 220ms ease;
                    }
                    .crisis-row-${widget.id}:hover {
                      background-color: rgba(148, 163, 184, 0.06);
                    }
                  `}</style>

                  <div
                    ref={scrollRef}
                    style={{
                      animationName:           `crisis-scroll-${widget.id}`,
                      animationDuration:       `${scrollDuration}s`,
                      animationTimingFunction: 'linear',
                      animationIterationCount: 'infinite' as any,
                      animationPlayState:      hovered ? 'paused' : 'running',
                      willChange:              'transform',
                    }}
                  >
                    {headlines.map((h, idx) => {
                      const breaking = isBreakingHeadline(h.text);
                      const accent   = isCrisisHeadline(h.text) ? '#ef4444' : '#1e40af';
                      const rowStyle: React.CSSProperties = {
                        height:         `${rowH}px`,
                        display:        'flex',
                        alignItems:     'center',
                        padding:        `0 ${Math.max(8, s * 0.045)}px`,
                        borderBottom:   '1px solid rgba(30,41,59,0.5)',
                        gap:            `${Math.max(6, s * 0.03)}px`,
                        textDecoration: 'none',
                        color:          'inherit',
                        cursor:         h.url ? 'pointer' : 'default',
                      };
                      const rowClass   = `crisis-row-${widget.id}`;
                      const rowTestId  = `crisis-headline-${widget.id}-${idx % CRISIS_HEADLINES.length}`;
                      const rowChildren = (
                        <>
                          {/* Accent bar */}
                          <span style={{
                            width:           '2px',
                            height:          `${Math.max(12, rowH * 0.45)}px`,
                            borderRadius:    '1px',
                            backgroundColor: accent,
                            flexShrink:      0,
                          }} />
                          {breaking && (
                            <span style={{
                              flexShrink: 0,
                              fontFamily: MONO, fontWeight: 800,
                              fontSize: `${Math.max(7, s * 0.04)}px`,
                              color: '#fff',
                              backgroundColor: '#dc2626',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              lineHeight: 1,
                            }}>
                              Breaking
                            </span>
                          )}
                          <span style={{
                            fontFamily:   MONO,
                            fontSize:     `${fontSize}px`,
                            fontWeight:   isCrisisHeadline(h.text) ? 600 : 400,
                            color:        isCrisisHeadline(h.text) ? '#fca5a5' : '#cbd5e1',
                            lineHeight:   1.35,
                            overflow:     'hidden',
                            whiteSpace:   'nowrap',
                            textOverflow: 'ellipsis',
                            letterSpacing: '0.01em',
                            flex: 1, minWidth: 0,
                          }}>
                            {h.text}
                          </span>
                          {h.url && (
                            <ExternalLink
                              size={Math.max(10, s * 0.045)}
                              color="#475569"
                              style={{ flexShrink: 0 }}
                            />
                          )}
                        </>
                      );

                      // Branch on link presence so each branch keeps the
                      // intrinsic-element prop typing intact (no `any` casts).
                      return h.url ? (
                        <a
                          key={`${h.id}-${idx}`}
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={rowClass}
                          style={rowStyle}
                          data-testid={rowTestId}
                        >
                          {rowChildren}
                        </a>
                      ) : (
                        <div
                          key={`${h.id}-${idx}`}
                          className={rowClass}
                          style={rowStyle}
                          data-testid={rowTestId}
                        >
                          {rowChildren}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  MarketsTickerWidget — at-a-glance prices for crypto + equities.
          //
          //  • Polls /api/markets every 60s for the symbols stored on the widget.
          //  • Renders one row per symbol: name, price, 24h delta (green / red),
          //    inline sparkline SVG.
          //  • Settings cog opens an in-widget panel for add / remove / reorder.
          //  • Per-symbol upstream errors render a muted "—" instead of breaking
          //    the whole widget.
          // ─────────────────────────────────────────────────────────────────────────────

          interface MarketEntry {
            symbol: string;
            name: string;
            type: 'crypto' | 'stock';
            price: number | null;
            change24hPct: number | null;
            sparkline: number[];
            updatedAt: number;
            error?: string;
          }

          const DEFAULT_MARKETS_SYMBOLS = ['BTC', 'ETH', 'SPY', 'AAPL'];
          // Pure validation/dedupe/cap/reorder helpers live in
          // `client/src/lib/markets-symbols.ts` so they can be unit tested
          // without a DOM. Keep `MAX_SYMBOLS` and `SYMBOL_RE` aligned with
          // the server-side `parseSymbols` regex.

          function formatPrice(price: number | null): string {
            if (price == null || !Number.isFinite(price)) return '—';
            if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
            if (price >= 1)    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
            return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
          }

          function formatPct(pct: number | null): string {
            if (pct == null || !Number.isFinite(pct)) return '—';
            const sign = pct >= 0 ? '+' : '';
            return `${sign}${pct.toFixed(2)}%`;
          }

          interface SparklineProps {
            data: number[];
            width: number;
            height: number;
            stroke: string;
          }

          const Sparkline: React.FC<SparklineProps> = ({ data, width, height, stroke }) => {
            if (!data || data.length < 2) {
              return (
                <svg width={width} height={height} aria-hidden>
                  <line x1={0} y1={height / 2} x2={width} y2={height / 2}
                        stroke="#475569" strokeWidth={1} strokeDasharray="2,2" />
                </svg>
              );
            }
            const min = Math.min(...data);
            const max = Math.max(...data);
            const range = max - min || 1;
            const step = data.length > 1 ? width / (data.length - 1) : width;
            const path = data
              .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
              .join(' ');
            return (
              <svg width={width} height={height} aria-hidden>
                <path d={path} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            );
          };

          interface MarketsTickerWidgetProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const MarketsTickerWidget: React.FC<MarketsTickerWidgetProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [cw, setCw] = useState(320);
            const [ch, setCh] = useState(220);
            const [entries, setEntries] = useState<MarketEntry[] | null>(null);
            const [error, setError] = useState(false);
            const [settingsOpen, setSettingsOpen] = useState(false);
            const [newSymbol, setNewSymbol] = useState('');

            const symbols = (widget.marketsSymbols && widget.marketsSymbols.length > 0)
              ? widget.marketsSymbols
              : DEFAULT_MARKETS_SYMBOLS;
            const symbolsKey = symbols.join(',');

            // ── ResizeObserver
            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver(es => {
                const r = es[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              setCw(el.offsetWidth); setCh(el.offsetHeight);
              return () => ro.disconnect();
            }, []);

            // ── Poll /api/markets every 60s
            useEffect(() => {
              let mounted = true;
              const fetchMarkets = async () => {
                try {
                  const resp = await fetch(`/api/markets?symbols=${encodeURIComponent(symbolsKey)}`);
                  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                  const data = await resp.json();
                  if (mounted) {
                    setEntries(Array.isArray(data.symbols) ? data.symbols : []);
                    setError(false);
                  }
                } catch (err) {
                  console.warn('[MarketsTickerWidget] Fetch failed:', err);
                  if (mounted) setError(true);
                }
              };
              fetchMarkets();
              const id = setInterval(fetchMarkets, 60 * 1000);
              return () => { mounted = false; clearInterval(id); };
            }, [symbolsKey]);

            const s = Math.min(cw, ch);
            const headerH  = Math.max(26, s * 0.13);
            const rowH     = Math.max(28, s * 0.14);
            const labelFs  = Math.max(10, s * 0.05);
            const priceFs  = Math.max(11, s * 0.055);
            const badgeFs  = Math.max(9,  s * 0.06);

            const moveSymbolAt = (idx: number, dir: -1 | 1) => {
              const next = moveSymbolHelper(symbols, idx, dir);
              if (next === symbols) return;
              onUpdate?.(widget.id, { marketsSymbols: next });
            };
            const removeSymbolAt = (sym: string) => {
              const next = removeSymbolHelper(symbols, sym);
              if (next === symbols) return;
              onUpdate?.(widget.id, { marketsSymbols: next });
            };
            const addSymbol = () => {
              const result = addSymbolHelper(symbols, newSymbol);
              if (!result.ok) {
                // Duplicates clear the input (matches prior UX); other
                // rejections leave it intact so the user can edit.
                if (result.reason === 'duplicate') setNewSymbol('');
                return;
              }
              onUpdate?.(widget.id, { marketsSymbols: result.symbols });
              setNewSymbol('');
            };

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 100%)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: '0.5rem',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', boxSizing: 'border-box',
                  position: 'relative',
                }}
                data-testid={`markets-ticker-widget-${widget.id}`}
              >
                {/* ── Header ───────────────────────────────────────────── */}
                <div style={{
                  height: `${headerH}px`, minHeight: `${headerH}px`, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  gap: `${Math.max(6, s * 0.03)}px`,
                  padding: `0 ${Math.max(8, s * 0.045)}px`,
                  borderBottom: '1px solid rgba(30,41,59,0.6)',
                  backgroundColor: 'rgba(10,15,26,0.7)',
                }}>
                  <TrendingUp size={Math.max(11, s * 0.06)} color="#34d399" />
                  <span style={{
                    fontFamily: MONO, fontWeight: 700,
                    fontSize: `${badgeFs}px`,
                    color: '#34d399', letterSpacing: '0.1em',
                    textTransform: 'uppercase', lineHeight: 1,
                  }}>
                    Markets
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: MONO,
                    fontSize: `${Math.max(8, s * 0.045)}px`,
                    color: error ? '#f59e0b' : '#475569',
                    letterSpacing: '0.05em',
                  }}>
                    {error ? 'Stale' : (entries ? 'Live' : 'Loading…')}
                  </span>
                  {onUpdate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSettingsOpen(o => !o); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="Manage symbols"
                      data-testid={`markets-settings-${widget.id}`}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: settingsOpen ? '#34d399' : '#64748b',
                        padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}
                    >
                      <SettingsIcon size={Math.max(11, s * 0.055)} />
                    </button>
                  )}
                </div>

                {/* ── Settings panel ────────────────────────────────── */}
                {onUpdate && settingsOpen && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: `${headerH + 4}px`, right: '6px',
                      zIndex: 5, minWidth: '210px', maxWidth: '280px',
                      background: 'rgba(10,15,26,0.97)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      borderRadius: '8px', padding: '10px 12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      fontFamily: MONO,
                    }}
                    data-testid={`markets-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Symbols
                      </span>
                      {symbols.map((sym, i) => (
                        <div key={sym} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(30,41,59,0.7)', padding: '4px 6px',
                          borderRadius: '4px',
                        }}>
                          <span style={{ flex: 1, color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>
                            {sym}
                          </span>
                          <button
                            onClick={() => moveSymbolAt(i, -1)}
                            disabled={i === 0}
                            title="Move up"
                            data-testid={`markets-move-up-${widget.id}-${sym}`}
                            style={{
                              background: 'transparent', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer',
                              color: i === 0 ? '#334155' : '#94a3b8', padding: 0, display: 'flex',
                            }}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moveSymbolAt(i, 1)}
                            disabled={i === symbols.length - 1}
                            title="Move down"
                            data-testid={`markets-move-down-${widget.id}-${sym}`}
                            style={{
                              background: 'transparent', border: 'none', cursor: i === symbols.length - 1 ? 'not-allowed' : 'pointer',
                              color: i === symbols.length - 1 ? '#334155' : '#94a3b8', padding: 0, display: 'flex',
                            }}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            onClick={() => removeSymbolAt(sym)}
                            title="Remove"
                            data-testid={`markets-remove-${widget.id}-${sym}`}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: '#ef4444', padding: 0, display: 'flex',
                            }}
                          >
                            <XIcon size={12} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input
                          value={newSymbol}
                          onChange={(e) => setNewSymbol(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') addSymbol();
                          }}
                          placeholder="e.g. SOL, MSFT"
                          maxLength={8}
                          data-testid={`markets-new-symbol-${widget.id}`}
                          style={{
                            flex: 1, background: 'rgba(30,41,59,0.9)',
                            border: '1px solid rgba(148,163,184,0.2)',
                            color: '#e2e8f0', borderRadius: '4px',
                            padding: '4px 6px', fontSize: '12px',
                            fontFamily: MONO, outline: 'none',
                          }}
                        />
                        <button
                          onClick={addSymbol}
                          title="Add symbol"
                          data-testid={`markets-add-${widget.id}`}
                          style={{
                            background: '#34d399', border: 'none',
                            color: '#052e1c', padding: '4px 8px',
                            borderRadius: '4px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          <PlusIcon size={12} />
                        </button>
                      </div>
                      <span style={{ fontSize: '9px', color: '#64748b', lineHeight: 1.3, marginTop: '4px' }}>
                        Crypto: BTC, ETH, SOL, ADA, DOGE, BNB, XRP, MATIC, DOT, AVAX, LTC, LINK. Anything else is treated as a stock ticker.
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Symbol rows ───────────────────────────────────── */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {symbols.map((sym) => {
                    const entry = entries?.find(e => e.symbol === sym);
                    const up = entry?.change24hPct != null && entry.change24hPct >= 0;
                    const deltaColor = entry?.change24hPct == null ? '#64748b' : (up ? '#34d399' : '#f87171');
                    return (
                      <div
                        key={sym}
                        style={{
                          height: `${rowH}px`,
                          display: 'flex', alignItems: 'center',
                          padding: `0 ${Math.max(8, s * 0.045)}px`,
                          borderBottom: '1px solid rgba(30,41,59,0.5)',
                          gap: `${Math.max(4, s * 0.02)}px`,
                        }}
                        data-testid={`markets-row-${widget.id}-${sym}`}
                      >
                        <span style={{
                          fontFamily: MONO, fontWeight: 700,
                          fontSize: `${labelFs}px`,
                          color: '#e2e8f0', minWidth: `${Math.max(36, s * 0.18)}px`,
                          letterSpacing: '0.04em',
                        }}>
                          {sym}
                        </span>
                        <Sparkline
                          data={entry?.sparkline || []}
                          width={Math.max(40, cw * 0.22)}
                          height={Math.max(16, rowH * 0.6)}
                          stroke={deltaColor}
                        />
                        <span style={{
                          marginLeft: 'auto',
                          fontFamily: MONO, fontWeight: 600,
                          fontSize: `${priceFs}px`,
                          color: '#e2e8f0',
                          textAlign: 'right',
                        }}>
                          {entry?.error ? '—' : formatPrice(entry?.price ?? null)}
                        </span>
                        <span style={{
                          fontFamily: MONO, fontWeight: 600,
                          fontSize: `${labelFs}px`,
                          color: deltaColor,
                          minWidth: `${Math.max(46, s * 0.22)}px`,
                          textAlign: 'right',
                        }}>
                          {entry?.error ? '—' : formatPct(entry?.change24hPct ?? null)}
                        </span>
                      </div>
                    );
                  })}
                  {symbols.length === 0 && (
                    <div style={{
                      padding: '12px', textAlign: 'center',
                      fontFamily: MONO, fontSize: `${labelFs}px`, color: '#64748b',
                    }}>
                      No symbols. Open settings to add some.
                    </div>
                  )}
                </div>
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  WeatherWidget — mock weather display with lucide-react icons
          //
          //  • Glassmorphism background with backdrop-blur and weather-adaptive gradient.
          //  • Shows: city name, large temperature, condition label, and a scaled icon.
          //  • Mock data cycles through several conditions every 20s for demo purposes.
          //  • Enlarged city dots (12px+) always clickable; full opacity on hover.
          //  • Humidity/wind 50% larger with bold weight for high visibility.
          //  • All sizes scale proportionally with container dimensions.
          // ─────────────────────────────────────────────────────────────────────────────

          type WeatherIconType = 'sun' | 'cloud' | 'cloud-rain' | 'cloud-snow' | 'cloud-lightning' | 'wind' | 'cloud-drizzle' | 'cloudy';

          interface WeatherEntry {
            city:       string;
            tempC:      number;
            tempF:      number;
            condition:  string;
            icon:       WeatherIconType;
            humidity:   number;
            windKph:    number;
            lat?:       number | null;
            lon?:       number | null;
          }

          interface ForecastDay {
            date:      string;
            dayLabel:  string;
            tempMaxC:  number;
            tempMinC:  number;
            tempMaxF:  number;
            tempMinF:  number;
            icon:      WeatherIconType;
            condition: string;
          }

          const FALLBACK_WEATHER: Record<string, WeatherEntry> = {
            'London':    { city: 'London',    tempC: 15, tempF: 59,  condition: 'Cloudy',        icon: 'cloudy',         humidity: 74, windKph: 22 },
            'New York':  { city: 'New York',  tempC: 22, tempF: 72,  condition: 'Sunny',         icon: 'sun',            humidity: 48, windKph: 14 },
            'Tokyo':     { city: 'Tokyo',     tempC: 28, tempF: 82,  condition: 'Partly Cloudy', icon: 'cloud',          humidity: 65, windKph: 18 },
            'Sydney':    { city: 'Sydney',    tempC: 19, tempF: 66,  condition: 'Light Rain',    icon: 'cloud-drizzle',  humidity: 82, windKph: 26 },
            'Dubai':     { city: 'Dubai',     tempC: 38, tempF: 100, condition: 'Sunny',         icon: 'sun',            humidity: 28, windKph: 11 },
            'Moscow':    { city: 'Moscow',    tempC: -4, tempF: 25,  condition: 'Snow',          icon: 'cloud-snow',     humidity: 88, windKph: 31 },
            'Miami':     { city: 'Miami',     tempC: 31, tempF: 88,  condition: 'Thunderstorm',  icon: 'cloud-lightning', humidity: 91, windKph: 44 },
            'Chicago':   { city: 'Chicago',   tempC: 12, tempF: 54,  condition: 'Windy',         icon: 'wind',           humidity: 56, windKph: 52 },
            'Mumbai':    { city: 'Mumbai',    tempC: 33, tempF: 91,  condition: 'Heavy Rain',    icon: 'cloud-rain',     humidity: 95, windKph: 19 },
            'Reykjavik': { city: 'Reykjavik', tempC: 3,  tempF: 37,  condition: 'Overcast',      icon: 'cloudy',         humidity: 83, windKph: 37 },
          };

          const WeatherIcon: React.FC<{ icon: WeatherIconType; size: number; color: string }> = ({ icon, size, color }) => {
            const props = { size, color, strokeWidth: 1.8 };
            switch (icon) {
              case 'sun':             return <Sun             {...props} />;
              case 'cloud':           return <Cloud           {...props} />;
              case 'cloud-rain':      return <CloudRain       {...props} />;
              case 'cloud-snow':      return <CloudSnow       {...props} />;
              case 'cloud-lightning': return <CloudLightning  {...props} />;
              case 'wind':            return <Wind            {...props} />;
              case 'cloud-drizzle':   return <CloudDrizzle    {...props} />;
              case 'cloudy':          return <Cloudy          {...props} />;
              default:                return <Sun             {...props} />;
            }
          };

          const weatherIconColor = (icon: WeatherIconType): string => {
            switch (icon) {
              case 'sun':             return '#fbbf24';
              case 'cloud':           return '#94a3b8';
              case 'cloud-rain':      return '#60a5fa';
              case 'cloud-snow':      return '#bae6fd';
              case 'cloud-lightning': return '#facc15';
              case 'wind':            return '#a5b4fc';
              case 'cloud-drizzle':   return '#7dd3fc';
              case 'cloudy':          return '#94a3b8';
              default:                return '#f1f5f9';
            }
          };

          const weatherGradient = (icon: WeatherIconType): string => {
            switch (icon) {
              case 'sun':             return 'radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.25) 0%, rgba(234,88,12,0.08) 50%, rgba(15,23,42,0.95) 100%)';
              case 'cloud':           return 'radial-gradient(ellipse at 50% 30%, rgba(148,163,184,0.18) 0%, rgba(51,65,85,0.10) 50%, rgba(15,23,42,0.95) 100%)';
              case 'cloud-rain':      return 'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.22) 0%, rgba(30,58,138,0.10) 50%, rgba(15,23,42,0.95) 100%)';
              case 'cloud-snow':      return 'radial-gradient(ellipse at 50% 30%, rgba(186,230,253,0.20) 0%, rgba(125,211,252,0.08) 50%, rgba(15,23,42,0.95) 100%)';
              case 'cloud-lightning': return 'radial-gradient(ellipse at 50% 30%, rgba(250,204,21,0.22) 0%, rgba(161,98,7,0.08) 50%, rgba(15,23,42,0.95) 100%)';
              case 'wind':            return 'radial-gradient(ellipse at 50% 30%, rgba(165,180,252,0.18) 0%, rgba(99,102,241,0.08) 50%, rgba(15,23,42,0.95) 100%)';
              case 'cloud-drizzle':   return 'radial-gradient(ellipse at 50% 30%, rgba(125,211,252,0.20) 0%, rgba(56,189,248,0.08) 50%, rgba(15,23,42,0.95) 100%)';
              case 'cloudy':          return 'radial-gradient(ellipse at 50% 30%, rgba(148,163,184,0.18) 0%, rgba(71,85,105,0.08) 50%, rgba(15,23,42,0.95) 100%)';
              default:                return 'radial-gradient(ellipse at 50% 30%, rgba(241,245,249,0.12) 0%, rgba(15,23,42,0.95) 100%)';
            }
          };

          interface WeatherWidgetProps {
            widget: Widget;
          }

          export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ widget }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const searchRef    = useRef<HTMLInputElement>(null);
            const [cw, setCw]  = useState(280);
            const [ch, setCh]  = useState(200);
            const [useFahrenheit, setUseFahrenheit] = useState(false);
            const [isHovered, setIsHovered]         = useState(false);
            const [isSearchFocused, setIsSearchFocused] = useState(false);
            const [data, setData]           = useState<WeatherEntry>(FALLBACK_WEATHER['London']);
            const [forecast, setForecast]   = useState<ForecastDay[]>([]);
            const [weatherError, setWeatherError] = useState(false);
            const [searchVal, setSearchVal] = useState('');
            const [searchErr, setSearchErr] = useState('');
            const [isSearching, setIsSearching] = useState(false);

            const showControls = isHovered || isSearchFocused;

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                const r = entries[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              setCw(el.offsetWidth);
              setCh(el.offsetHeight);
              return () => ro.disconnect();
            }, []);

            // ── Loader: fetch current weather + 3-day forecast for either a city
            //    name or coordinates. Used for both initial load and city search.
            const loadWeather = useCallback(async (
              query: { kind: 'coords'; lat: number; lon: number } | { kind: 'city'; city: string },
              mountedRef: { current: boolean }
            ): Promise<boolean> => {
              const qs = query.kind === 'coords'
                ? `lat=${query.lat}&lon=${query.lon}`
                : `city=${encodeURIComponent(query.city)}`;
              try {
                const resp = await fetch(`/api/weather?${qs}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const w = await resp.json() as WeatherEntry;
                if (!mountedRef.current) return false;
                setData(w);
                setWeatherError(false);
                // Forecast — best-effort, prefer lat/lon from current weather response
                const fcQs = (w.lat != null && w.lon != null)
                  ? `lat=${w.lat}&lon=${w.lon}`
                  : qs;
                try {
                  const fcResp = await fetch(`/api/weather/forecast?${fcQs}`);
                  if (fcResp.ok) {
                    const fc = await fcResp.json() as { days: ForecastDay[] };
                    if (mountedRef.current) setForecast(Array.isArray(fc.days) ? fc.days : []);
                  } else if (mountedRef.current) {
                    setForecast([]);
                  }
                } catch {
                  if (mountedRef.current) setForecast([]);
                }
                return true;
              } catch (err) {
                console.warn('[WeatherWidget] Failed to fetch weather:', err);
                if (mountedRef.current) setWeatherError(true);
                return false;
              }
            }, []);

            useEffect(() => {
              const mountedRef = { current: true };
              let timeoutId: ReturnType<typeof setTimeout> | null = null;
              const fallbackToLondon = () => {
                void loadWeather({ kind: 'city', city: 'London' }, mountedRef);
              };

              if (typeof navigator !== 'undefined' && navigator.geolocation) {
                let resolved = false;
                timeoutId = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    if (mountedRef.current) fallbackToLondon();
                  }
                }, 5000);

                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    if (resolved) return;
                    resolved = true;
                    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
                    if (!mountedRef.current) return;
                    void loadWeather(
                      { kind: 'coords', lat: pos.coords.latitude, lon: pos.coords.longitude },
                      mountedRef
                    ).then((ok) => { if (!ok && mountedRef.current) fallbackToLondon(); });
                  },
                  () => {
                    if (resolved) return;
                    resolved = true;
                    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
                    if (mountedRef.current) fallbackToLondon();
                  },
                  { timeout: 5000, maximumAge: 600000 }
                );
              } else {
                fallbackToLondon();
              }

              return () => {
                mountedRef.current = false;
                if (timeoutId) clearTimeout(timeoutId);
              };
            }, [loadWeather]);

            useEffect(() => {
              if (showControls && searchRef.current) searchRef.current.focus();
            }, [showControls]);

            const handleSearch = async () => {
              const trimmed = searchVal.trim();
              if (!trimmed) return;
              setIsSearching(true);
              setSearchErr('');
              const mountedRef = { current: true };
              const ok = await loadWeather({ kind: 'city', city: trimmed }, mountedRef);
              if (!ok) {
                setSearchErr('City not found');
                setTimeout(() => setSearchErr(''), 2500);
              } else {
                setSearchVal('');
              }
              setIsSearching(false);
            };

            const s = Math.min(cw, ch);

            // ── Forecast strip is only rendered when the widget is large enough
            //    to show it without crowding the primary readout.
            const showForecast = forecast.length > 0 && ch >= 220 && cw >= 220;

            const iconSize    = Math.max(24, Math.min(s * 0.28, cw * 0.22, ch * 0.30));
            const tempFont    = Math.max(22, Math.min(s * 0.25, cw * 0.18, ch * 0.27));
            const cityFont    = Math.max(12, Math.min(s * 0.095, cw * 0.07));
            const condFont    = Math.max(9,  Math.min(s * 0.065, cw * 0.048));
            const metaFont    = Math.max(12, Math.min(s * 0.082, cw * 0.06));
            const metaIconSz  = Math.max(14, Math.min(s * 0.09, cw * 0.065));
            const toggleFont  = Math.max(8,  s * 0.05);
            const gap         = Math.max(4,  s * 0.035);
            const padV        = Math.max(8,  s * 0.06);
            const padH        = Math.max(10, s * 0.065);
            const iconColor   = weatherIconColor(data.icon);
            const bgGradient  = weatherGradient(data.icon);
            const temp        = useFahrenheit ? `${data.tempF}\u00B0F` : `${data.tempC}\u00B0C`;
            const searchH     = Math.max(26, s * 0.13);
            const searchIcon  = Math.max(12, s * 0.065);
            const fcDayFont   = Math.max(8,  Math.min(s * 0.052, cw * 0.038));
            const fcTempFont  = Math.max(9,  Math.min(s * 0.058, cw * 0.042));
            const fcIconSz    = Math.max(14, Math.min(s * 0.10, cw * 0.07, 28));

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: bgGradient,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                  position: 'relative',
                  padding: `${padV}px ${padH}px`,
                  gap: `${gap}px`,
                  transition: 'background 0.6s ease',
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                data-testid={`weather-widget-${widget.id}`}
              >

                {/* ── Glass search bar (hover-only) ─────────────────────────────────── */}
                <div style={{
                  position:      'absolute',
                  top:           `${Math.max(6, s * 0.03)}px`,
                  left:          `${Math.max(8, s * 0.04)}px`,
                  right:         `${Math.max(8, s * 0.04)}px`,
                  opacity:       showControls ? 1 : 0,
                  pointerEvents: showControls ? 'auto' : 'none',
                  transition:    'opacity 0.25s ease',
                  zIndex:        20,
                }}>
                  <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    height:         `${searchH}px`,
                    background:     'rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border:         searchErr ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.20)',
                    borderRadius:   '8px',
                    padding:        `0 ${Math.max(8, s * 0.04)}px`,
                    boxSizing:      'border-box',
                    gap:            `${Math.max(4, s * 0.025)}px`,
                  }}>
                    <Search size={searchIcon} color="#94a3b8" strokeWidth={2} style={{ flexShrink: 0 }} />
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchVal}
                      onChange={(e) => { setSearchVal(e.target.value); setSearchErr(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      placeholder="Search city\u2026"
                      style={{
                        flex:            1,
                        height:          '100%',
                        background:      'transparent',
                        border:          'none',
                        color:           '#e2e8f0',
                        fontFamily:      MONO,
                        fontSize:        `${Math.max(10, s * 0.055)}px`,
                        fontWeight:      500,
                        outline:         'none',
                        letterSpacing:   '0.03em',
                        minWidth:        0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid="weather-city-search"
                    />
                    {isSearching && (
                      <div style={{
                        width: `${Math.max(14, s * 0.06)}px`, height: `${Math.max(14, s * 0.06)}px`,
                        border: '2px solid rgba(148,163,184,0.3)', borderTopColor: '#60a5fa',
                        borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0,
                      }} />
                    )}
                  </div>
                  {searchErr && (
                    <div style={{
                      fontFamily: MONO, fontSize: `${Math.max(9, s * 0.05)}px`,
                      color: '#ef4444', letterSpacing: '0.03em', marginTop: '4px',
                      paddingLeft: `${Math.max(8, s * 0.04)}px`,
                    }}>
                      {searchErr}
                    </div>
                  )}
                </div>

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                {/* ── City name ───────────────────────────────────────────────────────── */}
                <div style={{
                  fontFamily:    MONO,
                  fontSize:      `${cityFont}px`,
                  fontWeight:    700,
                  color:         '#e2e8f0',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  lineHeight:    1,
                  textAlign:     'center',
                  zIndex:        1,
                  textShadow:    '0 1px 4px rgba(0,0,0,0.4)',
                }}>
                  {data.city}
                </div>

                {weatherError && (
                  <div style={{
                    fontFamily: MONO, fontSize: `${Math.max(8, s * 0.045)}px`,
                    color: '#f59e0b', letterSpacing: '0.04em', zIndex: 1,
                    textAlign: 'center', lineHeight: 1,
                  }}>
                    Service temporarily unavailable
                  </div>
                )}

                {/* ── Icon ──────────────────────────────────────────────────────────── */}
                <div style={{ zIndex: 1, lineHeight: 0, filter: `drop-shadow(0 0 ${Math.max(4, iconSize * 0.12)}px ${iconColor}88)` }}>
                  <WeatherIcon icon={data.icon} size={iconSize} color={iconColor} />
                </div>

                {/* ── Temperature ──────────────────────────────────────────────────── */}
                <div style={{
                  fontFamily:    MONO,
                  fontSize:      `${tempFont}px`,
                  fontWeight:    700,
                  color:         '#f1f5f9',
                  letterSpacing: '-0.03em',
                  lineHeight:    1,
                  zIndex:        1,
                  textAlign:     'center',
                }}>
                  {temp}
                </div>

                {/* ── Condition label ───────────────────────────────────────────────── */}
                <div style={{
                  fontFamily:    MONO,
                  fontSize:      `${condFont}px`,
                  fontWeight:    500,
                  color:         iconColor,
                  letterSpacing: '0.04em',
                  lineHeight:    1,
                  zIndex:        1,
                  textAlign:     'center',
                }}>
                  {data.condition}
                </div>

                {/* ── Meta row: humidity + wind ─────────────────────────────────────── */}
                <div style={{
                  display:        'flex',
                  gap:            `${Math.max(12, s * 0.08)}px`,
                  alignItems:     'center',
                  justifyContent: 'center',
                  zIndex:         1,
                }}>
                  <span style={{
                    fontFamily: MONO, fontSize: `${metaFont}px`, fontWeight: 700,
                    color: '#93c5fd', letterSpacing: '0.03em',
                    display: 'flex', alignItems: 'center', gap: `${Math.max(3, metaIconSz * 0.2)}px`,
                  }}>
                    <span style={{ fontSize: `${metaIconSz}px`, lineHeight: 1 }}>{'\uD83D\uDCA7'}</span> {data.humidity}%
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: `${metaFont}px`, fontWeight: 700,
                    color: '#a5b4fc', letterSpacing: '0.03em',
                    display: 'flex', alignItems: 'center', gap: `${Math.max(3, metaIconSz * 0.2)}px`,
                  }}>
                    <span style={{ fontSize: `${metaIconSz}px`, lineHeight: 1 }}>{'\uD83D\uDCA8'}</span> {data.windKph} km/h
                  </span>
                </div>

                {/* ── 3-day forecast strip (only when widget is large enough) ─── */}
                {showForecast && (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'stretch',
                      gap: `${Math.max(4, s * 0.025)}px`,
                      marginTop: `${Math.max(4, s * 0.02)}px`,
                      paddingTop: `${Math.max(6, s * 0.03)}px`,
                      borderTop: '1px solid rgba(255,255,255,0.10)',
                      zIndex: 1,
                    }}
                    data-testid={`weather-forecast-${widget.id}`}
                  >
                    {forecast.map((d) => (
                      <div
                        key={d.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: `${Math.max(2, s * 0.012)}px`,
                          minWidth: 0,
                        }}
                        data-testid={`weather-forecast-day-${d.date}`}
                      >
                        <span style={{
                          fontFamily: MONO,
                          fontSize: `${fcDayFont}px`,
                          fontWeight: 700,
                          color: '#cbd5e1',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          lineHeight: 1,
                        }}>
                          {d.dayLabel}
                        </span>
                        <div style={{ lineHeight: 0 }}>
                          <WeatherIcon icon={d.icon} size={fcIconSz} color={weatherIconColor(d.icon)} />
                        </div>
                        <span style={{
                          fontFamily: MONO,
                          fontSize: `${fcTempFont}px`,
                          fontWeight: 600,
                          color: '#f1f5f9',
                          letterSpacing: '0.02em',
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                        }}>
                          {useFahrenheit
                            ? `${d.tempMaxF}\u00B0/${d.tempMinF}\u00B0`
                            : `${d.tempMaxC}\u00B0/${d.tempMinC}\u00B0`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── °C / °F toggle (visible on hover) ───────────────────────────── */}
                <div style={{
                  position:      'absolute',
                  bottom:        `${Math.max(5, s * 0.025)}px`,
                  left:          '50%',
                  transform:     'translateX(-50%)',
                  opacity:       showControls ? 1 : 0,
                  pointerEvents: showControls ? 'auto' : 'none',
                  transition:    'opacity 0.2s ease',
                  zIndex:        10,
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUseFahrenheit(f => !f); }}
                    style={{
                      background:    'rgba(255,255,255,0.08)',
                      border:        '1px solid #334155',
                      cursor:        'pointer',
                      color:         '#94a3b8',
                      fontSize:      `${toggleFont}px`,
                      fontFamily:    MONO,
                      fontWeight:    600,
                      padding:       `${Math.max(2, s * 0.01)}px ${Math.max(8, s * 0.045)}px`,
                      borderRadius:  '4px',
                      letterSpacing: '0.06em',
                      whiteSpace:    'nowrap',
                    }}
                    data-testid="btn-toggle-unit"
                  >
                    {useFahrenheit ? '\u00B0F \u2192 \u00B0C' : '\u00B0C \u2192 \u00B0F'}
                  </button>
                </div>
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  DictionaryWidget
          // ─────────────────────────────────────────────────────────────────────────────

          const POWER_WORDS = [
            'ephemeral', 'perspicacious', 'sanguine', 'mellifluous', 'obfuscate',
            'tenacious', 'eloquent', 'sagacious', 'inexorable', 'magnanimous',
            'pernicious', 'soliloquy', 'sycophant', 'vicissitude', 'recalcitrant',
            'loquacious', 'serendipity', 'equanimity', 'propitious', 'truculent',
          ];

          // Returns a stable index for the current calendar day so the daily
          // power word matches across reloads but rotates at midnight UTC.
          function dailyWordIndex(): number {
            const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
            return day % POWER_WORDS.length;
          }

          interface DictionaryEntryShape {
            word: string;
            phonetic?: string;
            phonetics?: { text?: string; audio?: string }[];
            origin?: string;
            meanings?: {
              partOfSpeech?: string;
              definitions?: { definition?: string; example?: string }[];
              synonyms?: string[];
            }[];
          }

          const DictionaryWidget: React.FC<{
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [cw, setCw] = useState(300);
            const [ch, setCh] = useState(200);

            // The "active" word is either the explicit search query or, if
            // empty, the daily-seeded power word. A local search-input state
            // lets the user type without losing the persisted query.
            const dailyWord = POWER_WORDS[dailyWordIndex()];
            const activeWord = (widget.dictionaryQuery || '').trim() || dailyWord;
            const [searchInput, setSearchInput] = useState(widget.dictionaryQuery || '');
            const [showFavorites, setShowFavorites] = useState(false);
            const [entry, setEntry] = useState<DictionaryEntryShape | null>(null);
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState(false);

            const favorites = widget.dictionaryFavorites || [];
            const isFavorite = favorites.includes(activeWord.toLowerCase());

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                const r = entries[0]?.contentRect;
                if (r) { setCw(r.width); setCh(r.height); }
              });
              ro.observe(el);
              return () => ro.disconnect();
            }, []);

            useEffect(() => {
              let mounted = true;
              setLoading(true); setError(false); setEntry(null);
              (async () => {
                try {
                  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(activeWord)}`);
                  if (!res.ok) throw new Error('fetch failed');
                  const data = await res.json();
                  if (!mounted) return;
                  setEntry(Array.isArray(data) ? data[0] : null);
                } catch {
                  if (mounted) setError(true);
                } finally {
                  if (mounted) setLoading(false);
                }
              })();
              return () => { mounted = false; };
            }, [activeWord]);

            const meaning = entry?.meanings?.[0];
            const definition = meaning?.definitions?.[0]?.definition ?? null;
            const partOfSpeech = meaning?.partOfSpeech ?? null;
            const synonyms = (meaning?.synonyms || []).slice(0, 6);
            const origin = entry?.origin || null;
            // dictionaryapi.dev nests audio under multiple phonetics; pick the
            // first non-empty one so we always play *something* when available.
            const audioUrl = entry?.phonetics?.find(p => p.audio && p.audio.length > 0)?.audio || null;
            const phoneticText = entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || null;

            const submitSearch = () => {
              const v = searchInput.trim();
              onUpdate?.(widget.id, { dictionaryQuery: v });
            };

            const clearSearch = () => {
              setSearchInput('');
              onUpdate?.(widget.id, { dictionaryQuery: '' });
            };

            const toggleFavorite = () => {
              if (!onUpdate) return;
              const lower = activeWord.toLowerCase();
              const next = isFavorite
                ? favorites.filter(w => w !== lower)
                : [lower, ...favorites].slice(0, 30);
              onUpdate(widget.id, { dictionaryFavorites: next });
            };

            const playAudio = () => {
              if (!audioUrl) return;
              try {
                const a = new Audio(audioUrl);
                a.play().catch(err => console.warn('[Dictionary] audio play failed', err));
              } catch (err) { console.warn('[Dictionary] audio init failed', err); }
            };

            const compact = cw < 260 || ch < 180;
            const s = Math.min(cw, ch);

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: compact ? '0.75rem' : '1.1rem',
                  boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
                }}
                data-testid={`dictionary-widget-${widget.id}`}
              >
                {/* Search row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexShrink: 0 }} onKeyDown={e => e.stopPropagation()}>
                  <Search size={11} color="#818cf8" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
                    placeholder="Search a word…"
                    style={{
                      flex: 1, minWidth: 0,
                      padding: '4px 6px',
                      background: 'rgba(15,23,42,0.7)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: 4,
                      color: '#e2e8f0', fontFamily: MONO,
                      fontSize: compact ? 10 : 11, outline: 'none',
                    }}
                    data-testid={`dictionary-search-${widget.id}`}
                  />
                  {widget.dictionaryQuery && (
                    <button
                      onClick={clearSearch}
                      title="Back to daily word"
                      style={{
                        background: 'none', border: 'none', color: '#64748b',
                        cursor: 'pointer', padding: 2, lineHeight: 0,
                      }}
                    >
                      <X size={11} />
                    </button>
                  )}
                  {favorites.length > 0 && (
                    <button
                      onClick={() => setShowFavorites(s => !s)}
                      title="Favorites"
                      style={{
                        background: showFavorites ? 'rgba(251,191,36,0.2)' : 'none',
                        border: '1px solid ' + (showFavorites ? 'rgba(251,191,36,0.5)' : 'transparent'),
                        color: '#fbbf24', cursor: 'pointer',
                        padding: '2px 4px', borderRadius: 4, lineHeight: 0,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}
                      data-testid={`dictionary-fav-toggle-${widget.id}`}
                    >
                      <Star size={11} />
                      <ChevronDown size={9} />
                    </button>
                  )}
                </div>

                {/* Favorites dropdown */}
                {showFavorites && favorites.length > 0 && (
                  <div style={{
                    background: 'rgba(15,23,42,0.85)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    borderRadius: 6, padding: 6, marginBottom: 6,
                    display: 'flex', flexWrap: 'wrap', gap: 4,
                    flexShrink: 0, maxHeight: 80, overflowY: 'auto',
                  }}>
                    {favorites.map(fav => (
                      <button
                        key={fav}
                        onClick={() => {
                          setSearchInput(fav);
                          onUpdate?.(widget.id, { dictionaryQuery: fav });
                          setShowFavorites(false);
                        }}
                        style={{
                          padding: '2px 6px', borderRadius: 3,
                          background: 'rgba(251,191,36,0.1)',
                          border: '1px solid rgba(251,191,36,0.3)',
                          color: '#fbbf24', fontFamily: MONO, fontSize: 10,
                          cursor: 'pointer',
                        }}
                        data-testid={`dictionary-fav-${fav}-${widget.id}`}
                      >
                        {fav}
                      </button>
                    ))}
                  </div>
                )}

                {/* Header line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexShrink: 0 }}>
                  <span style={{
                    fontSize: compact ? '0.55rem' : '0.6rem', fontFamily: MONO,
                    fontWeight: 700, color: '#818cf8', textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    {widget.dictionaryQuery ? 'Lookup' : 'Word of the Day'}
                  </span>
                  {partOfSpeech && (
                    <span style={{
                      fontSize: compact ? '0.5rem' : '0.55rem', fontFamily: MONO, color: '#64748b',
                      background: '#1e293b', border: '1px solid #334155',
                      borderRadius: 4, padding: '1px 5px',
                    }}>
                      {partOfSpeech}
                    </span>
                  )}
                  <button
                    onClick={toggleFavorite}
                    title={isFavorite ? 'Unfavorite' : 'Favorite'}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none',
                      color: isFavorite ? '#fbbf24' : '#475569',
                      cursor: 'pointer', padding: 2, lineHeight: 0,
                    }}
                    data-testid={`dictionary-fav-toggle-star-${widget.id}`}
                  >
                    <Star size={12} fill={isFavorite ? '#fbbf24' : 'none'} />
                  </button>
                </div>

                {/* Word + audio */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: MONO, fontWeight: 700,
                    fontSize: `${Math.max(0.9, Math.min(1.5, s * 0.05))}rem`,
                    color: '#e2e8f0', letterSpacing: '0.02em',
                    textTransform: 'capitalize',
                  }}>
                    {activeWord}
                  </span>
                  {phoneticText && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>
                      {phoneticText}
                    </span>
                  )}
                  {audioUrl && (
                    <button
                      onClick={playAudio}
                      title="Play pronunciation"
                      style={{
                        background: 'rgba(99,102,241,0.18)',
                        border: '1px solid rgba(129,140,248,0.4)',
                        borderRadius: 4, padding: '2px 4px',
                        color: '#a5b4fc', cursor: 'pointer', lineHeight: 0,
                      }}
                      data-testid={`dictionary-audio-${widget.id}`}
                    >
                      <Volume2 size={11} />
                    </button>
                  )}
                </div>

                {/* Definition + extras */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {loading && (
                    <span style={{ color: '#475569', fontFamily: MONO, fontSize: compact ? '0.65rem' : '0.72rem' }}>
                      Loading…
                    </span>
                  )}
                  {error && !loading && (
                    <span style={{ color: '#ef4444', fontFamily: MONO, fontSize: compact ? '0.65rem' : '0.72rem' }}>
                      No definition for "{activeWord}"
                    </span>
                  )}
                  {!loading && !error && definition && (
                    <p style={{
                      color: '#94a3b8', fontFamily: MONO,
                      fontSize: `${Math.max(0.65, Math.min(0.8, s * 0.026))}rem`,
                      lineHeight: 1.5, margin: '0 0 6px 0',
                    }}>
                      {definition}
                    </p>
                  )}
                  {!loading && !error && synonyms.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        Synonyms
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                        {synonyms.map(s => (
                          <button
                            key={s}
                            onClick={() => {
                              setSearchInput(s);
                              onUpdate?.(widget.id, { dictionaryQuery: s });
                            }}
                            style={{
                              padding: '1px 6px', borderRadius: 3,
                              background: 'rgba(99,102,241,0.12)',
                              border: '1px solid rgba(99,102,241,0.3)',
                              color: '#a5b4fc', fontFamily: MONO, fontSize: 10,
                              cursor: 'pointer',
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!loading && !error && origin && (
                    <div>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        Etymology
                      </span>
                      <p style={{
                        color: '#7c8aa6', fontFamily: MONO,
                        fontSize: `${Math.max(0.6, Math.min(0.7, s * 0.022))}rem`,
                        lineHeight: 1.4, margin: '3px 0 0 0', fontStyle: 'italic',
                      }}>
                        {origin}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom accent */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, #6366f1, #818cf8, #6366f1)',
                  opacity: 0.6,
                }} />
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  QRGeneratorWidget v2 — multi-mode QR with logo, theming, copy, history.
          //  Modes: URL · WiFi · vCard · Email · Geo. Each mode persists its values
          //  on the widget so switching tabs preserves work in progress. The QR is
          //  rendered at error-correction level H whenever a center logo is set so
          //  the embedded image remains scannable.
          // ─────────────────────────────────────────────────────────────────────────────

          const MONO_QR = "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace";

          type QRMode = NonNullable<Widget['qrMode']>;
          type QRHistoryEntry = NonNullable<Widget['qrHistory']>[number];

          const QR_MODES: { value: QRMode; label: string; Icon: typeof Wifi }[] = [
            { value: 'url',   label: 'Link',  Icon: Link2 },
            { value: 'wifi',  label: 'WiFi',  Icon: Wifi },
            { value: 'vcard', label: 'Card',  Icon: UserIcon },
            { value: 'email', label: 'Email', Icon: Mail },
            { value: 'geo',   label: 'Geo',   Icon: MapPin },
          ];

          // WiFi QR strings escape the five reserved characters: \ ; , " :
          function escapeWifiField(s: string): string {
            return s.replace(/([\\;,":])/g, '\\$1');
          }

          // Returns { value, label } for the current mode. value is the encoded QR
          // payload (empty when the mode's required fields aren't filled in yet);
          // label is a short human-readable summary used in history + footer.
          function buildQRPayload(widget: Widget): { value: string; label: string } {
            const mode: QRMode = widget.qrMode ?? 'url';
            const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
            switch (mode) {
              case 'url': {
                const v = (widget.qrUrlValue || '').trim();
                return { value: v.slice(0, 2953), label: v ? trunc(v, 40) : '' };
              }
              case 'wifi': {
                const ssid = (widget.qrWifiSsid || '').trim();
                if (!ssid) return { value: '', label: '' };
                const sec = widget.qrWifiSecurity || 'WPA';
                const pwd = widget.qrWifiPassword || '';
                const hidden = widget.qrWifiHidden ? 'H:true;' : '';
                const secPart = sec === 'nopass' ? 'nopass' : sec;
                const pwdPart = sec === 'nopass' ? '' : `P:${escapeWifiField(pwd)};`;
                return {
                  value: `WIFI:T:${secPart};S:${escapeWifiField(ssid)};${pwdPart}${hidden};`,
                  label: `WiFi \u2022 ${trunc(ssid, 32)}`,
                };
              }
              case 'vcard': {
                const name  = (widget.qrVcardName  || '').trim();
                const phone = (widget.qrVcardPhone || '').trim();
                const email = (widget.qrVcardEmail || '').trim();
                const org   = (widget.qrVcardOrg   || '').trim();
                if (!name && !phone && !email) return { value: '', label: '' };
                const parts = [
                  'BEGIN:VCARD',
                  'VERSION:3.0',
                  name  ? `FN:${name}`              : null,
                  org   ? `ORG:${org}`              : null,
                  phone ? `TEL;TYPE=CELL:${phone}`  : null,
                  email ? `EMAIL;TYPE=INTERNET:${email}` : null,
                  'END:VCARD',
                ].filter(Boolean) as string[];
                return { value: parts.join('\n'), label: trunc(name || email || phone, 40) };
              }
              case 'email': {
                const to   = (widget.qrEmailTo      || '').trim();
                const subj = (widget.qrEmailSubject || '').trim();
                const body = (widget.qrEmailBody    || '').trim();
                if (!to) return { value: '', label: '' };
                const params: string[] = [];
                if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
                if (body) params.push(`body=${encodeURIComponent(body)}`);
                const q = params.length ? `?${params.join('&')}` : '';
                return { value: `mailto:${to}${q}`, label: `\u2709 ${trunc(to, 36)}` };
              }
              case 'geo': {
                const lat = parseFloat((widget.qrGeoLat || '').trim());
                const lon = parseFloat((widget.qrGeoLon || '').trim());
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { value: '', label: '' };
                const lab = (widget.qrGeoLabel || '').trim();
                const value = lab
                  ? `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(lab)})`
                  : `geo:${lat},${lon}`;
                return { value, label: lab || `${lat.toFixed(3)}, ${lon.toFixed(3)}` };
              }
            }
          }

          // Rasterize the QR <svg> to a PNG and copy it to the clipboard. Falls
          // back to a download anchor when the Async Clipboard API can't handle
          // image/png (older Safari, locked-down browsers).
          async function copyQRToClipboard(svg: SVGSVGElement, bgColor: string): Promise<'copied' | 'downloaded' | 'failed'> {
            try {
              const xml = new XMLSerializer().serializeToString(svg);
              const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
              await new Promise<void>((resolve, reject) => {
                img.onload  = () => resolve();
                img.onerror = (e) => reject(e);
                img.src = svgUrl;
              });
              const target = 1024;
              const canvas = document.createElement('canvas');
              canvas.width = target; canvas.height = target;
              const ctx = canvas.getContext('2d');
              if (!ctx) return 'failed';
              ctx.fillStyle = bgColor;
              ctx.fillRect(0, 0, target, target);
              ctx.drawImage(img, 0, 0, target, target);
              // Best-effort clipboard write — feature-detect ClipboardItem on
              // window without `any` so older browsers fall through cleanly.
              const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), 'image/png'));
              if (!blob) return 'failed';
              const ClipboardItemCtor = (
                globalThis as { ClipboardItem?: typeof ClipboardItem }
              ).ClipboardItem;
              if (ClipboardItemCtor && navigator.clipboard?.write) {
                try {
                  await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
                  return 'copied';
                } catch {
                  // fall through to download
                }
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'qrcode.png';
              document.body.appendChild(a); a.click();
              setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 250);
              return 'downloaded';
            } catch (err) {
              console.warn('[QR] copy/download failed:', err);
              return 'failed';
            }
          }

          // Relative luminance per WCAG 2.x; used to pick a contrast-safe QR
          // foreground when the background tracks the widget color-droplet.
          function hexLuminance(hex: string): number {
            const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
            if (!m) return 1;
            const r = parseInt(m[1].slice(0, 2), 16) / 255;
            const g = parseInt(m[1].slice(2, 4), 16) / 255;
            const b = parseInt(m[1].slice(4, 6), 16) / 255;
            const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          }

          interface QRGeneratorWidgetProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const QRGeneratorWidget: React.FC<QRGeneratorWidgetProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const svgWrapperRef = useRef<HTMLDivElement>(null);
            const [size, setSize] = useState(280);
            const [showSettings, setShowSettings] = useState(false);
            const [copyState, setCopyState] = useState<'idle' | 'copied' | 'downloaded' | 'failed'>('idle');
            const { toast } = useToast();

            useEffect(() => {
              const obs = new ResizeObserver(entries => {
                const r = entries[0]?.contentRect;
                if (r) setSize(Math.min(r.width, r.height));
              });
              if (containerRef.current) obs.observe(containerRef.current);
              return () => obs.disconnect();
            }, []);

            const mode: QRMode = widget.qrMode ?? 'url';
            const patch = useCallback((p: Partial<Widget>) => {
              if (onUpdate) onUpdate(widget.id, p);
            }, [onUpdate, widget.id]);

            const { value: qrValue, label: qrLabel } = useMemo(() => buildQRPayload(widget), [widget]);

            // Color theme: BOTH foreground and background track the widget
            // color-droplet by default. Background takes the droplet's tint;
            // foreground is auto-picked for WCAG-safe contrast against it.
            // Per-widget manual overrides (qrFgColor / qrBgColor) win when set.
            // Falls back to the classic dark-on-white when no droplet is set.
            const dropletBg = widget.customColor ?? null;
            const bgColor   = widget.qrBgColor || dropletBg || '#ffffff';
            const fgColor   = widget.qrFgColor
              || (dropletBg ? (hexLuminance(bgColor) > 0.5 ? '#0f172a' : '#ffffff') : '#0f172a');

            // Push current value into history (debounced + dedup) whenever the
            // payload changes and is non-empty.
            const lastSavedRef = useRef<string>('');
            useEffect(() => {
              if (!qrValue || !onUpdate) return;
              if (lastSavedRef.current === qrValue) return;
              const t = setTimeout(() => {
                if (lastSavedRef.current === qrValue) return;
                lastSavedRef.current = qrValue;
                const prev = widget.qrHistory || [];
                // Drop any prior entry with the same value so it moves to the top.
                const filtered = prev.filter(h => h.value !== qrValue);
                // Snapshot every mode-specific field so restore reconstructs the
                // full form, not just the primary value.
                const fields: Partial<Widget> = (() => {
                  switch (mode) {
                    case 'url':   return { qrUrlValue: widget.qrUrlValue };
                    case 'wifi':  return {
                      qrWifiSsid: widget.qrWifiSsid, qrWifiPassword: widget.qrWifiPassword,
                      qrWifiSecurity: widget.qrWifiSecurity, qrWifiHidden: widget.qrWifiHidden,
                    };
                    case 'vcard': return {
                      qrVcardName: widget.qrVcardName, qrVcardPhone: widget.qrVcardPhone,
                      qrVcardEmail: widget.qrVcardEmail, qrVcardOrg: widget.qrVcardOrg,
                    };
                    case 'email': return {
                      qrEmailTo: widget.qrEmailTo, qrEmailSubject: widget.qrEmailSubject,
                      qrEmailBody: widget.qrEmailBody,
                    };
                    case 'geo':   return {
                      qrGeoLat: widget.qrGeoLat, qrGeoLon: widget.qrGeoLon, qrGeoLabel: widget.qrGeoLabel,
                    };
                  }
                })();
                const next: QRHistoryEntry[] = [
                  { mode, value: qrValue, label: qrLabel || qrValue.slice(0, 32), ts: Date.now(), fields },
                  ...filtered,
                ].slice(0, 5);
                patch({ qrHistory: next });
              }, 1500);
              return () => clearTimeout(t);
            }, [qrValue, qrLabel, mode, patch, widget, onUpdate]);

            const compact = size < 260;
            const qrSize = Math.max(110, Math.min(260, size * 0.45));
            const tabFs  = compact ? 9.5 : 11;
            const fieldFs = compact ? 11 : 12;

            const handleCopy = async () => {
              const svg = svgWrapperRef.current?.querySelector('svg');
              if (!svg) {
                setCopyState('failed');
                setTimeout(() => setCopyState('idle'), 1600);
                toast({ title: 'Copy failed', description: 'No QR code to copy.', variant: 'destructive' });
                return;
              }
              const result = await copyQRToClipboard(svg as SVGSVGElement, bgColor);
              setCopyState(result);
              setTimeout(() => setCopyState('idle'), 1800);
              if (result === 'copied') {
                toast({ title: 'Copied!', description: 'QR code copied to clipboard as PNG.' });
              } else if (result === 'downloaded') {
                toast({ title: 'Downloaded', description: 'Clipboard unavailable — saved as PNG instead.' });
              } else {
                toast({ title: 'Copy failed', description: 'Could not copy or download the QR code.', variant: 'destructive' });
              }
            };

            const handleLogoUpload = (file: File) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (dataUrl) patch({ qrLogoUrl: dataUrl });
              };
              reader.readAsDataURL(file);
            };

            const restoreFromHistory = (h: QRHistoryEntry) => {
              // Prefer the structured snapshot when present (newer entries).
              if (h.fields) {
                patch({ qrMode: h.mode, ...h.fields });
                return;
              }
              // Legacy entries: best-effort parse of the encoded value.
              const fields: Partial<Widget> = { qrMode: h.mode };
              if (h.mode === 'url')   fields.qrUrlValue   = h.value;
              if (h.mode === 'email') {
                const m = h.value.match(/^mailto:([^?]+)(?:\?(.*))?$/);
                if (m) {
                  fields.qrEmailTo = decodeURIComponent(m[1]);
                  if (m[2]) {
                    const params = new URLSearchParams(m[2]);
                    const subj = params.get('subject'); if (subj) fields.qrEmailSubject = subj;
                    const body = params.get('body');    if (body) fields.qrEmailBody    = body;
                  }
                }
              }
              if (h.mode === 'wifi') {
                const unesc = (s: string) => s.replace(/\\(.)/g, '$1');
                const ssidM = h.value.match(/S:((?:[^;\\]|\\.)+);/);
                const pwdM  = h.value.match(/P:((?:[^;\\]|\\.)*);/);
                const secM  = h.value.match(/T:([^;]+);/);
                if (ssidM) fields.qrWifiSsid     = unesc(ssidM[1]);
                if (pwdM)  fields.qrWifiPassword = unesc(pwdM[1]);
                if (secM)  fields.qrWifiSecurity = (secM[1] === 'nopass' ? 'nopass' : (secM[1] === 'WEP' ? 'WEP' : 'WPA'));
              }
              if (h.mode === 'geo') {
                const m = h.value.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\?q=[^()]*\(([^)]+)\))?$/);
                if (m) {
                  fields.qrGeoLat = m[1];
                  fields.qrGeoLon = m[2];
                  if (m[3]) fields.qrGeoLabel = decodeURIComponent(m[3]);
                }
              }
              if (h.mode === 'vcard') {
                const fn   = h.value.match(/\nFN:([^\n]+)/);
                const tel  = h.value.match(/\nTEL[^:]*:([^\n]+)/);
                const eml  = h.value.match(/\nEMAIL[^:]*:([^\n]+)/);
                const org  = h.value.match(/\nORG:([^\n]+)/);
                if (fn)  fields.qrVcardName  = fn[1].trim();
                if (tel) fields.qrVcardPhone = tel[1].trim();
                if (eml) fields.qrVcardEmail = eml[1].trim();
                if (org) fields.qrVcardOrg   = org[1].trim();
              }
              patch(fields);
            };

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  display: 'flex', flexDirection: 'column',
                  background: 'rgba(15,23,42,0.55)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  position: 'relative', overflow: 'hidden',
                  padding: compact ? 8 : 12,
                  boxSizing: 'border-box',
                }}
                data-testid={`qr-generator-widget-${widget.id}`}
              >
                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexShrink: 0 }}>
                  {QR_MODES.map(({ value, label, Icon }) => {
                    const active = mode === value;
                    return (
                      <button
                        key={value}
                        onClick={() => patch({ qrMode: value })}
                        title={label}
                        style={{
                          flex: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 4,
                          padding: '5px 4px',
                          background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(129,140,248,0.55)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 6,
                          color: active ? '#c7d2fe' : '#94a3b8',
                          fontFamily: MONO_QR, fontSize: tabFs, fontWeight: 600,
                          cursor: 'pointer', minWidth: 0, lineHeight: 1,
                        }}
                        data-testid={`qr-mode-${value}-${widget.id}`}
                      >
                        <Icon size={compact ? 11 : 12} />
                        {!compact && <span>{label}</span>}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    title="Settings"
                    style={{
                      padding: '5px 6px',
                      background: showSettings ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${showSettings ? 'rgba(129,140,248,0.55)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 6, color: '#cbd5e1', cursor: 'pointer',
                    }}
                    data-testid={`qr-settings-toggle-${widget.id}`}
                  >
                    <SettingsIcon size={compact ? 11 : 12} />
                  </button>
                </div>

                {/* Body: form fields + QR */}
                <div style={{
                  flex: 1, minHeight: 0,
                  display: 'flex', flexDirection: 'column',
                  gap: 8, overflow: 'hidden',
                }}>
                  {/* Mode-specific form */}
                  {!showSettings && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      flexShrink: 0,
                    }} onKeyDown={e => e.stopPropagation()}>
                      {mode === 'url' && (
                        <input
                          type="text"
                          value={widget.qrUrlValue || ''}
                          onChange={e => patch({ qrUrlValue: e.target.value })}
                          placeholder="https://..."
                          maxLength={2953}
                          style={qrInputStyle(fieldFs)}
                          data-testid={`qr-input-url-${widget.id}`}
                        />
                      )}
                      {mode === 'wifi' && (
                        <>
                          <input
                            type="text"
                            value={widget.qrWifiSsid || ''}
                            onChange={e => patch({ qrWifiSsid: e.target.value })}
                            placeholder="Network name (SSID)"
                            style={qrInputStyle(fieldFs)}
                            data-testid={`qr-input-ssid-${widget.id}`}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={widget.qrWifiPassword || ''}
                              onChange={e => patch({ qrWifiPassword: e.target.value })}
                              placeholder="Password"
                              style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                              data-testid={`qr-input-pwd-${widget.id}`}
                            />
                            <select
                              value={widget.qrWifiSecurity || 'WPA'}
                              onChange={e => patch({ qrWifiSecurity: e.target.value as 'WPA' | 'WEP' | 'nopass' })}
                              style={{ ...qrInputStyle(fieldFs), width: 78, padding: '6px 4px' }}
                            >
                              <option value="WPA">WPA</option>
                              <option value="WEP">WEP</option>
                              <option value="nopass">None</option>
                            </select>
                          </div>
                        </>
                      )}
                      {mode === 'vcard' && (
                        <>
                          <input
                            type="text"
                            value={widget.qrVcardName || ''}
                            onChange={e => patch({ qrVcardName: e.target.value })}
                            placeholder="Full name"
                            style={qrInputStyle(fieldFs)}
                            data-testid={`qr-input-vname-${widget.id}`}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={widget.qrVcardPhone || ''}
                              onChange={e => patch({ qrVcardPhone: e.target.value })}
                              placeholder="Phone"
                              style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                            />
                            <input
                              type="text"
                              value={widget.qrVcardEmail || ''}
                              onChange={e => patch({ qrVcardEmail: e.target.value })}
                              placeholder="Email"
                              style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                            />
                          </div>
                          <input
                            type="text"
                            value={widget.qrVcardOrg || ''}
                            onChange={e => patch({ qrVcardOrg: e.target.value })}
                            placeholder="Company (optional)"
                            style={qrInputStyle(fieldFs)}
                          />
                        </>
                      )}
                      {mode === 'email' && (
                        <>
                          <input
                            type="text"
                            value={widget.qrEmailTo || ''}
                            onChange={e => patch({ qrEmailTo: e.target.value })}
                            placeholder="recipient@example.com"
                            style={qrInputStyle(fieldFs)}
                            data-testid={`qr-input-email-to-${widget.id}`}
                          />
                          <input
                            type="text"
                            value={widget.qrEmailSubject || ''}
                            onChange={e => patch({ qrEmailSubject: e.target.value })}
                            placeholder="Subject (optional)"
                            style={qrInputStyle(fieldFs)}
                          />
                        </>
                      )}
                      {mode === 'geo' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={widget.qrGeoLat || ''}
                            onChange={e => patch({ qrGeoLat: e.target.value })}
                            placeholder="Lat"
                            style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                            data-testid={`qr-input-lat-${widget.id}`}
                          />
                          <input
                            type="text"
                            value={widget.qrGeoLon || ''}
                            onChange={e => patch({ qrGeoLon: e.target.value })}
                            placeholder="Lon"
                            style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                            data-testid={`qr-input-lon-${widget.id}`}
                          />
                          <input
                            type="text"
                            value={widget.qrGeoLabel || ''}
                            onChange={e => patch({ qrGeoLabel: e.target.value })}
                            placeholder="Label"
                            style={{ ...qrInputStyle(fieldFs), flex: 1.2 }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Settings panel */}
                  {showSettings && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      padding: 10, borderRadius: 8,
                      background: 'rgba(15,23,42,0.55)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      maxHeight: '60%', overflowY: 'auto',
                    }} onKeyDown={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={qrLabelStyle()}>Logo URL</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          value={widget.qrLogoUrl || ''}
                          onChange={e => patch({ qrLogoUrl: e.target.value })}
                          placeholder="https://...png"
                          style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                          data-testid={`qr-logo-url-${widget.id}`}
                        />
                        <label
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(99,102,241,0.18)',
                            border: '1px solid rgba(129,140,248,0.4)',
                            color: '#c7d2fe', fontFamily: MONO_QR, fontSize: fieldFs - 1,
                          }}
                          title="Upload logo"
                        >
                          <Upload size={11} />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleLogoUpload(f);
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {widget.qrLogoUrl && (
                          <button
                            onClick={() => patch({ qrLogoUrl: '' })}
                            style={qrIconBtnStyle()}
                            title="Remove logo"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <span style={qrLabelStyle()}>Foreground</span>
                          <input
                            type="color"
                            value={fgColor.startsWith('#') ? fgColor : '#0f172a'}
                            onChange={e => patch({ qrFgColor: e.target.value })}
                            style={qrColorPickerStyle()}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={qrLabelStyle()}>Background</span>
                          <input
                            type="color"
                            value={bgColor.startsWith('#') ? bgColor : '#ffffff'}
                            onChange={e => patch({ qrBgColor: e.target.value })}
                            style={qrColorPickerStyle()}
                          />
                        </div>
                        <button
                          onClick={() => patch({ qrFgColor: undefined, qrBgColor: undefined })}
                          style={{ ...qrIconBtnStyle(), alignSelf: 'flex-end', marginBottom: 2 }}
                          title="Reset colors"
                        >
                          <RefreshCw size={11} />
                        </button>
                      </div>

                      {(widget.qrHistory || []).length > 0 && (
                        <button
                          onClick={() => patch({ qrHistory: [] })}
                          style={{
                            ...qrIconBtnStyle(), alignSelf: 'flex-start',
                            padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4,
                            fontFamily: MONO_QR, fontSize: fieldFs - 1, color: '#fda4af',
                            borderColor: 'rgba(244,63,94,0.4)',
                          }}
                          data-testid={`qr-clear-history-${widget.id}`}
                        >
                          <Trash2 size={11} /> Clear history
                        </button>
                      )}
                    </div>
                  )}

                  {/* QR + label */}
                  <div style={{
                    flex: 1, minHeight: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 6,
                  }}>
                    <div
                      ref={svgWrapperRef}
                      style={{
                        background: bgColor,
                        borderRadius: 8,
                        padding: Math.max(4, size * 0.015),
                        boxShadow: '0 0 0 1px rgba(99,102,241,0.25), 0 4px 24px rgba(0,0,0,0.4)',
                        opacity: qrValue ? 1 : 0.35,
                      }}
                    >
                      {qrValue ? (
                        <QRCodeSVG
                          value={qrValue}
                          size={qrSize}
                          // Logo embedded → must use level H so the QR survives
                          // the cut-out region. Otherwise level Q is plenty.
                          level={widget.qrLogoUrl ? 'H' : 'Q'}
                          fgColor={fgColor}
                          bgColor={bgColor}
                          includeMargin={false}
                          imageSettings={widget.qrLogoUrl ? {
                            src: widget.qrLogoUrl,
                            height: Math.round(qrSize * 0.22),
                            width:  Math.round(qrSize * 0.22),
                            excavate: true,
                          } : undefined}
                        />
                      ) : (
                        <div style={{
                          width: qrSize, height: qrSize,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          gap: 8,
                        }}>
                          <QrCode size={qrSize * 0.35} color="#94a3b8" strokeWidth={1.4} />
                          <span style={{
                            fontFamily: MONO_QR, fontSize: 10, color: '#475569',
                            letterSpacing: '0.04em', textAlign: 'center', padding: '0 8px',
                          }}>
                            Fill in fields to generate
                          </span>
                        </div>
                      )}
                    </div>
                    {qrLabel && (
                      <span style={{
                        fontFamily: MONO_QR, fontSize: 10, color: '#cbd5e1',
                        textAlign: 'center', maxWidth: '100%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {qrLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer: Copy + history strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 8, flexShrink: 0,
                }}>
                  <button
                    onClick={handleCopy}
                    disabled={!qrValue}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 10px', borderRadius: 6,
                      background: qrValue ? 'rgba(99,102,241,0.25)' : 'rgba(71,85,105,0.25)',
                      border: `1px solid ${qrValue ? 'rgba(129,140,248,0.5)' : 'rgba(71,85,105,0.4)'}`,
                      color: qrValue ? '#c7d2fe' : '#64748b',
                      fontFamily: MONO_QR, fontSize: 10.5, fontWeight: 600,
                      cursor: qrValue ? 'pointer' : 'not-allowed',
                    }}
                    data-testid={`qr-copy-${widget.id}`}
                  >
                    {copyState === 'copied'     ? <><Check size={11} /> Copied</> :
                     copyState === 'downloaded' ? <><Check size={11} /> Saved</>  :
                     copyState === 'failed'     ? <><X     size={11} /> Failed</> :
                                                  <><Copy  size={11} /> Copy PNG</>}
                  </button>
                  <div style={{
                    flex: 1, display: 'flex', gap: 4, alignItems: 'center',
                    overflowX: 'auto', minWidth: 0,
                  }}>
                    <HistoryIcon size={11} color="#475569" style={{ flexShrink: 0 }} />
                    {(widget.qrHistory || []).map((h, i) => (
                      <button
                        key={`${h.ts}-${i}`}
                        onClick={() => restoreFromHistory(h)}
                        title={`${h.mode}: ${h.label}`}
                        style={{
                          flexShrink: 0,
                          padding: '3px 6px', borderRadius: 4,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#94a3b8', cursor: 'pointer',
                          fontFamily: MONO_QR, fontSize: 9, lineHeight: 1.2,
                          maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        data-testid={`qr-history-${i}-${widget.id}`}
                      >
                        {h.label || h.value.slice(0, 16)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          };

          // Small style helpers reused inside the QR widget — declared after the
          // component so they're hoisted via JS function declarations.
          function qrInputStyle(fontSize: number): React.CSSProperties {
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
          function qrLabelStyle(): React.CSSProperties {
            return {
              fontFamily: MONO_QR, fontSize: 9, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
              display: 'block', marginBottom: 4,
            };
          }
          function qrColorPickerStyle(): React.CSSProperties {
            return {
              width: '100%', height: 26, padding: 0, border: 'none',
              borderRadius: 4, background: 'transparent', cursor: 'pointer',
            };
          }
          function qrIconBtnStyle(): React.CSSProperties {
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

          // ─────────────────────────────────────────────────────────────────────────────
          //  GitHubPulseWidget — repo stats (stars, open PRs, last commit, latest release)
          //  Backed by /api/github/repo/:owner/:repo (5 min cache).
          // ─────────────────────────────────────────────────────────────────────────────

          interface GitHubPulseProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          interface GitHubPulseData {
            fullName: string;
            htmlUrl: string;
            description: string | null;
            stars: number;
            openPRs: number;
            lastCommit: { sha: string; message: string; authoredAt: string; url: string } | null;
            latestRelease: { tagName: string; name: string; publishedAt: string; url: string } | null;
            fetchedAt: number;
          }

          interface GitHubUserData {
            login: string;
            name: string | null;
            htmlUrl: string;
            avatarUrl: string;
            bio: string | null;
            publicRepos: number;
            followers: number;
            following: number;
            topRepos: { name: string; stars: number; htmlUrl: string; description: string | null }[];
            fetchedAt: number;
          }

          // Discriminated union so the widget can render either repo stats or
          // an owner-profile card without juggling two parallel state slots.
          type GitHubPayload =
            | { kind: 'repo'; data: GitHubPulseData }
            | { kind: 'user'; data: GitHubUserData };

          function timeAgo(iso: string): string {
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

          export const GitHubPulseWidget: React.FC<GitHubPulseProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [size, setSize] = useState(280);
            // Editing is derived (no owner ⇒ edit) + a manual override.
            const [forceEdit, setForceEdit] = useState(false);
            const editing = forceEdit || !widget.githubOwner;
            const [draftOwner, setDraftOwner] = useState(widget.githubOwner || '');
            const [draftRepo,  setDraftRepo]  = useState(widget.githubRepo  || '');
            const [payload, setPayload] = useState<GitHubPayload | null>(null);
            const [loading, setLoading] = useState(false);
            const [error, setError]   = useState<string | null>(null);

            useEffect(() => {
              const obs = new ResizeObserver(entries => {
                const r = entries[0]?.contentRect;
                if (r) setSize(Math.min(r.width, r.height));
              });
              if (containerRef.current) obs.observe(containerRef.current);
              return () => obs.disconnect();
            }, []);

            const owner = widget.githubOwner;
            const repo  = widget.githubRepo;

            useEffect(() => {
              if (!owner) { setPayload(null); return; }
              let cancelled = false;
              const run = async () => {
                setLoading(true);
                setError(null);
                try {
                  // Branch on whether a repo was supplied: repo stats vs.
                  // owner profile. Both routes share the 5-min cache window.
                  const url = repo
                    ? `/api/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
                    : `/api/github/user/${encodeURIComponent(owner)}`;
                  const r = await fetch(url);
                  const body = await r.json();
                  if (cancelled) return;
                  if (!r.ok) {
                    setError(body?.error || `Error ${r.status}`);
                    setPayload(null);
                  } else if (repo) {
                    setPayload({ kind: 'repo', data: body as GitHubPulseData });
                  } else {
                    setPayload({ kind: 'user', data: body as GitHubUserData });
                  }
                } catch (err: unknown) {
                  if (!cancelled) {
                    const msg = err instanceof Error ? err.message : 'Network error';
                    setError(msg);
                  }
                } finally {
                  if (!cancelled) setLoading(false);
                }
              };
              run();
              const id = setInterval(run, 5 * 60 * 1000);
              return () => { cancelled = true; clearInterval(id); };
            }, [owner, repo]);

            const compact = size < 240;
            const repoData: GitHubPulseData | null = payload?.kind === 'repo' ? payload.data : null;
            const userData: GitHubUserData  | null = payload?.kind === 'user' ? payload.data : null;

            const submitRepo = () => {
              const o = draftOwner.trim();
              const r = draftRepo.trim();
              if (!o) return;
              // Repo is optional — empty repo means "show owner profile".
              onUpdate?.(widget.id, { githubOwner: o, githubRepo: r || undefined });
              setForceEdit(false);
            };

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: compact ? 10 : 14,
                  boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
                  border: '1px solid rgba(48,54,61,0.6)',
                }}
                data-testid={`github-pulse-widget-${widget.id}`}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                  <Github size={compact ? 14 : 16} color="#c9d1d9" />
                  {!editing && owner ? (
                    <>
                      <a
                        href={
                          repoData?.htmlUrl
                          || userData?.htmlUrl
                          || (repo ? `https://github.com/${owner}/${repo}` : `https://github.com/${owner}`)
                        }
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          flex: 1, color: '#58a6ff', fontFamily: MONO,
                          fontSize: compact ? 11 : 12, fontWeight: 600,
                          textDecoration: 'none', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        data-testid={`github-link-${widget.id}`}
                      >
                        {repo ? `${owner}/${repo}` : `@${owner}`}
                      </a>
                      <button
                        onClick={() => { setDraftOwner(owner); setDraftRepo(repo || ''); setForceEdit(true); }}
                        style={qrIconBtnStyle()}
                        title={repo ? 'Change repo' : 'Change profile'}
                      >
                        <SettingsIcon size={11} />
                      </button>
                    </>
                  ) : (
                    <span style={{ flex: 1, color: '#7d8590', fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>
                      GitHub Pulse
                    </span>
                  )}
                </div>

                {/* Editor */}
                {editing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onKeyDown={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={draftOwner}
                        onChange={e => setDraftOwner(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { submitRepo(); } }}
                        placeholder="owner"
                        style={{ ...qrInputStyle(11), flex: 1 }}
                        data-testid={`github-input-owner-${widget.id}`}
                      />
                      <span style={{ color: '#7d8590', alignSelf: 'center', fontFamily: MONO, fontSize: 12 }}>/</span>
                      <input
                        type="text"
                        value={draftRepo}
                        onChange={e => setDraftRepo(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { submitRepo(); } }}
                        placeholder="repo (optional)"
                        style={{ ...qrInputStyle(11), flex: 1 }}
                        data-testid={`github-input-repo-${widget.id}`}
                      />
                    </div>
                    <button
                      onClick={submitRepo}
                      disabled={!draftOwner.trim()}
                      style={{
                        padding: '6px 8px', borderRadius: 6,
                        background: 'rgba(56,139,253,0.2)',
                        border: '1px solid rgba(56,139,253,0.5)',
                        color: '#58a6ff', cursor: 'pointer',
                        fontFamily: MONO, fontSize: 11, fontWeight: 600,
                      }}
                      data-testid={`github-submit-${widget.id}`}
                    >
                      {draftRepo.trim() ? 'Load repository' : 'Load profile'}
                    </button>
                    <p style={{ color: '#7d8590', fontFamily: MONO, fontSize: 10, margin: 0 }}>
                      Leave repo blank to show the owner's profile and top repos.
                    </p>
                  </div>
                )}

                {/* Body */}
                {!editing && (
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {loading && !payload && (
                      <span style={{ color: '#7d8590', fontFamily: MONO, fontSize: 11 }}>Loading…</span>
                    )}
                    {error && !payload && (
                      <span style={{ color: '#f85149', fontFamily: MONO, fontSize: 11 }}>{error}</span>
                    )}

                    {/* ── Repo mode ────────────────────────────────────────── */}
                    {repoData && (
                      <>
                        {repoData.description && !compact && (
                          <p style={{
                            color: '#8b949e', fontFamily: MONO, fontSize: 10.5,
                            margin: 0, lineHeight: 1.4, display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {repoData.description}
                          </p>
                        )}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                          flexShrink: 0,
                        }}>
                          <GitHubStat icon={<Star size={11} />} label="Stars" value={repoData.stars.toLocaleString()} color="#d29922" />
                          <GitHubStat icon={<GitPullRequest size={11} />} label="Open PRs" value={repoData.openPRs.toLocaleString()} color="#3fb950" />
                        </div>
                        {repoData.lastCommit && (
                          <a
                            href={repoData.lastCommit.url}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 2,
                              padding: 8, borderRadius: 6,
                              background: 'rgba(13,17,23,0.6)',
                              border: '1px solid rgba(48,54,61,0.6)',
                              textDecoration: 'none',
                            }}
                            data-testid={`github-commit-${widget.id}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <GitCommit size={11} color="#58a6ff" />
                              <span style={{ color: '#58a6ff', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                                {repoData.lastCommit.sha}
                              </span>
                              <span style={{ color: '#7d8590', fontFamily: MONO, fontSize: 9.5, marginLeft: 'auto' }}>
                                {timeAgo(repoData.lastCommit.authoredAt)}
                              </span>
                            </div>
                            <span style={{
                              color: '#c9d1d9', fontFamily: MONO, fontSize: 10.5,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {repoData.lastCommit.message}
                            </span>
                          </a>
                        )}
                        {repoData.latestRelease && (
                          <a
                            href={repoData.latestRelease.url}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 8px', borderRadius: 6,
                              background: 'rgba(63,185,80,0.08)',
                              border: '1px solid rgba(63,185,80,0.3)',
                              textDecoration: 'none',
                            }}
                          >
                            <Tag size={11} color="#3fb950" />
                            <span style={{ color: '#3fb950', fontFamily: MONO, fontSize: 10.5, fontWeight: 700 }}>
                              {repoData.latestRelease.tagName}
                            </span>
                            <span style={{ color: '#7d8590', fontFamily: MONO, fontSize: 9.5, marginLeft: 'auto' }}>
                              {timeAgo(repoData.latestRelease.publishedAt)}
                            </span>
                          </a>
                        )}
                      </>
                    )}

                    {/* ── Owner / profile mode ─────────────────────────────── */}
                    {userData && (
                      <div data-testid={`github-profile-${widget.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {userData.avatarUrl && (
                            <img
                              src={userData.avatarUrl}
                              alt={`${userData.login} avatar`}
                              width={compact ? 28 : 36}
                              height={compact ? 28 : 36}
                              style={{ borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(48,54,61,0.6)' }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              color: '#c9d1d9', fontFamily: MONO,
                              fontSize: compact ? 11 : 12, fontWeight: 700,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {userData.name || userData.login}
                            </div>
                            {userData.name && (
                              <div style={{
                                color: '#7d8590', fontFamily: MONO, fontSize: 10,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                @{userData.login}
                              </div>
                            )}
                          </div>
                        </div>
                        {userData.bio && !compact && (
                          <p style={{
                            color: '#8b949e', fontFamily: MONO, fontSize: 10.5,
                            margin: 0, lineHeight: 1.4, display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {userData.bio}
                          </p>
                        )}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 6, flexShrink: 0,
                        }}>
                          <GitHubStat icon={<Star size={11} />}    label="Repos"     value={userData.publicRepos.toLocaleString()} color="#d29922" />
                          <GitHubStat icon={<Github size={11} />}  label="Followers" value={userData.followers.toLocaleString()}   color="#58a6ff" />
                          <GitHubStat icon={<Github size={11} />}  label="Following" value={userData.following.toLocaleString()}   color="#3fb950" />
                        </div>
                        {userData.topRepos.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{
                              color: '#7d8590', fontFamily: MONO, fontSize: 9,
                              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            }}>
                              Top repos
                            </span>
                            {userData.topRepos.map(r => (
                              <a
                                key={r.htmlUrl}
                                href={r.htmlUrl}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '5px 8px', borderRadius: 6,
                                  background: 'rgba(13,17,23,0.6)',
                                  border: '1px solid rgba(48,54,61,0.6)',
                                  textDecoration: 'none',
                                }}
                                data-testid={`github-toprepo-${r.name}-${widget.id}`}
                              >
                                <span style={{
                                  flex: 1, color: '#58a6ff', fontFamily: MONO,
                                  fontSize: 10.5, fontWeight: 600,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {r.name}
                                </span>
                                <Star size={10} color="#d29922" />
                                <span style={{ color: '#d29922', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                                  {r.stars.toLocaleString()}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          const GitHubStat: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
            <div style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'rgba(13,17,23,0.6)',
              border: '1px solid rgba(48,54,61,0.6)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color }}>
                {icon}
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {label}
                </span>
              </div>
              <span style={{ color: '#c9d1d9', fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>
                {value}
              </span>
            </div>
          );

          // ─────────────────────────────────────────────────────────────────────────────
          //  RSSHeadlinesWidget — feed URL + scrolling list of headlines.
          //  Backed by /api/rss?url= (12 min cache).
          // ─────────────────────────────────────────────────────────────────────────────

          interface RSSHeadlinesProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          interface RSSPayload {
            title: string;
            link: string;
            items: { title: string; url: string; pubDate: string; isoDate: string }[];
            fetchedAt: number;
          }

          export const RSSHeadlinesWidget: React.FC<RSSHeadlinesProps> = ({ widget, onUpdate }) => {
            const [editing, setEditing] = useState<boolean>(!widget.rssUrl);
            const [draftUrl, setDraftUrl] = useState(widget.rssUrl || '');
            const [data, setData] = useState<RSSPayload | null>(null);
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<string | null>(null);

            const url = widget.rssUrl;

            useEffect(() => {
              if (!url) { setData(null); return; }
              let cancelled = false;
              const run = async () => {
                setLoading(true);
                setError(null);
                try {
                  const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
                  const body = await r.json();
                  if (cancelled) return;
                  if (!r.ok) {
                    setError(body?.error || `Error ${r.status}`);
                    setData(null);
                  } else {
                    setData(body);
                  }
                } catch (err: unknown) {
                  if (!cancelled) {
                    const msg = err instanceof Error ? err.message : 'Network error';
                    setError(msg);
                  }
                } finally {
                  if (!cancelled) setLoading(false);
                }
              };
              run();
              const id = setInterval(run, 12 * 60 * 1000);
              return () => { cancelled = true; clearInterval(id); };
            }, [url]);

            const submitUrl = () => {
              const u = draftUrl.trim();
              if (!u) return;
              onUpdate?.(widget.id, { rssUrl: u });
              setEditing(false);
            };

            return (
              <div
                style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: 12, boxSizing: 'border-box', overflow: 'hidden',
                  border: '1px solid rgba(71,85,105,0.4)',
                }}
                data-testid={`rss-headlines-widget-${widget.id}`}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                  <Rss size={14} color="#fb923c" />
                  {!editing && url ? (
                    <>
                      <span style={{
                        flex: 1, color: '#fb923c', fontFamily: MONO,
                        fontSize: 11, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={data?.title || url}>
                        {data?.title || 'RSS Feed'}
                      </span>
                      <button
                        onClick={() => { setDraftUrl(url); setEditing(true); }}
                        style={qrIconBtnStyle()}
                        title="Change feed"
                      >
                        <SettingsIcon size={11} />
                      </button>
                    </>
                  ) : (
                    <span style={{ flex: 1, color: '#fb923c', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                      RSS Headlines
                    </span>
                  )}
                </div>

                {/* Editor */}
                {editing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onKeyDown={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={draftUrl}
                      onChange={e => setDraftUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitUrl(); }}
                      placeholder="https://example.com/feed.xml"
                      style={qrInputStyle(11)}
                      data-testid={`rss-input-url-${widget.id}`}
                    />
                    <button
                      onClick={submitUrl}
                      disabled={!draftUrl.trim()}
                      style={{
                        padding: '6px 8px', borderRadius: 6,
                        background: 'rgba(251,146,60,0.2)',
                        border: '1px solid rgba(251,146,60,0.5)',
                        color: '#fb923c', cursor: 'pointer',
                        fontFamily: MONO, fontSize: 11, fontWeight: 600,
                      }}
                      data-testid={`rss-submit-${widget.id}`}
                    >
                      Load feed
                    </button>
                    <p style={{ color: '#64748b', fontFamily: MONO, fontSize: 10, margin: 0 }}>
                      Paste any RSS or Atom feed URL.
                    </p>
                  </div>
                )}

                {/* Body */}
                {!editing && (
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {loading && !data && (
                      <span style={{ color: '#64748b', fontFamily: MONO, fontSize: 11 }}>Loading…</span>
                    )}
                    {error && !data && (
                      <span style={{ color: '#f87171', fontFamily: MONO, fontSize: 11 }}>{error}</span>
                    )}
                    {data && data.items.length === 0 && !loading && (
                      <span style={{ color: '#64748b', fontFamily: MONO, fontSize: 11 }}>Feed has no items.</span>
                    )}
                    {data && data.items.length > 0 && (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {data.items.map((it, i) => (
                          <li key={`${it.url}-${i}`}>
                            <a
                              href={it.url || '#'}
                              target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'block',
                                padding: '6px 8px', borderRadius: 6,
                                background: 'rgba(15,23,42,0.55)',
                                border: '1px solid rgba(71,85,105,0.3)',
                                textDecoration: 'none',
                                color: '#e2e8f0', fontFamily: MONO, fontSize: 10.5,
                                lineHeight: 1.4,
                              }}
                              data-testid={`rss-item-${i}-${widget.id}`}
                            >
                              <span style={{
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              }}>
                                {it.title}
                              </span>
                              {it.isoDate && (
                                <span style={{ color: '#64748b', fontSize: 9, marginTop: 2, display: 'block' }}>
                                  {timeAgo(it.isoDate)}
                                </span>
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  HabitTrackerWidget — daily check-ins with 7-day streak strip.
          //  Storage: widget.habits[] = { id, name, days: ['YYYY-MM-DD', ...] }.
          //  Persists via the dashboard's existing widget blob; payload is a
          //  rolling 30-day window so even 8 habits stay well under 1 KB.
          // ─────────────────────────────────────────────────────────────────────────────

          interface HabitTrackerProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          // ISO date `YYYY-MM-DD` in local time — we deliberately avoid UTC so
          // a habit checked at 11pm doesn't roll into "tomorrow" for the user.
          function todayKey(): string {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
          }
          function offsetDayKey(offset: number): string {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
          }

          export const HabitTrackerWidget: React.FC<HabitTrackerProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [size, setSize] = useState(280);
            const [showSettings, setShowSettings] = useState(false);
            const [draftName, setDraftName] = useState('');

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                for (const e of entries) {
                  setSize(Math.min(e.contentRect.width, e.contentRect.height));
                }
              });
              ro.observe(el);
              return () => ro.disconnect();
            }, []);

            const habits = widget.habits ?? [];
            const today = todayKey();
            const last7 = useMemo(
              () => Array.from({ length: 7 }, (_, i) => offsetDayKey(-(6 - i))),
              [],
            );

            const setHabits = useCallback(
              (next: NonNullable<Widget['habits']>) => {
                // Trim each habit's day list to the rolling 30-day window so
                // the persisted blob never grows unbounded.
                const cutoff = offsetDayKey(-29);
                const trimmed = next.map(h => ({
                  ...h,
                  days: Array.from(new Set(h.days)).filter(d => d >= cutoff).sort(),
                }));
                onUpdate?.(widget.id, { habits: trimmed });
              },
              [onUpdate, widget.id],
            );

            const toggle = (habitId: string, dayKey: string) => {
              const next = habits.map(h => {
                if (h.id !== habitId) return h;
                const has = h.days.includes(dayKey);
                return { ...h, days: has ? h.days.filter(d => d !== dayKey) : [...h.days, dayKey] };
              });
              setHabits(next);
            };

            const addHabit = () => {
              const name = draftName.trim();
              if (!name) return;
              if (habits.length >= 8) return;
              setHabits([...habits, { id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, days: [] }]);
              setDraftName('');
            };

            const removeHabit = (id: string) => {
              setHabits(habits.filter(h => h.id !== id));
            };

            const renameHabit = (id: string, name: string) => {
              setHabits(habits.map(h => h.id === id ? { ...h, name } : h));
            };

            // Theme awareness: use the per-widget colour droplet as the
            // background (Task #10 Clock/Countdown/WorldClocks pattern). When
            // the user picks a light bg we flip text + borders dark via
            // `isLightBg` so the widget reads cleanly in any theme.
            const bgColor    = widget.customColor ?? '#0f172a';
            const light      = isLightBg(bgColor);
            const accent     = light ? '#dc2626' : '#fb7185';
            const clrPrimary = light ? '#0f172a' : '#e2e8f0';
            const clrSubtle  = light ? '#475569' : '#cbd5e1';
            const clrMuted   = light ? '#64748b' : '#64748b';
            const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
            const clrCellBg  = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
            const clrCellBdr = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';
            const clrInert   = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
            const clrInertBd = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
            const fs = Math.max(10, Math.min(13, size * 0.04));

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: bgColor,
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: 12, boxSizing: 'border-box', overflow: 'hidden',
                  border: `1px solid ${clrBorder}`,
                  position: 'relative',
                }}
                data-testid={`habit-tracker-widget-${widget.id}`}
              >
                {/* Hover-only cog */}
                <div
                  className="widget-hover-cog"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    transition: 'opacity 0.15s', zIndex: 5,
                  }}
                >
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    style={qrIconBtnStyle()}
                    title="Habit settings"
                    data-testid={`habit-settings-toggle-${widget.id}`}
                  >
                    <SettingsIcon size={11} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                  <Flame size={14} color={accent} />
                  <span style={{
                    flex: 1, color: accent, fontFamily: MONO,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    HABITS
                  </span>
                  <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>
                    {habits.filter(h => h.days.includes(today)).length}/{habits.length} today
                  </span>
                </div>

                {/* Settings overlay */}
                {showSettings && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(15,23,42,0.97)', zIndex: 4,
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
                      borderRadius: 'var(--outer-radius)',
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    data-testid={`habit-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                        Edit habits
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        style={qrIconBtnStyle()}
                        data-testid={`habit-settings-close-${widget.id}`}
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={draftName}
                        onChange={e => setDraftName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addHabit(); }}
                        placeholder="New habit name…"
                        maxLength={40}
                        style={qrInputStyle(11)}
                        data-testid={`habit-input-name-${widget.id}`}
                      />
                      <button
                        onClick={addHabit}
                        disabled={!draftName.trim() || habits.length >= 8}
                        style={{
                          ...qrIconBtnStyle(),
                          opacity: !draftName.trim() || habits.length >= 8 ? 0.4 : 1,
                        }}
                        data-testid={`habit-add-${widget.id}`}
                      >
                        <PlusIcon size={11} />
                      </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {habits.map(h => (
                        <div key={h.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="text"
                            value={h.name}
                            onChange={e => renameHabit(h.id, e.target.value)}
                            maxLength={40}
                            style={qrInputStyle(10)}
                            data-testid={`habit-rename-${h.id}-${widget.id}`}
                          />
                          <button
                            onClick={() => removeHabit(h.id)}
                            style={qrIconBtnStyle()}
                            title="Delete"
                            data-testid={`habit-remove-${h.id}-${widget.id}`}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                      {habits.length === 0 && (
                        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10 }}>
                          Add your first habit above.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Body */}
                {!showSettings && (
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {habits.length === 0 && (
                      <button
                        onClick={() => setShowSettings(true)}
                        style={{
                          margin: 'auto', padding: '8px 12px', borderRadius: 6,
                          background: clrInert,
                          border: `1px dashed ${clrInertBd}`,
                          color: clrSubtle, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                        }}
                        data-testid={`habit-empty-cta-${widget.id}`}
                      >
                        + Add a habit
                      </button>
                    )}
                    {habits.map(h => {
                      const checkedToday = h.days.includes(today);
                      // Streak = consecutive days back from today (or yesterday
                      // if today not yet checked) where the habit was checked.
                      let streak = 0;
                      for (let i = 0; i < 60; i++) {
                        const k = offsetDayKey(-i);
                        if (h.days.includes(k)) streak++;
                        else if (i === 0) continue; // today blank doesn't kill streak yet
                        else break;
                      }
                      return (
                        <div
                          key={h.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px', borderRadius: 6,
                            background: clrCellBg,
                            border: `1px solid ${clrCellBdr}`,
                          }}
                        >
                          <button
                            onClick={() => toggle(h.id, today)}
                            style={{
                              ...qrIconBtnStyle(),
                              background: checkedToday ? `${accent}33` : clrInert,
                              borderColor: checkedToday ? accent : clrInertBd,
                              color: checkedToday ? accent : clrSubtle,
                            }}
                            title={checkedToday ? 'Uncheck today' : 'Check off today'}
                            data-testid={`habit-toggle-today-${h.id}-${widget.id}`}
                          >
                            {checkedToday ? <CheckSquare size={12} /> : <SquareIcon size={12} />}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              color: clrPrimary, fontFamily: MONO, fontSize: fs, fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {h.name}
                            </div>
                            <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                              {last7.map(k => {
                                const has = h.days.includes(k);
                                const isToday = k === today;
                                return (
                                  <button
                                    key={k}
                                    onClick={() => toggle(h.id, k)}
                                    title={k}
                                    style={{
                                      width: 10, height: 10, borderRadius: 2,
                                      background: has ? accent : clrInert,
                                      border: isToday ? `1px solid ${accent}` : `1px solid ${clrInertBd}`,
                                      cursor: 'pointer', padding: 0,
                                    }}
                                    data-testid={`habit-day-${h.id}-${k}-${widget.id}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 2,
                            color: streak > 0 ? accent : clrMuted,
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                          }}>
                            <Flame size={10} />
                            {streak}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  QuickLaunchWidget — grid of named URL tiles (2/3/4 cols).
          // ─────────────────────────────────────────────────────────────────────────────

          interface QuickLaunchProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          function faviconUrl(rawUrl: string): string {
            try {
              const u = new URL(rawUrl);
              return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
            } catch {
              return '';
            }
          }
          function normalizeUrl(raw: string): string {
            const t = raw.trim();
            if (!t) return '';
            if (/^https?:\/\//i.test(t)) return t;
            return `https://${t}`;
          }

          export const QuickLaunchWidget: React.FC<QuickLaunchProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [size, setSize] = useState(280);
            const [showSettings, setShowSettings] = useState(false);
            const [draftLabel, setDraftLabel] = useState('');
            const [draftUrl, setDraftUrl] = useState('');

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                for (const e of entries) setSize(Math.min(e.contentRect.width, e.contentRect.height));
              });
              ro.observe(el);
              return () => ro.disconnect();
            }, []);

            const cols = (widget.quickLaunchCols ?? 3) as 2 | 3 | 4;
            const tiles = widget.quickLinks ?? [];
            // Theme awareness — see HabitTracker note.
            const bgColor    = widget.customColor ?? '#0f172a';
            const light      = isLightBg(bgColor);
            const accent     = light ? '#0891b2' : '#2dd4bf';
            const clrPrimary = light ? '#0f172a' : '#e2e8f0';
            const clrSubtle  = light ? '#475569' : '#cbd5e1';
            const clrMuted   = light ? '#64748b' : '#64748b';
            const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
            const clrTileBg  = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
            const clrTileBd  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';

            const setTiles = (next: NonNullable<Widget['quickLinks']>) => {
              onUpdate?.(widget.id, { quickLinks: next });
            };
            const setCols = (n: 2 | 3 | 4) => {
              onUpdate?.(widget.id, { quickLaunchCols: n });
            };

            const addTile = () => {
              const u = normalizeUrl(draftUrl);
              const label = draftLabel.trim() || (() => {
                try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Link'; }
              })();
              if (!u) return;
              if (tiles.length >= 16) return;
              setTiles([
                ...tiles,
                { id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label, url: u },
              ]);
              setDraftLabel('');
              setDraftUrl('');
            };
            const removeTile = (id: string) => setTiles(tiles.filter(t => t.id !== id));
            const moveTile = (id: string, dir: -1 | 1) => {
              const i = tiles.findIndex(t => t.id === id);
              if (i < 0) return;
              const j = i + dir;
              if (j < 0 || j >= tiles.length) return;
              const next = [...tiles];
              [next[i], next[j]] = [next[j], next[i]];
              setTiles(next);
            };

            const tileFs = Math.max(9, Math.min(12, size * 0.035));

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: bgColor,
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: 12, boxSizing: 'border-box', overflow: 'hidden',
                  border: `1px solid ${clrBorder}`,
                  position: 'relative',
                }}
                data-testid={`quick-launch-widget-${widget.id}`}
              >
                <div
                  className="widget-hover-cog"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    transition: 'opacity 0.15s', zIndex: 5,
                  }}
                >
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    style={qrIconBtnStyle()}
                    title="Tile settings"
                    data-testid={`quick-launch-settings-toggle-${widget.id}`}
                  >
                    <SettingsIcon size={11} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                  <Grid3x3 size={14} color={accent} />
                  <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                    QUICK LAUNCH
                  </span>
                  <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>{tiles.length} tile{tiles.length === 1 ? '' : 's'}</span>
                </div>

                {showSettings && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(15,23,42,0.97)', zIndex: 4,
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
                      borderRadius: 'var(--outer-radius)',
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    data-testid={`quick-launch-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                        Edit tiles
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        style={qrIconBtnStyle()}
                        data-testid={`quick-launch-settings-close-${widget.id}`}
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([2, 3, 4] as const).map(n => (
                        <button
                          key={n}
                          onClick={() => setCols(n)}
                          style={{
                            ...qrIconBtnStyle(),
                            background: cols === n ? `${accent}33` : 'rgba(255,255,255,0.04)',
                            borderColor: cols === n ? accent : 'rgba(255,255,255,0.1)',
                            color: cols === n ? accent : '#cbd5e1',
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                            padding: '4px 8px',
                          }}
                          data-testid={`quick-launch-cols-${n}-${widget.id}`}
                        >
                          {n}×{n}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <input
                        type="text"
                        value={draftLabel}
                        onChange={e => setDraftLabel(e.target.value)}
                        placeholder="Label (optional)"
                        maxLength={20}
                        style={qrInputStyle(11)}
                        data-testid={`quick-launch-input-label-${widget.id}`}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="text"
                          value={draftUrl}
                          onChange={e => setDraftUrl(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addTile(); }}
                          placeholder="https://example.com"
                          style={qrInputStyle(11)}
                          data-testid={`quick-launch-input-url-${widget.id}`}
                        />
                        <button
                          onClick={addTile}
                          disabled={!draftUrl.trim() || tiles.length >= 16}
                          style={{
                            ...qrIconBtnStyle(),
                            opacity: !draftUrl.trim() || tiles.length >= 16 ? 0.4 : 1,
                          }}
                          data-testid={`quick-launch-add-${widget.id}`}
                        >
                          <PlusIcon size={11} />
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {tiles.map((t, i) => (
                        <div key={t.id} style={{
                          display: 'flex', gap: 4, alignItems: 'center',
                          padding: '4px 6px', borderRadius: 4,
                          background: clrTileBg,
                          border: `1px solid ${clrTileBd}`,
                        }}>
                          <span style={{
                            flex: 1, color: clrPrimary, fontFamily: MONO, fontSize: 10,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }} title={`${t.label} → ${t.url}`}>
                            {t.label}
                          </span>
                          <button
                            onClick={() => moveTile(t.id, -1)}
                            disabled={i === 0}
                            style={{ ...qrIconBtnStyle(), opacity: i === 0 ? 0.3 : 1, padding: 4 }}
                            data-testid={`quick-launch-up-${t.id}-${widget.id}`}
                          >
                            <ChevronLeft size={10} />
                          </button>
                          <button
                            onClick={() => moveTile(t.id, 1)}
                            disabled={i === tiles.length - 1}
                            style={{ ...qrIconBtnStyle(), opacity: i === tiles.length - 1 ? 0.3 : 1, padding: 4 }}
                            data-testid={`quick-launch-down-${t.id}-${widget.id}`}
                          >
                            <ChevronRight size={10} />
                          </button>
                          <button
                            onClick={() => removeTile(t.id)}
                            style={{ ...qrIconBtnStyle(), padding: 4 }}
                            data-testid={`quick-launch-remove-${t.id}-${widget.id}`}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!showSettings && (
                  <div style={{
                    flex: 1, minHeight: 0,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: 6,
                  }}>
                    {tiles.length === 0 && (
                      <button
                        onClick={() => setShowSettings(true)}
                        style={{
                          gridColumn: `span ${cols}`,
                          padding: '8px 12px', borderRadius: 6,
                          background: clrTileBg,
                          border: `1px dashed ${clrTileBd}`,
                          color: clrSubtle, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                          alignSelf: 'center',
                        }}
                        data-testid={`quick-launch-empty-cta-${widget.id}`}
                      >
                        + Add tile
                      </button>
                    )}
                    {tiles.slice(0, cols * cols).map(t => (
                      <a
                        key={t.id}
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 4, padding: 6, borderRadius: 6,
                          background: clrTileBg,
                          border: `1px solid ${accent}33`,
                          textDecoration: 'none', color: clrPrimary,
                          minHeight: 0, overflow: 'hidden',
                          transition: 'transform 0.1s, border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = accent; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}33`; }}
                        title={t.url}
                        data-testid={`quick-launch-tile-${t.id}-${widget.id}`}
                      >
                        <img
                          src={faviconUrl(t.url)}
                          alt=""
                          style={{ width: 20, height: 20, flexShrink: 0 }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        />
                        <span style={{
                          fontFamily: MONO, fontSize: tileFs, fontWeight: 600,
                          textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: '100%',
                        }}>
                          {t.label}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  BigTextMarqueeWidget — static or scrolling banner.
          // ─────────────────────────────────────────────────────────────────────────────

          interface BigTextMarqueeProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const BigTextMarqueeWidget: React.FC<BigTextMarqueeProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const textRef = useRef<HTMLSpanElement>(null);
            const [size, setSize] = useState({ w: 320, h: 120 });
            const [showSettings, setShowSettings] = useState(false);
            const [staticFs, setStaticFs] = useState(48);

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
              });
              ro.observe(el);
              return () => ro.disconnect();
            }, []);

            const text = widget.marqueeText ?? 'ON AIR';
            const mode = widget.marqueeMode ?? 'static';
            const speed = widget.marqueeSpeed ?? 120;
            // Theme awareness: bg comes from marqueeBgColor (or customColor as
            // fallback) so the widget already follows the user's theme via the
            // colour droplet. We flip the auto-fg accent and border when the
            // chosen bg is light enough to need dark contrast.
            const bg = widget.marqueeBgColor ?? widget.customColor ?? '#1e0b2e';
            const light = isLightBg(bg);
            const fg = widget.marqueeFgColor ?? (light ? '#9d174d' : '#f9a8d4');
            const clrBorder = light ? 'rgba(0,0,0,0.12)' : 'rgba(71,85,105,0.4)';

            // For static mode, fit-to-width: shrink font until single-line text
            // fits in 90% of width. We bisect rather than measuring per-character
            // because ResizeObserver retriggers on every resize anyway.
            useEffect(() => {
              if (mode !== 'static') return;
              const container = containerRef.current;
              const span = textRef.current;
              if (!container || !span) return;
              const targetW = container.clientWidth * 0.9;
              const targetH = container.clientHeight * 0.7;
              let lo = 12, hi = Math.min(targetH, 240);
              for (let i = 0; i < 8; i++) {
                const mid = (lo + hi) / 2;
                span.style.fontSize = `${mid}px`;
                if (span.scrollWidth <= targetW) lo = mid; else hi = mid;
              }
              setStaticFs(lo);
            }, [text, mode, size.w, size.h]);

            // Scroll mode duration in seconds — derived from text width and speed.
            // Re-measured whenever text or width changes.
            const [scrollDur, setScrollDur] = useState(8);
            useEffect(() => {
              if (mode !== 'scroll') return;
              const span = textRef.current;
              if (!span) return;
              const totalDist = span.scrollWidth + size.w;
              setScrollDur(Math.max(3, totalDist / Math.max(40, speed)));
            }, [text, mode, speed, size.w]);

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: bg,
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, boxSizing: 'border-box', overflow: 'hidden',
                  border: `1px solid ${clrBorder}`,
                  position: 'relative',
                }}
                data-testid={`big-text-marquee-widget-${widget.id}`}
              >
                <style>{`
                  @keyframes obb-marquee-scroll {
                    0%   { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                  }
                `}</style>
                <div
                  className="widget-hover-cog"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    transition: 'opacity 0.15s', zIndex: 5,
                  }}
                >
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    style={qrIconBtnStyle()}
                    title="Marquee settings"
                    data-testid={`marquee-settings-toggle-${widget.id}`}
                  >
                    <SettingsIcon size={11} />
                  </button>
                </div>

                {showSettings && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(15,23,42,0.97)', zIndex: 4,
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
                      borderRadius: 'var(--outer-radius)',
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    data-testid={`marquee-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, color: fg, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                        Big Text
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        style={qrIconBtnStyle()}
                        data-testid={`marquee-settings-close-${widget.id}`}
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={text}
                      onChange={e => onUpdate?.(widget.id, { marqueeText: e.target.value.slice(0, 200) })}
                      maxLength={200}
                      placeholder="Headline text"
                      style={qrInputStyle(12)}
                      data-testid={`marquee-input-text-${widget.id}`}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['static', 'scroll'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => onUpdate?.(widget.id, { marqueeMode: m })}
                          style={{
                            ...qrIconBtnStyle(),
                            flex: 1,
                            background: mode === m ? `${fg}33` : 'rgba(255,255,255,0.04)',
                            borderColor: mode === m ? fg : 'rgba(255,255,255,0.1)',
                            color: mode === m ? fg : '#cbd5e1',
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                            padding: '4px 8px',
                          }}
                          data-testid={`marquee-mode-${m}-${widget.id}`}
                        >
                          {m === 'static' ? 'STATIC' : 'SCROLL'}
                        </button>
                      ))}
                    </div>
                    {mode === 'scroll' && (
                      <div>
                        <span style={qrLabelStyle()}>Speed: {speed}px/s</span>
                        <input
                          type="range" min={40} max={400} step={10}
                          value={speed}
                          onChange={e => onUpdate?.(widget.id, { marqueeSpeed: Number(e.target.value) })}
                          style={{ width: '100%' }}
                          data-testid={`marquee-speed-${widget.id}`}
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <span style={qrLabelStyle()}>Text</span>
                        <input
                          type="color" value={fg}
                          onChange={e => onUpdate?.(widget.id, { marqueeFgColor: e.target.value })}
                          style={qrColorPickerStyle()}
                          data-testid={`marquee-fg-${widget.id}`}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={qrLabelStyle()}>Background</span>
                        <input
                          type="color" value={bg}
                          onChange={e => onUpdate?.(widget.id, { marqueeBgColor: e.target.value })}
                          style={qrColorPickerStyle()}
                          data-testid={`marquee-bg-${widget.id}`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {mode === 'static' && (
                  <span
                    ref={textRef}
                    style={{
                      color: fg,
                      fontFamily: MONO, fontWeight: 900,
                      whiteSpace: 'nowrap', letterSpacing: '0.04em',
                      fontSize: staticFs,
                      textShadow: `0 0 24px ${fg}55`,
                    }}
                    data-testid={`marquee-text-${widget.id}`}
                  >
                    {text}
                  </span>
                )}
                {mode === 'scroll' && (
                  <div style={{
                    width: '100%', overflow: 'hidden',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <span
                      ref={textRef}
                      style={{
                        display: 'inline-block',
                        color: fg,
                        fontFamily: MONO, fontWeight: 900,
                        whiteSpace: 'nowrap', letterSpacing: '0.04em',
                        fontSize: Math.max(24, Math.min(96, size.h * 0.55)),
                        textShadow: `0 0 24px ${fg}55`,
                        animation: `obb-marquee-scroll ${scrollDur}s linear infinite`,
                      }}
                      data-testid={`marquee-text-${widget.id}`}
                    >
                      {text}
                    </span>
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  NetworkLightWidget — pings a URL, shows green/red dot + latency.
          // ─────────────────────────────────────────────────────────────────────────────

          interface NetworkLightProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          interface PingResult {
            ok: boolean;
            status: number;
            latencyMs: number;
            fetchedAt: number;
            error?: string;
          }

          export const NetworkLightWidget: React.FC<NetworkLightProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [size, setSize] = useState(180);
            const [showSettings, setShowSettings] = useState(false);
            const [draftUrl, setDraftUrl] = useState(widget.networkUrl ?? '');
            const [result, setResult] = useState<PingResult | null>(null);
            const [pinging, setPinging] = useState(false);

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver((entries) => {
                for (const e of entries) setSize(Math.min(e.contentRect.width, e.contentRect.height));
              });
              ro.observe(el);
              return () => ro.disconnect();
            }, []);

            const url = widget.networkUrl;
            const intervalSec = widget.networkIntervalSec ?? 30;

            useEffect(() => {
              if (!url) { setResult(null); return; }
              let cancelled = false;
              const ping = async () => {
                setPinging(true);
                try {
                  const r = await fetch(`/api/ping?url=${encodeURIComponent(url)}`);
                  const body: PingResult = await r.json();
                  if (!cancelled) setResult(body);
                } catch (err: unknown) {
                  if (!cancelled) {
                    setResult({
                      ok: false, status: 0, latencyMs: 0, fetchedAt: Date.now(),
                      error: err instanceof Error ? err.message : 'Network error',
                    });
                  }
                } finally {
                  if (!cancelled) setPinging(false);
                }
              };
              ping();
              const id = setInterval(ping, intervalSec * 1000);
              return () => { cancelled = true; clearInterval(id); };
            }, [url, intervalSec]);

            const submit = () => {
              const u = normalizeUrl(draftUrl);
              if (!u) return;
              onUpdate?.(widget.id, { networkUrl: u });
              setShowSettings(false);
            };

            // Theme awareness — see HabitTracker note.
            const bgColor    = widget.customColor ?? '#0f172a';
            const light      = isLightBg(bgColor);
            const accent     = light ? '#65a30d' : '#a3e635';
            const clrPrimary = light ? '#0f172a' : '#e2e8f0';
            const clrSubtle  = light ? '#475569' : '#cbd5e1';
            const clrMuted   = light ? '#64748b' : '#64748b';
            const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
            const dotColor = !url ? (light ? '#94a3b8' : '#475569')
                              : pinging ? '#fbbf24'
                              : result?.ok ? '#22c55e' : '#ef4444';
            const dotSize = Math.max(40, Math.min(96, size * 0.36));
            const labelFs = Math.max(9, Math.min(12, size * 0.06));
            const host = (() => { try { return new URL(url || '').hostname.replace(/^www\./, ''); } catch { return url || ''; } })();

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: bgColor,
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: 12, boxSizing: 'border-box', overflow: 'hidden',
                  border: `1px solid ${clrBorder}`,
                  position: 'relative',
                }}
                data-testid={`network-light-widget-${widget.id}`}
              >
                <div
                  className="widget-hover-cog"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    transition: 'opacity 0.15s', zIndex: 5,
                  }}
                >
                  <button
                    onClick={() => { setDraftUrl(url ?? ''); setShowSettings(s => !s); }}
                    style={qrIconBtnStyle()}
                    title="Network settings"
                    data-testid={`network-settings-toggle-${widget.id}`}
                  >
                    <SettingsIcon size={11} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                  <Activity size={14} color={accent} />
                  <span style={{
                    flex: 1, color: accent, fontFamily: MONO,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {host || 'NETWORK LIGHT'}
                  </span>
                </div>

                {(showSettings || !url) && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(15,23,42,0.97)', zIndex: 4,
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
                      borderRadius: 'var(--outer-radius)',
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    data-testid={`network-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                        Ping target
                      </span>
                      {url && (
                        <button
                          onClick={() => setShowSettings(false)}
                          style={qrIconBtnStyle()}
                          data-testid={`network-settings-close-${widget.id}`}
                        >
                          <XIcon size={11} />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={draftUrl}
                      onChange={e => setDraftUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                      placeholder="https://example.com"
                      style={qrInputStyle(11)}
                      data-testid={`network-input-url-${widget.id}`}
                    />
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {([10, 30, 60, 300] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => onUpdate?.(widget.id, { networkIntervalSec: s })}
                          style={{
                            ...qrIconBtnStyle(),
                            background: intervalSec === s ? `${accent}33` : 'rgba(255,255,255,0.04)',
                            borderColor: intervalSec === s ? accent : 'rgba(255,255,255,0.1)',
                            color: intervalSec === s ? accent : '#cbd5e1',
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                            padding: '4px 6px',
                          }}
                          data-testid={`network-interval-${s}-${widget.id}`}
                        >
                          {s < 60 ? `${s}s` : `${s / 60}m`}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={submit}
                      disabled={!draftUrl.trim()}
                      style={{
                        padding: '6px 8px', borderRadius: 6,
                        background: `${accent}33`,
                        border: `1px solid ${accent}`,
                        color: accent, cursor: 'pointer',
                        fontFamily: MONO, fontSize: 11, fontWeight: 700,
                        opacity: !draftUrl.trim() ? 0.4 : 1,
                      }}
                      data-testid={`network-submit-${widget.id}`}
                    >
                      Save & ping
                    </button>
                  </div>
                )}

                {!showSettings && url && (
                  <div style={{
                    flex: 1, minHeight: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <div
                      style={{
                        width: dotSize, height: dotSize, borderRadius: '50%',
                        background: `radial-gradient(circle, ${dotColor} 0%, ${dotColor}66 70%, transparent 100%)`,
                        boxShadow: `0 0 ${dotSize * 0.4}px ${dotColor}88`,
                        transition: 'background 0.4s, box-shadow 0.4s',
                      }}
                      data-testid={`network-dot-${widget.id}`}
                    />
                    <div style={{
                      color: clrPrimary, fontFamily: MONO,
                      fontSize: labelFs, fontWeight: 700,
                    }}>
                      {!result ? 'Pinging…' : result.ok ? `${result.latencyMs}ms` : result.error?.slice(0, 30) || 'DOWN'}
                    </div>
                    {result && (
                      <div style={{
                        color: clrMuted, fontFamily: MONO,
                        fontSize: Math.max(8, labelFs - 2),
                      }}>
                        {result.status > 0 ? `HTTP ${result.status}` : '—'} · every {intervalSec < 60 ? `${intervalSec}s` : `${intervalSec / 60}m`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  PhotoLoopWidget — rotating image gallery with crossfade.
          // ─────────────────────────────────────────────────────────────────────────────

          interface PhotoLoopProps {
            widget: Widget;
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export const PhotoLoopWidget: React.FC<PhotoLoopProps> = ({ widget, onUpdate }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [showSettings, setShowSettings] = useState(false);
            const [draftUrl, setDraftUrl] = useState('');
            const [idx, setIdx] = useState(0);
            const [paused, setPaused] = useState(false);

            useEffect(() => {
              const el = containerRef.current;
              if (!el) return;
              const ro = new ResizeObserver(() => { /* nothing layout-dependent */ });
              ro.observe(el);
              return () => ro.disconnect();
            }, []);

            const photos = widget.photoUrls ?? [];
            const intervalSec = widget.photoIntervalSec ?? 5;
            const fit = widget.photoFit ?? 'cover';
            // Theme awareness: photos look best framed in black, but the user
            // can override via the colour droplet — we then flip the border
            // and accent contrast accordingly (Task #10 Clock-family pattern).
            const bgColor   = widget.customColor ?? '#000';
            const light     = isLightBg(bgColor);
            const accent    = light ? '#7c3aed' : '#c084fc';
            const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';

            useEffect(() => {
              if (paused) return;
              if (photos.length <= 1 || intervalSec <= 0) return;
              const id = setInterval(() => setIdx(i => (i + 1) % photos.length), intervalSec * 1000);
              return () => clearInterval(id);
            }, [photos.length, intervalSec, paused]);

            // Reset idx if we deleted past the end.
            useEffect(() => {
              if (idx >= photos.length) setIdx(0);
            }, [photos.length, idx]);

            const setPhotos = (next: string[]) => {
              onUpdate?.(widget.id, { photoUrls: next });
            };

            const addUrl = () => {
              const u = normalizeUrl(draftUrl);
              if (!u) return;
              if (photos.length >= 20) return;
              setPhotos([...photos, u]);
              setDraftUrl('');
            };
            const removeAt = (i: number) => setPhotos(photos.filter((_, j) => j !== i));

            const handleUpload = (file: File) => {
              if (file.size > 800_000) {
                alert('Image too large — pick something under ~800 KB or paste a URL.');
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result;
                if (typeof result === 'string') {
                  if (photos.length >= 20) return;
                  setPhotos([...photos, result]);
                }
              };
              reader.readAsDataURL(file);
            };

            const current = photos[idx] ?? null;

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: bgColor,
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: 0, boxSizing: 'border-box', overflow: 'hidden',
                  border: `1px solid ${clrBorder}`,
                  position: 'relative',
                }}
                data-testid={`photo-loop-widget-${widget.id}`}
              >
                <div
                  className="widget-hover-cog"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    transition: 'opacity 0.15s', zIndex: 5,
                    display: 'flex', gap: 4,
                  }}
                >
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
                        style={qrIconBtnStyle()}
                        title="Previous"
                        data-testid={`photo-loop-prev-${widget.id}`}
                      >
                        <ChevronLeft size={11} />
                      </button>
                      <button
                        onClick={() => setPaused(p => !p)}
                        style={{
                          ...qrIconBtnStyle(),
                          color: paused ? accent : '#cbd5e1',
                          borderColor: paused ? accent : 'rgba(255,255,255,0.1)',
                        }}
                        title={paused ? 'Resume slideshow' : 'Pause slideshow'}
                        data-testid={`photo-loop-${paused ? 'play' : 'pause'}-${widget.id}`}
                      >
                        {paused ? <PlayIcon size={11} /> : <PauseIcon size={11} />}
                      </button>
                      <button
                        onClick={() => setIdx(i => (i + 1) % photos.length)}
                        style={qrIconBtnStyle()}
                        title="Next"
                        data-testid={`photo-loop-next-${widget.id}`}
                      >
                        <ChevronRight size={11} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    style={qrIconBtnStyle()}
                    title="Photo settings"
                    data-testid={`photo-loop-settings-toggle-${widget.id}`}
                  >
                    <SettingsIcon size={11} />
                  </button>
                </div>

                {showSettings && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(15,23,42,0.97)', zIndex: 4,
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
                      borderRadius: 'var(--outer-radius)',
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    data-testid={`photo-loop-settings-panel-${widget.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
                        Photo Loop
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        style={qrIconBtnStyle()}
                        data-testid={`photo-loop-settings-close-${widget.id}`}
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="text"
                        value={draftUrl}
                        onChange={e => setDraftUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addUrl(); }}
                        placeholder="Paste image URL…"
                        style={qrInputStyle(11)}
                        data-testid={`photo-loop-input-url-${widget.id}`}
                      />
                      <button
                        onClick={addUrl}
                        disabled={!draftUrl.trim() || photos.length >= 20}
                        style={{
                          ...qrIconBtnStyle(),
                          opacity: !draftUrl.trim() || photos.length >= 20 ? 0.4 : 1,
                        }}
                        data-testid={`photo-loop-add-${widget.id}`}
                      >
                        <PlusIcon size={11} />
                      </button>
                    </div>
                    <label
                      style={{
                        ...qrIconBtnStyle(),
                        cursor: photos.length >= 20 ? 'not-allowed' : 'pointer',
                        opacity: photos.length >= 20 ? 0.4 : 1,
                        justifyContent: 'flex-start', gap: 6, padding: '6px 8px',
                        fontFamily: MONO, fontSize: 11,
                      }}
                      data-testid={`photo-loop-upload-label-${widget.id}`}
                    >
                      <Upload size={11} />
                      Upload from device (≤800 KB)
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={photos.length >= 20}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(f);
                          e.target.value = '';
                        }}
                        data-testid={`photo-loop-upload-${widget.id}`}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {([0, 3, 5, 10, 30] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => onUpdate?.(widget.id, { photoIntervalSec: s })}
                          style={{
                            ...qrIconBtnStyle(),
                            background: intervalSec === s ? `${accent}33` : 'rgba(255,255,255,0.04)',
                            borderColor: intervalSec === s ? accent : 'rgba(255,255,255,0.1)',
                            color: intervalSec === s ? accent : '#cbd5e1',
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                            padding: '4px 6px',
                          }}
                          data-testid={`photo-loop-interval-${s}-${widget.id}`}
                        >
                          {s === 0 ? 'MANUAL' : `${s}s`}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['cover', 'contain'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => onUpdate?.(widget.id, { photoFit: f })}
                          style={{
                            ...qrIconBtnStyle(),
                            flex: 1,
                            background: fit === f ? `${accent}33` : 'rgba(255,255,255,0.04)',
                            borderColor: fit === f ? accent : 'rgba(255,255,255,0.1)',
                            color: fit === f ? accent : '#cbd5e1',
                            fontFamily: MONO, fontSize: 10, fontWeight: 700,
                            padding: '4px 6px',
                          }}
                          data-testid={`photo-loop-fit-${f}-${widget.id}`}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {photos.map((p, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: 4, alignItems: 'center',
                          padding: 4, borderRadius: 4,
                          background: 'rgba(15,23,42,0.55)',
                          border: '1px solid rgba(71,85,105,0.3)',
                        }}>
                          <img src={p} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }} />
                          <span style={{
                            flex: 1, color: '#cbd5e1', fontFamily: MONO, fontSize: 9,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {p.startsWith('data:') ? `Upload #${i + 1}` : p}
                          </span>
                          <button
                            onClick={() => removeAt(i)}
                            style={{ ...qrIconBtnStyle(), padding: 4 }}
                            data-testid={`photo-loop-remove-${i}-${widget.id}`}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!showSettings && photos.length === 0 && (
                  <button
                    onClick={() => setShowSettings(true)}
                    style={{
                      margin: 'auto', padding: '8px 12px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px dashed rgba(255,255,255,0.2)',
                      color: '#cbd5e1', fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                    }}
                    data-testid={`photo-loop-empty-cta-${widget.id}`}
                  >
                    + Add photos
                  </button>
                )}
                {!showSettings && current && (
                  <>
                    <img
                      key={`${idx}-${current.slice(0, 32)}`}
                      src={current}
                      alt=""
                      style={{
                        width: '100%', height: '100%',
                        objectFit: fit,
                        animation: 'obb-photo-fade 0.6s ease-in',
                      }}
                      data-testid={`photo-loop-image-${widget.id}`}
                    />
                    <style>{`
                      @keyframes obb-photo-fade {
                        from { opacity: 0; }
                        to   { opacity: 1; }
                      }
                    `}</style>
                    {photos.length > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 6, left: 0, right: 0,
                        display: 'flex', justifyContent: 'center', gap: 4,
                        pointerEvents: 'none',
                      }}>
                        {photos.map((_, i) => (
                          <span
                            key={i}
                            style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: i === idx ? accent : 'rgba(255,255,255,0.3)',
                              transition: 'background 0.2s',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          };

          // ─────────────────────────────────────────────────────────────────────────────
          //  WidgetRenderer
          // ─────────────────────────────────────────────────────────────────────────────

          interface WidgetRendererProps {
            widget: Widget;
            onToggle24Hour: (widgetId: string) => void;
            onColorChange?: (widgetId: string, color: string) => void;
            // Generic per-widget patcher used by widgets that persist their own
            // settings (Crisis Ticker filters, Markets Ticker symbols).
            onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
          }

          export function WidgetRenderer({
            widget,
            onToggle24Hour,
            onColorChange,
            onUpdate,
          }: WidgetRendererProps): React.ReactElement | null | false {
            switch (widget.type) {
              case 'clock':
                return (
                  <ClockWidget
                    key={widget.id}
                    widget={widget}
                    onToggle24Hour={onToggle24Hour}
                    onUpdate={onUpdate}
                  />
                );

              case 'world_clocks':
                return (
                  <WorldClocksWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'countdown':
                return (
                  <CountdownWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'crisis_ticker':
                return (
                  <CrisisTickerWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'markets_ticker':
                return (
                  <MarketsTickerWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'weather':
                return (
                  <WeatherWidget
                    key={widget.id}
                    widget={widget}
                  />
                );

              case 'dictionary':
                return (
                  <DictionaryWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'qr_generator':
                return (
                  <QRGeneratorWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'github_pulse':
                return (
                  <GitHubPulseWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'rss_headlines':
                return (
                  <RSSHeadlinesWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'habit_tracker':
                return (
                  <HabitTrackerWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'quick_launch':
                return (
                  <QuickLaunchWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'big_text_marquee':
                return (
                  <BigTextMarqueeWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'network_light':
                return (
                  <NetworkLightWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'photo_loop':
                return (
                  <PhotoLoopWidget
                    key={widget.id}
                    widget={widget}
                    onUpdate={onUpdate}
                  />
                );

              case 'video':
              case 'note':
              case 'spacer':
              case 'image':
                return false;

              default:
                return (
                  <div
                    style={{
                      width: '100%', height: '100%', backgroundColor: '#0f172a',
                      borderRadius: '0.5rem', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '1.5rem', boxSizing: 'border-box', border: '1px dashed #334155',
                    }}
                  >
                    <p style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                      Unknown Widget Type
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.75rem', textAlign: 'center', fontFamily: MONO }}>
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

            const getDefaultWidgets = (): Widget[] => [];

            const [widgets, setWidgets] = useState<Widget[]>(() => {
              const saved = localStorage.getItem('openBentoWidgets');
              if (saved) {
                try {
                  const parsed = JSON.parse(saved);
                  return parsed
                    // Drop legacy 'zoom' widgets persisted before the type was removed.
                    // Otherwise they render as unknown ghost tiles for returning users.
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
                      refreshCounter: (w as any).refreshCounter ?? (w as any).iframeKey ?? 0,
                      channelName:    stripLegacyPrefix(w.channelName),
                      noteContent:    w.type === 'note' ? (w.noteContent ?? '') : w.noteContent,
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
              onRefreshWidget:     handleRefreshWidget,
              onToggleClockFormat: handleToggleClockFormat,
              onColorChange:       handleClockColorChange,
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
                    <Switch>
                      <Route path="/">
                        {() => <MasterControlDashboard {...dashboardProps} />}
                      </Route>
                      <Route path="/auth/reset-password">
                        {() => <MasterControlDashboard {...dashboardProps} />}
                      </Route>
                      <Route path="/admin"    component={Admin} />
                      <Route path="/terms"    component={Terms} />
                      <Route path="/privacy"  component={Privacy} />
                      <Route path="/feedback" component={Feedback} />
                      <Route path="/cast">
                        {() => (
                          <Suspense fallback={<div className="w-screen h-screen bg-slate-950" />}>
                            <CastPage />
                          </Suspense>
                        )}
                      </Route>
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