// Focus Soundscape — bundled WAV loop player. Assets are generated
// offline by scripts/generate-soundscapes.mjs (filter chain + seam
// crossfade) and shipped from /sounds/wellness/. Honors widget.isMuted
// + widget.volume; theming via isLightBg.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudRain, Flame, type LucideIcon, Pause, Play, Settings as SettingsIcon, TreePine, Volume2, Waves, Wind, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle } from './shared';

interface FocusSoundscapeProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

type SoundKey = NonNullable<Widget['soundscape']>;

const SOUND_OPTIONS: { key: SoundKey; label: string; Icon: LucideIcon; asset: string }[] = [
  { key: 'rain',   label: 'Rain',   Icon: CloudRain, asset: '/sounds/wellness/rain.wav' },
  { key: 'brown',  label: 'Brown',  Icon: Wind,      asset: '/sounds/wellness/brown.wav' },
  { key: 'fire',   label: 'Fire',   Icon: Flame,     asset: '/sounds/wellness/fire.wav' },
  { key: 'forest', label: 'Forest', Icon: TreePine,  asset: '/sounds/wellness/forest.wav' },
  { key: 'waves',  label: 'Waves',  Icon: Waves,     asset: '/sounds/wellness/waves.wav' },
];

interface AudioGraph {
  ctx: AudioContext;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

// Module-scoped decode cache so pause→play and preset switches don't
// re-fetch the asset.
const bufferCache = new Map<SoundKey, AudioBuffer>();
const inflightCache = new Map<SoundKey, Promise<AudioBuffer>>();

async function loadBuffer(ctx: AudioContext, sound: SoundKey): Promise<AudioBuffer> {
  const cached = bufferCache.get(sound);
  if (cached) return cached;
  const inflight = inflightCache.get(sound);
  if (inflight) return inflight;
  const opt = SOUND_OPTIONS.find(o => o.key === sound) ?? SOUND_OPTIONS[0];
  const p = (async () => {
    const res = await fetch(opt.asset);
    if (!res.ok) throw new Error(`fetch ${opt.asset} → ${res.status}`);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    bufferCache.set(sound, buf);
    inflightCache.delete(sound);
    return buf;
  })();
  inflightCache.set(sound, p);
  return p;
}

function buildGraph(ctx: AudioContext, buffer: AudioBuffer): AudioGraph {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  return { ctx, src, gain };
}

function disposeGraph(g: AudioGraph): void {
  try { g.src.stop(); } catch { /* already stopped */ }
  try { g.src.disconnect(); } catch { /* noop */ }
  try { g.gain.disconnect(); } catch { /* noop */ }
  g.ctx.close().catch(() => {});
}

export const FocusSoundscapeWidget: React.FC<FocusSoundscapeProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const graphRef = useRef<AudioGraph | null>(null);
  const mountedRef = useRef(true);
  // Bumped on play/stop/switch; in-flight loaders bail when it changes.
  const reqIdRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setSize(Math.min(e.contentRect.width, e.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sound = widget.soundscape ?? 'rain';
  const volume = widget.volume ?? 40;
  const muted = widget.isMuted === true;

  const effGain = useMemo(
    () => (muted || volume === 0 || !playing) ? 0 : Math.min(0.45, (volume / 100) * 0.45),
    [muted, volume, playing],
  );

  useEffect(() => {
    const g = graphRef.current; if (!g) return;
    g.gain.gain.cancelScheduledValues(g.ctx.currentTime);
    g.gain.gain.linearRampToValueAtTime(effGain, g.ctx.currentTime + 0.12);
  }, [effGain]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      reqIdRef.current += 1;
      if (graphRef.current) { disposeGraph(graphRef.current); graphRef.current = null; }
    };
  }, []);

  const stopAudio = useCallback(() => {
    reqIdRef.current += 1;
    if (graphRef.current) { disposeGraph(graphRef.current); graphRef.current = null; }
    setPlaying(false);
    setLoading(false);
  }, []);

