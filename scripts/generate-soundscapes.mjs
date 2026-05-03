// One-time generator for the Focus Soundscape bundled loop assets.
// Renders 5 short ambient WAV loops by synthesizing white/brown noise,
// applying a biquad filter chain (RBJ cookbook) offline, and seam-
// crossfading the tail back into the head with an equal-power ramp so
// looping the WAV via <audio loop> or AudioBufferSourceNode.loop = true
// produces no audible click at the boundary.
//
// Run:  node scripts/generate-soundscapes.mjs
// Output: client/public/sounds/wellness/{rain,brown,fire,forest,waves}.wav

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;          // 22.05kHz, mono — small files, plenty for ambient
const SECONDS = 4;         // loop length
const XFADE_S = 0.15;      // 150ms equal-power crossfade at the seam
const XFADE = Math.floor(XFADE_S * SR);
const TOTAL = SECONDS * SR;

// ─── Noise sources ──────────────────────────────────────────────────────
function genWhite(n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.random() * 2 - 1;
  return out;
}
function genBrown(n) {
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5;
  }
  return out;
}

// ─── Biquad (RBJ cookbook). Stateful — apply in-place. ──────────────────
function biquadCoeffs(type, f0, Q) {
  const w0 = 2 * Math.PI * f0 / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') {
    b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    a0 = 1 + alpha;    a1 = -2 * cw; a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    a0 = 1 + alpha;    a1 = -2 * cw;   a2 = 1 - alpha;
  } else if (type === 'bandpass') {
    b0 = alpha; b1 = 0; b2 = -alpha;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else {
    throw new Error('unknown filter type: ' + type);
  }
  return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
}
function biquad(input, type, f0, Q = 0.707) {
  const { b0, b1, b2, a1, a2 } = biquadCoeffs(type, f0, Q);
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}
function chain(input, ...stages) {
  let cur = input;
  for (const [type, f0, Q] of stages) cur = biquad(cur, type, f0, Q);
  return cur;
}

// ─── Slow LFO amplitude envelope (used by `waves`). ─────────────────────
function applyLfo(input, freqHz, depth) {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const env = 1 - depth + depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * freqHz * i / SR));
    out[i] = input[i] * env;
  }
  return out;
}

// ─── Seam crossfade: head[i]*cos + tail[i]*sin (equal-power). ───────────
function seamCrossfade(buf) {
  // buf has length TOTAL + XFADE; we fold tail samples [TOTAL..TOTAL+XFADE)
  // back into head [0..XFADE) and trim the tail off.
  const out = new Float32Array(TOTAL);
  out.set(buf.subarray(0, TOTAL));
  for (let i = 0; i < XFADE; i++) {
    const t = i / XFADE;
    const a = Math.cos(t * Math.PI / 2);
    const b = Math.sin(t * Math.PI / 2);
    out[i] = buf[i] * a + buf[TOTAL + i] * b;
  }
  return out;
}

// ─── Normalize to -3 dBFS so the file isn't clipped ─────────────────────
function normalize(buf, targetDb = -3) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i]); if (v > peak) peak = v;
  }
  if (peak === 0) return buf;
  const target = Math.pow(10, targetDb / 20);
  const gain = target / peak;
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * gain;
  return out;
}

// ─── 16-bit PCM mono WAV writer ─────────────────────────────────────────
function writeWav(samples, filePath) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);          // fmt chunk size
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(SR, 24);          // sample rate
  buf.writeUInt32LE(SR * 2, 28);      // byte rate
  buf.writeUInt16LE(2, 32);           // block align
  buf.writeUInt16LE(16, 34);          // bits/sample
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, buf);
}

// ─── Preset recipes ─────────────────────────────────────────────────────
const recipes = {
  rain:   () => chain(genWhite(TOTAL + XFADE),
                      ['highpass',  900, 0.7],
                      ['lowpass',  6500, 0.7]),
  brown:  () => chain(genBrown(TOTAL + XFADE),
                      ['lowpass',   600, 0.7]),
  fire:   () => {
    // Brown noise, lowpassed deep, with a faint slow LFO simulating crackle swell.
    const base = chain(genBrown(TOTAL + XFADE), ['lowpass', 500, 0.7]);
    return applyLfo(base, 0.6, 0.20);
  },
  forest: () => chain(genBrown(TOTAL + XFADE),
                      ['bandpass', 1100, 0.7]),
  waves:  () => {
    // Brown noise, lowpassed warm + slow swell LFO @ 0.18Hz.
    const base = chain(genBrown(TOTAL + XFADE), ['lowpass', 800, 0.7]);
    return applyLfo(base, 0.18, 0.55);
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'client', 'public', 'sounds', 'wellness');

for (const [name, recipe] of Object.entries(recipes)) {
  const raw = recipe();
  const looped = seamCrossfade(raw);
  const normed = normalize(looped, -3);
  const out = resolve(outDir, `${name}.wav`);
  writeWav(normed, out);
  console.log(`✓ wrote ${name}.wav (${(normed.length * 2 / 1024).toFixed(0)}KB)`);
}
console.log('done.');
