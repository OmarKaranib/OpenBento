// Random Quote — /api/quote with offline fallback + favourites + hourly refresh.
import React, { useEffect, useRef, useState } from 'react';
import { Heart, Quote as QuoteIcon, RefreshCw, Star } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle } from './shared';
import { FALLBACK_QUOTES, pickFallbackQuote, type QuoteEntry } from './play-helpers';

interface Props { widget: Widget; onUpdate?: (id: string, patch: Partial<Widget>) => void; }

export const QuoteWidget: React.FC<Props> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 200 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cycleRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!widget.quoteCurrent) {
      const q = pickFallbackQuote(Date.now());
      onUpdate?.(widget.id, { quoteCurrent: q });
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/quote');
        if (!r.ok) return;
        const j = await r.json() as { text?: string; author?: string };
        if (cancelled || typeof j.text !== 'string' || j.text.trim().length === 0) return;
        onUpdate?.(widget.id, { quoteCurrent: { text: j.text, author: typeof j.author === 'string' ? j.author : 'Unknown' } });
      } catch { /* offline → keep fallback */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hourly auto-refresh; also fires on tab focus to recover from throttled timers.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (!active) return;
      try {
        const r = await fetch('/api/quote');
        if (!r.ok) return;
        const j = await r.json() as { text?: string; author?: string };
        if (!active || typeof j.text !== 'string' || j.text.trim().length === 0) return;
        onUpdate?.(widget.id, { quoteCurrent: { text: j.text, author: typeof j.author === 'string' ? j.author : 'Unknown' } });
      } catch { /* offline → keep current */ }
    };
    const id = window.setInterval(tick, 60 * 60_000);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id]);

  const cycleFallback = () => {
    cycleRef.current = (cycleRef.current + 1) >>> 0;
    const pool: readonly QuoteEntry[] = (widget.quoteFavorites && widget.quoteFavorites.length > 0)
      ? widget.quoteFavorites
      : FALLBACK_QUOTES;
    const q = pool[cycleRef.current % pool.length];
    onUpdate?.(widget.id, { quoteCurrent: { text: q.text, author: q.author } });
  };

  const refresh = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/quote');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { text?: string; author?: string };
      if (typeof j.text !== 'string' || j.text.trim().length === 0) throw new Error('Empty quote');
      onUpdate?.(widget.id, { quoteCurrent: { text: j.text, author: typeof j.author === 'string' ? j.author : 'Unknown' } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      cycleFallback();
    } finally {
      setLoading(false);
    }
  };

  const current: QuoteEntry = widget.quoteCurrent ?? FALLBACK_QUOTES[0];
  const favs = widget.quoteFavorites ?? [];
  const isFav = favs.some(f => f.text === current.text && f.author === current.author);

  const toggleFav = () => {
    if (isFav) {
      onUpdate?.(widget.id, { quoteFavorites: favs.filter(f => !(f.text === current.text && f.author === current.author)) });
    } else {
      onUpdate?.(widget.id, { quoteFavorites: [...favs, current].slice(-50) });
    }
  };

  const bgColor = widget.customColor ?? '#0e1f2a';
  const light = isLightBg(bgColor);
  const accent = light ? '#0e7490' : '#22d3ee';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle = light ? '#475569' : '#cbd5e1';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const fs = Math.max(13, Math.min(20, size.w * 0.045));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        padding: 14, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      data-testid={`quote-widget-${widget.id}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <QuoteIcon size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          QUOTE OF THE HOUR
        </span>
        {favs.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: clrMuted, fontFamily: MONO, fontSize: 9 }}>
            <Star size={9} /> {favs.length}
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          color: clrPrimary, fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: fs, lineHeight: 1.45, fontStyle: 'italic',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '4px 6px',
        }}
        data-testid={`quote-text-${widget.id}`}
      >
        “{current.text}”
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ flex: 1, color: clrSubtle, fontFamily: MONO, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid={`quote-author-${widget.id}`}>
          — {current.author}
        </span>
        <button
          onClick={toggleFav}
          style={{ ...qrIconBtnStyle(), color: isFav ? '#ef4444' : undefined }}
          title={isFav ? 'Remove from favourites' : 'Save as favourite'}
          data-testid={`quote-fav-${widget.id}`}
        >
          <Heart size={12} fill={isFav ? '#ef4444' : 'none'} />
        </button>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          style={{ ...qrIconBtnStyle(), opacity: loading ? 0.5 : 1 }}
          title="New quote"
          data-testid={`quote-refresh-${widget.id}`}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {err && (
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9, flexShrink: 0 }}>
          Offline · cycling saved
        </span>
      )}
    </div>
  );
};
