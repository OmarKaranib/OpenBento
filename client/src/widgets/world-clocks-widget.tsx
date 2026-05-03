// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Search, Settings as SettingsIcon, X } from 'lucide-react';
import { DEFAULT_WORLD_CLOCK_TZS, MONO, TZ_TO_CITY, WORLD_ZONES, Widget, isDaytimeIn, isLightBg } from './shared';

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
