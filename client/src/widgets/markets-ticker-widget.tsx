// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus as PlusIcon, Settings as SettingsIcon, TrendingUp, X as XIcon } from 'lucide-react';
import { MONO, Widget } from './shared';
import {
  addSymbol as addSymbolHelper,
  moveSymbol as moveSymbolHelper,
  removeSymbol as removeSymbolHelper,
} from '@/lib/markets-symbols';
import { requestTimeoutSignal } from '@/lib/request-timeout';

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
        const resp = await fetch(`/api/markets?symbols=${encodeURIComponent(symbolsKey)}`, {
          signal: requestTimeoutSignal(),
        });
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

