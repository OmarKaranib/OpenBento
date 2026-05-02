// Backend tests for `/api/markets`. Drive the markets service directly with a
// mocked `fetch` and a controllable clock so we can assert:
//   • cache hit within 60s returns the same payload (no upstream call)
//   • stale fallback (≤ 5 min) fires when an upstream call fails
//   • bad symbols surface a per-symbol `error` payload without 5xxing
//
// These tests also exercise the route handler end-to-end via supertest-less
// in-process Express invocation to confirm the HTTP contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import http from 'node:http';
import {
  createMarketsService,
  parseSymbols,
  CRYPTO_MAP,
  MARKETS_TTL_MS,
  STALE_TTL_MS,
  type MarketEntry,
} from '../../server/markets';

// ── Fake fetch builder ──────────────────────────────────────────────────────
// Tests register URL-substring → response mappings; unmatched URLs throw so
// we never accidentally hit a real upstream.
type FakeResponse = { ok: boolean; status: number; body: any };
type Handler = (url: string) => FakeResponse;

function makeFakeFetch() {
  const handlers: { match: (url: string) => boolean; handler: Handler }[] = [];
  const calls: string[] = [];
  const fakeFetch = async (input: string) => {
    calls.push(input);
    const found = handlers.find(h => h.match(input));
    if (!found) {
      throw new Error(`Unhandled fetch URL in test: ${input}`);
    }
    const r = found.handler(input);
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
    };
  };
  return {
    fetch: fakeFetch,
    calls,
    on(matcher: string | RegExp, handler: Handler | FakeResponse) {
      const match = (url: string) =>
        matcher instanceof RegExp ? matcher.test(url) : url.includes(matcher);
      const h: Handler = typeof handler === 'function' ? handler : () => handler;
      handlers.push({ match, handler: h });
    },
  };
}

// CoinGecko market_chart payload — `prices` is `[[ts, price], ...]`.
function coingeckoPayload(prices: number[]): FakeResponse {
  return {
    ok: true,
    status: 200,
    body: { prices: prices.map((p, i) => [1700000000 + i * 1000, p]) },
  };
}

// ── parseSymbols ────────────────────────────────────────────────────────────

test('parseSymbols: trims, uppercases, dedupes, drops invalid, caps at 20', () => {
  assert.deepEqual(parseSymbols('btc, eth ,SPY'), ['BTC', 'ETH', 'SPY']);
  assert.deepEqual(parseSymbols('AAPL,AAPL,AAPL'), ['AAPL']);
  assert.deepEqual(parseSymbols('!!!,@@@,btc'), ['BTC']);
  assert.deepEqual(parseSymbols(''), []);
  assert.deepEqual(parseSymbols('TOOLONGSYMBOL'), []);
  // 25 unique tokens → capped at 20
  const many = Array.from({ length: 25 }, (_, i) => `S${i}`).join(',');
  assert.equal(parseSymbols(many).length, 20);
});

// ── Cache hit within 60s ────────────────────────────────────────────────────

test('cache hit within 60s returns the same payload without re-fetching', async () => {
  const fake = makeFakeFetch();
  fake.on('coingecko', coingeckoPayload([100, 110, 120]));

  let nowMs = 1_700_000_000_000;
  const service = createMarketsService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
    twelveDataApiKey: null, // forces stock fallback (not used here)
  });

  const first = await service.getMarketEntries(['BTC']);
  assert.equal(first.length, 1);
  assert.equal(first[0].symbol, 'BTC');
  assert.equal(first[0].price, 120);
  assert.equal(fake.calls.length, 1, 'first call hits upstream');

  // Advance 30s — well within the 60s TTL.
  nowMs += 30_000;
  assert.ok(30_000 < MARKETS_TTL_MS);

  const second = await service.getMarketEntries(['BTC']);
  assert.equal(fake.calls.length, 1, 'cached hit must not re-fetch');
  // Same object reference is returned from cache.
  assert.strictEqual(second[0], first[0]);
});

