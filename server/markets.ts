// Markets service: resolves crypto + stock quotes with an in-memory cache.
//
// Extracted from `server/routes.ts` so the cache + per-symbol error handling +
// stale-fallback behavior can be unit-tested in isolation. The factory
// `createMarketsService` accepts an optional `fetchImpl` and `now` so tests can
// drive both upstream responses and the clock deterministically.
//
// Behavior contract (mirrored by `tests/server/markets.test.ts`):
//   • Symbols are normalized (trimmed + uppercased) and validated against
//     `SYMBOL_RE`; invalid tokens are dropped before any lookup.
//   • Successful fetches are cached for `MARKETS_TTL_MS` (60s). Within that
//     window, the cached payload is returned verbatim — no upstream call.
//   • A failed upstream is surfaced as a per-symbol `{ ..., error }` payload.
//     If a recently cached entry exists (≤ `STALE_TTL_MS`, 5 min), that stale
//     value is returned instead so the ticker doesn't blank out.
//   • The route handler itself only 5xxs on truly unexpected exceptions; bad
//     symbols and upstream failures degrade gracefully through this service.

export type MarketEntry = {
  symbol: string;
  name: string;
  type: 'crypto' | 'stock';
  price: number | null;
  change24hPct: number | null;
  sparkline: number[];
  updatedAt: number;
  error?: string;
};

export const MARKETS_TTL_MS = 60 * 1000;
export const STALE_TTL_MS = 5 * 60 * 1000;
export const MARKETS_TIMEOUT_MS = 8_000;
// Symbols are 1-8 chars: A-Z, 0-9, dot, dash. Matches both crypto tickers
// (BTC, ETH) and US equities (SPY, BRK.B).
export const SYMBOL_RE = /^[A-Z0-9.\-]{1,8}$/;

export const CRYPTO_MAP: Record<string, { id: string; name: string }> = {
  BTC:   { id: 'bitcoin',       name: 'Bitcoin'   },
  ETH:   { id: 'ethereum',      name: 'Ethereum'  },
  SOL:   { id: 'solana',        name: 'Solana'    },
  ADA:   { id: 'cardano',       name: 'Cardano'   },
  DOGE:  { id: 'dogecoin',      name: 'Dogecoin'  },
  BNB:   { id: 'binancecoin',   name: 'BNB'       },
  XRP:   { id: 'ripple',        name: 'XRP'       },
  MATIC: { id: 'matic-network', name: 'Polygon'   },
  DOT:   { id: 'polkadot',      name: 'Polkadot'  },
  AVAX:  { id: 'avalanche-2',   name: 'Avalanche' },
  LTC:   { id: 'litecoin',      name: 'Litecoin'  },
  LINK:  { id: 'chainlink',     name: 'Chainlink' },
};

