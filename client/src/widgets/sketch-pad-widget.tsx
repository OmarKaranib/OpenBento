// Sketch Pad widget — freehand drawing surface with a small floating
// toolbar. Drawing is persisted to the widget as a PNG data URL (debounced
// 500 ms after the last pointer-up) so it survives reloads and cloud sync.
// The canvas is sized in DEVICE pixels (×DPR) for crisp lines, with the
// CSS surface stretched to fill the widget. Resize-observer rescales the
// saved PNG into the new pixel canvas using a "contain" fit so strokes
// stay intact (no crop, no aspect-ratio stretch).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Brush, Eraser, Undo2, Trash2, Download, Palette } from 'lucide-react';
import { Widget, isLightBg, MONO } from './shared';
import {
  decimateStroke,
  buildBezierSegments,
  brushPx,
  fitContain,
  pushBounded,
  acceptPrimaryPointer,
  ownsPointer,
  createDebouncedSaver,
  SKETCH_PALETTE,
  type Point,
  type BrushSize,
  type DebouncedSaver,
} from '@shared/sketch-pad';

const SAVE_DEBOUNCE_MS  = 500;
const TOOLBAR_HIDE_MS   = 3000;
const UNDO_CAP          = 20;

interface Props {
  widget: Widget;
  onUpdate?: (id: string, patch: Partial<Widget>) => void;
  isDarkMode?: boolean;
}

