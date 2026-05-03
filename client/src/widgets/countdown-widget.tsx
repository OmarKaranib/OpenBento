// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hourglass, Settings as SettingsIcon, X } from 'lucide-react';
import { MONO, Widget, isLightBg, pad2 } from './shared';

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

