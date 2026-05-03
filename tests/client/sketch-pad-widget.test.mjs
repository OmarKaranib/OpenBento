// Widget-level integration test for the Sketch Pad widget.
//
// Verifies the contract the architect called out as a Done criterion:
// mount the component, simulate a pointer stroke (down → move → up),
// and assert that the debounced persistence path eventually calls the
// `onUpdate` prop with a `sketchPad` payload (PNG data URL + size +
// preference fields).
//
// We render the component without a real DOM by installing a hand-
// rolled React hook dispatcher (same trick used by
// use-cloud-sync.test.mjs). The widget needs a canvas + browser APIs;
// we shim only the surface area it touches (devicePixelRatio,
// ResizeObserver, document.createElement('canvas'), Image, and a
// minimal CanvasRenderingContext2D). That keeps the test focused on
// the widget's own logic rather than browser fidelity.
import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
register({ parentURL: pathToFileURL('./').href });

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

// ─── Browser shims ────────────────────────────────────────────────────
// Provide the smallest subset of browser globals the widget exercises.
class FakeCtx {
  constructor() {
    this.lineCap = ''; this.lineJoin = '';
    this.lineWidth = 0; this.strokeStyle = ''; this.fillStyle = '';
    this.globalCompositeOperation = 'source-over';
    this.calls = [];
  }
  save()    { this.calls.push(['save']); }
  restore() { this.calls.push(['restore']); }
  beginPath(){this.calls.push(['beginPath']); }
  moveTo(x,y){this.calls.push(['moveTo',x,y]); }
  arc()     { this.calls.push(['arc']); }
  fill()    { this.calls.push(['fill']); }
  stroke()  { this.calls.push(['stroke']); }
  quadraticCurveTo(){ this.calls.push(['quad']); }
  drawImage(){ this.calls.push(['drawImage']); }
  clearRect(){ this.calls.push(['clearRect']); }
}
function makeFakeCanvas() {
  const ctx = new FakeCtx();
  const cv = {
    width: 0, height: 0,
    clientWidth: 200, clientHeight: 100,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    toDataURL: () => 'data:image/png;base64,FAKE',
  };
  return { cv, ctx };
}

// Capture the real timer functions BEFORE we install the window shim
// (otherwise globalThis.window.setTimeout = ... creates a recursive
// reference because window === globalThis in node).
const _setTimeout   = globalThis.setTimeout.bind(globalThis);
const _clearTimeout = globalThis.clearTimeout.bind(globalThis);
globalThis.window = globalThis.window ?? globalThis;
globalThis.window.devicePixelRatio = 1;
globalThis.window.setTimeout   = (cb, ms) => _setTimeout(cb, ms);
globalThis.window.clearTimeout = (id)     => _clearTimeout(id);
globalThis.ResizeObserver = class { observe(){} disconnect(){} unobserve(){} };
globalThis.Image = class {
  constructor() { this.naturalWidth = 1; this.naturalHeight = 1; }
  set src(_) { /* no-op */ }
};
// document.createElement('canvas') is used inside initSurface for
// snapshot-restore on resize. Return another fake canvas.
globalThis.document = globalThis.document ?? {
  createElement: (tag) => {
    if (tag === 'canvas') return makeFakeCanvas().cv;
    return {};
  },
};

// ─── Hook dispatcher (renderer-less mount) ────────────────────────────
const Internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
function makeDispatcher(refSeed) {
  const states = []; const refs = []; const effects = [];
  let sIdx = 0; let rIdx = 0;
  const dispatcher = {
    useState(init) {
      const i = sIdx++;
      if (i >= states.length) states.push(typeof init === 'function' ? init() : init);
      const setter = (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; };
      return [states[i], setter];
    },
    useRef(init) {
      const i = rIdx++;
      if (i >= refs.length) refs.push({ current: refSeed?.[i] !== undefined ? refSeed[i] : init });
      return refs[i];
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (fn, deps) => { effects.push({ fn, deps }); },
    useLayoutEffect: (fn, deps) => { effects.push({ fn, deps }); },
    useContext: () => undefined,
    useReducer: (_r, init) => [init, () => {}],
    useImperativeHandle: () => {},
    useDebugValue: () => {},
    useTransition: () => [false, (cb) => cb()],
    useDeferredValue: (v) => v,
    useId: () => ':r:test:',
    useSyncExternalStore: (_s, getSnap) => getSnap(),
    useInsertionEffect: () => {},
  };
  const reset = () => { sIdx = 0; rIdx = 0; };
  return { dispatcher, reset, refs, effects };
}

// ─── Tree walk: find the <canvas> JSX node ────────────────────────────
function findCanvas(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'canvas') return node;
  const kids = node.props?.children;
  const list = Array.isArray(kids) ? kids : [kids];
  for (const k of list) {
    const hit = findCanvas(k);
    if (hit) return hit;
  }
  return null;
}

const { SketchPadWidget } = await import(
  '../../client/src/widgets/sketch-pad-widget.tsx'
);

