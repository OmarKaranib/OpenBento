// Lava Lamp — pure-canvas blob animation. Color-tunable via palette presets
// or "match background" which derives palette from the widget's customColor.
// Respects prefers-reduced-motion: falls back to a static gradient.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle, qrLabelStyle } from './shared';

interface LavaLampProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

type PaletteId = 'aurora' | 'sunset' | 'ocean' | 'magma' | 'forest' | 'match';

const PALETTES: Record<Exclude<PaletteId, 'match'>, { bg: string; blobs: string[]; label: string }> = {
  aurora: { label: 'Aurora', bg: '#0a1d2a', blobs: ['#22d3ee', '#a855f7', '#10b981', '#3b82f6'] },
  sunset: { label: 'Sunset', bg: '#1f0a14', blobs: ['#f97316', '#ec4899', '#fbbf24', '#ef4444'] },
  ocean:  { label: 'Ocean',  bg: '#031629', blobs: ['#0ea5e9', '#0891b2', '#1d4ed8', '#22d3ee'] },
  magma:  { label: 'Magma',  bg: '#1c0606', blobs: ['#dc2626', '#f59e0b', '#7c2d12', '#fb923c'] },
  forest: { label: 'Forest', bg: '#031912', blobs: ['#10b981', '#65a30d', '#14b8a6', '#34d399'] },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paletteFor(widget: Widget): { bg: string; blobs: string[] } {
  const id = (widget.lavaPalette as PaletteId | undefined) ?? 'aurora';
  if (id !== 'match') return PALETTES[id] ?? PALETTES.aurora;
  // Derive a palette from the widget's customColor: shift hue by rotating RGB.
  const base = widget.customColor ?? PALETTES.aurora.bg;
  const [r, g, b] = hexToRgb(base);
  const rot = (rr: number, gg: number, bb: number) => `rgb(${rr},${gg},${bb})`;
  return {
    bg: base,
    blobs: [
      rot(Math.min(255, r + 60), g, b),
      rot(r, Math.min(255, g + 60), b),
      rot(r, g, Math.min(255, b + 80)),
      rot(Math.min(255, r + 40), Math.min(255, g + 40), b),
    ],
  };
}

interface Blob { x: number; y: number; vx: number; vy: number; r: number; color: string; }

export const LavaLampWidget: React.FC<LavaLampProps> = ({ widget, onUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [size, setSize] = useState({ w: 240, h: 240 });

  const palette = useMemo(() => paletteFor(widget), [widget.lavaPalette, widget.customColor]);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  );

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(40, size.w);
    const H = Math.max(40, size.h);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // 5 blobs, slow lazy drift. Low CPU at idle by limiting to ~30fps.
    const rnd = () => Math.random();
    const blobs: Blob[] = Array.from({ length: 5 }, (_, i) => ({
      x: rnd() * W,
      y: rnd() * H,
      vx: (rnd() - 0.5) * 0.25,
      vy: (rnd() - 0.5) * 0.25,
      r: Math.max(40, Math.min(W, H) * (0.22 + rnd() * 0.10)),
      color: palette.blobs[i % palette.blobs.length],
    }));

    let raf = 0;
    let last = 0;
    const FRAME_MS = 33;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < FRAME_MS) return;
      last = t;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.r) b.vx = Math.abs(b.vx);
        if (b.x > W + b.r) b.vx = -Math.abs(b.vx);
        if (b.y < -b.r) b.vy = Math.abs(b.vy);
        if (b.y > H + b.r) b.vy = -Math.abs(b.vy);
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [palette, size.w, size.h, reducedMotion]);

  const setPalette = (id: PaletteId) => onUpdate?.(widget.id, { lavaPalette: id });

  const accent = isLightBg(palette.bg) ? '#0f172a' : '#e2e8f0';

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        borderRadius: 'var(--outer-radius)', background: palette.bg,
        border: `1px solid ${isLightBg(palette.bg) ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)'}`,
      }}
      data-testid={`lava-lamp-widget-${widget.id}`}
    >
      {reducedMotion ? (
        // Static fallback honors prefers-reduced-motion.
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 30% 30%, ${palette.blobs[0]}66 0%, transparent 50%),
                       radial-gradient(circle at 70% 70%, ${palette.blobs[1]}66 0%, transparent 50%),
                       ${palette.bg}`,
        }} />
      ) : (
        <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
      )}

      <div className="widget-hover-cog" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
        <button
          onClick={() => setShowSettings(s => !s)}
          style={qrIconBtnStyle()}
          title="Lava lamp settings"
          data-testid={`lava-settings-toggle-${widget.id}`}
        >
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ position: 'absolute', top: 8, left: 10, display: 'flex', alignItems: 'center', gap: 4, zIndex: 4 }}>
        <Sparkles size={12} color={accent} />
        <span style={{ color: accent, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
          LAVA
        </span>
      </div>

      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 6,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`lava-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: '#22d3ee', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Palette</span>
            <button onClick={() => setShowSettings(false)} style={qrIconBtnStyle()} data-testid={`lava-settings-close-${widget.id}`}>
              <XIcon size={11} />
            </button>
          </div>
          <span style={qrLabelStyle()}>Choose a look</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {(Object.keys(PALETTES) as Array<keyof typeof PALETTES>).map(id => {
              const p = PALETTES[id];
              const active = (widget.lavaPalette ?? 'aurora') === id;
              return (
                <button
                  key={id}
                  onClick={() => setPalette(id)}
                  style={{
                    ...qrIconBtnStyle(),
                    width: '100%', height: 32,
                    background: p.bg,
                    borderColor: active ? '#22d3ee' : 'rgba(255,255,255,0.15)',
                    color: '#e2e8f0', justifyContent: 'flex-start',
                    paddingLeft: 8, gap: 6,
                  }}
                  data-testid={`lava-palette-${id}-${widget.id}`}
                >
                  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: p.blobs[0] }} />
                  <span style={{ fontFamily: MONO, fontSize: 10 }}>{p.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setPalette('match')}
              style={{
                ...qrIconBtnStyle(),
                width: '100%', height: 32,
                background: widget.customColor ?? '#1e293b',
                borderColor: (widget.lavaPalette === 'match') ? '#22d3ee' : 'rgba(255,255,255,0.15)',
                color: '#e2e8f0', justifyContent: 'flex-start', paddingLeft: 8, gap: 6,
              }}
              data-testid={`lava-palette-match-${widget.id}`}
            >
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: 'linear-gradient(45deg,#22d3ee,#a855f7)' }} />
              <span style={{ fontFamily: MONO, fontSize: 10 }}>Match BG</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