  const startAudio = useCallback(async (which: SoundKey) => {
    if (graphRef.current) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const buf = await loadBuffer(ctx, which);
      if (!mountedRef.current || reqIdRef.current !== myReq) {
        ctx.close().catch(() => {});
        return;
      }
      const g = buildGraph(ctx, buf);
      g.gain.gain.value = 0;
      g.gain.gain.linearRampToValueAtTime(effGain, ctx.currentTime + 0.25);
      graphRef.current = g;
      setPlaying(true);
    } catch (err) {
      console.warn('[Soundscape] failed to start:', err);
      ctx.close().catch(() => {});
    } finally {
      if (mountedRef.current && reqIdRef.current === myReq) setLoading(false);
    }
  }, [effGain]);

  const selectSound = (next: SoundKey) => {
    if (next === sound) return;
    onUpdate?.(widget.id, { soundscape: next });
    if (playing || loading) {
      if (graphRef.current) { disposeGraph(graphRef.current); graphRef.current = null; }
      setPlaying(false);
      void startAudio(next);
    }
  };

  const togglePlay = () => {
    if (playing || loading) stopAudio();
    else void startAudio(sound);
  };

  const setVolume = (v: number) => {
    onUpdate?.(widget.id, { volume: v, isMuted: v === 0 });
  };

  const bgColor    = widget.customColor ?? '#0c1929';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#0369a1' : '#67e8f9';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrCellBg  = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
  const clrCellBdr = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';
  const clrInert   = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const clrInertBd = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';

  const ActiveIcon = (SOUND_OPTIONS.find(s => s.key === sound) ?? SOUND_OPTIONS[0]).Icon;
  const fs = Math.max(11, Math.min(15, size * 0.045));
  const status = muted ? 'MUTED' : (loading ? 'LOADING' : (playing ? 'PLAYING' : 'PAUSED'));

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
      data-testid={`focus-soundscape-widget-${widget.id}`}
    >
      <div className="widget-hover-cog" style={{ position: 'absolute', top: 8, right: 8, transition: 'opacity 0.15s', zIndex: 5 }}>
        <button onClick={() => setShowSettings(s => !s)} style={qrIconBtnStyle()} title="Sound settings" data-testid={`soundscape-settings-toggle-${widget.id}`}>
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <ActiveIcon size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          SOUNDSCAPE
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9, textTransform: 'uppercase' }}>
          {status}
        </span>
      </div>

      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`soundscape-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Soundscape</span>
            <button onClick={() => setShowSettings(false)} style={qrIconBtnStyle()} data-testid={`soundscape-settings-close-${widget.id}`}>
              <XIcon size={11} />
            </button>
          </div>
          <p style={{ color: '#94a3b8', fontFamily: MONO, fontSize: 10, margin: 0 }}>
            Bundled ambient loops (~170KB each). Respects master mute.
          </p>
        </div>
      )}

      {!showSettings && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 4, marginBottom: 8, flexShrink: 0,
          }}>
            {SOUND_OPTIONS.map(({ key, label, Icon }) => {
              const active = key === sound;
              return (
                <button
                  key={key}
                  onClick={() => selectSound(key)}
                  title={label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '6px 4px', borderRadius: 6,
                    background: active ? `${accent}22` : clrCellBg,
                    border: `1px solid ${active ? accent : clrCellBdr}`,
                    color: active ? accent : clrSubtle,
                    cursor: 'pointer',
                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  }}
                  data-testid={`soundscape-pick-${key}-${widget.id}`}
                >
                  <Icon size={14} color={active ? accent : clrSubtle} />
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                </button>
              );
            })}
          </div>

          <div style={{
            flex: 1, minHeight: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <button
              onClick={togglePlay}
              style={{
                width: Math.max(48, size * 0.22), height: Math.max(48, size * 0.22),
                borderRadius: '50%',
                background: playing && !muted ? accent : clrInert,
                border: `1px solid ${playing && !muted ? accent : clrInertBd}`,
                color: playing && !muted ? bgColor : clrPrimary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
              title={playing ? 'Pause' : 'Play'}
              data-testid={`soundscape-play-${widget.id}`}
            >
              {playing ? <Pause size={Math.max(18, size * 0.08)} /> : <Play size={Math.max(18, size * 0.08)} />}
            </button>
            <div style={{ color: clrPrimary, fontFamily: MONO, fontSize: fs, fontWeight: 700, letterSpacing: '0.04em' }}>
              {(SOUND_OPTIONS.find(s => s.key === sound) ?? SOUND_OPTIONS[0]).label.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Volume2 size={11} color={clrMuted} />
            <input
              type="range" min={0} max={100} step={5}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              style={{ flex: 1 }}
              data-testid={`soundscape-volume-${widget.id}`}
            />
            <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10, minWidth: 28, textAlign: 'right' }}>
              {volume}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
