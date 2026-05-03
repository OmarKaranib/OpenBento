// Auto-extracted from App.tsx during widget modularization.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, Cloudy, Search, Sun, Wind } from 'lucide-react';
import { MONO, Widget } from './shared';
import { setLastResolvedLocation } from './weather-location';

type WeatherIconType = 'sun' | 'cloud' | 'cloud-rain' | 'cloud-snow' | 'cloud-lightning' | 'wind' | 'cloud-drizzle' | 'cloudy';

interface WeatherEntry {
  city:       string;
  tempC:      number;
  tempF:      number;
  condition:  string;
  icon:       WeatherIconType;
  humidity:   number;
  windKph:    number;
  lat?:       number | null;
  lon?:       number | null;
}

interface ForecastDay {
  date:      string;
  dayLabel:  string;
  tempMaxC:  number;
  tempMinC:  number;
  tempMaxF:  number;
  tempMinF:  number;
  icon:      WeatherIconType;
  condition: string;
}

const FALLBACK_WEATHER: Record<string, WeatherEntry> = {
  'London':    { city: 'London',    tempC: 15, tempF: 59,  condition: 'Cloudy',        icon: 'cloudy',         humidity: 74, windKph: 22 },
  'New York':  { city: 'New York',  tempC: 22, tempF: 72,  condition: 'Sunny',         icon: 'sun',            humidity: 48, windKph: 14 },
  'Tokyo':     { city: 'Tokyo',     tempC: 28, tempF: 82,  condition: 'Partly Cloudy', icon: 'cloud',          humidity: 65, windKph: 18 },
  'Sydney':    { city: 'Sydney',    tempC: 19, tempF: 66,  condition: 'Light Rain',    icon: 'cloud-drizzle',  humidity: 82, windKph: 26 },
  'Dubai':     { city: 'Dubai',     tempC: 38, tempF: 100, condition: 'Sunny',         icon: 'sun',            humidity: 28, windKph: 11 },
  'Moscow':    { city: 'Moscow',    tempC: -4, tempF: 25,  condition: 'Snow',          icon: 'cloud-snow',     humidity: 88, windKph: 31 },
  'Miami':     { city: 'Miami',     tempC: 31, tempF: 88,  condition: 'Thunderstorm',  icon: 'cloud-lightning', humidity: 91, windKph: 44 },
  'Chicago':   { city: 'Chicago',   tempC: 12, tempF: 54,  condition: 'Windy',         icon: 'wind',           humidity: 56, windKph: 52 },
  'Mumbai':    { city: 'Mumbai',    tempC: 33, tempF: 91,  condition: 'Heavy Rain',    icon: 'cloud-rain',     humidity: 95, windKph: 19 },
  'Reykjavik': { city: 'Reykjavik', tempC: 3,  tempF: 37,  condition: 'Overcast',      icon: 'cloudy',         humidity: 83, windKph: 37 },
};

const WeatherIcon: React.FC<{ icon: WeatherIconType; size: number; color: string }> = ({ icon, size, color }) => {
  const props = { size, color, strokeWidth: 1.8 };
  switch (icon) {
    case 'sun':             return <Sun             {...props} />;
    case 'cloud':           return <Cloud           {...props} />;
    case 'cloud-rain':      return <CloudRain       {...props} />;
    case 'cloud-snow':      return <CloudSnow       {...props} />;
    case 'cloud-lightning': return <CloudLightning  {...props} />;
    case 'wind':            return <Wind            {...props} />;
    case 'cloud-drizzle':   return <CloudDrizzle    {...props} />;
    case 'cloudy':          return <Cloudy          {...props} />;
    default:                return <Sun             {...props} />;
  }
};

const weatherIconColor = (icon: WeatherIconType): string => {
  switch (icon) {
    case 'sun':             return '#fbbf24';
    case 'cloud':           return '#94a3b8';
    case 'cloud-rain':      return '#60a5fa';
    case 'cloud-snow':      return '#bae6fd';
    case 'cloud-lightning': return '#facc15';
    case 'wind':            return '#a5b4fc';
    case 'cloud-drizzle':   return '#7dd3fc';
    case 'cloudy':          return '#94a3b8';
    default:                return '#f1f5f9';
  }
};

