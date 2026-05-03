// Air Quality Widget — surfaces US AQI + dominant pollutant + optional
// pollen for the user's location. Reuses the shared geolocation cache
// populated by Weather/Sun & Sky and refreshes every 30 minutes (and on
// tab focus) to recover from throttled timers. Falls back to the last
// persisted payload with a "stale" badge when upstream is unreachable.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wind, Settings as SettingsIcon, RefreshCw, Flower2, X } from 'lucide-react';
import { MONO, Widget, isLightBg } from './shared';
import { getLastResolvedLocation, subscribeLocation, setLastResolvedLocation } from './weather-location';
import {
  aqiCategory,
  pollutantLabel,
  pollenColor,
  pollenLabel,
  type AirQualityPayload,
  type PollutantKey,
} from '@shared/air-quality';

const REFRESH_MS = 30 * 60_000; // 30 min

interface Props { widget: Widget; onUpdate?: (id: string, patch: Partial<Widget>) => void; }

interface ResolvedLoc { lat: number; lon: number; label: string; }

export const AirQualityWidget: React.FC<Props> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 220 });
  const [loc, setLoc] = useState<ResolvedLoc | null>(() => {
    if (typeof widget.airQualityLat === 'number' && typeof widget.airQualityLon === 'number') {
      return { lat: widget.airQualityLat, lon: widget.airQualityLon, label: widget.airQualityCity ?? 'Custom' };
    }
    const last = getLastResolvedLocation();
    if (last) return { lat: last.lat, lon: last.lon, label: last.label };
    return null;
  });
  const [data, setData] = useState<AirQualityPayload | null>(() => {
    const persisted = widget.airQualityCurrent;
    if (!persisted) return null;
    return { ...persisted } as AirQualityPayload;
  });
  // When we hydrate from localStorage we have no proof the value is fresh,
  // so flag it stale until the first successful network fetch lands.
  const [stale, setStale] = useState<boolean>(() => widget.airQualityCurrent != null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchVal, setSearchVal] = useState(widget.airQualityCity ?? '');

  // Resize observer for responsive typography.
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    setSize({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Subscribe to the shared location cache so the widget hydrates as
  // soon as Weather/Sun resolves geolocation — no need to re-prompt.
  useEffect(() => {
    if (loc) return;
    const unsub = subscribeLocation((next) => {
      setLoc({ lat: next.lat, lon: next.lon, label: next.label });
    });
    if (!getLastResolvedLocation() && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Here' };
          setLastResolvedLocation(next);
          setLoc(next);
        },
        () => { /* will be resolved when user enters a city via the settings popover */ },
        { timeout: 5000, maximumAge: 600_000 },
      );
    }
    return unsub;
  }, [loc]);

  // Close the settings popover when clicking outside it.
  useEffect(() => {
    if (!showSettings) return;
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showSettings]);

  const persist = useCallback((payload: AirQualityPayload, label: string) => {
    onUpdate?.(widget.id, {
      airQualityCurrent: { ...payload, cityLabel: label },
    });
  }, [onUpdate, widget.id]);

  // `fetchAQ` is read through a ref by the long-lived interval/focus
  // listeners so they always call the latest version (current pollen
  // mode, current persist target). This avoids a stale-closure bug where
  // toggling pollen would never reach the upstream until the next
  // location change.
  const hasDataRef = useRef<boolean>(data != null);
  useEffect(() => { hasDataRef.current = data != null; }, [data]);
  const fetchAQ = useCallback(async (target: ResolvedLoc, signal?: AbortSignal): Promise<boolean> => {
    const wantPollen = widget.airQualityShowPollen !== false;
    const qs = `lat=${target.lat}&lon=${target.lon}${wantPollen ? '&pollen=1' : ''}`;
    try {
      const r = await fetch(`/api/air-quality?${qs}`, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as AirQualityPayload;
      setData(j);
      setStale(j.stale === true);
      setErr(null);
      persist(j, target.label);
      return true;
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return false;
      if (hasDataRef.current) setStale(true);
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [widget.airQualityShowPollen, persist]);
  const fetchAQRef = useRef(fetchAQ);
  useEffect(() => { fetchAQRef.current = fetchAQ; }, [fetchAQ]);

  // Initial + location-change fetch.
  useEffect(() => {
    if (!loc) return;
    const ctrl = new AbortController();
    setLoading(true);
    void fetchAQ(loc, ctrl.signal).finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc?.lat, loc?.lon, widget.airQualityShowPollen]);

  // 30-min auto-refresh + tab-focus refresh. Reads the latest `fetchAQ`
  // through a ref so a pollen toggle (or any other dep change) takes
  // effect on the very next refresh tick — no need to tear down the
  // interval/listeners.
  useEffect(() => {
    if (!loc) return;
    let active = true;
    const tick = () => { if (active && loc) void fetchAQRef.current(loc); };
    const id = window.setInterval(tick, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loc?.lat, loc?.lon]);

  const onCommitCity = async () => {
    const trimmed = searchVal.trim();
    if (!trimmed) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/air-quality?city=${encodeURIComponent(trimmed)}${widget.airQualityShowPollen !== false ? '&pollen=1' : ''}`);
      if (r.status === 404) { setErr('City not found'); setTimeout(() => setErr(null), 2500); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const payload = await r.json() as AirQualityPayload & { cityLabel?: string };
      const label = payload.cityLabel ?? trimmed;
      const next: ResolvedLoc = { lat: payload.lat, lon: payload.lon, label };
      setLoc(next);
      setData(payload);
      setStale(payload.stale === true);
      persist(payload, label);
      onUpdate?.(widget.id, {
        airQualityCity: label,
        airQualityLat:  payload.lat,
        airQualityLon:  payload.lon,
      });
      setShowSettings(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const togglePollen = () => {
    const next = !(widget.airQualityShowPollen !== false);
    onUpdate?.(widget.id, { airQualityShowPollen: next });
  };

  // ── Theming
  const bgColor = widget.customColor ?? '#0f1a26';
  const light = isLightBg(bgColor);
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#94a3b8';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const inputBg    = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const popoverBg  = light ? '#ffffff' : '#1e293b';

  const cat = aqiCategory(data?.aqi ?? null);
  const aqiText = data?.aqi != null ? Math.round(data.aqi).toString() : '—';
  const dominant = data?.dominant ?? null;
  const cityLabel = loc?.label ?? widget.airQualityCurrent?.cityLabel ?? '—';
  const pollenOn = widget.airQualityShowPollen !== false;

  // Responsive scale.
  const s = Math.min(size.w, size.h);
  const aqiFont   = Math.max(36, Math.min(s * 0.36, size.w * 0.32));
  const labelFont = Math.max(10, Math.min(s * 0.06, 14));
  const cityFont  = Math.max(10, Math.min(s * 0.06, 13));
  const chipFont  = Math.max(9,  Math.min(s * 0.05, 11));
  const adviceFont = Math.max(9, Math.min(s * 0.045, 11));
  const showPollen = pollenOn && data?.pollen != null && size.h >= 220;
  const showAdvice = data?.aqi != null && size.h >= 200;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      data-testid={`air-quality-widget-${widget.id}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Wind size={14} color={cat.color} />
        <span style={{ flex: 1, color: cat.color, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          AIR QUALITY
        </span>
        {stale && (
          <span
            title={err ?? 'Showing cached value'}
            style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: '#fde68a', background: 'rgba(217,119,6,0.18)',
              border: '1px solid rgba(217,119,6,0.4)',
              padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase',
            }}
            data-testid={`air-quality-stale-${widget.id}`}
          >
            Stale
          </span>
        )}
        <button
          onClick={() => loc && void fetchAQ(loc)}
          disabled={loading || !loc}
          title="Refresh"
          style={{
            background: 'transparent', border: 'none', cursor: loading || !loc ? 'default' : 'pointer',
            color: clrMuted, padding: 2, borderRadius: 4, opacity: loading ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          data-testid={`air-quality-refresh-${widget.id}`}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => setShowSettings((v) => !v)}
          title="Settings"
          style={{
            background: showSettings ? inputBg : 'transparent', border: 'none', cursor: 'pointer',
            color: clrMuted, padding: 2, borderRadius: 4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          data-testid={`air-quality-settings-${widget.id}`}
        >
          <SettingsIcon size={12} />
        </button>
      </div>

      {/* City line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 16 }}>
        <span
          style={{ flex: 1, color: clrSubtle, fontFamily: MONO, fontSize: cityFont, letterSpacing: '0.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          data-testid={`air-quality-city-${widget.id}`}
        >
          {cityLabel}
        </span>
      </div>

      {/* Big AQI block */}
      <div
        style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4,
          background: `linear-gradient(180deg, ${cat.color}22 0%, transparent 90%)`,
          borderRadius: 8, padding: '4px 6px',
        }}
      >
        <div
          style={{ color: cat.color, fontFamily: MONO, fontSize: aqiFont, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}
          data-testid={`air-quality-aqi-${widget.id}`}
        >
          {aqiText}
        </div>
        <div
          style={{
            color: cat.fg, background: cat.color,
            fontFamily: MONO, fontSize: labelFont, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase',
            maxWidth: '92%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
          data-testid={`air-quality-label-${widget.id}`}
        >
          {cat.label}
        </div>
        {dominant && (
          <div
            style={{ color: clrSubtle, fontFamily: MONO, fontSize: chipFont, marginTop: 2 }}
            data-testid={`air-quality-dominant-${widget.id}`}
          >
            Dominant: <span style={{ color: clrPrimary, fontWeight: 700 }}>{pollutantLabel(dominant as PollutantKey)}</span>
          </div>
        )}
      </div>

      {/* Health advice blurb — short, themed by AQI band */}
      {showAdvice && (
        <div
          style={{
            flexShrink: 0, color: clrSubtle, fontFamily: MONO,
            fontSize: adviceFont, lineHeight: 1.35, textAlign: 'center',
            padding: '0 4px',
          }}
          data-testid={`air-quality-advice-${widget.id}`}
        >
          {cat.advice}
        </div>
      )}

      {/* Pollutant strip */}
      {data?.pollutants && size.h >= 170 && (
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
            flexShrink: 0,
          }}
          data-testid={`air-quality-pollutants-${widget.id}`}
        >
          {(['pm2_5', 'pm10', 'o3', 'no2', 'so2', 'co'] as PollutantKey[]).map((k) => {
            const v = data.pollutants[k];
            const isDom = dominant === k;
            return (
              <div
                key={k}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: isDom ? `${cat.color}22` : inputBg,
                  border: `1px solid ${isDom ? cat.color : clrBorder}`,
                  borderRadius: 4, padding: '2px 4px',
                }}
              >
                <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em' }}>
                  {pollutantLabel(k)}
                </span>
                <span style={{ color: clrPrimary, fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                  {typeof v === 'number' ? v.toFixed(0) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional pollen card */}
      {showPollen && data?.pollen && (
        <div
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            background: inputBg, border: `1px solid ${clrBorder}`,
            borderRadius: 6, padding: '4px 8px',
          }}
          data-testid={`air-quality-pollen-${widget.id}`}
        >
          <Flower2 size={12} color={pollenColor(data.pollen.maxLevel)} />
          <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10, letterSpacing: '0.04em' }}>POLLEN</span>
          <span style={{
            color: '#0a0a0a', background: pollenColor(data.pollen.maxLevel),
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            padding: '1px 6px', borderRadius: 999, marginLeft: 'auto',
          }}>
            {pollenLabel(data.pollen.maxLevel)}
          </span>
        </div>
      )}

      {!data && !loading && err && (
        <div style={{ color: '#f59e0b', fontFamily: MONO, fontSize: 10, textAlign: 'center', flexShrink: 0 }}>
          {err}
        </div>
      )}

      {/* Settings popover */}
      {showSettings && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute', top: 36, right: 8,
            zIndex: 10, minWidth: 220, maxWidth: 'calc(100% - 16px)',
            background: popoverBg, border: `1px solid ${clrBorder}`,
            borderRadius: 8, padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
          data-testid={`air-quality-settings-popover-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: clrPrimary, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Settings
            </span>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: clrMuted, padding: 2, display: 'inline-flex' }}
              title="Close"
              data-testid={`air-quality-settings-close-${widget.id}`}
            >
              <X size={12} />
            </button>
          </div>

          <label style={{ color: clrSubtle, fontFamily: MONO, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            City
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onCommitCity(); } }}
              placeholder="e.g. London"
              style={{
                flex: 1, minWidth: 0, background: inputBg,
                border: `1px solid ${clrBorder}`, borderRadius: 6, padding: '4px 8px',
                color: clrPrimary, fontFamily: MONO, fontSize: 12, outline: 'none',
              }}
              data-testid={`air-quality-search-${widget.id}`}
            />
            <button
              onClick={() => void onCommitCity()}
              disabled={loading || !searchVal.trim()}
              style={{
                background: cat.color, color: cat.fg, border: 'none',
                borderRadius: 6, padding: '4px 10px', cursor: loading || !searchVal.trim() ? 'default' : 'pointer',
                fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                opacity: loading || !searchVal.trim() ? 0.5 : 1,
              }}
              data-testid={`air-quality-search-submit-${widget.id}`}
            >
              SET
            </button>
          </div>

          <button
            onClick={togglePollen}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: inputBg, border: `1px solid ${clrBorder}`,
              borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
              color: clrPrimary, fontFamily: MONO, fontSize: 11, fontWeight: 600,
            }}
            data-testid={`air-quality-toggle-pollen-${widget.id}`}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Flower2 size={11} color={pollenOn ? '#22c55e' : clrMuted} />
              Pollen
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              padding: '1px 6px', borderRadius: 999,
              color: pollenOn ? '#052e16' : clrMuted,
              background: pollenOn ? '#22c55e' : 'transparent',
              border: `1px solid ${pollenOn ? '#22c55e' : clrBorder}`,
            }}>
              {pollenOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {err && (
            <div style={{ color: '#f59e0b', fontFamily: MONO, fontSize: 10, textAlign: 'center' }}>
              {err}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
