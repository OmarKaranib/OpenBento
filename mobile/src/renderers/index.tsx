import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import type { DashboardWidget } from '../types';
import type { Palette } from '../lib/colors';
import { API_BASE_URL } from '../lib/supabase';

// Lightweight registry — each renderer takes the widget shape + palette
// and returns a React Native subtree. Unknown widget types fall back to
// a placeholder card showing the widget name. The web app's renderers
// rely on the DOM (iframes, canvas, web fonts), so the mobile companion
// re-implements small read-only versions for the priority widgets.

export interface RendererProps {
  widget: DashboardWidget;
  palette: Palette;
}

function joinUrl(path: string): string {
  if (!API_BASE_URL) return path;
  const b = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

// ── Clock ───────────────────────────────────────────────────────────────
function ClockRenderer({ widget, palette }: RendererProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const showSeconds = widget.showSeconds !== false;
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: widget.is24Hour === false,
  });
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <View style={styles.center}>
      <Text style={[styles.bigDigits, { color: palette.text }]}>{time}</Text>
      <Text style={[styles.subtle, { color: palette.textMuted }]}>{date}</Text>
    </View>
  );
}

// ── Note ────────────────────────────────────────────────────────────────
function NoteRenderer({ widget, palette }: RendererProps) {
  const text = asString(widget.text ?? widget.content, '(empty note)');
  return (
    <View style={styles.col}>
      {widget.title ? (
        <Text style={[styles.title, { color: palette.text }]}>{asString(widget.title)}</Text>
      ) : null}
      <Text style={[styles.body, { color: palette.text }]}>{text}</Text>
    </View>
  );
}

// ── Image ───────────────────────────────────────────────────────────────
function ImageRenderer({ widget, palette }: RendererProps) {
  const src = asString(widget.src ?? widget.url ?? widget.imageUrl);
  if (!src) {
    return <Text style={[styles.subtle, { color: palette.textMuted }]}>No image</Text>;
  }
  return <Image source={{ uri: src }} style={styles.image} resizeMode="cover" />;
}

// ── Quote ───────────────────────────────────────────────────────────────
interface QuoteData { q?: string; a?: string }
function QuoteRenderer({ palette }: RendererProps) {
  const [data, setData] = useState<QuoteData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(joinUrl('/api/quote'))
      .then((r) => r.json())
      .then((j) => alive && setData(Array.isArray(j) ? j[0] : j))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);
  if (err) return <Text style={[styles.subtle, { color: palette.danger }]}>Quote unavailable</Text>;
  if (!data) return <ActivityIndicator color={palette.accent} />;
  return (
    <View style={styles.col}>
      <Text style={[styles.body, { color: palette.text, fontStyle: 'italic' }]}>
        “{data.q ?? '…'}”
      </Text>
      {data.a ? <Text style={[styles.subtle, { color: palette.textMuted, marginTop: 6 }]}>— {data.a}</Text> : null}
    </View>
  );
}

// ── On This Day ─────────────────────────────────────────────────────────
function OnThisDayRenderer({ palette }: RendererProps) {
  const [items, setItems] = useState<Array<{ year?: number; text: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(joinUrl('/api/onthisday'))
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const list = Array.isArray(j?.events) ? j.events : Array.isArray(j) ? j : [];
        setItems(list.slice(0, 5).map((e: any) => ({ year: e.year, text: asString(e.text ?? e.title) })));
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);
  if (err) return <Text style={[styles.subtle, { color: palette.danger }]}>Unavailable</Text>;
  if (items.length === 0) return <ActivityIndicator color={palette.accent} />;
  return (
    <View style={styles.col}>
      <Text style={[styles.title, { color: palette.text, marginBottom: 6 }]}>On this day</Text>
      {items.map((it, i) => (
        <Text key={i} style={[styles.body, { color: palette.text, marginTop: 4 }]}>
          {it.year ? <Text style={{ color: palette.accent }}>{it.year} · </Text> : null}
          {it.text}
        </Text>
      ))}
    </View>
  );
}

