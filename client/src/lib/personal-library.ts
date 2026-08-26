import type { LibraryItem } from './stream-api';

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

function clean(value: string | null | undefined): string | undefined {
  const result = value?.trim();
  return result || undefined;
}

export function savedChannelIdentity(channel: SavedChannel): string {
  const platform = channel.platform.toLowerCase();
  const videoId = clean(channel.videoId);
  if (videoId) return `${platform}:video:${videoId}`;

  const channelId = clean(channel.channelId);
  if (channelId) return `${platform}:channel:${channelId}`;

  const url = channel.url.trim().replace(/\/+$/, '').toLowerCase();
  if (url) return `${platform}:url:${url}`;

  return `${platform}:id:${channel.id}`;
}

export function mergeSavedChannels(
  preferred: SavedChannel[],
  fallback: SavedChannel[],
): SavedChannel[] {
  const merged = new Map<string, SavedChannel>();

  for (const channel of [...preferred, ...fallback]) {
    const identity = savedChannelIdentity(channel);
    if (!merged.has(identity)) merged.set(identity, channel);
  }

  return Array.from(merged.values());
}

function toPlatform(platform: string): SavedChannel['platform'] {
  return platform === 'twitch' || platform === 'kick' ? platform : 'youtube';
}

function toIconType(item: LibraryItem): SavedChannel['iconType'] {
  const category = item.category?.toLowerCase();
  if (item.platform === 'twitch' || item.platform === 'kick' || category === 'gaming') return 'gaming';
  if (category === 'science' || category === 'space') return 'science';
  if (category === 'finance' || category === 'business') return 'finance';
  return 'news';
}

export function libraryItemToSavedChannel(item: LibraryItem): SavedChannel {
  const createdAt = item.createdAt ? Date.parse(item.createdAt) : NaN;

  return {
    id: item.id,
    name: item.name,
    url: item.url,
    iconType: toIconType(item),
    category: item.category || 'Saved',
    platform: toPlatform(item.platform),
    channelId: clean(item.channelId),
    videoId: clean(item.videoId),
    savedAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
  };
}

export function savedChannelToLibraryItem(channel: SavedChannel) {
  return {
    name: channel.name,
    url: channel.url,
    platform: channel.platform,
    channelId: clean(channel.channelId),
    videoId: clean(channel.videoId),
    category: channel.category,
  };
}

export async function reconcilePersonalLibrary(
  localChannels: SavedChannel[],
  cloudItems: LibraryItem[],
  upload: (item: ReturnType<typeof savedChannelToLibraryItem>) => Promise<LibraryItem | null>,
): Promise<SavedChannel[]> {
  const cloudChannels = cloudItems.map(libraryItemToSavedChannel);
  const cloudIdentities = new Set(cloudChannels.map(savedChannelIdentity));
  const uploadedOrLocal: SavedChannel[] = [];

  for (const localChannel of localChannels) {
    if (cloudIdentities.has(savedChannelIdentity(localChannel))) continue;

    const uploaded = await upload(savedChannelToLibraryItem(localChannel));
    uploadedOrLocal.push(uploaded ? libraryItemToSavedChannel(uploaded) : localChannel);
  }

  return mergeSavedChannels(cloudChannels, uploadedOrLocal);
}
