// Sketch Pad pure helpers — split out so node-only tests can import
// without a JSX/canvas runtime. Two areas:
//
//   1. Stroke geometry: per-pointer-event point reduction so we don't
//      churn millions of segments on a fast move (decimateStroke), and
//      a midpoint-Bezier interpolator that turns a polyline into a list
//      of quadratic-curve control/anchor pairs for smoother rendering.
//
//   2. Canvas rescale math: when the widget is resized we re-draw the
//      saved PNG into the new pixel surface using a "contain" fit so
//      strokes never get cropped or stretched off-aspect. fitContain
//      returns the destination rectangle (dx, dy, dw, dh) the renderer
//      can pass straight to ctx.drawImage.

export interface Point { x: number; y: number; }

/**
 * Drops points that are within `minDist` pixels of the previous kept
 * point. Always preserves the first and last point so the stroke
 * doesn't visibly snap. `minDist` defaults to 1.5px which strikes a
 * good balance between fidelity and stroke length on touch devices.
 */
export function decimateStroke(points: Point[], minDist = 1.5): Point[] {
  if (!Array.isArray(points) || points.length < 2) return points.slice();
  const kept: Point[] = [points[0]];
  const sq = minDist * minDist;
  for (let i = 1; i < points.length - 1; i++) {
    const last = kept[kept.length - 1];
    const dx = points[i].x - last.x;
    const dy = points[i].y - last.y;
    if (dx * dx + dy * dy >= sq) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  return kept;
}

export interface BezierSegment { cp: Point; to: Point; }

/**
 * Given a stroke polyline, returns a list of quadratic Bezier segments
 * suitable for `ctx.quadraticCurveTo(cp.x, cp.y, to.x, to.y)`. The
 * control point is each intermediate vertex and the destination is
 * the midpoint to the next vertex — a classic catmull-style smoother
 * that doesn't require tangent estimation.
 *
 * The caller starts the path at `points[0]`. For a 1-point stroke we
 * return [], the caller should draw a dot in that case.
 */
export function buildBezierSegments(points: Point[]): BezierSegment[] {
  if (!Array.isArray(points) || points.length < 2) return [];
  const out: BezierSegment[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const to = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    out.push({ cp, to });
  }
  // Final straight-ish segment to the last real point.
  const last = points[points.length - 1];
  out.push({ cp: last, to: last });
  return out;
}

export interface FitRect { dx: number; dy: number; dw: number; dh: number; scale: number; }

/**
 * "contain" fit — returns the largest rectangle of source aspect that
 * fits inside the destination, centered. Used both when rescaling a
 * persisted PNG into a resized canvas and when computing an export
 * download size.
 */
export function fitContain(srcW: number, srcH: number, dstW: number, dstH: number): FitRect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { dx: 0, dy: 0, dw: 0, dh: 0, scale: 0 };
  }
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh, scale };
}

/** Brush size token → pixel diameter at logical (CSS) resolution. */
export type BrushSize = 'S' | 'M' | 'L';
export function brushPx(size: BrushSize): number {
  switch (size) {
    case 'S': return 2;
    case 'L': return 12;
    default:  return 5;
  }
}

/** Default colour palette surfaced in the toolbar. */
export const SKETCH_PALETTE: string[] = [
  '#0f172a', // ink
  '#ffffff', // chalk
  '#ef4444', // red
  '#f59e0b', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#ec4899', // pink
];

/**
 * Bounded undo stack. Pushing past `cap` discards the oldest entry so
 * the in-memory snapshot list never grows without bound. We store
 * canvas snapshots as `ImageData` (or any opaque T) — this helper just
 * enforces the cap and returns a new array (immutable for React).
 */
export function pushBounded<T>(stack: T[], item: T, cap = 20): T[] {
  if (cap <= 0) return [];
  const next = stack.length >= cap ? stack.slice(stack.length - cap + 1) : stack.slice();
  next.push(item);
  return next;
}
