          import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
          import { useAuth } from '@/hooks/use-auth';
          import { LoginModal } from '@/components/login-modal';
          import { MobileGuard } from '@/components/mobile-guard';
          import { useViralAds, AdBlockData } from '@/components/ad-block';
          import { searchChannelLiveStream } from '@/lib/stream-api';
          import { getVerifiedChannel, getStaticLiveId, getFallbackVideoId } from '@/lib/channel-constants';
          import {
            Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, CloudDrizzle, Cloudy, Search, QrCode,
            Settings as SettingsIcon, ExternalLink, TrendingUp, ArrowUp, ArrowDown, Plus as PlusIcon, X as XIcon,
          } from 'lucide-react';
          import { QRCodeSVG } from 'qrcode.react';
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
            | 'markets_ticker';

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
            { city: 'New York',    tz: 'America/New_York' },
            { city: 'Los Angeles', tz: 'America/Los_Angeles' },
            { city: 'Chicago',     tz: 'America/Chicago' },
            { city: 'London',      tz: 'Europe/London' },
            { city: 'Paris',       tz: 'Europe/Paris' },
            { city: 'Berlin',      tz: 'Europe/Berlin' },
            { city: 'Moscow',      tz: 'Europe/Moscow' },
            { city: 'Dubai',       tz: 'Asia/Dubai' },
            { city: 'Mumbai',      tz: 'Asia/Kolkata' },
            { city: 'Singapore',   tz: 'Asia/Singapore' },
            { city: 'Tokyo',       tz: 'Asia/Tokyo' },
            { city: 'Sydney',      tz: 'Australia/Sydney' },
            { city: 'Auckland',    tz: 'Pacific/Auckland' },
            { city: 'Honolulu',    tz: 'Pacific/Honolulu' },
            { city: 'São Paulo',   tz: 'America/Sao_Paulo' },
            { city: 'Cairo',       tz: 'Africa/Cairo' },
          ];

          const pad2 = (n: number) => String(n).padStart(2, '0');

          interface ClockWidgetProps {
            widget: Widget;
            onToggle24Hour: (widgetId: string) => void;
          }

          export const ClockWidget: React.FC<ClockWidgetProps> = ({
            widget,
            onToggle24Hour,
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
            const use24 = widget.clockUse24Hour ?? false;

            const [worldZone, setWorldZone] = useState(WORLD_ZONES[0].tz);

            const [timerTotal,   setTimerTotal]   = useState(300);
            const [timerLeft,    setTimerLeft]    = useState(300);
            const [timerRunning, setTimerRunning] = useState(false);
            const [timerSetMin,  setTimerSetMin]  = useState('5');
            const [timerSetSec,  setTimerSetSec]  = useState('0');

            const [swElapsed, setSwElapsed] = useState(0);
            const [swRunning, setSwRunning] = useState(false);
            const swStartRef = useRef<number>(0);

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
            useEffect(() => {
              const id = setInterval(() => setNow(new Date()), 1_000);
              return () => clearInterval(id);
            }, []);

            // ── Countdown with chime ──────────────────────────────────────────────────
            useEffect(() => {
              if (!timerRunning) return;
              const id = setInterval(() => {
                setTimerLeft(prev => {
                  if (prev <= 1) { setTimerRunning(false); playTimerChime(); return 0; }
                  return prev - 1;
                });
              }, 1_000);
              return () => clearInterval(id);
            }, [timerRunning]);

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
              setTimerTotal(total);
              setTimerLeft(total);
              setTimerRunning(true);
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
                  {tab === 'clock' && (
                    <>
                      <div style={{ fontSize: `${sz.bigTime}px`, fontFamily: MONO, fontWeight: 700, color: clrPrimary, letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'center' }}>
                        {fmtTime(now)}
                      </div>
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
                      <div
                        style={{
                          fontSize:   `${timerRunning || timerLeft !== timerTotal ? sz.bigTime : sz.bigTime * 0.65}px`,
                          fontFamily: MONO, fontWeight: 700, lineHeight: 1, textAlign: 'center',
                          color: timerLeft === 0 ? '#f87171' : timerRunning ? clrAccent : clrPrimary,
                        }}
                      >
                        {timerLeft === 0 && !timerRunning ? 'TIME UP!' : fmtTimer(timerLeft)}
                      </div>

                      {!timerRunning && timerLeft === timerTotal && (
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

                      <div style={{ display: 'flex', gap: `${sz.btnGap}px`, marginTop: `${sz.contentGap * 0.5}px` }}>
                        {!timerRunning && timerLeft === timerTotal && (
                          <button style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); startTimer(); }} data-testid="btn-timer-start">Start</button>
                        )}
                        {timerRunning && (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setTimerRunning(false); }} data-testid="btn-timer-pause">Pause</button>
                        )}
                        {!timerRunning && timerLeft < timerTotal && timerLeft > 0 && (
                          <button style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); setTimerRunning(true); }} data-testid="btn-timer-resume">Resume</button>
                        )}
                        {timerLeft < timerTotal && (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setTimerRunning(false); setTimerLeft(timerTotal); }} data-testid="btn-timer-reset">Reset</button>
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
                      <div style={{ display: 'flex', gap: `${sz.btnGap}px`, marginTop: `${sz.contentGap * 0.5}px` }}>
                        {!swRunning ? (
                          <button style={btnStyle(true)} onClick={(e) => { e.stopPropagation(); setSwRunning(true); }} data-testid="btn-sw-start">
                            {swElapsed > 0 ? 'Resume' : 'Start'}
                          </button>
                        ) : (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setSwRunning(false); }} data-testid="btn-sw-stop">Stop</button>
                        )}
                        {swElapsed > 0 && !swRunning && (
                          <button style={btnStyle()} onClick={(e) => { e.stopPropagation(); setSwElapsed(0); }} data-testid="btn-sw-reset">Reset</button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* ── 12h/24h toggle: BOTTOM-CENTER, clock tab only ──────────────────── */}
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

          function mapCrisisCategoryToApi(category: string | undefined): string {
            switch (category) {
              case 'tech':    return 'technology';
              case 'markets': return 'business';
              case 'sports':  return 'sports';
              case 'world':   return '';
              case 'all':     return '';
              default:        return '';
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
                    params.set('sources', sources);
                  } else {
                    const apiCat = mapCrisisCategoryToApi(category);
                    if (apiCat) params.set('category', apiCat);
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
                      const accent = isCrisisHeadline(h.text) ? '#ef4444' : '#1e40af';
                      const RowEl: any = h.url ? 'a' : 'div';
                      const rowProps = h.url
                        ? {
                            href: h.url,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            onClick: (e: React.MouseEvent) => e.stopPropagation(),
                          }
                        : {};
                      return (
                        <RowEl
                          key={`${h.id}-${idx}`}
                          className={`crisis-row-${widget.id}`}
                          {...rowProps}
                          style={{
                            height:       `${rowH}px`,
                            display:      'flex',
                            alignItems:   'center',
                            padding:      `0 ${Math.max(8, s * 0.045)}px`,
                            borderBottom: '1px solid rgba(30,41,59,0.5)',
                            gap:          `${Math.max(6, s * 0.03)}px`,
                            textDecoration: 'none',
                            color: 'inherit',
                            cursor: h.url ? 'pointer' : 'default',
                          }}
                          data-testid={`crisis-headline-${widget.id}-${idx % CRISIS_HEADLINES.length}`}
                        >
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
                        </RowEl>
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

            const moveSymbol = (idx: number, dir: -1 | 1) => {
              const next = [...symbols];
              const target = idx + dir;
              if (target < 0 || target >= next.length) return;
              [next[idx], next[target]] = [next[target], next[idx]];
              onUpdate?.(widget.id, { marketsSymbols: next });
            };
            const removeSymbol = (sym: string) => {
              const next = symbols.filter(x => x !== sym);
              onUpdate?.(widget.id, { marketsSymbols: next });
            };
            const addSymbol = () => {
              const sym = newSymbol.trim().toUpperCase();
              if (!sym || !/^[A-Z0-9.\-]{1,8}$/.test(sym)) return;
              if (symbols.includes(sym)) { setNewSymbol(''); return; }
              if (symbols.length >= 12) return;
              onUpdate?.(widget.id, { marketsSymbols: [...symbols, sym] });
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
                            onClick={() => moveSymbol(i, -1)}
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
                            onClick={() => moveSymbol(i, 1)}
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
                            onClick={() => removeSymbol(sym)}
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

          const DictionaryWidget: React.FC<{ widget: Widget }> = ({ widget }) => {
            const containerRef = useRef<HTMLDivElement>(null);
            const [cw, setCw] = useState(300);
            const [ch, setCh] = useState(200);

            const [wordIndex, setWordIndex] = useState<number>(() =>
              Math.floor(Math.random() * POWER_WORDS.length)
            );
            const [definition, setDefinition] = useState<string | null>(null);
            const [partOfSpeech, setPartOfSpeech] = useState<string | null>(null);
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState(false);

            const word = POWER_WORDS[wordIndex];

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
              setLoading(true);
              setError(false);
              setDefinition(null);
              setPartOfSpeech(null);
              (async () => {
                try {
                  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
                  if (!res.ok) throw new Error('fetch failed');
                  const data = await res.json();
                  if (!mounted) return;
                  const meanings = data[0]?.meanings;
                  const firstMeaning = meanings?.[0];
                  const def = firstMeaning?.definitions?.[0]?.definition ?? null;
                  const pos = firstMeaning?.partOfSpeech ?? null;
                  setDefinition(def);
                  setPartOfSpeech(pos);
                } catch {
                  if (mounted) setError(true);
                } finally {
                  if (mounted) setLoading(false);
                }
              })();
              return () => { mounted = false; };
            }, [word]);

            const handleRefresh = () => {
              setWordIndex((prev) => {
                let next = prev;
                while (next === prev) next = Math.floor(Math.random() * POWER_WORDS.length);
                return next;
              });
            };

            const compact = cw < 240 || ch < 160;
            const s = Math.min(cw, ch);

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                  borderRadius: 'var(--outer-radius)',
                  display: 'flex', flexDirection: 'column',
                  padding: compact ? '0.75rem' : '1.25rem',
                  boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? '0.5rem' : '0.75rem', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: compact ? '0.6rem' : '0.65rem', fontFamily: MONO, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Power Word
                    </span>
                    {partOfSpeech && (
                      <span style={{
                        fontSize: compact ? '0.55rem' : '0.6rem', fontFamily: MONO, color: '#64748b',
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: '4px', padding: '1px 5px',
                      }}>
                        {partOfSpeech}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    style={{
                      background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      color: loading ? '#475569' : '#818cf8', padding: '2px',
                      transition: 'color 0.2s',
                      lineHeight: 0,
                    }}
                    title="New word"
                  >
                    <svg
                      width={compact ? 13 : 15}
                      height={compact ? 13 : 15}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ display: 'block', transition: 'transform 0.3s', transform: loading ? 'rotate(180deg)' : 'none' }}
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </div>

                {/* Word */}
                <div style={{ flexShrink: 0, marginBottom: compact ? '0.4rem' : '0.6rem' }}>
                  <span style={{
                    fontFamily: MONO, fontWeight: 700,
                    fontSize: `${Math.max(0.9, Math.min(1.6, s * 0.055))}rem`,
                    color: '#e2e8f0', letterSpacing: '0.02em',
                    textTransform: 'capitalize',
                  }}>
                    {word}
                  </span>
                </div>

                {/* Definition */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
                  {loading && (
                    <span style={{ color: '#475569', fontFamily: MONO, fontSize: compact ? '0.7rem' : '0.78rem' }}>
                      Loading…
                    </span>
                  )}
                  {error && !loading && (
                    <span style={{ color: '#ef4444', fontFamily: MONO, fontSize: compact ? '0.7rem' : '0.78rem' }}>
                      Definition unavailable
                    </span>
                  )}
                  {definition && !loading && (
                    <p style={{
                      color: '#94a3b8', fontFamily: MONO,
                      fontSize: `${Math.max(0.68, Math.min(0.85, s * 0.028))}rem`,
                      lineHeight: 1.5, margin: 0,
                      display: '-webkit-box', WebkitLineClamp: compact ? 3 : 5,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {definition}
                    </p>
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
          //  QRGeneratorWidget — instant QR code generator with glassmorphism aesthetic
          // ─────────────────────────────────────────────────────────────────────────────

          const MONO_QR = "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace";

          interface QRGeneratorWidgetProps { widget: Widget; }

          export const QRGeneratorWidget: React.FC<QRGeneratorWidgetProps> = ({ widget }) => {
            const [inputVal, setInputVal] = useState('');
            const [qrValue, setQrValue] = useState('');
            const containerRef = useRef<HTMLDivElement>(null);
            const [size, setSize] = useState(200);

            useEffect(() => {
              const observer = new ResizeObserver(entries => {
                for (const e of entries) {
                  const { width, height } = e.contentRect;
                  setSize(Math.min(width, height));
                }
              });
              if (containerRef.current) observer.observe(containerRef.current);
              return () => observer.disconnect();
            }, []);

            const handleInput = (val: string) => {
              setInputVal(val);
              try {
                const trimmed = val.trim();
                setQrValue(trimmed.length > 0 ? trimmed.slice(0, 2953) : '');
              } catch {
                setQrValue('');
              }
            };

            const inputH = Math.max(28, size * 0.11);
            const inputFont = Math.max(9, size * 0.045);
            const qrSz = Math.max(60, size * 0.52);
            const placeholderSz = Math.max(28, size * 0.12);

            return (
              <div
                ref={containerRef}
                style={{
                  width: '100%', height: '100%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: `${Math.max(6, size * 0.03)}px`,
                  padding: `${Math.max(8, size * 0.04)}px`,
                  boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.55)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                data-testid={`qr-generator-widget-${widget.id}`}
              >
                {/* Subtle glow accent */}
                <div style={{
                  position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
                  width: '60%', height: '50%', borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />

                {/* QR code area */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  {qrValue ? (
                    <div style={{
                      background: '#fff',
                      borderRadius: '8px',
                      padding: `${Math.max(4, size * 0.02)}px`,
                      boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 4px 24px rgba(0,0,0,0.4)',
                    }}>
                      <QRCodeSVG
                        value={qrValue}
                        size={qrSz}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: `${Math.max(4, size * 0.02)}px`, opacity: 0.35,
                    }}>
                      <QrCode size={placeholderSz} color="#a5b4fc" strokeWidth={1.5} />
                      <span style={{
                        fontFamily: MONO_QR, fontSize: `${Math.max(8, size * 0.042)}px`,
                        color: '#94a3b8', letterSpacing: '0.06em', textAlign: 'center',
                        lineHeight: 1.3,
                      }}>
                        Paste link to teleport
                      </span>
                    </div>
                  )}
                </div>

                {/* Glass input at the bottom */}
                <div style={{
                  width: '100%', zIndex: 2,
                  display: 'flex', alignItems: 'center',
                  height: `${inputH}px`,
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: `0 ${Math.max(8, size * 0.035)}px`,
                  boxSizing: 'border-box',
                  gap: `${Math.max(4, size * 0.02)}px`,
                }}>
                  <QrCode size={Math.max(11, size * 0.045)} color="#6366f1" strokeWidth={2} style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    value={inputVal}
                    onChange={e => handleInput(e.target.value)}
                    onKeyDown={e => e.stopPropagation()}
                    placeholder="https://..."
                    maxLength={2953}
                    style={{
                      flex: 1, height: '100%', background: 'transparent', border: 'none',
                      color: '#e2e8f0', fontFamily: MONO_QR, fontSize: `${inputFont}px`,
                      fontWeight: 500, outline: 'none', letterSpacing: '0.02em', minWidth: 0,
                    }}
                    data-testid={`qr-input-${widget.id}`}
                  />
                  {inputVal && (
                    <button
                      onClick={() => handleInput('')}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#475569', fontSize: `${Math.max(10, size * 0.05)}px`,
                        lineHeight: 1, padding: 0, flexShrink: 0,
                      }}
                      title="Clear"
                    >
                      ×
                    </button>
                  )}
                </div>
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
                  />
                );

              case 'qr_generator':
                return (
                  <QRGeneratorWidget
                    key={widget.id}
                    widget={widget}
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