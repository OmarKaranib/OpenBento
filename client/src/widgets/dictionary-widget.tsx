// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Star, Volume2, X } from 'lucide-react';
import { MONO, Widget } from './shared';

const POWER_WORDS = [
  'ephemeral', 'perspicacious', 'sanguine', 'mellifluous', 'obfuscate',
  'tenacious', 'eloquent', 'sagacious', 'inexorable', 'magnanimous',
  'pernicious', 'soliloquy', 'sycophant', 'vicissitude', 'recalcitrant',
  'loquacious', 'serendipity', 'equanimity', 'propitious', 'truculent',
];

// Returns a stable index for the current calendar day so the daily
// power word matches across reloads but rotates at midnight UTC.
function dailyWordIndex(): number {
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return day % POWER_WORDS.length;
}

interface DictionaryEntryShape {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  origin?: string;
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
    synonyms?: string[];
  }[];
}

export const DictionaryWidget: React.FC<{
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(300);
  const [ch, setCh] = useState(200);

  // The "active" word is either the explicit search query or, if
  // empty, the daily-seeded power word. A local search-input state
  // lets the user type without losing the persisted query.
  const dailyWord = POWER_WORDS[dailyWordIndex()];
  const activeWord = (widget.dictionaryQuery || '').trim() || dailyWord;
  const [searchInput, setSearchInput] = useState(widget.dictionaryQuery || '');
  const [showFavorites, setShowFavorites] = useState(false);
  const [entry, setEntry] = useState<DictionaryEntryShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const favorites = widget.dictionaryFavorites || [];
  const isFavorite = favorites.includes(activeWord.toLowerCase());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) { setCw(r.width); setCh(r.height); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true); setError(false); setEntry(null);
    (async () => {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(activeWord)}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!mounted) return;
        setEntry(Array.isArray(data) ? data[0] : null);
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeWord]);

  const meaning = entry?.meanings?.[0];
  const definition = meaning?.definitions?.[0]?.definition ?? null;
  const partOfSpeech = meaning?.partOfSpeech ?? null;
  const synonyms = (meaning?.synonyms || []).slice(0, 6);
  const origin = entry?.origin || null;
  // dictionaryapi.dev nests audio under multiple phonetics; pick the
  // first non-empty one so we always play *something* when available.
  const audioUrl = entry?.phonetics?.find(p => p.audio && p.audio.length > 0)?.audio || null;
  const phoneticText = entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || null;

  const submitSearch = () => {
    const v = searchInput.trim();
    onUpdate?.(widget.id, { dictionaryQuery: v });
  };

  const clearSearch = () => {
    setSearchInput('');
    onUpdate?.(widget.id, { dictionaryQuery: '' });
  };

  const toggleFavorite = () => {
    if (!onUpdate) return;
    const lower = activeWord.toLowerCase();
    const next = isFavorite
      ? favorites.filter(w => w !== lower)
      : [lower, ...favorites].slice(0, 30);
    onUpdate(widget.id, { dictionaryFavorites: next });
  };

  const playAudio = () => {
    if (!audioUrl) return;
    try {
      const a = new Audio(audioUrl);
      a.play().catch(err => console.warn('[Dictionary] audio play failed', err));
    } catch (err) { console.warn('[Dictionary] audio init failed', err); }
  };

  const compact = cw < 260 || ch < 180;
  const s = Math.min(cw, ch);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: compact ? '0.75rem' : '1.1rem',
        boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
      }}
      data-testid={`dictionary-widget-${widget.id}`}
    >
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexShrink: 0 }} onKeyDown={e => e.stopPropagation()}>
        <Search size={11} color="#818cf8" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
          placeholder="Search a word…"
          style={{
            flex: 1, minWidth: 0,
            padding: '4px 6px',
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 4,
            color: '#e2e8f0', fontFamily: MONO,
            fontSize: compact ? 10 : 11, outline: 'none',
          }}
          data-testid={`dictionary-search-${widget.id}`}
        />
        {widget.dictionaryQuery && (
          <button
            onClick={clearSearch}
            title="Back to daily word"
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', padding: 2, lineHeight: 0,
            }}
          >
            <X size={11} />
          </button>
        )}
        {favorites.length > 0 && (
          <button
            onClick={() => setShowFavorites(s => !s)}
            title="Favorites"
            style={{
              background: showFavorites ? 'rgba(251,191,36,0.2)' : 'none',
              border: '1px solid ' + (showFavorites ? 'rgba(251,191,36,0.5)' : 'transparent'),
              color: '#fbbf24', cursor: 'pointer',
              padding: '2px 4px', borderRadius: 4, lineHeight: 0,
              display: 'flex', alignItems: 'center', gap: 2,
            }}
            data-testid={`dictionary-fav-toggle-${widget.id}`}
          >
            <Star size={11} />
            <ChevronDown size={9} />
          </button>
        )}
      </div>

      {/* Favorites dropdown */}
      {showFavorites && favorites.length > 0 && (
        <div style={{
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 6, padding: 6, marginBottom: 6,
          display: 'flex', flexWrap: 'wrap', gap: 4,
          flexShrink: 0, maxHeight: 80, overflowY: 'auto',
        }}>
          {favorites.map(fav => (
            <button
              key={fav}
              onClick={() => {
                setSearchInput(fav);
                onUpdate?.(widget.id, { dictionaryQuery: fav });
                setShowFavorites(false);
              }}
              style={{
                padding: '2px 6px', borderRadius: 3,
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.3)',
                color: '#fbbf24', fontFamily: MONO, fontSize: 10,
                cursor: 'pointer',
              }}
              data-testid={`dictionary-fav-${fav}-${widget.id}`}
            >
              {fav}
            </button>
          ))}
        </div>
      )}

      {/* Header line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexShrink: 0 }}>
        <span style={{
          fontSize: compact ? '0.55rem' : '0.6rem', fontFamily: MONO,
          fontWeight: 700, color: '#818cf8', textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {widget.dictionaryQuery ? 'Lookup' : 'Word of the Day'}
        </span>
        {partOfSpeech && (
          <span style={{
            fontSize: compact ? '0.5rem' : '0.55rem', fontFamily: MONO, color: '#64748b',
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 4, padding: '1px 5px',
          }}>
            {partOfSpeech}
          </span>
        )}
        <button
          onClick={toggleFavorite}
          title={isFavorite ? 'Unfavorite' : 'Favorite'}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: isFavorite ? '#fbbf24' : '#475569',
            cursor: 'pointer', padding: 2, lineHeight: 0,
          }}
          data-testid={`dictionary-fav-toggle-star-${widget.id}`}
        >
          <Star size={12} fill={isFavorite ? '#fbbf24' : 'none'} />
        </button>
      </div>

      {/* Word + audio */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexShrink: 0 }}>
        <span style={{
          fontFamily: MONO, fontWeight: 700,
          fontSize: `${Math.max(0.9, Math.min(1.5, s * 0.05))}rem`,
          color: '#e2e8f0', letterSpacing: '0.02em',
          textTransform: 'capitalize',
        }}>
          {activeWord}
        </span>
        {phoneticText && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>
            {phoneticText}
          </span>
        )}
        {audioUrl && (
          <button
            onClick={playAudio}
            title="Play pronunciation"
            style={{
              background: 'rgba(99,102,241,0.18)',
              border: '1px solid rgba(129,140,248,0.4)',
              borderRadius: 4, padding: '2px 4px',
              color: '#a5b4fc', cursor: 'pointer', lineHeight: 0,
            }}
            data-testid={`dictionary-audio-${widget.id}`}
          >
            <Volume2 size={11} />
          </button>
        )}
      </div>

      {/* Definition + extras */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && (
          <span style={{ color: '#475569', fontFamily: MONO, fontSize: compact ? '0.65rem' : '0.72rem' }}>
            Loading…
          </span>
        )}
        {error && !loading && (
          <span style={{ color: '#ef4444', fontFamily: MONO, fontSize: compact ? '0.65rem' : '0.72rem' }}>
            No definition for "{activeWord}"
          </span>
        )}
        {!loading && !error && definition && (
          <p style={{
            color: '#94a3b8', fontFamily: MONO,
            fontSize: `${Math.max(0.65, Math.min(0.8, s * 0.026))}rem`,
            lineHeight: 1.5, margin: '0 0 6px 0',
          }}>
            {definition}
          </p>
        )}
        {!loading && !error && synonyms.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Synonyms
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
              {synonyms.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSearchInput(s);
                    onUpdate?.(widget.id, { dictionaryQuery: s });
                  }}
                  style={{
                    padding: '1px 6px', borderRadius: 3,
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#a5b4fc', fontFamily: MONO, fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && !error && origin && (
          <div>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Etymology
            </span>
            <p style={{
              color: '#7c8aa6', fontFamily: MONO,
              fontSize: `${Math.max(0.6, Math.min(0.7, s * 0.022))}rem`,
              lineHeight: 1.4, margin: '3px 0 0 0', fontStyle: 'italic',
            }}>
              {origin}
            </p>
          </div>
        )}
      </div>

      {/* Bottom accent */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, #6366f1, #818cf8, #6366f1)',
        opacity: 0.6,
      }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  QRGeneratorWidget v2 — multi-mode QR with logo, theming, copy, history.
//  Modes: URL · WiFi · vCard · Email · Geo. Each mode persists its values
//  on the widget so switching tabs preserves work in progress. The QR is
//  rendered at error-correction level H whenever a center logo is set so
//  the embedded image remains scannable.
// ─────────────────────────────────────────────────────────────────────────────

