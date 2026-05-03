import type { DashboardPage } from '@shared/dashboard-pages';

export type BackgroundConfig = NonNullable<DashboardPage['backgroundConfig']>;

export type PageVisualSnapshot = {
  themeId: string | null;
  bg: BodyBgStyles | null;
};

export type BodyBgStyles = {
  backgroundImage: string;
  backgroundColor: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundAttachment: string;
};

export type PageVisualPrev = {
  hadThemeOverride: boolean;
  hadBgOverride: boolean;
  snapshot: PageVisualSnapshot;
};

export type PageVisualCommand =
  | { kind: 'apply-theme'; themeId: string }
  | { kind: 'restore-theme'; themeId: string | null }
  | { kind: 'apply-bg'; bg: BackgroundConfig }
  | { kind: 'restore-bg'; bg: BodyBgStyles | null };

export type PageVisualPlan = {
  commands: PageVisualCommand[];
  next: PageVisualPrev;
};

/**
 * Pure planner for the per-page theme/background apply effect.
 *
 * Decides which DOM-mutating commands to fire when switching to a
 * new active page, given the previous override state and the current
 * "global" baseline (theme + body styles). The first time a page
 * with an override is activated we snapshot the global baseline; on
 * the next switch to a no-override page we restore from that
 * snapshot so per-page visuals never bleed across tabs.
 */
export function planPageVisuals(
  prev: PageVisualPrev,
  active: { themeId: string | null; backgroundConfig: BackgroundConfig | null },
  globals: { themeId: string | null; bg: BodyBgStyles | null },
): PageVisualPlan {
  const commands: PageVisualCommand[] = [];
  const next: PageVisualPrev = {
    hadThemeOverride: prev.hadThemeOverride,
    hadBgOverride: prev.hadBgOverride,
    snapshot: { ...prev.snapshot },
  };

  // Theme dimension
  if (active.themeId) {
    if (!prev.hadThemeOverride) {
      next.snapshot.themeId = globals.themeId;
    }
    if (active.themeId !== prev.snapshot.themeId || !prev.hadThemeOverride) {
      commands.push({ kind: 'apply-theme', themeId: active.themeId });
    }
    next.hadThemeOverride = true;
    next.snapshot.themeId = next.hadThemeOverride && !prev.hadThemeOverride
      ? globals.themeId
      : prev.snapshot.themeId;
  } else if (prev.hadThemeOverride) {
    commands.push({ kind: 'restore-theme', themeId: prev.snapshot.themeId });
    next.hadThemeOverride = false;
    next.snapshot.themeId = null;
  }

  // Background dimension
  if (active.backgroundConfig) {
    if (!prev.hadBgOverride) {
      next.snapshot.bg = globals.bg;
    }
    commands.push({ kind: 'apply-bg', bg: active.backgroundConfig });
    next.hadBgOverride = true;
  } else if (prev.hadBgOverride) {
    commands.push({ kind: 'restore-bg', bg: prev.snapshot.bg });
    next.hadBgOverride = false;
    next.snapshot.bg = null;
  }

  return { commands, next };
}

export const EMPTY_PAGE_VISUAL_PREV: PageVisualPrev = {
  hadThemeOverride: false,
  hadBgOverride: false,
  snapshot: { themeId: null, bg: null },
};
