import type { Widget } from "@/App";
import type { CastSnapshot } from "@shared/schema";

function stripWidgetForCast(w: Widget): Record<string, unknown> {
  const { isDeleting: _d, refreshCounter: _r, ...rest } = w;
  return rest as unknown as Record<string, unknown>;
}

// The dashboard has no separate background state — the visible bg is purely
// theme-derived. Resolving here keeps the TV renderer self-contained.
function resolveBackground(isDarkMode: boolean): string {
  return isDarkMode ? "#0f172a" : "#F8F9FA";
}

export function buildCastSnapshot(args: {
  widgets: Widget[];
  isDarkMode: boolean;
  masterMute: boolean;
  background?: string;
  layoutId?: string | null;
  layoutName?: string | null;
}): CastSnapshot {
  return {
    v: 1,
    widgets: args.widgets
      .filter((w) => !w.isDeleting)
      .map((w) => stripWidgetForCast(w)) as CastSnapshot["widgets"],
    isDarkMode: args.isDarkMode,
    masterMute: args.masterMute,
    background: args.background ?? resolveBackground(args.isDarkMode),
    pushedAt: Date.now(),
    layoutId: args.layoutId ?? null,
    layoutName: args.layoutName ?? null,
  };
}

const STORAGE_KEY = "openBentoCastTVs";

export interface PairedTV {
  roomId: string;
  label: string;
  pairedAt: number;
  code?: string | null;
}

export function loadPairedTVs(): PairedTV[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PairedTV =>
        p && typeof p.roomId === "string" && typeof p.label === "string",
    );
  } catch {
    return [];
  }
}

export function savePairedTVs(list: PairedTV[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}
