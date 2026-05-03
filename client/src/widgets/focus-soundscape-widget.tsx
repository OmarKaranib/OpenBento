// Focus Soundscape — procedurally-generated ambient loop. No audio
// assets required: each preset wires up a noise buffer through a
// filter chain in the Web Audio API. Honors widget.isMuted (master
// mute) and widget.volume (0-100). Productivity theming via isLightBg.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudRain, Coffee, Flame, type LucideIcon, Pause, Play, Settings as SettingsIcon, TreePine, Volume2, Waves, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle } from './shared';

interface FocusSoundscapeProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

type SoundKey = NonNullable<Widget['soundscape']>;

const SOUND_OPTIONS: { key: SoundKey; label: string; Icon: LucideIcon }[] = [
  { key: 'rain',   label: 'Rain',   Icon: CloudRain },
  { key: 'cafe',   label: 'Cafe',   Icon: Coffee },
  { key: 'fire',   label: 'Fire',   Icon: Flame },
  { key: 'forest', label: 'Forest', Icon: TreePine },
  { key: 'waves',  label: 'Waves',  Icon: Waves },
];

interface AudioGraph {
  ctx: AudioContext;
  src: AudioBufferSourceNode;
  gain: GainNode;
  extras: AudioNode[];
}

function buildNoiseBuffer(ctx: AudioContext, kind: 'white' | 'brown'): AudioBuffer {
  const seconds = 4;
  const sampleRate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, seconds * sampleRate, sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buf;
}

function buildGraph(ctx: AudioContext, sound: SoundKey): AudioGraph {
  const isBrown = sound === 'waves' || sound === 'fire' || sound === 'forest' || sound === 'cafe';
  const buf = buildNoiseBuffer(ctx, isBrown ? 'brown' : 'white');
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  const extras: AudioNode[] = [];

  let head: AudioNode = src;

  switch (sound) {
    case 'rain': {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 6500;
      head.connect(hp); hp.connect(lp); head = lp;
      extras.push(hp, lp);
      break;
    }
    case 'cafe': {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      head.connect(lp); head = lp;
      extras.push(lp);
      break;
    }
    case 'fire': {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      head.connect(lp); head = lp;
      extras.push(lp);
      break;
    }
    case 'forest': {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.7;
      head.connect(bp); head = bp;
      extras.push(bp);
      break;
    }
    case 'waves': {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      // Slow LFO modulating gain to simulate swelling waves.
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.55;
      const swell = ctx.createGain(); swell.gain.value = 0.45;
      lfo.connect(lfoGain); lfoGain.connect(swell.gain);
      head.connect(lp); lp.connect(swell); head = swell;
      lfo.start();
      extras.push(lp, lfo, lfoGain, swell);
      break;
    }
  }

  head.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  return { ctx, src, gain, extras };
}

function disposeGraph(g: AudioGraph): void {
  try { g.src.stop(); } catch { /* already stopped */ }
  try { g.src.disconnect(); } catch { /* noop */ }
  try { g.gain.disconnect(); } catch { /* noop */ }
  for (const n of g.extras) {
    try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* noop */ }
    try { n.disconnect(); } catch { /* noop */ }
  }
  g.ctx.close().catch(() => {});
}

export const FocusSoundscapeWidget: React.FC<FocusSoundscapeProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  const [playing, setPlaying] = useState(false);
  const graphRef = useRef<AudioGraph | null>(null);
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

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
  // Master mute contract: only true if the dashboard explicitly muted this
  // widget. New widgets default to UNMUTED so a user-gesture play actually
  // produces sound at the chosen volume — they still won't hear anything
  // until they click Play (autoplay policy guarantees this).
  const muted = widget.isMuted === true;

  // Effective gain: 0 when muted or volume === 0.
  const effGain = useMemo(
    () => (muted || volume === 0 || !playing) ? 0 : Math.min(0.45, (volume / 100) * 0.45),
    [muted, volume, playing],
  );

  // Live-update gain on volume / mute changes (no audio rebuild).
  useEffect(() => {
    const g = graphRef.current; if (!g) return;
    g.gain.gain.cancelScheduledValues(g.ctx.currentTime);
    g.gain.gain.linearRampToValueAtTime(effGain, g.ctx.currentTime + 0.12);
  }, [effGain]);

  // Tear down graph + clear any pending rebuild timer on unmount.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (rebuildTimerRef.current) { clearTimeout(rebuildTimerRef.current); rebuildTimerRef.current = null; }
      if (graphRef.current) { disposeGraph(graphRef.current); graphRef.current = null; }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (graphRef.current) { disposeGraph(graphRef.current); graphRef.current = null; }
    setPlaying(false);
  }, []);

  const startAudio = useCallback(() => {
    if (graphRef.current) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const g = buildGraph(ctx, sound);
      g.gain.gain.value = 0;
      g.gain.gain.linearRampToValueAtTime(effGain, ctx.currentTime + 0.25);
      graphRef.current = g;
      setPlaying(true);
    } catch (err) {
      console.warn('[Soundscape] failed to start:', err);
    }
  }, [sound, effGain]);

  // Switching sound while playing rebuilds the graph.
  const selectSound = (next: SoundKey) => {
    if (next === sound) return;
    onUpdate?.(widget.id, { soundscape: next });
    if (playing) {
      stopAudio();
      // Cancel any in-flight rebuild before scheduling a new one.
      if (rebuildTimerRef.current) { clearTimeout(rebuildTimerRef.current); rebuildTimerRef.current = null; }
      // Rebuild on next paint — ref already cleared. Abort if unmounted
      // so a late timer can't resurrect an AudioContext after teardown.
      rebuildTimerRef.current = setTimeout(() => {
        rebuildTimerRef.current = null;
        if (!mountedRef.current) return;
        try {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) return;
          const ctx = new Ctor();
          const g = buildGraph(ctx, next);
          g.gain.gain.value = 0;
          g.gain.gain.linearRampToValueAtTime(effGain, ctx.currentTime + 0.25);
          graphRef.current = g;
          setPlaying(true);
        } catch { /* swallow */ }
      }, 60);
    }
  };

  const togglePlay = () => {
    if (playing) stopAudio();
    else startAudio();
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
          {muted ? 'MUTED' : (playing ? 'PLAYING' : 'PAUSED')}
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
            Procedurally generated — no downloads, respects master mute.
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
