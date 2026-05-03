// Mood Check-in — daily emoji + 30-day heatmap. Long-press to clear.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { MONO, Widget, isLightBg, offsetLocalKey, todayLocalKey } from './shared';

interface MoodCheckinProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

const EMOJIS = ['😄', '🙂', '😐', '😕', '😢'] as const;
const LABELS = ['Great', 'Good', 'Meh', 'Low', 'Bad'] as const;

const LONG_PRESS_MS = 550;

export const MoodCheckinWidget: React.FC<MoodCheckinProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 200 });
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = widget.moodDays ?? {};
  const today = todayLocalKey();
  const todayMood = days[today];

  const last30 = useMemo(
    () => Array.from({ length: 30 }, (_, i) => offsetLocalKey(-(29 - i))),
    [],
  );

  const setMood = (idx: number | null) => {
    const cutoff = offsetLocalKey(-59);
    const trimmed: Record<string, number> = {};
    for (const k of Object.keys(days)) if (k >= cutoff) trimmed[k] = days[k];
    if (idx === null) delete trimmed[today]; else trimmed[today] = idx;
    onUpdate?.(widget.id, { moodDays: trimmed });
  };

  const clearDay = (key: string) => {
    const cutoff = offsetLocalKey(-59);
    const trimmed: Record<string, number> = {};
    for (const k of Object.keys(days)) if (k >= cutoff && k !== key) trimmed[k] = days[k];
    onUpdate?.(widget.id, { moodDays: trimmed });
  };

  const startPress = (key: string) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      clearDay(key);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const bgColor    = widget.customColor ?? '#1c1330';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#7c3aed' : '#c4b5fd';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrCellBg  = light ? 'rgba(0,0,0,0.06)' : 'rgba(15,23,42,0.55)';
  const clrCellBdr = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';

  const cellColor = (idx: number | undefined): string => {
    if (idx === undefined) return clrCellBg;
    const palette = light
      ? ['#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626']
      : ['#22c55e', '#84cc16', '#eab308', '#fb923c', '#f87171'];
    return palette[Math.max(0, Math.min(4, idx))];
  };

  const cellSize = Math.max(12, Math.min(22, Math.min(size.w / 8, (size.h - 110) / 6)));

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
      data-testid={`mood-checkin-widget-${widget.id}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Smile size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          MOOD
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9, textTransform: 'uppercase' }}>
          {todayMood !== undefined ? LABELS[todayMood] : 'tap one'}
        </span>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 10, flexShrink: 0,
      }}>
        {EMOJIS.map((e, i) => {
          const active = todayMood === i;
          return (
            <button
              key={e}
              onClick={() => setMood(active ? null : i)}
              title={LABELS[i]}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8,
                background: active ? `${accent}33` : 'transparent',
                border: `1px solid ${active ? accent : clrCellBdr}`,
                fontSize: Math.max(18, size.w * 0.06),
                cursor: 'pointer',
                lineHeight: 1,
              }}
              data-testid={`mood-pick-${i}-${widget.id}`}
            >
              {e}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          color: clrMuted, fontFamily: MONO, fontSize: 9,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          last 30 days · long-press to clear
        </span>
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(6, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`, gap: 3, justifyContent: 'center',
        }}>
          {last30.map(k => {
            const v = days[k];
            const isToday = k === today;
            return (
              <div
                key={k}
                title={`${k}${v !== undefined ? ` — ${EMOJIS[v]} ${LABELS[v]}` : ''}`}
                onPointerDown={() => startPress(k)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                style={{
                  width: cellSize, height: cellSize, borderRadius: 3,
                  background: cellColor(v),
                  opacity: v === undefined ? 0.55 : 0.9,
                  border: isToday ? `1px solid ${accent}` : `1px solid ${clrCellBdr}`,
                  cursor: v !== undefined ? 'pointer' : 'default',
                }}
                data-testid={`mood-cell-${k}-${widget.id}`}
              />
            );
          })}
        </div>
      </div>

      <span style={{
        color: clrPrimary, fontFamily: MONO, fontSize: 9, opacity: 0.7,
        textAlign: 'center', marginTop: 4,
      }} data-testid={`mood-streak-${widget.id}`}>
        {(() => {
          const logged = last30.filter(k => days[k] !== undefined).length;
          return `${logged}/30 days logged`;
        })()}
      </span>
    </div>
  );
};
