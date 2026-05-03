// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { Activity, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, normalizeUrl, qrIconBtnStyle, qrInputStyle } from './shared';

interface NetworkLightProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

interface PingResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  fetchedAt: number;
  error?: string;
}

export const NetworkLightWidget: React.FC<NetworkLightProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(180);
  const [showSettings, setShowSettings] = useState(false);
  const [draftUrl, setDraftUrl] = useState(widget.networkUrl ?? '');
  const [result, setResult] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize(Math.min(e.contentRect.width, e.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const url = widget.networkUrl;
  const intervalSec = widget.networkIntervalSec ?? 30;

  useEffect(() => {
    if (!url) { setResult(null); return; }
    let cancelled = false;
    const ping = async () => {
      setPinging(true);
      try {
        const r = await fetch(`/api/ping?url=${encodeURIComponent(url)}`);
        const body: PingResult = await r.json();
        if (!cancelled) setResult(body);
      } catch (err: unknown) {
        if (!cancelled) {
          setResult({
            ok: false, status: 0, latencyMs: 0, fetchedAt: Date.now(),
            error: err instanceof Error ? err.message : 'Network error',
          });
        }
      } finally {
        if (!cancelled) setPinging(false);
      }
    };
    ping();
    const id = setInterval(ping, intervalSec * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [url, intervalSec]);

  const submit = () => {
    const u = normalizeUrl(draftUrl);
    if (!u) return;
    onUpdate?.(widget.id, { networkUrl: u });
    setShowSettings(false);
  };

  // Theme awareness — see HabitTracker note.
  const bgColor    = widget.customColor ?? '#0f172a';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#65a30d' : '#a3e635';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const dotColor = !url ? (light ? '#94a3b8' : '#475569')
                    : pinging ? '#fbbf24'
                    : result?.ok ? '#22c55e' : '#ef4444';
  const dotSize = Math.max(40, Math.min(96, size * 0.36));
  const labelFs = Math.max(9, Math.min(12, size * 0.06));
  const host = (() => { try { return new URL(url || '').hostname.replace(/^www\./, ''); } catch { return url || ''; } })();

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
      data-testid={`network-light-widget-${widget.id}`}
    >
      <div
        className="widget-hover-cog"
        style={{
          position: 'absolute', top: 8, right: 8,
          transition: 'opacity 0.15s', zIndex: 5,
        }}
      >
        <button
          onClick={() => { setDraftUrl(url ?? ''); setShowSettings(s => !s); }}
          style={qrIconBtnStyle()}
          title="Network settings"
          data-testid={`network-settings-toggle-${widget.id}`}
        >
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Activity size={14} color={accent} />
        <span style={{
          flex: 1, color: accent, fontFamily: MONO,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {host || 'NETWORK LIGHT'}
        </span>
      </div>

      {(showSettings || !url) && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
            borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`network-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
              Ping target
            </span>
            {url && (
              <button
                onClick={() => setShowSettings(false)}
                style={qrIconBtnStyle()}
                data-testid={`network-settings-close-${widget.id}`}
              >
                <XIcon size={11} />
              </button>
            )}
          </div>
          <input
            type="text"
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="https://example.com"
            style={qrInputStyle(11)}
            data-testid={`network-input-url-${widget.id}`}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([10, 30, 60, 300] as const).map(s => (
              <button
                key={s}
                onClick={() => onUpdate?.(widget.id, { networkIntervalSec: s })}
                style={{
                  ...qrIconBtnStyle(),
                  background: intervalSec === s ? `${accent}33` : 'rgba(255,255,255,0.04)',
                  borderColor: intervalSec === s ? accent : 'rgba(255,255,255,0.1)',
                  color: intervalSec === s ? accent : '#cbd5e1',
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  padding: '4px 6px',
                }}
                data-testid={`network-interval-${s}-${widget.id}`}
              >
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </button>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={!draftUrl.trim()}
            style={{
              padding: '6px 8px', borderRadius: 6,
              background: `${accent}33`,
              border: `1px solid ${accent}`,
              color: accent, cursor: 'pointer',
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              opacity: !draftUrl.trim() ? 0.4 : 1,
            }}
            data-testid={`network-submit-${widget.id}`}
          >
            Save & ping
          </button>
        </div>
      )}

      {!showSettings && url && (
        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <div
            style={{
              width: dotSize, height: dotSize, borderRadius: '50%',
              background: `radial-gradient(circle, ${dotColor} 0%, ${dotColor}66 70%, transparent 100%)`,
              boxShadow: `0 0 ${dotSize * 0.4}px ${dotColor}88`,
              transition: 'background 0.4s, box-shadow 0.4s',
            }}
            data-testid={`network-dot-${widget.id}`}
          />
          <div style={{
            color: clrPrimary, fontFamily: MONO,
            fontSize: labelFs, fontWeight: 700,
          }}>
            {!result ? 'Pinging…' : result.ok ? `${result.latencyMs}ms` : result.error?.slice(0, 30) || 'DOWN'}
          </div>
          {result && (
            <div style={{
              color: clrMuted, fontFamily: MONO,
              fontSize: Math.max(8, labelFs - 2),
            }}>
              {result.status > 0 ? `HTTP ${result.status}` : '—'} · every {intervalSec < 60 ? `${intervalSec}s` : `${intervalSec / 60}m`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PhotoLoopWidget — rotating image gallery with crossfade.
// ─────────────────────────────────────────────────────────────────────────────

