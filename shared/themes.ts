// Themes Marketplace data model + pure helpers.
//
// Lives in `shared/` so future server-driven theme bundles, the cast
// hub, and the tests can all import the same shape without pulling in
// React or DOM types. Browser-side application of a theme is handled
// in client/src/dashboard/use-theme.ts; this file is intentionally
// side-effect-free (no `window`, no `document`).

// ─── Types ────────────────────────────────────────────────────────────────

export type ThemeBackgroundKind = 'color' | 'gradient' | 'image';

export interface ThemeBackground {
  /**
   * `color`    — solid hex (e.g. "#0f172a"). Applied as background-color.
   * `gradient` — any valid CSS background-image expression
   *              (e.g. "linear-gradient(135deg,#0a2342,#3b1d6e)").
   * `image`    — absolute URL fetched and rendered via background-image:url().
   *              Renderer is responsible for cover/center/fixed positioning.
   */
  kind: ThemeBackgroundKind;
  value: string;
}

export type ThemeFont = 'inter' | 'mono' | 'serif' | 'rounded';

export interface Theme {
  id:           string;          // stable slug, unique across built-in + personal
  name:         string;          // user-visible display name
  description:  string;          // one-liner for the marketplace card
  builtIn:      boolean;         // true for the curated 8, false for "My Themes"
  background:   ThemeBackground; // background engine config
  accent:       string;          // hex — drives links, focus rings, highlights
  font:         ThemeFont;       // global font family family selector
  widgetTint:   string;          // hex — default customColor for widgets / palette base
  lightMode:    boolean;         // true → flip dashboard into True Light Mode
  createdAt?:   number;          // ms epoch — only set for personal themes
}

// CSS variables a Theme writes to :root when applied. Stable string keys so
// the apply reducer and the unit tests share a single source of truth.
//
// `--slot-bg-rgb` is a "r, g, b" triplet (no rgb() wrapper) because the
// existing .dashboard-slot rule in index.css consumes it that way to build
// rgba() colors at runtime. Setting it from a theme makes every untinted
// widget pick up the theme's widgetTint as its translucent background.
export interface ThemeCssVars {
  '--ob-bg-color':    string;
  '--ob-bg-image':    string;   // 'none' for solid colors
  '--ob-accent':      string;
  '--ob-accent-soft': string;   // accent at ~20% alpha for highlights/borders
  '--ob-font':        string;   // resolved font-family stack
  '--ob-widget-tint': string;
  '--slot-bg-rgb':    string;   // "r, g, b" triplet driving .dashboard-slot
}

// ─── Font stacks ──────────────────────────────────────────────────────────

export const THEME_FONT_STACKS: Record<ThemeFont, string> = {
  inter:   "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  serif:   "'Source Serif Pro', 'Iowan Old Style', Georgia, 'Times New Roman', serif",
  rounded: "'Nunito', 'Quicksand', system-ui, -apple-system, sans-serif",
};

// ─── Built-in themes (the curated 8) ──────────────────────────────────────
//
// Order here is the order in which they render in the Built-in tab.
// Each theme is a complete, opinionated visual identity; "Apply" should
// produce a meaningfully different dashboard look on its own.

export const BUILT_IN_THEMES: readonly Theme[] = [
  {
    id: 'midnight-ocean',
    name: 'Midnight Ocean',
    description: 'Deep navy gradient with cyan accent — the OpenBento default, reimagined.',
    builtIn: true,
    background: { kind: 'gradient', value: 'linear-gradient(135deg,#020617 0%,#0c1e3d 50%,#0e2a4a 100%)' },
    accent:     '#22d3ee',
    font:       'inter',
    widgetTint: '#0f172a',
    lightMode:  false,
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    description: 'Warm peach-to-rose gradient. Bright, optimistic light mode.',
    builtIn: true,
    background: { kind: 'gradient', value: 'linear-gradient(135deg,#fde7d3 0%,#fbcfa1 45%,#f59e8a 100%)' },
    accent:     '#ea580c',
    font:       'inter',
    widgetTint: '#fef3e6',
    lightMode:  true,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon magenta on inky violet. Maximum contrast, all signal.',
    builtIn: true,
    background: { kind: 'gradient', value: 'linear-gradient(135deg,#0b001f 0%,#2a0a4a 50%,#0b001f 100%)' },
    accent:     '#ff2bd6',
    font:       'mono',
    widgetTint: '#1a0533',
    lightMode:  false,
  },
  {
    id: 'paper-light',
    name: 'Paper Light',
    description: 'Off-white parchment with serif type. Reading-room calm.',
    builtIn: true,
    background: { kind: 'color', value: '#f8f4ec' },
    accent:     '#1f2937',
    font:       'serif',
    widgetTint: '#ffffff',
    lightMode:  true,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Mossy greens, soft canopy. Grounding and easy on the eyes.',
    builtIn: true,
    background: { kind: 'gradient', value: 'linear-gradient(160deg,#0a1f14 0%,#103024 55%,#1a4d35 100%)' },
    accent:     '#34d399',
    font:       'rounded',
    widgetTint: '#0e2419',
    lightMode:  false,
  },
  {
    id: 'mono-slate',
    name: 'Mono Slate',
    description: 'Pure greyscale, monospace, no chrome. Distraction-free workshop.',
    builtIn: true,
    background: { kind: 'color', value: '#1c1c1e' },
    accent:     '#e5e5e7',
    font:       'mono',
    widgetTint: '#262629',
    lightMode:  false,
  },
  {
    id: 'lava-lounge',
    name: 'Lava Lounge',
    description: 'Crimson-and-gold dusk. Cozy, after-hours mission control.',
    builtIn: true,
    background: { kind: 'gradient', value: 'linear-gradient(135deg,#1a0407 0%,#3d0a14 45%,#7a1d2e 100%)' },
    accent:     '#fbbf24',
    font:       'inter',
    widgetTint: '#240609',
    lightMode:  false,
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    description: 'Pink-purple-cyan gradient straight out of 1986.',
    builtIn: true,
    background: { kind: 'gradient', value: 'linear-gradient(135deg,#ff77e9 0%,#a06bff 50%,#3ae0ff 100%)' },
    accent:     '#7c3aed',
    font:       'rounded',
    widgetTint: '#3a0d5b',
    lightMode:  false,
  },
];