test('Sketch Pad widget: pointer stroke triggers debounced onUpdate with PNG payload', async () => {
  const widget = { id: 'w-test', type: 'sketch_pad', x: 0, y: 0, w: 4, h: 3 };
  const updates = [];
  const onUpdate = (id, patch) => updates.push({ id, patch });

  const { dispatcher, reset, refs } = makeDispatcher();
  const prev = Internals.ReactCurrentDispatcher.current;
  Internals.ReactCurrentDispatcher.current = dispatcher;
  let element;
  try {
    reset();
    element = SketchPadWidget({ widget, onUpdate, isDarkMode: true });
  } finally {
    Internals.ReactCurrentDispatcher.current = prev;
  }

  // refs in declaration order: containerRef, canvasRef, ctxRef,
  // ptsRef, activePointerRef, dprRef, surfaceGenRef, hideTimerRef,
  // onUpdateRef, prefsRef, saverRef, lastHydratedRef.
  const containerRef = refs[0];
  const canvasRef    = refs[1];
  const { cv, ctx } = makeFakeCanvas();
  containerRef.current = { /* element host */ };
  canvasRef.current    = cv;

  // Run mount effects so the surface initialises (sets ctxRef etc.)
  // and the persistence saver is wired up.
  Internals.ReactCurrentDispatcher.current = dispatcher;
  try {
    reset();
    SketchPadWidget({ widget, onUpdate, isDarkMode: true });
  } finally {
    Internals.ReactCurrentDispatcher.current = prev;
  }

  // Locate the <canvas> JSX and pull the bound handlers off its props.
  const canvasNode = findCanvas(element);
  assert.ok(canvasNode, 'rendered tree must contain a <canvas> element');
  const { onPointerDown, onPointerMove, onPointerUp } = canvasNode.props;
  assert.equal(typeof onPointerDown, 'function');
  assert.equal(typeof onPointerMove, 'function');
  assert.equal(typeof onPointerUp,   'function');

  // initSurface is invoked by an effect we haven't run (no real
  // ResizeObserver mount). Hydrate the ctx ref manually so flushStroke
  // can run, then size the surface to match the fake canvas.
  refs[2].current = ctx;        // ctxRef
  cv.width = 200; cv.height = 100;
  refs[5].current = 1;          // dprRef

  // Synthetic primary pointer stroke: down → move → up.
  const ev = (extras) => ({ pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: 0, clientY: 0, ...extras });
  onPointerDown(ev({ clientX: 10, clientY: 10 }));
  onPointerMove(ev({ clientX: 50, clientY: 30 }));
  onPointerMove(ev({ clientX: 90, clientY: 70 }));
  onPointerUp  (ev({ clientX: 90, clientY: 70 }));

  // The widget schedules a 500 ms debounced save. Wait for it to fire.
  await new Promise((r) => setTimeout(r, 700));

  assert.ok(updates.length >= 1, 'onUpdate must be called after the debounce window');
  const last = updates[updates.length - 1];
  assert.equal(last.id, 'w-test');
  assert.ok(last.patch.sketchPad,                 'patch must include sketchPad payload');
  assert.equal(last.patch.sketchPad.format, 'v1', 'payload format is v1');
  assert.match(last.patch.sketchPad.dataUrl, /^data:image\/png/, 'payload carries a PNG data URL');
  assert.equal(typeof last.patch.sketchPad.w, 'number');
  assert.equal(typeof last.patch.sketchPad.h, 'number');
  assert.ok('sketchColor'  in last.patch);
  assert.ok('sketchSize'   in last.patch);
  assert.ok('sketchEraser' in last.patch);
});

test('Sketch Pad widget: secondary (non-primary) pointers do NOT start a stroke', async () => {
  const widget = { id: 'w-pinch', type: 'sketch_pad', x: 0, y: 0, w: 4, h: 3 };
  const updates = [];
  const onUpdate = (id, patch) => updates.push({ id, patch });

  const { dispatcher, reset, refs } = makeDispatcher();
  const prev = Internals.ReactCurrentDispatcher.current;
  Internals.ReactCurrentDispatcher.current = dispatcher;
  let element;
  try {
    reset();
    element = SketchPadWidget({ widget, onUpdate });
  } finally {
    Internals.ReactCurrentDispatcher.current = prev;
  }
  const { cv, ctx } = makeFakeCanvas();
  refs[0].current = {};
  refs[1].current = cv;
  refs[2].current = ctx;
  cv.width = 200; cv.height = 100;
  refs[5].current = 1;

  const canvasNode = findCanvas(element);
  const { onPointerDown, onPointerUp } = canvasNode.props;
  // Non-primary touch (pinch second finger) must be rejected outright.
  onPointerDown({ pointerId: 99, isPrimary: false, clientX: 5, clientY: 5 });
  onPointerUp  ({ pointerId: 99, isPrimary: false, clientX: 5, clientY: 5 });
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(updates.length, 0, 'no save should be scheduled for non-primary pointer');
});
