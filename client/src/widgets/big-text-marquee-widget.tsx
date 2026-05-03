// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrColorPickerStyle, qrIconBtnStyle, qrInputStyle, qrLabelStyle } from './shared';

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