export const SketchPadWidget: React.FC<Props> = ({ widget, onUpdate, isDarkMode = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const ctxRef       = useRef<CanvasRenderingContext2D | null>(null);
  const ptsRef       = useRef<Point[]>([]);
  // Active pointer id — null when no stroke is in progress. Used to
  // ignore non-primary pointers (pinch / multi-touch) so the user can
  // still pinch-zoom or two-finger-scroll without leaving stray ink.
  const activePointerRef = useRef<number | null>(null);
  const dprRef       = useRef<number>(1);
  // Bumped on every surface re-init so async Image.onload callbacks
  // know they've been superseded and skip drawing into a stale canvas.
  const surfaceGenRef = useRef(0);
  // Undo snapshots (data URLs) — capped via pushBounded.
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [showPalette, setShowPalette] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Toolbar prefs come from the widget; default to a sensible ink
  // colour. We keep local state so toggle clicks feel snappy and only
  // persist on commit (next save tick).
  const [color,   setColor]   = useState<string>(widget.sketchColor ?? '#0f172a');
  const [size,    setSize]    = useState<BrushSize>((widget.sketchSize ?? 'M') as BrushSize);
  const [eraser,  setEraser]  = useState<boolean>(widget.sketchEraser === true);

  // Theme — match other widgets: customColor wins, otherwise default
  // to the dashboard's dark/light mode so the surface feels native to
  // the active theme. light/dark booleans then drive the canvas
  // background and toolbar/text contrast.
  const bgColor = widget.customColor ?? (isDarkMode ? '#1e293b' : '#f8fafc');
  const light   = isLightBg(bgColor);
  // When the user has explicitly chosen a custom color the whole
  // surface (container + canvas) follows it; otherwise we default to
  // the dashboard's high-contrast white/dark drawing surface.
  const canvasBg = widget.customColor ?? (light ? '#ffffff' : '#0f172a');
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrMuted   = light ? '#64748b' : '#94a3b8';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const toolbarBg  = light ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.85)';

  // ── Toolbar auto-hide
  const bumpToolbar = useCallback(() => {
    setToolbarVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setToolbarVisible(false);
      setShowPalette(false);
    }, TOOLBAR_HIDE_MS);
  }, []);
  // Arm initial auto-hide on mount + flush a pending save on unmount
  // so a stroke finished within the 500 ms debounce window isn't lost
  // when the user navigates / collapses the widget.
  useEffect(() => {
    bumpToolbar();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      // Force a synchronous flush of any pending debounced PNG save so a
      // stroke completed inside the debounce window survives unmount /
      // navigation. The saver itself is no-op if nothing is pending.
      saverRef.current?.flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persistence helpers
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  const prefsRef = useRef({ color, size, eraser });
  // Mirror toolbar prefs into a ref AND persist them eagerly on change
  // so a user who only tweaks the color/size/eraser (no new stroke)
  // still has their choice survive a reload. We skip the very first
  // render so initial-mount state doesn't trigger an extra onUpdate.
  const prefsHydratedRef = useRef(false);
  useEffect(() => {
    prefsRef.current = { color, size, eraser };
    if (!prefsHydratedRef.current) { prefsHydratedRef.current = true; return; }
    onUpdateRef.current?.(widget.id, {
      sketchColor: color, sketchSize: size, sketchEraser: eraser,
    });
  }, [color, size, eraser, widget.id]);
  const saverRef = useRef<DebouncedSaver<null> | null>(null);
  if (!saverRef.current) {
    saverRef.current = createDebouncedSaver<null>(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const { color: c, size: s, eraser: e } = prefsRef.current;
        onUpdateRef.current?.(widget.id, {
          sketchPad: { format: 'v1', dataUrl, w: canvas.width, h: canvas.height },
          sketchColor: c, sketchSize: s, sketchEraser: e,
        });
      } catch (err) {
        console.warn('[SketchPad] toDataURL failed:', err);
      }
    }, SAVE_DEBOUNCE_MS);
  }
  const scheduleSave = useCallback(() => { saverRef.current?.schedule(null); }, []);

  // ── Resize handling: re-create the device-pixel surface and re-paint
  // the most recently persisted PNG into it (contain fit so nothing is
  // cropped). We only re-init the surface here; the very first init
  // also seeds the persisted snapshot.
  useEffect(() => {
    const el = containerRef.current; const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const initSurface = () => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW <= 0 || cssH <= 0) return;
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      dprRef.current = dpr;
      const pxW = Math.round(cssW * dpr);
      const pxH = Math.round(cssH * dpr);
      // Snapshot current bitmap (if any) so we can restore after resize.
      let snapshot: HTMLCanvasElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        const tctx = tmp.getContext('2d');
        if (tctx) { tctx.drawImage(canvas, 0, 0); snapshot = tmp; }
      }
      // Bump generation BEFORE resetting size so any in-flight async
      // image hydration from a prior init bails out on completion.
      const myGen = ++surfaceGenRef.current;
      canvas.width = pxW; canvas.height = pxH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;
      // Repaint snapshot (or persisted PNG on first init) with contain fit.
      if (snapshot) {
        const fit = fitContain(snapshot.width, snapshot.height, pxW, pxH);
        ctx.drawImage(snapshot, fit.dx, fit.dy, fit.dw, fit.dh);
      } else if (widget.sketchPad?.dataUrl) {
        const img = new Image();
        img.onload = () => {
          if (surfaceGenRef.current !== myGen) return; // superseded
          const c = canvasRef.current; const cx = ctxRef.current;
          if (!c || !cx) return;
          const fit = fitContain(img.naturalWidth, img.naturalHeight, c.width, c.height);
          cx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
        };
        img.src = widget.sketchPad.dataUrl;
      }
    };

    initSurface();
    const ro = new ResizeObserver(initSurface);
    ro.observe(el);
    return () => ro.disconnect();
    // We deliberately omit widget.sketchPad from deps — we hydrate on
    // mount and never want a remote update to wipe in-flight strokes.
    // The dedicated cloud-sync hydration effect below handles updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cloud-sync hydration: when the widget prop's sketchPad payload
  // changes (e.g. a fresh layout arrives from Supabase after another
  // device updated it), repaint the canvas with the remote bitmap —
  // but only when the user isn't mid-stroke, so we never steal a
  // drawing in flight. The surfaceGen guard prevents a stale image
  // load from clobbering a subsequent resize/init.
  const lastHydratedRef = useRef<string | undefined>(widget.sketchPad?.dataUrl);
  useEffect(() => {
    const url = widget.sketchPad?.dataUrl;
    if (!url) return;
    if (url === lastHydratedRef.current) return;
    if (activePointerRef.current !== null) return; // mid-stroke — skip
    const canvas = canvasRef.current; const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const myGen = ++surfaceGenRef.current;
    const img = new Image();
    img.onload = () => {
      if (surfaceGenRef.current !== myGen) return;
      const c = canvasRef.current; const cx = ctxRef.current;
      if (!c || !cx) return;
      cx.save();
      cx.globalCompositeOperation = 'source-over';
      cx.clearRect(0, 0, c.width, c.height);
      const fit = fitContain(img.naturalWidth, img.naturalHeight, c.width, c.height);
      cx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
      cx.restore();
      lastHydratedRef.current = url;
    };
    img.src = url;
  }, [widget.sketchPad?.dataUrl]);

  // ── Stroke rendering
  const flushStroke = useCallback(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    const pts = decimateStroke(ptsRef.current, 1.5);
    if (pts.length === 0) return;
    const dpr = dprRef.current;
    ctx.save();
    ctx.lineWidth = brushPx(size) * dpr;
    if (eraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle   = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
    }
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * dpr, pts[0].y * dpr, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const segs = buildBezierSegments(pts);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * dpr, pts[0].y * dpr);
      for (const s of segs) {
        ctx.quadraticCurveTo(s.cp.x * dpr, s.cp.y * dpr, s.to.x * dpr, s.to.y * dpr);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, [color, size, eraser]);

  // ── Pointer event handlers
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    // Primary-pointer guard: ignore secondary touches (pinch / two-finger
    // scroll) and re-entrant pointer-downs while a stroke is in flight.
    const accepted = acceptPrimaryPointer(activePointerRef.current, {
      pointerId: e.pointerId, isPrimary: e.isPrimary, pointerType: e.pointerType,
    });
    if (accepted === null) return;
    activePointerRef.current = accepted;
    // Snapshot pre-stroke for undo BEFORE we start drawing.
    try {
      const snap = canvas.toDataURL('image/png');
      setUndoStack(prev => pushBounded(prev, snap, UNDO_CAP));
    } catch { /* may fail if tainted; undo is best-effort */ }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const rect = canvas.getBoundingClientRect();
    ptsRef.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
    bumpToolbar();
  }, [bumpToolbar]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ownsPointer(activePointerRef.current, e.pointerId)) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    ptsRef.current.push(pt);
    // Throttle by drawing every move; decimateStroke prunes redundant
    // points before we hit the GPU.
    flushStroke();
    // Reset to the last point so the next batch continues smoothly.
    ptsRef.current = [pt];
  }, [flushStroke]);

  const endStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ownsPointer(activePointerRef.current, e.pointerId)) return;
    activePointerRef.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    flushStroke();
    ptsRef.current = [];
    scheduleSave();
    bumpToolbar();
  }, [flushStroke, scheduleSave, bumpToolbar]);

  // ── Toolbar actions
  const doUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const target = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      const canvas = canvasRef.current; const ctx = ctxRef.current;
      if (!canvas || !ctx) return next;
      // Capture the generation at scheduling time so an undo image that
      // resolves AFTER a resize doesn't paint into a fresh surface.
      const myGen = surfaceGenRef.current;
      const img = new Image();
      img.onload = () => {
        if (surfaceGenRef.current !== myGen) {
          // Surface was re-initialized between undo click and image
          // decode; the resize path already restored the live bitmap
          // via fitContain so we just bail.
          return;
        }
        const c = canvasRef.current; const cx = ctxRef.current;
        if (!c || !cx) return;
        const fit = fitContain(img.naturalWidth, img.naturalHeight, c.width, c.height);
        cx.save();
        // Wipe first so contain-fit letterbox bands don't keep stale
        // pixels. globalCompositeOperation reset ensures a clean draw.
        cx.globalCompositeOperation = 'source-over';
        cx.clearRect(0, 0, c.width, c.height);
        cx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
        cx.restore();
        scheduleSave();
      };
      img.src = target;
      return next;
    });
    bumpToolbar();
  }, [scheduleSave, bumpToolbar]);

  const doClear = useCallback(() => {
    const canvas = canvasRef.current; const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    try {
      const snap = canvas.toDataURL('image/png');
      setUndoStack(prev => pushBounded(prev, snap, UNDO_CAP));
    } catch { /* noop */ }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    scheduleSave();
    bumpToolbar();
  }, [scheduleSave, bumpToolbar]);

  const doDownload = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `sketch-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      console.warn('[SketchPad] download failed:', e);
    }
    bumpToolbar();
  }, [bumpToolbar]);

  // ── Toolbar style helpers
  const btnBase: React.CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: clrPrimary, padding: '4px 6px', borderRadius: 4,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  const sizeBtnStyle = (active: boolean): React.CSSProperties => ({
    ...btnBase,
    background: active ? `${color}33` : 'transparent',
    border: `1px solid ${active ? color : clrBorder}`,
    color: clrPrimary,
    fontFamily: MONO, fontSize: 10, fontWeight: 700, minWidth: 22,
  });

  return (
    <div
      ref={containerRef}
      onPointerEnter={bumpToolbar}
      onPointerMove={bumpToolbar}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: bgColor, borderRadius: 'var(--outer-radius)',
        border: `1px solid ${clrBorder}`,
        padding: 8, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
      data-testid={`sketch-pad-widget-${widget.id}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        style={{
          flex: 1, width: '100%', height: '100%',
          background: canvasBg, borderRadius: 6,
          touchAction: 'none', cursor: eraser ? 'cell' : 'crosshair',
          display: 'block',
        }}
        data-testid={`sketch-pad-canvas-${widget.id}`}
      />

      {/* Floating toolbar */}
      <div
        style={{
          position: 'absolute', left: '50%', bottom: 12,
          transform: `translateX(-50%) translateY(${toolbarVisible ? '0' : '12px'})`,
          opacity: toolbarVisible ? 1 : 0,
          transition: 'opacity 200ms ease, transform 200ms ease',
          pointerEvents: toolbarVisible ? 'auto' : 'none',
          background: toolbarBg, border: `1px solid ${clrBorder}`,
          borderRadius: 999, padding: '4px 6px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: 4, maxWidth: 'calc(100% - 16px)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}
        onPointerEnter={bumpToolbar}
        data-testid={`sketch-pad-toolbar-${widget.id}`}
      >
        {/* Color swatch / palette toggle */}
        <button
          onClick={() => { setShowPalette((v) => !v); bumpToolbar(); }}
          title="Brush color"
          style={{ ...btnBase, position: 'relative', padding: 2 }}
          data-testid={`sketch-pad-color-${widget.id}`}
        >
          <span style={{
            display: 'inline-block', width: 18, height: 18, borderRadius: 999,
            background: color, border: `2px solid ${clrBorder}`,
          }} />
          <Palette size={10} style={{ position: 'absolute', right: -2, bottom: -2, color: clrMuted }} />
        </button>
        {/* Brush sizes */}
        <button onClick={() => { setSize('S'); setEraser(false); bumpToolbar(); }} style={sizeBtnStyle(!eraser && size === 'S')} title="Small brush" data-testid={`sketch-pad-size-s-${widget.id}`}>S</button>
        <button onClick={() => { setSize('M'); setEraser(false); bumpToolbar(); }} style={sizeBtnStyle(!eraser && size === 'M')} title="Medium brush" data-testid={`sketch-pad-size-m-${widget.id}`}>M</button>
        <button onClick={() => { setSize('L'); setEraser(false); bumpToolbar(); }} style={sizeBtnStyle(!eraser && size === 'L')} title="Large brush" data-testid={`sketch-pad-size-l-${widget.id}`}>L</button>

        <span style={{ width: 1, height: 16, background: clrBorder }} />

        <button onClick={() => { setEraser((v) => !v); bumpToolbar(); }} title="Eraser" style={{ ...btnBase, background: eraser ? `${clrBorder}` : 'transparent' }} data-testid={`sketch-pad-eraser-${widget.id}`}>
          <Eraser size={14} color={eraser ? '#ef4444' : clrPrimary} />
        </button>
        <button onClick={doUndo} disabled={undoStack.length === 0} title="Undo" style={{ ...btnBase, opacity: undoStack.length === 0 ? 0.4 : 1 }} data-testid={`sketch-pad-undo-${widget.id}`}>
          <Undo2 size={14} />
        </button>
        <button onClick={doClear} title="Clear all" style={btnBase} data-testid={`sketch-pad-clear-${widget.id}`}>
          <Trash2 size={14} />
        </button>
        <button onClick={doDownload} title="Download PNG" style={btnBase} data-testid={`sketch-pad-download-${widget.id}`}>
          <Download size={14} />
        </button>
      </div>

      {/* Color palette popover */}
      {showPalette && toolbarVisible && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 56,
            transform: 'translateX(-50%)',
            background: toolbarBg, border: `1px solid ${clrBorder}`,
            borderRadius: 8, padding: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
          data-testid={`sketch-pad-palette-${widget.id}`}
        >
          {SKETCH_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setEraser(false); setShowPalette(false); bumpToolbar(); }}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: 999,
                background: c, border: c === color ? `2px solid ${clrPrimary}` : `1px solid ${clrBorder}`,
                cursor: 'pointer', padding: 0,
              }}
              data-testid={`sketch-pad-palette-${c}-${widget.id}`}
            />
          ))}
          <input
            type="color" value={color}
            onChange={(e) => { setColor(e.target.value); setEraser(false); bumpToolbar(); }}
            style={{ gridColumn: '1 / -1', width: '100%', height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }}
            data-testid={`sketch-pad-color-input-${widget.id}`}
          />
        </div>
      )}

      {/* Brand label — fades with toolbar so it doesn't intrude during drawing */}
      <div style={{
        position: 'absolute', top: 10, left: 14,
        opacity: toolbarVisible ? 0.6 : 0,
        transition: 'opacity 200ms ease', pointerEvents: 'none',
        color: clrMuted, fontFamily: MONO, fontSize: 10, fontWeight: 700,
        letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <Brush size={11} /> SKETCH
      </div>
    </div>
  );
};
