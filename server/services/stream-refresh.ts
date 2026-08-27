export interface YouTubeRefreshResult {
  videoId: string | null;
  isLive: boolean;
  apiError: boolean;
}

export function applyYouTubeRefresh<
  T extends { videoId: string | null; isLive: boolean; lastUpdated: number },
>(channel: T, result: YouTubeRefreshResult, refreshedAt: number): T {
  if (result.apiError) return channel;
  return {
    ...channel,
    videoId: result.videoId || channel.videoId,
    isLive: result.isLive,
    lastUpdated: refreshedAt,
  };
}