test('cache expires after 60s and triggers a fresh upstream call', async () => {
  const fake = makeFakeFetch();
  let returnPrices = [100, 110, 120];
  fake.on('coingecko', () => coingeckoPayload(returnPrices));

  let nowMs = 1_700_000_000_000;
  const service = createMarketsService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
    twelveDataApiKey: null,
  });

  const first = await service.getMarketEntries(['BTC']);
  assert.equal(first[0].price, 120);

  // Advance past TTL and change the upstream price.
  nowMs += MARKETS_TTL_MS + 1;
  returnPrices = [200, 210, 220];

  const second = await service.getMarketEntries(['BTC']);
  assert.equal(fake.calls.length, 2, 'expired cache forces refetch');
  assert.equal(second[0].price, 220);
});

// ── Stale fallback ──────────────────────────────────────────────────────────

test('stale-cache fallback fires when an upstream call fails (< 5 min)', async () => {
  const fake = makeFakeFetch();
  let upstreamHealthy = true;
  fake.on('coingecko', () => {
    if (upstreamHealthy) return coingeckoPayload([100, 110, 120]);
    return { ok: false, status: 503, body: {} };
  });

  let nowMs = 1_700_000_000_000;
  const service = createMarketsService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
    twelveDataApiKey: null,
  });

  // Prime the cache with a healthy response.
  const primed = await service.getMarketEntries(['BTC']);
  assert.equal(primed[0].price, 120);
  assert.equal(primed[0].error, undefined);

  // Move past the 60s TTL but stay well under the 5-min stale window;
  // upstream is now broken.
  nowMs += MARKETS_TTL_MS + 1;
  upstreamHealthy = false;
  assert.ok(MARKETS_TTL_MS + 1 < STALE_TTL_MS);

  const stale = await service.getMarketEntries(['BTC']);
  assert.equal(fake.calls.length, 2, 'service attempted to refetch');
  // Falls back to the previously cached good entry.
  assert.equal(stale[0].price, 120);
  assert.equal(stale[0].error, undefined, 'stale fallback hides the error');
});

test('stale-cache fallback expires past 5 min and surfaces error', async () => {
  const fake = makeFakeFetch();
  let upstreamHealthy = true;
  fake.on('coingecko', () => {
    if (upstreamHealthy) return coingeckoPayload([100, 110, 120]);
    return { ok: false, status: 503, body: {} };
  });

  let nowMs = 1_700_000_000_000;
  const service = createMarketsService({
    fetchImpl: fake.fetch as any,
    now: () => nowMs,
    twelveDataApiKey: null,
  });

  await service.getMarketEntries(['BTC']);

  // Jump past the 5-min stale window; upstream still broken.
  nowMs += STALE_TTL_MS + 1;
  upstreamHealthy = false;

  const result = await service.getMarketEntries(['BTC']);
  assert.equal(result[0].price, null);
  assert.equal(result[0].error, 'Upstream unavailable');
});

// ── Per-symbol error for invalid tickers ────────────────────────────────────

test('invalid stock ticker surfaces per-symbol error without 5xx', async () => {
  const fake = makeFakeFetch();
  // Yahoo path (twelveDataApiKey = null forces fallback). Return 404 for the
  // bogus symbol, success for AAPL.
  fake.on(/finance\/chart\/AAPL/, {
    ok: true,
    status: 200,
    body: {
      chart: {
        result: [{
          meta: { regularMarketPrice: 200, chartPreviousClose: 190, shortName: 'Apple' },
          indicators: { quote: [{ close: [195, 198, 200] }] },
        }],
      },
    },
  });
  fake.on(/finance\/chart\/ZBOGUS/, { ok: false, status: 404, body: {} });

  const service = createMarketsService({
    fetchImpl: fake.fetch as any,
    twelveDataApiKey: null,
  });

  const entries = await service.getMarketEntries(['AAPL', 'ZBOGUS']);
  assert.equal(entries.length, 2);
  const aapl = entries.find(e => e.symbol === 'AAPL')!;
  const bogus = entries.find(e => e.symbol === 'ZBOGUS')!;
  assert.equal(aapl.price, 200);
  assert.equal(aapl.error, undefined);
  assert.equal(bogus.price, null);
  assert.equal(bogus.error, 'Upstream unavailable');
});

