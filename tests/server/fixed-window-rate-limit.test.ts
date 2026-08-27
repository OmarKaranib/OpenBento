import test from "node:test";
import assert from "node:assert/strict";
import { FixedWindowRateLimiter } from "../../server/services/fixed-window-rate-limit";

test("rate limiter blocks attempts above the limit", () => {
  const limiter = new FixedWindowRateLimiter({ windowMs: 60_000, maxAttempts: 2 });

  assert.equal(limiter.allow("visitor-a"), true);
  assert.equal(limiter.allow("visitor-a"), true);
  assert.equal(limiter.allow("visitor-a"), false);
  assert.equal(limiter.allow("visitor-b"), true);
});

test("rate limiter resets after its time window", () => {
  let now = 1_000;
  const limiter = new FixedWindowRateLimiter({
    windowMs: 60_000,
    maxAttempts: 1,
    now: () => now,
  });

  assert.equal(limiter.allow("visitor-a"), true);
  assert.equal(limiter.allow("visitor-a"), false);
  now = 61_000;
  assert.equal(limiter.allow("visitor-a"), true);
});

test("rate limiter bounds the number of remembered visitors", () => {
  const limiter = new FixedWindowRateLimiter({
    windowMs: 60_000,
    maxAttempts: 1,
    maxEntries: 2,
  });

  assert.equal(limiter.allow("visitor-a"), true);
  assert.equal(limiter.allow("visitor-b"), true);
  assert.equal(limiter.allow("visitor-c"), true);
  assert.equal(limiter.allow("visitor-a"), true);
});
