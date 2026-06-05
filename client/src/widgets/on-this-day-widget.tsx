// On This Day — Wikipedia historical events for today's MM/DD, auto-rotated.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle, qrInputStyle, qrLabelStyle } from './shared';

interface Props { widget: Widget; onUpdate?: (id: string, patch: Partial<Widget>) => void; }

interface Event { year: number; text: string; pages: { title: string; url: string }[]; }
interface Payload { date: string; events: Event[]; fetchedAt: number; }

export const OnThisDayWidget: React.FC<Props> = ({ widget, onUpdate }) => {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 200 });

  const rotateSec = Math.max(5, Math.min(60, widget.onThisDayRotateSec ?? 10));

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/onthisday');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as Payload;
      setPayload(j);
      setIdx(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!payload || payload.events.length <= 1 || showSettings) return;
    const id = setInterval(() => {
      setIdx(i => (i + 1) % payload.events.length);
    }, rotateSec * 1000);
    return () => clearInterval(id);
  }, [payload, rotateSec, showSettings]);

  const bgColor = widget.customColor ?? '#1a1430';
  const light = isLightBg(bgColor);
  const accent = light ? '#7c3aed' : '#a78bfa';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle = light ? '#475569' : '#cbd5e1';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrCellBg = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.45)';

  const ev = payload?.events[idx] ?? null;
  const total = payload?.events.length ?? 0;
  const fs = Math.max(11, Math.min(15, size.w * 0.034));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      data-testid={`on-this-day-widget-${widget.id}`}
    >
      {/*
        Two sibling button groups at top-right:

        1. widget-hover-cog (hover-only): Refresh + Gear. Shown when settings
           is CLOSED. Gear opens settings.
        2. Always-visible X: shown only when settings is OPEN. Sits at z-index 6
           so it clears the overlay (z-index 4) and is never hidden by hover CSS.
      */}
      {!showSettings && (
        <div
          className="widget-hover-cog"
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, display: 'flex', gap: 4 }}
        >
          <button
            onClick={() => void load()}
            style={qrIconBtnStyle()}
            title="Refresh"
            data-testid={`on-this-day-refresh-${widget.id}`}
          >
            <RefreshCw size={11} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={qrIconBtnStyle()}
            title="Settings"
            data-testid={`on-this-day-settings-toggle-${widget.id}`}
          >
            <SettingsIcon size={11} />
          </button>
        </div>
      )}
      {showSettings && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 6 }}>
          <button
            onClick={() => setShowSettings(false)}
            style={qrIconBtnStyle()}
            title="Close settings"
            data-testid={`on-this-day-settings-toggle-${widget.id}`}
          >
            <XIcon size={11} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <CalendarDays size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          ON THIS DAY
        </span>
        {total > 0 && (
          <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>
            {idx + 1}/{total}
          </span>
        )}
      </div>

      {/* Settings overlay — no X button inside; toggle button above handles close */}
      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`on-this-day-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Settings</span>
          </div>
          <label style={qrLabelStyle()}>
            Rotate every (seconds)
            <input
              type="number"
              min={5}
              max={60}
              value={rotateSec}
              onChange={e => onUpdate?.(widget.id, { onThisDayRotateSec: Math.max(5, Math.min(60, Number(e.target.value) || 10)) })}
              style={qrInputStyle(11)}
              data-testid={`on-this-day-rotate-input-${widget.id}`}
            />
          </label>
          <span style={{ color: '#94a3b8', fontFamily: MONO, fontSize: 10 }}>
            Source: en.wikipedia.org · cached 1 hr server-side
          </span>
        </div>
      )}

      {!showSettings && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: clrMuted, fontFamily: MONO, fontSize: 11 }}>
              Loading…
            </div>
          )}
          {!loading && err && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontFamily: MONO, fontSize: 11, textAlign: 'center' }}>
              {err}
            </div>
          )}
          {!loading && !err && ev && (
            <div
              key={idx}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0,
                animation: 'onThisDayFade 600ms ease',
              }}
            >
              <div style={{
                color: accent, fontFamily: MONO, fontSize: Math.max(18, fs * 1.6),
                fontWeight: 800, letterSpacing: '0.02em', flexShrink: 0,
              }} data-testid={`on-this-day-year-${widget.id}`}>
                {ev.year}
              </div>
              <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                color: clrPrimary, fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: fs, lineHeight: 1.4,
                background: clrCellBg, borderRadius: 8, padding: 10,
                border: `1px solid ${clrBorder}`,
              }} data-testid={`on-this-day-text-${widget.id}`}>
                {ev.text}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {ev.pages.slice(0, 2).map(p => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6,
                      background: `${accent}22`, border: `1px solid ${accent}`,
                      color: accent, fontFamily: MONO, fontSize: 10, textDecoration: 'none',
                    }}
                    data-testid={`on-this-day-link-${widget.id}`}
                  >
                    {p.title} <ExternalLink size={9} />
                  </a>
                ))}
                <a
                  href="https://en.wikipedia.org/wiki/Wikipedia:On_this_day"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: 'auto',
                    color: clrMuted, fontFamily: MONO, fontSize: 9,
                    textDecoration: 'none', borderBottom: `1px dotted ${clrMuted}`,
                  }}
                  data-testid={`on-this-day-source-${widget.id}`}
                >
                  Source: Wikipedia
                </a>
              </div>
            </div>
          )}
          {!loading && !err && total > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexShrink: 0 }}>
              <button
                onClick={() => setIdx(i => (i - 1 + total) % total)}
                style={qrIconBtnStyle()}
                title="Previous"
                data-testid={`on-this-day-prev-${widget.id}`}
              >
                <ChevronLeft size={11} />
              </button>
              <button
                onClick={() => setIdx(i => (i + 1) % total)}
                style={qrIconBtnStyle()}
                title="Next"
                data-testid={`on-this-day-next-${widget.id}`}
              >
                <ChevronRight size={11} />
              </button>
              <span style={{ flex: 1, color: clrSubtle, fontFamily: MONO, fontSize: 9, alignSelf: 'center', textAlign: 'right' }}>
                Auto-rotate {rotateSec}s
              </span>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes onThisDayFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};