import type { Widget } from "@/App";
import type { CastSnapshot } from "@shared/schema";

/** Strip volatile fields that should never travel to the TV. */
function stripWidgetForCast(w: Widget): Record<string, unknown> {
  const {
    isDeleting: _isDeleting,
    refreshCounter: _refreshCounter,
    ...rest
  } = w;
  return rest as unknown as Record<string, unknown>;
}

export function buildCastSnapshot(args: {
  widgets: Widget[];
  isDarkMode: boolean;
  masterMute: boolean;
}): CastSnapshot {
  return {
    v: 1,
    widgets: args.widgets
      .filter((w) => !w.isDeleting)
      .map((w) => stripWidgetForCast(w)) as CastSnapshot["widgets"],
    isDarkMode: args.isDarkMode,
    masterMute: args.masterMute,
    pushedAt: Date.now(),
  };
}

/** Persist the laptop-side list of paired TVs in localStorage. */
const STORAGE_KEY = "openBentoCastTVs";

export interface PairedTV {
  roomId: string;
  label: string;
  pairedAt: number;
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
    /* quota — ignore */
  }
}
