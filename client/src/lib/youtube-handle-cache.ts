export interface HandleLiveCacheFields {
  isLive: boolean;
  liveVideoId: string | null;
  latestVideoId?: string | null;
  channelId?: string | null;
  title: string | null;
  apiError?: boolean;
}

export function restoreHandleLiveResult(cached: HandleLiveCacheFields) {
  return {
    isLive: cached.isLive,
    liveVideoId: cached.liveVideoId,
    latestVideoId: cached.latestVideoId ?? null,
    channelId: cached.channelId ?? null,
    title: cached.title,
    apiError: cached.apiError,
  };
}

export function cacheHandleLiveResult(result: Required<Omit<HandleLiveCacheFields, 'apiError'>>) {
  return {
    isLive: result.isLive,
    liveVideoId: result.liveVideoId,
    latestVideoId: result.latestVideoId,
    channelId: result.channelId,
    title: result.title,
  };
}
