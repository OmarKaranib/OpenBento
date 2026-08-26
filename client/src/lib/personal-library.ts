export const PERSONAL_LIBRARY_KEY = 'openBentoPersonalLibrary';

export interface SavedChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'finance' | 'gaming' | 'default';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  verifiedLiveId?: string | null;
  latestVideoId?: string | null;
  isManualOverride?: boolean;
  savedAt: number;
}

export function loadPersonalLibrary(): SavedChannel[] {
  try {
    const stored = localStorage.getItem(PERSONAL_LIBRARY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function savePersonalLibrary(channels: SavedChannel[]): void {
  try {
    localStorage.setItem(PERSONAL_LIBRARY_KEY, JSON.stringify(channels));
  } catch (error) {
    console.error('[Personal Library] Save error:', error);
  }
}
