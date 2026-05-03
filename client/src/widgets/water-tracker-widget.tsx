// Water Tracker — tap +/- to log cups against a daily target. Streak
// counts consecutive target-met days. Resets at local midnight (we
// just key by local YYYY-MM-DD and read "today" each render).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Droplet, Flame, Minus, Plus, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import {
  MONO, Widget, computeStreak, isLightBg,
  qrIconBtnStyle, qrInputStyle, qrLabelStyle, todayLocalKey,
} from './shared';

interface WaterTrackerProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

export const WaterTrackerWidget: React.FC<WaterTrackerProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  // Re-render at local midnight so the "today" key flips without a page reload.
  const [, setTick] = useState(0);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize(Math.min(e.contentRect.width, e.contentRect.height)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const now = new Date();
    const next = new Date(now); next.setDate(next.getDate() + 1); next.setHours(0, 0, 5, 0);
    const ms = Math.max(60_000, next.getTime() - now.getTime());
    const t = setTimeout(() => setTick(n => n + 1), ms);
    return () => clearTimeout(t);
  });

  const target = Math.max(1, Math.min(20, widget.waterTarget ?? 8));
  const days   = widget.waterDays ?? {};
  const today  = todayLocalKey();
  const cups   = days[today] ?? 0;
  const streak = useMemo(() => computeStreak(days, target, today), [days, target, today]);
  const pct    = Math.min(100, Math.round((cups / target) * 100));

  const setCups = (next: number) => {
    const clamped = Math.max(0, Math.min(99, next));
    // Trim to last 90 days so the persisted blob never grows unbounded.
    const cutoff = (() => {
      const d = new Date(); d.setDate(d.getDate() - 90);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    })();
    const trimmed: Record<string, number> = {};
    for (const k of Object.keys(days)) if (k >= cutoff) trimmed[k] = days[k];
    if (clamped === 0) delete trimmed[today]; else trimmed[today] = clamped;
    onUpdate?.(widget.id, { waterDays: trimmed, waterTarget: target });
  };

  const setTarget = (next: number) => {
    onUpdate?.(widget.id, { waterTarget: Math.max(1, Math.min(20, next)) });
  };

  const bgColor    = widget.customColor ?? '#0b1d2a';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#0369a1' : '#38bdf8';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrInert   = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const clrInertBd = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
  const clrTrack   = light ? 'rgba(0,0,0,0.08)' : 'rgba(15,23,42,0.55)';

  const big = Math.max(28, Math.min(72, size * 0.20));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
      }}
      data-testid={`water-tracker-widget-${widget.id}`}
    >
      <div className="widget-hover-cog" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
        <button onClick={() => setShowSettings(s => !s)} style={qrIconBtnStyle()} title="Water settings" data-testid={`water-settings-toggle-${widget.id}`}>
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Droplet size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          WATER
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 2,
          color: streak > 0 ? accent : clrMuted, fontFamily: MONO, fontSize: 10, fontWeight: 700,
        }}>
          <Flame size={10} />{streak}
        </span>
      </div>

      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`water-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Daily target (cups)</span>
            <button onClick={() => setShowSettings(false)} style={qrIconBtnStyle()} data-testid={`water-settings-close-${widget.id}`}>
              <XIcon size={11} />
            </button>
          </div>
          <span style={qrLabelStyle()}>Target: {target}</span>
          <input
            type="number" min={1} max={20} value={target}
            onChange={e => setTarget(Number(e.target.value) || 1)}
            style={qrInputStyle(12)}
            data-testid={`water-target-${widget.id}`}
          />
        </div>
      )}

      {!showSettings && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1 }}>
            <button
              onClick={() => setCups(cups - 1)}
              disabled={cups <= 0}
              style={{
                ...qrIconBtnStyle(),
                width: Math.max(36, size * 0.12), height: Math.max(36, size * 0.12),
                opacity: cups <= 0 ? 0.4 : 1,
                background: clrInert, borderColor: clrInertBd, color: clrSubtle,
              }}
              title="Remove a cup"
              data-testid={`water-decrement-${widget.id}`}
            >
              <Minus size={Math.max(14, size * 0.05)} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ color: clrPrimary, fontFamily: MONO, fontSize: big, fontWeight: 800, lineHeight: 1 }}>
                {cups}<span style={{ color: clrMuted, fontSize: big * 0.45, fontWeight: 700 }}> / {target}</span>
              </div>
              <div style={{ color: clrMuted, fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                cups today
              </div>
            </div>
            <button
              onClick={() => setCups(cups + 1)}
              style={{
                ...qrIconBtnStyle(),
                width: Math.max(36, size * 0.12), height: Math.max(36, size * 0.12),
                background: `${accent}22`, borderColor: accent, color: accent,
              }}
              title="Add a cup"
              data-testid={`water-increment-${widget.id}`}
            >
              <Plus size={Math.max(14, size * 0.05)} />
            </button>
          </div>

          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: '100%', height: 8, borderRadius: 4,
              background: clrTrack, overflow: 'hidden',
            }} data-testid={`water-progress-${widget.id}`}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: pct >= 100 ? accent : `linear-gradient(90deg, ${accent}99, ${accent})`,
                transition: 'width 0.25s ease',
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 4,
              color: clrMuted, fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span>{pct}%</span>
              <span>{pct >= 100 ? 'goal met' : `${Math.max(0, target - cups)} to go`}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