// O(1) lookup by id. Built once at module load.
export const BUILT_IN_THEMES_BY_ID: Record<string, Theme> =
  BUILT_IN_THEMES.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, Theme>);

// ─── Pure helpers (used by the apply hook AND the tests) ───────────────────

/**
 * Convert a hex (#rgb / #rrggbb) into rgba(r,g,b,alpha). Returns the input
 * untouched on parse failure so a malformed personal theme can't crash the
 * dashboard.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const triplet = hexToRgbTriplet(hex);
  if (!triplet) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${triplet}, ${a})`;
}

/**
 * Parse a hex (#rgb / #rrggbb) into a comma-space triplet "r, g, b" suitable
 * for use inside rgba(). Returns null on parse failure so the caller can
 * decide on a sensible fallback. Pure helper, used by both hexToRgba and
 * the apply reducer's `--slot-bg-rgb` var.
 */
export function hexToRgbTriplet(hex: string): string | null {
  const clean = hex.trim().replace(/^#/, '');
  const full  = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Theme → CSS-var bag. Pure: no DOM access, deterministic. The apply
 * hook spreads this onto document.documentElement.style; the tests
 * assert on the exact returned object so we catch theme regressions
 * without booting the browser.
 */
export function themeToCssVars(theme: Theme): ThemeCssVars {
  // Fall back to slate-900 for unparseable widget tints so the dashboard
  // never renders fully-transparent slots.
  const tintTriplet = hexToRgbTriplet(theme.widgetTint) ?? '15, 23, 42';
  return {
    '--ob-bg-color':    theme.background.kind === 'color' ? theme.background.value : 'transparent',
    '--ob-bg-image':    theme.background.kind === 'color' ? 'none' : theme.background.value,
    '--ob-accent':      theme.accent,
    '--ob-accent-soft': hexToRgba(theme.accent, 0.18),
    '--ob-font':        THEME_FONT_STACKS[theme.font] ?? THEME_FONT_STACKS.inter,
    '--ob-widget-tint': theme.widgetTint,
    '--slot-bg-rgb':    tintTriplet,
  };
}

// ─── localStorage key (also used by the test for round-trip checks) ─────────
export const PERSONAL_THEMES_KEY  = 'openBentoPersonalThemes';
export const ACTIVE_THEME_ID_KEY  = 'openBentoActiveThemeId';

/**
 * Snapshot the current "live look" from a settings bag into a Theme. Used
 * by "Save current look as a theme". The caller passes whatever values
 * the running dashboard is currently using (background config, accent,
 * font, default widget tint, isDarkMode); this packs them into a Theme
 * object with `builtIn:false` and a fresh id.
 */
export interface CaptureLookInput {
  name:        string;
  background:  ThemeBackground;
  accent:      string;
  font:        ThemeFont;
  widgetTint:  string;
  lightMode:   boolean;
}

export function captureLookAsTheme(input: CaptureLookInput): Theme {
  const safeName = (input.name || 'My Theme').trim().slice(0, 60) || 'My Theme';
  const slug = safeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24) || 'theme';
  const ts = Date.now();
  return {
    id:          `personal-${slug}-${ts.toString(36)}`,
    name:        safeName,
    description: 'Personal theme captured from your current look.',
    builtIn:     false,
    background:  input.background,
    accent:      input.accent,
    font:        input.font,
    widgetTint:  input.widgetTint,
    lightMode:   input.lightMode,
    createdAt:   ts,
  };
}

/**
 * Validate a Theme-shaped value coming from localStorage / the Supabase
 * payload. Returns null if any required field is missing or wrong-typed
 * so we can quietly drop corrupted entries instead of crashing the app.
 */
export function isValidTheme(v: unknown): v is Theme {
  if (!v || typeof v !== 'object') return false;
  const t = v as Partial<Theme>;
  if (typeof t.id !== 'string'   || !t.id) return false;
  if (typeof t.name !== 'string' || !t.name) return false;
  if (typeof t.description !== 'string') return false;
  if (typeof t.builtIn !== 'boolean') return false;
  if (typeof t.accent !== 'string') return false;
  if (typeof t.widgetTint !== 'string') return false;
  if (typeof t.lightMode !== 'boolean') return false;
  if (!t.font || !(t.font in THEME_FONT_STACKS)) return false;
  if (!t.background || typeof t.background !== 'object') return false;
  const bg = t.background as ThemeBackground;
  if (bg.kind !== 'color' && bg.kind !== 'gradient' && bg.kind !== 'image') return false;
  if (typeof bg.value !== 'string' || !bg.value) return false;
  return true;
}

/** Filter an unknown array down to valid Theme entries. Safe on null/undefined. */
export function sanitizeThemes(arr: unknown): Theme[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidTheme);
}