const weatherGradient = (icon: WeatherIconType): string => {
  switch (icon) {
    case 'sun':             return 'radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.25) 0%, rgba(234,88,12,0.08) 50%, rgba(15,23,42,0.95) 100%)';
    case 'cloud':           return 'radial-gradient(ellipse at 50% 30%, rgba(148,163,184,0.18) 0%, rgba(51,65,85,0.10) 50%, rgba(15,23,42,0.95) 100%)';
    case 'cloud-rain':      return 'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.22) 0%, rgba(30,58,138,0.10) 50%, rgba(15,23,42,0.95) 100%)';
    case 'cloud-snow':      return 'radial-gradient(ellipse at 50% 30%, rgba(186,230,253,0.20) 0%, rgba(125,211,252,0.08) 50%, rgba(15,23,42,0.95) 100%)';
    case 'cloud-lightning': return 'radial-gradient(ellipse at 50% 30%, rgba(250,204,21,0.22) 0%, rgba(161,98,7,0.08) 50%, rgba(15,23,42,0.95) 100%)';
    case 'wind':            return 'radial-gradient(ellipse at 50% 30%, rgba(165,180,252,0.18) 0%, rgba(99,102,241,0.08) 50%, rgba(15,23,42,0.95) 100%)';
    case 'cloud-drizzle':   return 'radial-gradient(ellipse at 50% 30%, rgba(125,211,252,0.20) 0%, rgba(56,189,248,0.08) 50%, rgba(15,23,42,0.95) 100%)';
    case 'cloudy':          return 'radial-gradient(ellipse at 50% 30%, rgba(148,163,184,0.18) 0%, rgba(71,85,105,0.08) 50%, rgba(15,23,42,0.95) 100%)';
    default:                return 'radial-gradient(ellipse at 50% 30%, rgba(241,245,249,0.12) 0%, rgba(15,23,42,0.95) 100%)';
  }
};

