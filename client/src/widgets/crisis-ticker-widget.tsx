// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { MONO, Widget } from './shared';

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