// Sample a series down to ~`target` evenly spaced points for a tidy sparkline.
export function sampleSeries(arr: number[], target = 24): number[] {
  if (arr.length <= target) return arr.slice();
  const step = (arr.length - 1) / (target - 1);
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

// Parse the raw `?symbols=` query string: split on commas, normalize, dedupe
// while preserving first-seen order, drop tokens that don't match SYMBOL_RE,
// and cap at 20 to avoid pathological upstream fanout.
export function parseSymbols(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of raw.split(',')) {
    const sym = tok.trim().toUpperCase();
    if (!SYMBOL_RE.test(sym)) continue;
    if (seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
    if (out.length >= 20) break;
  }
  return out;
}

type FetchImpl = (input: string, init?: any) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

export interface MarketsServiceOptions {
  fetchImpl?: FetchImpl;
  now?: () => number;
  twelveDataApiKey?: string | null;
}

export interface MarketsService {
  cache: Map<string, MarketEntry>;
  getMarketEntries(rawSymbols: string[]): Promise<MarketEntry[]>;
}

export function createMarketsService(opts: MarketsServiceOptions = {}): MarketsService {
  const fetchImpl: FetchImpl = (opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl));
  const now = opts.now ?? (() => Date.now());
  // `undefined` means "consult process.env at fetch time" so tests can still
  // pass `null` to force the Yahoo fallback path even if the env var is set.
  const twelveDataKey = opts.twelveDataApiKey;

  const cache = new Map<string, MarketEntry>();

  async function fetchCryptoEntry(symbol: string): Promise<MarketEntry> {
    const meta = CRYPTO_MAP[symbol];
    const updatedAt = now();
    if (!meta) {
      return { symbol, name: symbol, type: 'crypto', price: null, change24hPct: null, sparkline: [], updatedAt, error: 'Unknown crypto symbol' };
    }
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${meta.id}/market_chart?vs_currency=usd&days=1`;
      const resp = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(MARKETS_TIMEOUT_MS),
      });
      if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
      const data = await resp.json();
      const prices: [number, number][] = data?.prices || [];
      if (prices.length === 0) throw new Error('No price data');
      const series = prices.map(p => p[1]);
      const first = series[0];
      const last = series[series.length - 1];
      const change = first > 0 ? ((last - first) / first) * 100 : 0;
      return {
        symbol, name: meta.name, type: 'crypto',
        price: last, change24hPct: change,
        sparkline: sampleSeries(series, 24),
        updatedAt,
      };
    } catch (err: any) {
      console.warn(`[Markets] Crypto fetch failed for ${symbol}:`, err?.message || err);
      return { symbol, name: meta.name, type: 'crypto', price: null, change24hPct: null, sparkline: [], updatedAt, error: 'Upstream unavailable' };
    }
  }

  async function fetchStocksTwelveData(symbols: string[], apiKey: string): Promise<MarketEntry[]> {
    const updatedAt = now();
    const symbolParam = encodeURIComponent(symbols.join(','));
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbolParam}&apikey=${encodeURIComponent(apiKey)}`;
    const seriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbolParam}&interval=15min&outputsize=26&apikey=${encodeURIComponent(apiKey)}`;
    const [quoteResp, seriesResp] = await Promise.all([
      fetchImpl(quoteUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(MARKETS_TIMEOUT_MS),
      }),
      fetchImpl(seriesUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(MARKETS_TIMEOUT_MS),
      }),
    ]);
    if (!quoteResp.ok) throw new Error(`Twelve Data quote ${quoteResp.status}`);
    if (!seriesResp.ok) throw new Error(`Twelve Data time_series ${seriesResp.status}`);
    const quoteData = await quoteResp.json();
    const seriesData = await seriesResp.json();
    if (quoteData?.status === 'error') throw new Error(`Twelve Data quote: ${quoteData.message}`);
    if (seriesData?.status === 'error') throw new Error(`Twelve Data time_series: ${seriesData.message}`);
    const quoteMap: Record<string, any> = symbols.length === 1
      ? { [symbols[0]]: quoteData }
      : (quoteData || {});
    const seriesMap: Record<string, any> = symbols.length === 1
      ? { [symbols[0]]: seriesData }
      : (seriesData || {});

    return symbols.map((symbol): MarketEntry => {
      const q = quoteMap[symbol];
      const s = seriesMap[symbol];
      const qBad = !q || q.status === 'error' || q.code;
      if (qBad) {
        const msg = (q && q.message) || 'Upstream unavailable';
        console.warn(`[Markets] Twelve Data quote error for ${symbol}: ${msg}`);
        return { symbol, name: symbol, type: 'stock', price: null, change24hPct: null, sparkline: [], updatedAt, error: 'Upstream unavailable' };
      }
      const price = parseFloat(q.close);
      let change = parseFloat(q.percent_change);
      if (!Number.isFinite(change)) {
        const prev = parseFloat(q.previous_close);
        change = Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : NaN;
      }
      const name = (q.name as string) || symbol;
      let sparkline: number[] = [];
      if (s && Array.isArray(s.values)) {
        sparkline = s.values
          .slice()
          .reverse()
          .map((v: any) => parseFloat(v.close))
          .filter((n: number) => Number.isFinite(n));
      }
      return {
        symbol,
        name,
        type: 'stock',
        price: Number.isFinite(price) ? price : null,
        change24hPct: Number.isFinite(change) ? change : null,
        sparkline: sampleSeries(sparkline.length ? sparkline : (Number.isFinite(price) ? [price] : []), 24),
        updatedAt,
      };
    });
  }

  async function fetchStockEntryYahoo(symbol: string): Promise<MarketEntry> {
    const updatedAt = now();
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=15m&range=1d&includePrePost=false`;
      const resp = await fetchImpl(url, {
        signal: AbortSignal.timeout(MARKETS_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (!result) throw new Error('No chart result');
      const meta = result.meta || {};
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
      const cleaned = closes.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (cleaned.length === 0 && typeof meta.regularMarketPrice !== 'number') {
        throw new Error('No price points');
      }
      const last = typeof meta.regularMarketPrice === 'number'
        ? meta.regularMarketPrice
        : cleaned[cleaned.length - 1];
      const prev = typeof meta.chartPreviousClose === 'number'
        ? meta.chartPreviousClose
        : (typeof meta.previousClose === 'number' ? meta.previousClose : cleaned[0]);
      const change = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      const name = (meta.shortName || meta.longName || symbol) as string;
      return {
        symbol, name, type: 'stock',
        price: last, change24hPct: change,
        sparkline: sampleSeries(cleaned.length ? cleaned : [last], 24),
        updatedAt,
      };
    } catch (err: any) {
      console.warn(`[Markets] Yahoo stock fetch failed for ${symbol}:`, err?.message || err);
      return { symbol, name: symbol, type: 'stock', price: null, change24hPct: null, sparkline: [], updatedAt, error: 'Upstream unavailable' };
    }
  }

  async function fetchStocks(symbols: string[]): Promise<MarketEntry[]> {
    if (symbols.length === 0) return [];
    // `twelveDataKey === undefined` falls through to env (production behavior).
    // Pass `null` from tests to force the Yahoo fallback even if env is set.
    const apiKey = twelveDataKey === undefined ? process.env.TWELVE_DATA_API_KEY : twelveDataKey;
    if (apiKey) {
      try {
        return await fetchStocksTwelveData(symbols, apiKey);
      } catch (err: any) {
        console.warn('[Markets] Twelve Data batch failed, falling back to Yahoo:', err?.message || err);
      }
    }
    return Promise.all(symbols.map(fetchStockEntryYahoo));
  }

  async function getMarketEntries(rawSymbols: string[]): Promise<MarketEntry[]> {
    const tNow = now();
    const symbols = rawSymbols.map(s => s.trim().toUpperCase());
    const fresh = new Map<string, MarketEntry>();
    const queued = new Set<string>();
    const cryptoToFetch: string[] = [];
    const stocksToFetch: string[] = [];

    for (const symbol of symbols) {
      if (fresh.has(symbol) || queued.has(symbol)) continue;
      const cached = cache.get(symbol);
      if (cached && tNow - cached.updatedAt < MARKETS_TTL_MS && !cached.error) {
        fresh.set(symbol, cached);
        continue;
      }
      queued.add(symbol);
      if (symbol in CRYPTO_MAP) cryptoToFetch.push(symbol);
      else stocksToFetch.push(symbol);
    }

    const [cryptoEntries, stockEntries] = await Promise.all([
      Promise.all(cryptoToFetch.map(fetchCryptoEntry)),
      fetchStocks(stocksToFetch),
    ]);

    for (const entry of [...cryptoEntries, ...stockEntries]) {
      if (!entry.error) {
        cache.set(entry.symbol, entry);
        fresh.set(entry.symbol, entry);
      } else {
        const cached = cache.get(entry.symbol);
        if (cached && tNow - cached.updatedAt < STALE_TTL_MS) {
          fresh.set(entry.symbol, cached);
        } else {
          fresh.set(entry.symbol, entry);
        }
      }
    }

    return symbols.map(s => fresh.get(s)!).filter(Boolean);
  }

  return { cache, getMarketEntries };
}
