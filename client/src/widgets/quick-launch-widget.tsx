// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Grid3x3, Plus as PlusIcon, Settings as SettingsIcon, Trash2, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, normalizeUrl, qrIconBtnStyle, qrInputStyle } from './shared';

interface QuickLaunchProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

function faviconUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return '';
  }
}

export const QuickLaunchWidget: React.FC<QuickLaunchProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftUrl, setDraftUrl] = useState('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize(Math.min(e.contentRect.width, e.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = (widget.quickLaunchCols ?? 3) as 2 | 3 | 4;
  const tiles = widget.quickLinks ?? [];
  // Theme awareness — see HabitTracker note.
  const bgColor    = widget.customColor ?? '#0f172a';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#0891b2' : '#2dd4bf';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrTileBg  = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
  const clrTileBd  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';

  const setTiles = (next: NonNullable<Widget['quickLinks']>) => {
    onUpdate?.(widget.id, { quickLinks: next });
  };
  const setCols = (n: 2 | 3 | 4) => {
    onUpdate?.(widget.id, { quickLaunchCols: n });
  };

  const addTile = () => {
    const u = normalizeUrl(draftUrl);
    const label = draftLabel.trim() || (() => {
      try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Link'; }
    })();
    if (!u) return;
    if (tiles.length >= 16) return;
    setTiles([
      ...tiles,
      { id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label, url: u },
    ]);
    setDraftLabel('');
    setDraftUrl('');
  };
  const removeTile = (id: string) => setTiles(tiles.filter(t => t.id !== id));
  const moveTile = (id: string, dir: -1 | 1) => {
    const i = tiles.findIndex(t => t.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= tiles.length) return;
    const next = [...tiles];
    [next[i], next[j]] = [next[j], next[i]];
    setTiles(next);
  };

  const tileFs = Math.max(9, Math.min(12, size * 0.035));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`,
        position: 'relative',
      }}
      data-testid={`quick-launch-widget-${widget.id}`}
    >
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
          title="Tile settings"
          data-testid={`quick-launch-settings-toggle-${widget.id}`}
        >
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Grid3x3 size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          QUICK LAUNCH
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>{tiles.length} tile{tiles.length === 1 ? '' : 's'}</span>
      </div>

      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`quick-launch-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
              Edit tiles
            </span>
            <button
              onClick={() => setShowSettings(false)}
              style={qrIconBtnStyle()}
              data-testid={`quick-launch-settings-close-${widget.id}`}
            >
              <XIcon size={11} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([2, 3, 4] as const).map(n => (
              <button
                key={n}
                onClick={() => setCols(n)}
                style={{
                  ...qrIconBtnStyle(),
                  background: cols === n ? `${accent}33` : 'rgba(255,255,255,0.04)',
                  borderColor: cols === n ? accent : 'rgba(255,255,255,0.1)',
                  color: cols === n ? accent : '#cbd5e1',
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  padding: '4px 8px',
                }}
                data-testid={`quick-launch-cols-${n}-${widget.id}`}
              >
                {n}×{n}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              type="text"
              value={draftLabel}
              onChange={e => setDraftLabel(e.target.value)}
              placeholder="Label (optional)"
              maxLength={20}
              style={qrInputStyle(11)}
              data-testid={`quick-launch-input-label-${widget.id}`}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={draftUrl}
                onChange={e => setDraftUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTile(); }}
                placeholder="https://example.com"
                style={qrInputStyle(11)}
                data-testid={`quick-launch-input-url-${widget.id}`}
              />
              <button
                onClick={addTile}
                disabled={!draftUrl.trim() || tiles.length >= 16}
                style={{
                  ...qrIconBtnStyle(),
                  opacity: !draftUrl.trim() || tiles.length >= 16 ? 0.4 : 1,
                }}
                data-testid={`quick-launch-add-${widget.id}`}
              >
                <PlusIcon size={11} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tiles.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', gap: 4, alignItems: 'center',
                padding: '4px 6px', borderRadius: 4,
                background: clrTileBg,
                border: `1px solid ${clrTileBd}`,
              }}>
                <span style={{
                  flex: 1, color: clrPrimary, fontFamily: MONO, fontSize: 10,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={`${t.label} → ${t.url}`}>
                  {t.label}
                </span>
                <button
                  onClick={() => moveTile(t.id, -1)}
                  disabled={i === 0}
                  style={{ ...qrIconBtnStyle(), opacity: i === 0 ? 0.3 : 1, padding: 4 }}
                  data-testid={`quick-launch-up-${t.id}-${widget.id}`}
                >
                  <ChevronLeft size={10} />
                </button>
                <button
                  onClick={() => moveTile(t.id, 1)}
                  disabled={i === tiles.length - 1}
                  style={{ ...qrIconBtnStyle(), opacity: i === tiles.length - 1 ? 0.3 : 1, padding: 4 }}
                  data-testid={`quick-launch-down-${t.id}-${widget.id}`}
                >
                  <ChevronRight size={10} />
                </button>
                <button
                  onClick={() => removeTile(t.id)}
                  style={{ ...qrIconBtnStyle(), padding: 4 }}
                  data-testid={`quick-launch-remove-${t.id}-${widget.id}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showSettings && (
        <div style={{
          flex: 1, minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 6,
        }}>
          {tiles.length === 0 && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                gridColumn: `span ${cols}`,
                padding: '8px 12px', borderRadius: 6,
                background: clrTileBg,
                border: `1px dashed ${clrTileBd}`,
                color: clrSubtle, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                alignSelf: 'center',
              }}
              data-testid={`quick-launch-empty-cta-${widget.id}`}
            >
              + Add tile
            </button>
          )}
          {tiles.slice(0, cols * cols).map(t => (
            <a
              key={t.id}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: 6, borderRadius: 6,
                background: clrTileBg,
                border: `1px solid ${accent}33`,
                textDecoration: 'none', color: clrPrimary,
                minHeight: 0, overflow: 'hidden',
                transition: 'transform 0.1s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}33`; }}
              title={t.url}
              data-testid={`quick-launch-tile-${t.id}-${widget.id}`}
            >
              <img
                src={faviconUrl(t.url)}
                alt=""
                style={{ width: 20, height: 20, flexShrink: 0 }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              <span style={{
                fontFamily: MONO, fontSize: tileFs, fontWeight: 600,
                textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', maxWidth: '100%',
              }}>
                {t.label}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  BigTextMarqueeWidget — static or scrolling banner.
// ─────────────────────────────────────────────────────────────────────────────