interface WeatherWidgetProps {
  widget: Widget;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ widget }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const [cw, setCw]  = useState(280);
  const [ch, setCh]  = useState(200);
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  const [isHovered, setIsHovered]         = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [data, setData]           = useState<WeatherEntry>(FALLBACK_WEATHER['London']);
  const [forecast, setForecast]   = useState<ForecastDay[]>([]);
  const [weatherError, setWeatherError] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [searchErr, setSearchErr] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const showControls = isHovered || isSearchFocused;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) { setCw(r.width); setCh(r.height); }
    });
    ro.observe(el);
    setCw(el.offsetWidth);
    setCh(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // ── Loader: fetch current weather + 3-day forecast for either a city
  //    name or coordinates. Used for both initial load and city search.
  const loadWeather = useCallback(async (
    query: { kind: 'coords'; lat: number; lon: number } | { kind: 'city'; city: string },
    mountedRef: { current: boolean }
  ): Promise<boolean> => {
    const qs = query.kind === 'coords'
      ? `lat=${query.lat}&lon=${query.lon}`
      : `city=${encodeURIComponent(query.city)}`;
    try {
      const resp = await fetch(`/api/weather?${qs}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const w = await resp.json() as WeatherEntry;
      if (!mountedRef.current) return false;
      setData(w);
      setWeatherError(false);
      // Share the resolved location with sibling widgets (Sun & Sky,
      // ISS Tracker) so they don't re-prompt for geolocation.
      if (typeof w.lat === 'number' && typeof w.lon === 'number') {
        setLastResolvedLocation({ lat: w.lat, lon: w.lon, label: w.city ?? 'Here' });
      }
      // Forecast — best-effort, prefer lat/lon from current weather response
      const fcQs = (w.lat != null && w.lon != null)
        ? `lat=${w.lat}&lon=${w.lon}`
        : qs;
      try {
        const fcResp = await fetch(`/api/weather/forecast?${fcQs}`);
        if (fcResp.ok) {
          const fc = await fcResp.json() as { days: ForecastDay[] };
          if (mountedRef.current) setForecast(Array.isArray(fc.days) ? fc.days : []);
        } else if (mountedRef.current) {
          setForecast([]);
        }
      } catch {
        if (mountedRef.current) setForecast([]);
      }
      return true;
    } catch (err) {
      console.warn('[WeatherWidget] Failed to fetch weather:', err);
      if (mountedRef.current) setWeatherError(true);
      return false;
    }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const fallbackToLondon = () => {
      void loadWeather({ kind: 'city', city: 'London' }, mountedRef);
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      let resolved = false;
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (mountedRef.current) fallbackToLondon();
        }
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (resolved) return;
          resolved = true;
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          if (!mountedRef.current) return;
          void loadWeather(
            { kind: 'coords', lat: pos.coords.latitude, lon: pos.coords.longitude },
            mountedRef
          ).then((ok) => { if (!ok && mountedRef.current) fallbackToLondon(); });
        },
        () => {
          if (resolved) return;
          resolved = true;
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          if (mountedRef.current) fallbackToLondon();
        },
        { timeout: 5000, maximumAge: 600000 }
      );
    } else {
      fallbackToLondon();
    }

    return () => {
      mountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadWeather]);

  useEffect(() => {
    if (showControls && searchRef.current) searchRef.current.focus();
  }, [showControls]);

  const handleSearch = async () => {
    const trimmed = searchVal.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setSearchErr('');
    const mountedRef = { current: true };
    const ok = await loadWeather({ kind: 'city', city: trimmed }, mountedRef);
    if (!ok) {
      setSearchErr('City not found');
      setTimeout(() => setSearchErr(''), 2500);
    } else {
      setSearchVal('');
    }
    setIsSearching(false);
  };

  const s = Math.min(cw, ch);

  // ── Forecast strip is only rendered when the widget is large enough
  //    to show it without crowding the primary readout.
  const showForecast = forecast.length > 0 && ch >= 220 && cw >= 220;

  const iconSize    = Math.max(24, Math.min(s * 0.28, cw * 0.22, ch * 0.30));
  const tempFont    = Math.max(22, Math.min(s * 0.25, cw * 0.18, ch * 0.27));
  const cityFont    = Math.max(12, Math.min(s * 0.095, cw * 0.07));
  const condFont    = Math.max(9,  Math.min(s * 0.065, cw * 0.048));
  const metaFont    = Math.max(12, Math.min(s * 0.082, cw * 0.06));
  const metaIconSz  = Math.max(14, Math.min(s * 0.09, cw * 0.065));
  const toggleFont  = Math.max(8,  s * 0.05);
  const gap         = Math.max(4,  s * 0.035);
  const padV        = Math.max(8,  s * 0.06);
  const padH        = Math.max(10, s * 0.065);
  const iconColor   = weatherIconColor(data.icon);
  const bgGradient  = weatherGradient(data.icon);
  const temp        = useFahrenheit ? `${data.tempF}\u00B0F` : `${data.tempC}\u00B0C`;
  const searchH     = Math.max(26, s * 0.13);
  const searchIcon  = Math.max(12, s * 0.065);
  const fcDayFont   = Math.max(8,  Math.min(s * 0.052, cw * 0.038));
  const fcTempFont  = Math.max(9,  Math.min(s * 0.058, cw * 0.042));
  const fcIconSz    = Math.max(14, Math.min(s * 0.10, cw * 0.07, 28));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: bgGradient,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
        position: 'relative',
        padding: `${padV}px ${padH}px`,
        gap: `${gap}px`,
        transition: 'background 0.6s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`weather-widget-${widget.id}`}
    >

      {/* ── Glass search bar (hover-only) ─────────────────────────────────── */}
      <div style={{
        position:      'absolute',
        top:           `${Math.max(6, s * 0.03)}px`,
        left:          `${Math.max(8, s * 0.04)}px`,
        right:         `${Math.max(8, s * 0.04)}px`,
        opacity:       showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition:    'opacity 0.25s ease',
        zIndex:        20,
      }}>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          height:         `${searchH}px`,
          background:     'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border:         searchErr ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.20)',
          borderRadius:   '8px',
          padding:        `0 ${Math.max(8, s * 0.04)}px`,
          boxSizing:      'border-box',
          gap:            `${Math.max(4, s * 0.025)}px`,
        }}>
          <Search size={searchIcon} color="#94a3b8" strokeWidth={2} style={{ flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={searchVal}
            onChange={(e) => { setSearchVal(e.target.value); setSearchErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search city\u2026"
            style={{
              flex:            1,
              height:          '100%',
              background:      'transparent',
              border:          'none',
              color:           '#e2e8f0',
              fontFamily:      MONO,
              fontSize:        `${Math.max(10, s * 0.055)}px`,
              fontWeight:      500,
              outline:         'none',
              letterSpacing:   '0.03em',
              minWidth:        0,
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="weather-city-search"
          />
          {isSearching && (
            <div style={{
              width: `${Math.max(14, s * 0.06)}px`, height: `${Math.max(14, s * 0.06)}px`,
              border: '2px solid rgba(148,163,184,0.3)', borderTopColor: '#60a5fa',
              borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0,
            }} />
          )}
        </div>
        {searchErr && (
          <div style={{
            fontFamily: MONO, fontSize: `${Math.max(9, s * 0.05)}px`,
            color: '#ef4444', letterSpacing: '0.03em', marginTop: '4px',
            paddingLeft: `${Math.max(8, s * 0.04)}px`,
          }}>
            {searchErr}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── City name ───────────────────────────────────────────────────────── */}
      <div style={{
        fontFamily:    MONO,
        fontSize:      `${cityFont}px`,
        fontWeight:    700,
        color:         '#e2e8f0',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        lineHeight:    1,
        textAlign:     'center',
        zIndex:        1,
        textShadow:    '0 1px 4px rgba(0,0,0,0.4)',
      }}>
        {data.city}
      </div>

      {weatherError && (
        <div style={{
          fontFamily: MONO, fontSize: `${Math.max(8, s * 0.045)}px`,
          color: '#f59e0b', letterSpacing: '0.04em', zIndex: 1,
          textAlign: 'center', lineHeight: 1,
        }}>
          Service temporarily unavailable
        </div>
      )}

      {/* ── Icon ──────────────────────────────────────────────────────────── */}
      <div style={{ zIndex: 1, lineHeight: 0, filter: `drop-shadow(0 0 ${Math.max(4, iconSize * 0.12)}px ${iconColor}88)` }}>
        <WeatherIcon icon={data.icon} size={iconSize} color={iconColor} />
      </div>

      {/* ── Temperature ──────────────────────────────────────────────────── */}
      <div style={{
        fontFamily:    MONO,
        fontSize:      `${tempFont}px`,
        fontWeight:    700,
        color:         '#f1f5f9',
        letterSpacing: '-0.03em',
        lineHeight:    1,
        zIndex:        1,
        textAlign:     'center',
      }}>
        {temp}
      </div>

      {/* ── Condition label ───────────────────────────────────────────────── */}
      <div style={{
        fontFamily:    MONO,
        fontSize:      `${condFont}px`,
        fontWeight:    500,
        color:         iconColor,
        letterSpacing: '0.04em',
        lineHeight:    1,
        zIndex:        1,
        textAlign:     'center',
      }}>
        {data.condition}
      </div>

      {/* ── Meta row: humidity + wind ─────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        gap:            `${Math.max(12, s * 0.08)}px`,
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         1,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: `${metaFont}px`, fontWeight: 700,
          color: '#93c5fd', letterSpacing: '0.03em',
          display: 'flex', alignItems: 'center', gap: `${Math.max(3, metaIconSz * 0.2)}px`,
        }}>
          <span style={{ fontSize: `${metaIconSz}px`, lineHeight: 1 }}>{'\uD83D\uDCA7'}</span> {data.humidity}%
        </span>
        <span style={{
          fontFamily: MONO, fontSize: `${metaFont}px`, fontWeight: 700,
          color: '#a5b4fc', letterSpacing: '0.03em',
          display: 'flex', alignItems: 'center', gap: `${Math.max(3, metaIconSz * 0.2)}px`,
        }}>
          <span style={{ fontSize: `${metaIconSz}px`, lineHeight: 1 }}>{'\uD83D\uDCA8'}</span> {data.windKph} km/h
        </span>
      </div>

      {/* ── 3-day forecast strip (only when widget is large enough) ─── */}
      {showForecast && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'stretch',
            gap: `${Math.max(4, s * 0.025)}px`,
            marginTop: `${Math.max(4, s * 0.02)}px`,
            paddingTop: `${Math.max(6, s * 0.03)}px`,
            borderTop: '1px solid rgba(255,255,255,0.10)',
            zIndex: 1,
          }}
          data-testid={`weather-forecast-${widget.id}`}
        >
          {forecast.map((d) => (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: `${Math.max(2, s * 0.012)}px`,
                minWidth: 0,
              }}
              data-testid={`weather-forecast-day-${d.date}`}
            >
              <span style={{
                fontFamily: MONO,
                fontSize: `${fcDayFont}px`,
                fontWeight: 700,
                color: '#cbd5e1',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}>
                {d.dayLabel}
              </span>
              <div style={{ lineHeight: 0 }}>
                <WeatherIcon icon={d.icon} size={fcIconSz} color={weatherIconColor(d.icon)} />
              </div>
              <span style={{
                fontFamily: MONO,
                fontSize: `${fcTempFont}px`,
                fontWeight: 600,
                color: '#f1f5f9',
                letterSpacing: '0.02em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>
                {useFahrenheit
                  ? `${d.tempMaxF}\u00B0/${d.tempMinF}\u00B0`
                  : `${d.tempMaxC}\u00B0/${d.tempMinC}\u00B0`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── °C / °F toggle (visible on hover) ───────────────────────────── */}
      <div style={{
        position:      'absolute',
        bottom:        `${Math.max(5, s * 0.025)}px`,
        left:          '50%',
        transform:     'translateX(-50%)',
        opacity:       showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition:    'opacity 0.2s ease',
        zIndex:        10,
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); setUseFahrenheit(f => !f); }}
          style={{
            background:    'rgba(255,255,255,0.08)',
            border:        '1px solid #334155',
            cursor:        'pointer',
            color:         '#94a3b8',
            fontSize:      `${toggleFont}px`,
            fontFamily:    MONO,
            fontWeight:    600,
            padding:       `${Math.max(2, s * 0.01)}px ${Math.max(8, s * 0.045)}px`,
            borderRadius:  '4px',
            letterSpacing: '0.06em',
            whiteSpace:    'nowrap',
          }}
          data-testid="btn-toggle-unit"
        >
          {useFahrenheit ? '\u00B0F \u2192 \u00B0C' : '\u00B0C \u2192 \u00B0F'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  DictionaryWidget
// ─────────────────────────────────────────────────────────────────────────────

