// Brand tokens pulled from the OpenBento web theme (shared/themes.ts —
// Midnight Ocean default) so the mobile companion looks like the same
// product. Keep these in sync if the web defaults change.

export const FONT_FAMILY = 'System';

export const COLORS = {
  // Background — solid fallback for the Midnight Ocean gradient.
  bg: '#020617',
  bgElevated: '#0c1e3d',
  surface: 'rgba(15, 23, 42, 0.85)',
  surfaceLight: 'rgba(255, 255, 255, 0.92)',

  // Accent — the Midnight Ocean cyan used across focus rings + links.
  accent: '#22d3ee',
  accentSoft: 'rgba(34, 211, 238, 0.18)',

  // Text
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textOnLight: '#0f172a',
  textMutedOnLight: '#475569',

  // Borders
  border: 'rgba(148, 163, 184, 0.25)',
  borderLight: 'rgba(15, 23, 42, 0.12)',

  // Status
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
} as const;

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  danger: string;
  success: string;
}

export function paletteFor(mode: ThemeMode): Palette {
  if (mode === 'light') {
    return {
      bg: '#f8fafc',
      surface: COLORS.surfaceLight,
      text: COLORS.textOnLight,
      textMuted: COLORS.textMutedOnLight,
      border: COLORS.borderLight,
      accent: COLORS.accent,
      accentSoft: COLORS.accentSoft,
      danger: COLORS.danger,
      success: COLORS.success,
    };
  }
  return {
    bg: COLORS.bg,
    surface: COLORS.surface,
    text: COLORS.text,
    textMuted: COLORS.textMuted,
    border: COLORS.border,
    accent: COLORS.accent,
    accentSoft: COLORS.accentSoft,
    danger: COLORS.danger,
    success: COLORS.success,
  };
}
