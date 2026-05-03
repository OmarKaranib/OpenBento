import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decimateStroke,
  buildBezierSegments,
  fitContain,
  brushPx,
  pushBounded,
  SKETCH_PALETTE,
  type Point,
} from '../../shared/sketch-pad';

test('decimateStroke keeps endpoints and drops near-duplicates', () => {
  const pts: Point[] = [
    { x: 0, y: 0 },
    { x: 0.1, y: 0.1 },   // too close — drop
    { x: 0.2, y: 0.0 },   // too close — drop
    { x: 5, y: 5 },       // keep
    { x: 5.1, y: 5.1 },   // too close — drop
    { x: 10, y: 10 },     // keep (last)
  ];
  const out = decimateStroke(pts, 1.5);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { x: 0, y: 0 });
  assert.deepEqual(out[out.length - 1], { x: 10, y: 10 });
});

test('decimateStroke handles trivial inputs', () => {
  assert.deepEqual(decimateStroke([], 1.5), []);
  assert.deepEqual(decimateStroke([{ x: 1, y: 2 }], 1.5), [{ x: 1, y: 2 }]);
  const two: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
  assert.deepEqual(decimateStroke(two, 1.5), two);
});

test('buildBezierSegments produces midpoint control/anchor pairs', () => {
  const pts: Point[] = [
    { x: 0,  y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
    { x: 30, y: 10 },
  ];
  const segs = buildBezierSegments(pts);
  // For N points, we emit N-1 segments (N-2 midpoints + final to-last).
  assert.equal(segs.length, pts.length - 1);
  // First control = pts[1], anchor = midpoint(pts[1], pts[2]).
  assert.deepEqual(segs[0].cp, { x: 10, y: 0 });
  assert.deepEqual(segs[0].to, { x: 15, y: 5 });
  // Final segment terminates exactly on the last point.
  assert.deepEqual(segs[segs.length - 1].to, pts[pts.length - 1]);
});

test('buildBezierSegments returns [] for <2 points', () => {
  assert.deepEqual(buildBezierSegments([]), []);
  assert.deepEqual(buildBezierSegments([{ x: 1, y: 1 }]), []);
});

test('buildBezierSegments handles the 2-point edge case (single straight segment)', () => {
  // For a stroke that's just two points (a quick tap-and-drag), the
  // mid-loop runs zero times so we should still emit one final
  // segment that terminates exactly on the last point — guaranteeing
  // ctx.quadraticCurveTo will draw something instead of nothing.
  const segs = buildBezierSegments([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0].cp, { x: 10, y: 10 });
  assert.deepEqual(segs[0].to, { x: 10, y: 10 });
});

test('fitContain produces a centered, aspect-preserving rect', () => {
  // 100×50 source into 200×200 dest → scale 2 (limited by width
  // hitting 200 first since 200/100 < 200/50).
  const r = fitContain(100, 50, 200, 200);
  assert.equal(r.scale, 2);
  assert.equal(r.dw, 200);
  assert.equal(r.dh, 100);
  assert.equal(r.dx, 0);
  assert.equal(r.dy, 50);  // centered vertically
});

test('fitContain handles taller source', () => {
  // 50×100 into 200×200 → scale 2 (limited by height).
  const r = fitContain(50, 100, 200, 200);
  assert.equal(r.scale, 2);
  assert.equal(r.dw, 100);
  assert.equal(r.dh, 200);
  assert.equal(r.dx, 50);
  assert.equal(r.dy, 0);
});

test('fitContain returns zero-rect for invalid dims', () => {
  const r = fitContain(0, 100, 200, 200);
  assert.equal(r.scale, 0);
  assert.equal(r.dw, 0);
  assert.equal(r.dh, 0);
});

test('brushPx returns S<M<L', () => {
  const s = brushPx('S'), m = brushPx('M'), l = brushPx('L');
  assert.ok(s < m);
  assert.ok(m < l);
  assert.ok(s >= 1);
});

test('pushBounded enforces cap and is non-mutating', () => {
  const start = [1, 2, 3];
  const after = pushBounded(start, 4, 3);
  assert.deepEqual(start, [1, 2, 3]);          // input unchanged
  assert.deepEqual(after, [2, 3, 4]);          // oldest dropped
  // Cap honored even on a fresh stack.
  let acc: number[] = [];
  for (let i = 0; i < 25; i++) acc = pushBounded(acc, i, 5);
  assert.equal(acc.length, 5);
  assert.deepEqual(acc, [20, 21, 22, 23, 24]);
});

test('SKETCH_PALETTE has stable swatch list', () => {
  assert.ok(SKETCH_PALETTE.length >= 6);
  for (const c of SKETCH_PALETTE) {
    assert.match(c, /^#[0-9a-f]{6}$/i);
  }
});
