export type StreamPlatform = 'youtube' | 'twitch' | 'kick';
export type StreamLiveStatus = boolean | null;

export interface CatalogStreamCandidate {
  id: string;
  channelId?: string | null;
  platform: StreamPlatform;
  isLive?: boolean;
}

export interface CatalogStreamStatus {
  channelId: string;
  isLive: StreamLiveStatus;
  lastChecked: number;
}

/**
 * YouTube catalog status is refreshed by OpenBento's YouTube service.
 * Twitch has no configured API check, and Kick is checked separately, so
 * their catalog flags are unknown until a real status check succeeds.
 */
export function catalogStreamLiveStatus(
  platform: StreamPlatform,
  reportedLive: unknown,
): StreamLiveStatus {
  if (platform !== 'youtube') return null;
  return typeof reportedLive === 'boolean' ? reportedLive : null;
}

export function initialWidgetLiveState(
  platform: StreamPlatform,
  reportedLive: unknown,
): boolean {
  return catalogStreamLiveStatus(platform, reportedLive) === true;
}

export function liveStatusFromResponse(payload: unknown): StreamLiveStatus {
  if (!payload || typeof payload !== 'object') return null;
  const isLive = (payload as { isLive?: unknown }).isLive;
  return typeof isLive === 'boolean' ? isLive : null;
}

export async function buildCatalogLiveStatuses(
  channels: readonly CatalogStreamCandidate[],
  lastChecked: number,
  checkKick: (channelId: string) => Promise<StreamLiveStatus>,
): Promise<Record<string, CatalogStreamStatus>> {
  const entries = await Promise.all(
    channels.filter((channel) => Boolean(channel.channelId)).map(async (channel) => {
      const channelId = channel.channelId as string;
      const isLive = channel.platform === 'kick'
        ? await checkKick(channelId)
        : catalogStreamLiveStatus(channel.platform, channel.isLive);

      return [channel.id, { channelId, isLive, lastChecked }] as const;
    }),
  );

  return Object.fromEntries(entries);
}
