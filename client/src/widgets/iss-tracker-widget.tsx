// ISS Live Tracker — pulls position via /api/iss (server proxy + cache),
// plots a dot on a small equirectangular world map, shows distance from
// an optional configured city.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Satellite, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import {
  MONO, Widget, isLightBg,
  qrIconBtnStyle, qrInputStyle, qrLabelStyle,
} from './shared';
import { haversineKm } from './sky-helpers';
import { requestTimeoutSignal } from '@/lib/request-timeout';

interface IssTrackerProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

interface IssPosition {
  lat: number;
  lon: number;
  altitudeKm: number | null;
  velocityKmh: number | null;
  ts: number;
}

interface IssPass {
  atTs: number;
  minDistanceKm: number;
  willPassOverhead: boolean;
}

export const IssTrackerWidget: React.FC<IssTrackerProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 200 });
  const [pos, setPos] = useState<IssPosition | null>(null);
  const [pass, setPass] = useState<IssPass | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cityInput, setCityInput] = useState(widget.issCity ?? '');

  const refreshSec = Math.max(15, Math.min(300, widget.issRefreshSec ?? 30));

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/iss', { signal: requestTimeoutSignal() });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        if (typeof j?.lat === 'number' && typeof j?.lon === 'number') {
          setPos({
            lat: j.lat, lon: j.lon,
            altitudeKm: typeof j.altitudeKm === 'number' ? j.altitudeKm : null,
            velocityKmh: typeof j.velocityKmh === 'number' ? j.velocityKmh : null,
            ts: typeof j.ts === 'number' ? j.ts : Date.now(),
          });
          setErr(null);
        } else {
          setErr('No position available');
        }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    };
    void load();
    const id = setInterval(load, refreshSec * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshSec]);

  // Resolve configured city to lat/lon via the existing /api/weather route.
  useEffect(() => {
    if (!widget.issCity || (widget.issLat != null && widget.issLon != null)) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/weather?city=${encodeURIComponent(widget.issCity!)}`, {
          signal: requestTimeoutSignal(),
        });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        if (typeof j?.lat === 'number' && typeof j?.lon === 'number') {
          onUpdate?.(widget.id, { issLat: j.lat, issLon: j.lon });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [widget.issCity, widget.issLat, widget.issLon, widget.id, onUpdate]);

  // Tick once a minute so the "passing over X in Ym" countdown updates.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch next-pass prediction whenever the configured city resolves.
  // Server response is cached for 5 min, so refetch on that cadence.
  useEffect(() => {
    if (widget.issLat == null || widget.issLon == null) {
      setPass(null);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    const fetchPass = async () => {
      try {
        const r = await fetch(`/api/iss/pass?lat=${widget.issLat}&lon=${widget.issLon}`, {
          signal: requestTimeoutSignal(undefined, ctrl.signal),
        });
        if (!r.ok) return;
        const j = await r.json() as IssPass;
        if (cancelled) return;
        if (typeof j?.atTs === 'number' && typeof j?.minDistanceKm === 'number') {
          setPass(j);
        }
      } catch { /* ignore — keep last value */ }
    };
    void fetchPass();
    const id = setInterval(fetchPass, 5 * 60_000);
    return () => { cancelled = true; ctrl.abort(); clearInterval(id); };
  }, [widget.issLat, widget.issLon]);

  const distance = useMemo(() => {
    if (!pos || widget.issLat == null || widget.issLon == null) return null;
    return haversineKm(widget.issLat, widget.issLon, pos.lat, pos.lon);
  }, [pos, widget.issLat, widget.issLon]);

  const bgColor = widget.customColor ?? '#020617';
  const light = isLightBg(bgColor);
  const accent = light ? '#0f172a' : '#22d3ee';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrLand = light ? 'rgba(15,23,42,0.10)' : 'rgba(148,163,184,0.20)';
  const clrGrid = light ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.12)';

  // Equirectangular projection: x = (lon + 180)/360, y = (90 - lat)/180.
  const mapW = Math.max(160, size.w - 28);
  const mapH = Math.min(mapW * 0.5, Math.max(80, size.h - 90));
  const px = pos ? ((pos.lon + 180) / 360) * mapW : null;
  const py = pos ? ((90 - pos.lat) / 180) * mapH : null;

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
      data-testid={`iss-tracker-widget-${widget.id}`}
    >
      {/* Single toggle button: gear when closed, X when open */}
      <div
        className={showSettings ? undefined : 'widget-hover-cog'}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 6 }}
      >
        <button
          onClick={() => setShowSettings(s => !s)}
          style={qrIconBtnStyle()}
          title={showSettings ? 'Close settings' : 'ISS settings'}
          data-testid={`iss-settings-toggle-${widget.id}`}
        >
          {showSettings ? <XIcon size={11} /> : <SettingsIcon size={11} />}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexShrink: 0 }}>
        <Satellite size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          ISS LIVE
        </span>
        {pos && (
          <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10 }}>
            {pos.lat.toFixed(2)}°, {pos.lon.toFixed(2)}°
          </span>
        )}
      </div>

      {/* Settings overlay — no X button inside; toggle button above handles close */}
      {showSettings ? (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`iss-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Settings</span>
          </div>
          <span style={qrLabelStyle()}>Reference city (optional)</span>
          <input
            type="text" value={cityInput}
            placeholder="e.g. London"
            onChange={e => setCityInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onUpdate?.(widget.id, { issCity: cityInput.trim() || undefined, issLat: undefined, issLon: undefined });
                setShowSettings(false);
              }
            }}
            style={qrInputStyle(12)}
            data-testid={`iss-city-${widget.id}`}
          />
          <span style={qrLabelStyle()}>Refresh interval (sec): {refreshSec}</span>
          <input
            type="range" min={15} max={300} step={5} value={refreshSec}
            onChange={e => onUpdate?.(widget.id, { issRefreshSec: Number(e.target.value) })}
            data-testid={`iss-refresh-${widget.id}`}
          />
          <button
            onClick={() => {
              onUpdate?.(widget.id, { issCity: cityInput.trim() || undefined, issLat: undefined, issLon: undefined });
              setShowSettings(false);
            }}
            style={{ ...qrIconBtnStyle(), width: '100%', height: 28, background: `${accent}22`, borderColor: accent, color: accent, fontFamily: MONO, fontSize: 11 }}
            data-testid={`iss-city-save-${widget.id}`}
          >
            Save
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg
              width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`}
              style={{ display: 'block', borderRadius: 6, background: clrLand }}
              data-testid={`iss-map-${widget.id}`}
            >
              {/* Equator + prime meridian */}
              <line x1={0} y1={mapH / 2} x2={mapW} y2={mapH / 2} stroke={clrGrid} />
              <line x1={mapW / 2} y1={0} x2={mapW / 2} y2={mapH} stroke={clrGrid} />
              {/* Reference city marker */}
              {widget.issLat != null && widget.issLon != null && (
                <circle
                  cx={((widget.issLon + 180) / 360) * mapW}
                  cy={((90 - widget.issLat) / 180) * mapH}
                  r={3} fill={clrMuted}
                  data-testid={`iss-city-marker-${widget.id}`}
                />
              )}
              {/* ISS dot */}
              {pos && px != null && py != null && (
                <>
                  <circle cx={px} cy={py} r={6} fill={accent} opacity={0.25} />
                  <circle cx={px} cy={py} r={3} fill={accent} />
                </>
              )}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 11, color: clrPrimary }}>
            <span>Alt: {pos?.altitudeKm != null ? `${Math.round(pos.altitudeKm)} km` : '—'}</span>
            <span>Vel: {pos?.velocityKmh != null ? `${Math.round(pos.velocityKmh).toLocaleString()} km/h` : '—'}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: clrMuted, textAlign: 'center' }}>
            {(() => {
              if (err) return `ISS: ${err}`;
              if (distance == null) {
                return widget.issCity ? `Tracking ${widget.issCity}…` : 'Set a reference city in settings';
              }
              const overheadNow = distance < 2000;
              const distLine = overheadNow
                ? `Above ${widget.issCity} now (~${Math.round(distance)} km)`
                : `~${Math.round(distance).toLocaleString()} km from ${widget.issCity}`;
              // Next-pass line, when we have a prediction and it's in the future.
              if (pass && pass.willPassOverhead && pass.atTs > nowTick) {
                const minutes = Math.max(0, Math.round((pass.atTs - nowTick) / 60_000));
                if (minutes > 0 && !overheadNow) {
                  return `${distLine} · Est. passing over ${widget.issCity} in ~${minutes}m`;
                }
              }
              return distLine;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