// ── Markets Ticker ──────────────────────────────────────────────────────
interface MarketRow { symbol: string; price?: number; changePct?: number; error?: string }
function MarketsRenderer({ widget, palette }: RendererProps) {
  const symbols: string[] = Array.isArray(widget.symbols)
    ? (widget.symbols as unknown[]).filter((s) => typeof s === 'string') as string[]
    : ['BTC', 'ETH', 'AAPL'];
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const url = `/api/markets?symbols=${encodeURIComponent(symbols.join(','))}`;
    fetch(joinUrl(url))
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const list = Array.isArray(j?.results) ? j.results : Array.isArray(j) ? j : [];
        setRows(list);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [symbols.join(',')]);
  if (err) return <Text style={[styles.subtle, { color: palette.danger }]}>Markets unavailable</Text>;
  if (rows.length === 0) return <ActivityIndicator color={palette.accent} />;
  return (
    <View style={styles.col}>
      <Text style={[styles.title, { color: palette.text, marginBottom: 8 }]}>Markets</Text>
      {rows.map((r) => {
        const up = (r.changePct ?? 0) >= 0;
        return (
          <View key={r.symbol} style={styles.row}>
            <Text style={[styles.body, { color: palette.text, fontWeight: '600' }]}>{r.symbol}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.body, { color: palette.text }]}>
              {typeof r.price === 'number' ? r.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            </Text>
            <Text style={[styles.body, { color: up ? palette.success : palette.danger, marginLeft: 12, minWidth: 64, textAlign: 'right' }]}>
              {typeof r.changePct === 'number' ? `${up ? '+' : ''}${r.changePct.toFixed(2)}%` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Weather ─────────────────────────────────────────────────────────────
function WeatherRenderer({ widget, palette }: RendererProps) {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const lat = typeof widget.lat === 'number' ? widget.lat : null;
  const lon = typeof widget.lon === 'number' ? widget.lon : null;
  const city = asString(widget.city);
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    if (lat != null && lon != null) {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=${widget.unit === 'F' ? 'fahrenheit' : 'celsius'}`;
    } else if (city) {
      // Geocode → forecast.
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
        .then((r) => r.json())
        .then((g) => {
          if (!alive) return;
          const hit = g?.results?.[0];
          if (!hit) throw new Error('No match');
          return fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code&temperature_unit=${widget.unit === 'F' ? 'fahrenheit' : 'celsius'}`,
          );
        })
        .then((r) => (r ? r.json() : null))
        .then((j) => alive && setData(j))
        .catch((e) => alive && setErr(String(e)));
      return () => { alive = false; };
    }
    if (url) {
      fetch(url)
        .then((r) => r.json())
        .then((j) => alive && setData(j))
        .catch((e) => alive && setErr(String(e)));
    } else {
      setErr('Set lat/lon or city');
    }
    return () => { alive = false; };
  }, [lat, lon, city, widget.unit]);
  if (err) return <Text style={[styles.subtle, { color: palette.danger }]}>Weather: {err}</Text>;
  if (!data) return <ActivityIndicator color={palette.accent} />;
  const t = data?.current?.temperature_2m;
  const unit = widget.unit === 'F' ? '°F' : '°C';
  return (
    <View style={styles.center}>
      <Text style={[styles.bigDigits, { color: palette.text }]}>{typeof t === 'number' ? Math.round(t) : '—'}{unit}</Text>
      <Text style={[styles.subtle, { color: palette.textMuted }]}>{city || 'Current location'}</Text>
    </View>
  );
}

// ── RSS Headlines ───────────────────────────────────────────────────────
function RssRenderer({ widget, palette }: RendererProps) {
  const url = asString(widget.url ?? widget.feedUrl);
  const [items, setItems] = useState<Array<{ title: string; link?: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setErr('No feed URL'); return; }
    let alive = true;
    fetch(joinUrl(`/api/rss?url=${encodeURIComponent(url)}`))
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const list = Array.isArray(j?.items) ? j.items : [];
        setItems(list.slice(0, 6).map((it: any) => ({ title: asString(it.title), link: asString(it.link) })));
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [url]);
  if (err) return <Text style={[styles.subtle, { color: palette.danger }]}>RSS: {err}</Text>;
  if (items.length === 0) return <ActivityIndicator color={palette.accent} />;
  return (
    <View style={styles.col}>
      <Text style={[styles.title, { color: palette.text, marginBottom: 6 }]}>Headlines</Text>
      {items.map((it, i) => (
        <Text key={i} style={[styles.body, { color: palette.text, marginTop: 6 }]} numberOfLines={2}>
          • {it.title}
        </Text>
      ))}
    </View>
  );
}

// ── Placeholder ─────────────────────────────────────────────────────────
function PlaceholderRenderer({ widget, palette }: RendererProps) {
  return (
    <View style={styles.col}>
      <Text style={[styles.title, { color: palette.text }]}>{prettyType(widget.type)}</Text>
      <Text style={[styles.subtle, { color: palette.textMuted, marginTop: 4 }]}>
        Available on the web dashboard.
      </Text>
    </View>
  );
}

function prettyType(type: string): string {
  return type
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

// ── Registry + dispatcher ───────────────────────────────────────────────
const REGISTRY: Record<string, React.FC<RendererProps>> = {
  clock: ClockRenderer,
  note: NoteRenderer,
  image: ImageRenderer,
  quote: QuoteRenderer,
  'on-this-day': OnThisDayRenderer,
  onThisDay: OnThisDayRenderer,
  markets: MarketsRenderer,
  'markets-ticker': MarketsRenderer,
  marketsTicker: MarketsRenderer,
  weather: WeatherRenderer,
  rss: RssRenderer,
  'rss-headlines': RssRenderer,
  rssHeadlines: RssRenderer,
};

export function rendererFor(type: string): React.FC<RendererProps> {
  return REGISTRY[type] ?? PlaceholderRenderer;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  col: { flexDirection: 'column' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  bigDigits: { fontSize: 44, fontWeight: '800', letterSpacing: 1 },
  subtle: { fontSize: 13 },
  title: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 15, lineHeight: 21 },
  image: { width: '100%', height: 180, borderRadius: 8 },
});
