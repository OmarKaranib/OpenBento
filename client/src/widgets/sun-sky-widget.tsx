// Sun & Sky Position — sunrise/sunset arc with a sun-glyph dot, golden hour
// countdown, and moon phase. Location uses widget overrides → geolocation
// → London fallback. All math is local (sky-helpers.ts), no API needed.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sun, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import {
  MONO, Widget, isLightBg,
  qrIconBtnStyle, qrInputStyle, qrLabelStyle,
} from './shared';
import { computeMoonPhase, computeSunTimes } from './sky-helpers';
import { getLastResolvedLocation, subscribeLocation } from './weather-location';

interface SunSkyProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

function formatTime(d: Date | null): string {
  if (!d) return '--:--';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export const SunSkyWidget: React.FC<SunSkyProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 200 });
  const [showSettings, setShowSettings] = useState(false);
  // Re-render every minute so countdown + sun position stay live.
  const [now, setNow] = useState(() => new Date());
  // Resolved location (override > geolocation > London).
  const [resolved, setResolved] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [cityInput, setCityInput] = useState(widget.sunCity ?? '');

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => {
      for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Resolve location on mount or when overrides change.
  // Precedence: explicit override → Weather widget's last resolved location
  // → city geocode → browser geolocation → London fallback. We also
  // subscribe to weather updates so a later weather resolve replaces our
  // London fallback transparently.
  useEffect(() => {
    let cancelled = false;
    const useOverride = widget.sunLat != null && widget.sunLon != null;
    const useCity = !!widget.sunCity;

    if (useOverride) {
      setResolved({ lat: widget.sunLat!, lon: widget.sunLon!, label: widget.sunCity ?? 'Custom' });
      return;
    }

    (async () => {
      // 1) Reuse Weather widget's already-resolved location (no extra
      //    geolocation prompt or geocode round-trip).
      const cached = getLastResolvedLocation();
      if (!useCity && cached) {
        if (!cancelled) setResolved({ lat: cached.lat, lon: cached.lon, label: cached.label });
        return;
      }
      // 2) City name override → geocode via /api/weather.
      if (useCity) {
        try {
          const r = await fetch(`/api/weather?city=${encodeURIComponent(widget.sunCity!)}`);
          if (r.ok) {
            const j = await r.json();
            if (!cancelled && typeof j?.lat === 'number' && typeof j?.lon === 'number') {
              setResolved({ lat: j.lat, lon: j.lon, label: j.city ?? widget.sunCity! });
              return;
            }
          }
        } catch { /* fall through */ }
      }
      // 3) Browser geolocation.
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const settled = await new Promise<{ lat: number; lon: number } | null>(resolve => {
          let done = false;
          const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 4000);
          navigator.geolocation.getCurrentPosition(
            pos => { if (!done) { done = true; clearTimeout(t); resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }); } },
            () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
            { timeout: 4000, maximumAge: 600_000 },
          );
        });
        if (!cancelled && settled) {
          setResolved({ lat: settled.lat, lon: settled.lon, label: 'Here' });
          return;
        }
      }
      // 4) London fallback.
      if (!cancelled) setResolved({ lat: 51.5074, lon: -0.1278, label: 'London' });
    })();

    // Subscribe to later Weather resolves so we upgrade off the fallback
    // as soon as a Weather widget elsewhere on the dashboard resolves.
    const unsubscribe = (!useOverride && !useCity)
      ? subscribeLocation(loc => {
          if (!cancelled) setResolved({ lat: loc.lat, lon: loc.lon, label: loc.label });
        })
      : null;

    return () => { cancelled = true; unsubscribe?.(); };
  }, [widget.sunCity, widget.sunLat, widget.sunLon]);

  const sun = useMemo(() => {
    if (!resolved) return null;
    return computeSunTimes(now, resolved.lat, resolved.lon);
  }, [now, resolved]);

  const moon = useMemo(() => computeMoonPhase(now), [now]);

  const bgColor = widget.customColor ?? '#0a1320';
  const light = isLightBg(bgColor);
  const accent = light ? '#b45309' : '#fbbf24';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrTrack = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)';
  const clrFill = light ? 'rgba(251,191,36,0.30)' : 'rgba(251,191,36,0.18)';

  // Arc geometry — half-ellipse from sunrise (left) to sunset (right).
  const arcW = Math.max(120, size.w - 28);
  const arcH = Math.max(60, Math.min(size.h * 0.45, arcW * 0.45));
  const dotR = Math.max(6, Math.min(12, arcH * 0.12));
  // Position the sun on the arc using its arcFraction (0..1).
  const t = sun ? Math.max(0, Math.min(1, Number.isNaN(sun.arcFraction) ? 0 : sun.arcFraction)) : 0;
  const cx = arcW / 2;
  const cy = arcH;
  const rx = arcW / 2 - dotR;
  const ry = arcH - dotR;
  const angle = Math.PI * (1 - t); // 1 → π (left), 0 → 0 (right)
  const sunX = cx + rx * Math.cos(angle) * -1; // mirror so 0 → left
  const sunY = cy - ry * Math.sin(angle);

  // Golden-hour countdown — show evening hour relative to sunset.
  const goldenLabel = (() => {
    if (!sun) return '—';
    const t0 = now.getTime();
    const ge = sun.goldenHourEveningStart;
    const ss = sun.sunset;
    const gm = sun.goldenHourMorningEnd;
    const sr = sun.sunrise;
    if (sr && t0 < sr.getTime()) return `Sunrise in ${formatDuration(sr.getTime() - t0)}`;
    if (gm && t0 < gm.getTime()) return `Golden hour ends ${formatTime(gm)}`;
    if (ge && t0 < ge.getTime()) return `Golden hour in ${formatDuration(ge.getTime() - t0)}`;
    if (ss && t0 < ss.getTime()) return `Golden hour now · sunset ${formatTime(ss)}`;
    return 'Night';
  })();

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
      }}
      data-testid={`sun-sky-widget-${widget.id}`}
    >
      <div className="widget-hover-cog" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
        <button onClick={() => setShowSettings(s => !s)} style={qrIconBtnStyle()} title="Sun & Sky settings" data-testid={`sun-sky-settings-toggle-${widget.id}`}>
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexShrink: 0 }}>
        <Sun size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          SUN & SKY
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10 }}>
          {resolved?.label ?? '—'}
        </span>
      </div>

      {showSettings ? (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`sun-sky-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Location</span>
            <button onClick={() => setShowSettings(false)} style={qrIconBtnStyle()} data-testid={`sun-sky-settings-close-${widget.id}`}>
              <XIcon size={11} />
            </button>
          </div>
          <span style={qrLabelStyle()}>City (blank = Here / London)</span>
          <input
            type="text" value={cityInput}
            placeholder="e.g. Tokyo"
            onChange={e => setCityInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onUpdate?.(widget.id, { sunCity: cityInput.trim() || undefined, sunLat: undefined, sunLon: undefined });
                setShowSettings(false);
              }
            }}
            style={qrInputStyle(12)}
            data-testid={`sun-sky-city-${widget.id}`}
          />
          <button
            onClick={() => {
              onUpdate?.(widget.id, { sunCity: cityInput.trim() || undefined, sunLat: undefined, sunLon: undefined });
              setShowSettings(false);
            }}
            style={{ ...qrIconBtnStyle(), width: '100%', height: 28, background: `${accent}22`, borderColor: accent, color: accent, fontFamily: MONO, fontSize: 11 }}
            data-testid={`sun-sky-city-save-${widget.id}`}
          >
            Save
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ position: 'relative', height: arcH, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <svg width={arcW} height={arcH + dotR + 2} viewBox={`0 0 ${arcW} ${arcH + dotR + 2}`} style={{ display: 'block', overflow: 'visible' }}>
              {/* Filled arc to suggest the sky dome */}
              <path
                d={`M ${dotR} ${arcH} A ${rx} ${ry} 0 0 1 ${arcW - dotR} ${arcH} L ${arcW - dotR} ${arcH + 1} L ${dotR} ${arcH + 1} Z`}
                fill={clrFill}
              />
              <path
                d={`M ${dotR} ${arcH} A ${rx} ${ry} 0 0 1 ${arcW - dotR} ${arcH}`}
                stroke={clrTrack} strokeWidth={1.5} fill="none"
              />
              <line x1={0} y1={arcH} x2={arcW} y2={arcH} stroke={clrTrack} strokeDasharray="3 3" />
              {sun?.isDay ? (
                <circle cx={sunX} cy={sunY} r={dotR} fill={accent} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
              ) : (
                <circle cx={cx} cy={arcH} r={dotR * 0.6} fill={clrMuted} />
              )}
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: MONO, fontSize: 11 }}>
            <div style={{ color: clrMuted }}>↑ {formatTime(sun?.sunrise ?? null)}</div>
            <div style={{ color: clrPrimary, fontWeight: 700 }}>{goldenLabel}</div>
            <div style={{ color: clrMuted }}>{formatTime(sun?.sunset ?? null)} ↓</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11, color: clrPrimary }}>
            <span style={{ fontSize: 18 }} aria-hidden>{moon.glyph}</span>
            <span>{moon.name}</span>
            <span style={{ marginLeft: 'auto', color: clrMuted }}>{Math.round(moon.illumination * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
