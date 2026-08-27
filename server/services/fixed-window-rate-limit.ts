interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface FixedWindowRateLimiterOptions {
  windowMs: number;
  maxAttempts: number;
  maxEntries?: number;
  now?: () => number;
}

/** Small in-memory limiter for abuse-sensitive routes. */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: FixedWindowRateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxAttempts = options.maxAttempts;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  allow(key: string): boolean {
    const now = this.now();
    const existing = this.entries.get(key);
    if (existing && existing.resetAt > now) {
      existing.count++;
      return existing.count <= this.maxAttempts;
    }

    this.purgeExpired(now);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
    return true;
  }

  private purgeExpired(now: number): void {
    this.entries.forEach((entry, key) => {
      if (entry.resetAt <= now) this.entries.delete(key);
    });
  }
}