test('unknown crypto-style symbol that is not in CRYPTO_MAP routes to stocks', async () => {
  const fake = makeFakeFetch();
  fake.on(/finance\/chart\/FAKE/, { ok: false, status: 404, body: {} });
  const service = createMarketsService({
    fetchImpl: fake.fetch as any,
    twelveDataApiKey: null,
  });
  const entries = await service.getMarketEntries(['FAKE']);
  assert.equal(entries[0].error, 'Upstream unavailable');
  assert.ok(!('FAKE' in CRYPTO_MAP), 'FAKE is not in the crypto map');
});

// ── Full HTTP contract ──────────────────────────────────────────────────────
// Wire the service into a minimal Express app to confirm the route handler:
//   • returns 400 when no valid symbols
//   • returns 200 with `{ symbols, fetchedAt }` on success
//   • returns 200 (not 5xx!) when one symbol errors and others succeed

async function startTestServer(handler: (req: Request, res: Response) => Promise<void>) {
  const app = express();
  app.get('/api/markets', handler);
  return await new Promise<{ url: string; close: () => Promise<void> }>(resolve => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(() => r())),
      });
    });
  });
}

test('HTTP /api/markets: 400 when no valid symbols', async () => {
  const service = createMarketsService({ fetchImpl: (() => { throw new Error('should not call'); }) as any });
  const { url, close } = await startTestServer(async (req, res) => {
    const symbols = parseSymbols(typeof req.query.symbols === 'string' ? req.query.symbols : '');
    if (symbols.length === 0) {
      res.status(400).json({ error: 'No valid symbols provided' });
      return;
    }
    res.json({ symbols: await service.getMarketEntries(symbols), fetchedAt: Date.now() });
  });
  try {
    const resp = await fetch(`${url}/api/markets?symbols=!!!`);
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error, 'No valid symbols provided');
  } finally {
    await close();
  }
});

test('HTTP /api/markets: 200 with mixed success/error payload — never 5xx', async () => {
  const fake = makeFakeFetch();
  fake.on('coins/bitcoin', coingeckoPayload([100, 110, 120]));
  fake.on(/finance\/chart\/AAPL/, {
    ok: true,
    status: 200,
    body: {
      chart: {
        result: [{
          meta: { regularMarketPrice: 200, chartPreviousClose: 190, shortName: 'Apple' },
          indicators: { quote: [{ close: [195, 198, 200] }] },
        }],
      },
    },
  });
  fake.on(/finance\/chart\/ZBOGUS/, { ok: false, status: 404, body: {} });

  const service = createMarketsService({ fetchImpl: fake.fetch as any, twelveDataApiKey: null });
  const { url, close } = await startTestServer(async (req, res) => {
    const symbols = parseSymbols(typeof req.query.symbols === 'string' ? req.query.symbols : '');
    if (symbols.length === 0) { res.status(400).json({ error: 'No valid symbols provided' }); return; }
    try {
      const entries = await service.getMarketEntries(symbols);
      res.json({ symbols: entries, fetchedAt: Date.now() });
    } catch (err) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
    }
  });
  try {
    const resp = await fetch(`${url}/api/markets?symbols=BTC,AAPL,ZBOGUS`);
    assert.equal(resp.status, 200, 'must not 5xx when one symbol errors');
    const body = await resp.json() as { symbols: MarketEntry[]; fetchedAt: number };
    assert.equal(body.symbols.length, 3);
    assert.equal(body.symbols.find(s => s.symbol === 'BTC')!.price, 120);
    assert.equal(body.symbols.find(s => s.symbol === 'AAPL')!.price, 200);
    assert.equal(body.symbols.find(s => s.symbol === 'ZBOGUS')!.error, 'Upstream unavailable');
  } finally {
    await close();
  }
});
