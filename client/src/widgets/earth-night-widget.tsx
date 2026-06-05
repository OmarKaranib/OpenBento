// Earth at Night — slowly rotating night-side globe with a CSS-rendered
// terminator anchored to the current sub-solar longitude (UTC). No external
// imagery and no per-frame API calls — everything is computed locally.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle, qrLabelStyle } from './shared';
import { computeSunTimes } from './sky-helpers';

interface EarthNightProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

export const EarthNightWidget: React.FC<EarthNightProps> = ({ widget, onUpdate }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 240, h: 240 });
  const [now, setNow] = useState(() => new Date());
  const [showSettings, setShowSettings] = useState(false);

  // Continent silhouettes are intentionally schematic (we ship nothing
  // larger than this widget); the focus is the day/night terminator.
  const rotationSeconds = Math.max(20, Math.min(600, widget.earthRotateSec ?? 180));

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Re-tick every minute is plenty for the terminator and slow rotation.
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sub = useMemo(() => computeSunTimes(now, 0, 0), [now]);

  const bgColor = widget.customColor ?? '#020617';
  const light = isLightBg(bgColor);
  const accent = light ? '#1e293b' : '#bae6fd';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';

  const diameter = Math.max(80, Math.min(size.w, size.h) - 28);
  // Map sub-solar longitude (-180..180) to a 0..1 horizontal offset on the
  // sphere texture so the lit side roughly tracks where the sun is.
  const dayOffset = (sub.subSolarLon + 180) / 360;

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
      }}
      data-testid={`earth-night-widget-${widget.id}`}
    >
      {/* Single toggle button: gear when closed, X when open */}
      <div
        className={showSettings ? undefined : 'widget-hover-cog'}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 6 }}
      >
        <button
          onClick={() => setShowSettings(s => !s)}
          style={qrIconBtnStyle()}
          title={showSettings ? 'Close settings' : 'Earth at night settings'}
          data-testid={`earth-night-settings-toggle-${widget.id}`}
        >
          {showSettings ? <XIcon size={11} /> : <SettingsIcon size={11} />}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexShrink: 0 }}>
        <Globe2 size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          EARTH · NIGHT
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10 }}>
          {now.toUTCString().slice(17, 22)} UTC
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: diameter, height: diameter, position: 'relative',
            borderRadius: '50%', overflow: 'hidden',
            boxShadow: `inset 0 0 ${diameter * 0.18}px rgba(0,0,0,0.85),
                        0 0 ${diameter * 0.20}px rgba(56,189,248,0.20)`,
            background: '#020617',
          }}
          data-testid={`earth-night-globe-${widget.id}`}
        >
          {/* Cached night-lights raster — bundled as /earth/night-lights.svg
              and reused across instances. Scrolls horizontally to give the
              illusion of rotation. */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'url(/earth/night-lights.svg), linear-gradient(#04122a, #04122a)',
              backgroundSize: '200% 100%',
              backgroundRepeat: 'repeat-x',
              animation: `earth-spin ${rotationSeconds}s linear infinite`,
            }}
          />
          {/* Day-side glow: a soft highlight anchored to sub-solar longitude. */}
          <div
            style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at ${dayOffset * 100}% 50%,
                rgba(56,189,248,0.35) 0%, rgba(56,189,248,0.18) 25%, rgba(0,0,0,0) 55%)`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />
          {/* Atmosphere ring */}
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              boxShadow: `inset 0 0 ${diameter * 0.1}px rgba(56,189,248,0.45)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      <style>{`@keyframes earth-spin { from { background-position: 0% 0%; } to { background-position: -200% 0%; } }`}</style>

      {/* Settings overlay — no X button inside; toggle button above handles close */}
      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`earth-night-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Rotation speed</span>
          </div>
          <span style={qrLabelStyle()}>Seconds per full rotation: {rotationSeconds}</span>
          <input
            type="range" min={20} max={600} step={10} value={rotationSeconds}
            onChange={e => onUpdate?.(widget.id, { earthRotateSec: Number(e.target.value) })}
            data-testid={`earth-rotate-${widget.id}`}
          />
        </div>
      )}
    </div>
  );
};