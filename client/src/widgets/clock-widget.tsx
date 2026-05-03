// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { CLOCK_COLOR_PRESETS, ClockTab, MONO, WORLD_ZONES, Widget, isLightBg, pad2, playTimerChime } from './shared';


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
