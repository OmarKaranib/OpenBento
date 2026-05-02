// Small bounded LRU cache with TTL eviction plus per-key in-flight request
// de-duplication. Used to keep the GitHub and RSS widget endpoints snappy
// when many dashboard copies are open: we never let the cache grow without
// bound, and concurrent requests for the same key share a single upstream
// fetch so we don't trigger a thundering herd against GitHub or feed
// publishers.

export interface LruTtlCacheOptions {
  max: number;
  ttlMs: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruTtlCache<V> {
  private readonly max: number;
  private readonly ttlMs: number;
  // Map preserves insertion order — re-inserting on `get` is the standard
  // O(1) LRU trick.
  private readonly store = new Map<string, Entry<V>>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(opts: LruTtlCacheOptions) {
    this.max = Math.max(1, opts.max);
    this.ttlMs = Math.max(0, opts.ttlMs);
  }

  // Returns the live value if it has not expired. `allowStale` returns the
  // entry even past TTL, which the route handlers use as a fallback when
  // upstream is rate-limited or unreachable.
  get(key: string, allowStale = false): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const fresh = entry.expiresAt > Date.now();
    if (!fresh && !allowStale) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  // De-duplicates concurrent loads for the same key. While one caller is
  // fetching, every other caller awaits the same promise. The result is
  // cached on success; failures are not cached (caller decides whether to
  // surface stale data).
  async dedupe(key: string, loader: () => Promise<V>): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = (async () => {
      try {
        const v = await loader();
        this.set(key, v);
        return v;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  // Whether a load for this key is already in flight — handy when callers
  // want to await the same promise without supplying a loader.
  inflightFor(key: string): Promise<V> | undefined {
    return this.inflight.get(key);
  }
}
