// Page + widget shapes the mobile app cares about. Kept minimal so the
// renderer registry can pick the fields it needs without dragging in the
// full web-side `Widget` discriminated union.

export interface DashboardWidget {
  id: string;
  type: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  [key: string]: unknown;
}

export interface DashboardPage {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
}

export type ThemePreference = 'dark' | 'light' | 'auto';

export interface Settings {
  pageId: string | null; // null → follow dashboard's active/default page
  refreshMinutes: number; // 1, 5, 15, 30
  themePref: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = {
  pageId: null,
  refreshMinutes: 5,
  themePref: 'auto',
};

export const REFRESH_OPTIONS: number[] = [1, 5, 15, 30];
