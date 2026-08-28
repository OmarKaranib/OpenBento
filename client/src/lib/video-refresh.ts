interface RefreshableVideoCandidate {
  type?: string;
  url?: string | null;
  videoId?: string | null;
  youtubeChannelId?: string | null;
  twitchChannel?: string | null;
  kickChannel?: string | null;
  lastRefresh?: number;
  isOffline?: boolean;
  error?: unknown;
  embedBlocked?: boolean;
}

export function isRefreshableVideoWidget(widget: RefreshableVideoCandidate): boolean {
  return widget.type === 'video' && Boolean(
    widget.url
    || widget.videoId
    || widget.youtubeChannelId
    || widget.twitchChannel
    || widget.kickChannel
  );
}

export function refreshVideoWidget<T extends RefreshableVideoCandidate>(
  widget: T,
  refreshedAt: number,
): T {
  if (!isRefreshableVideoWidget(widget)) return widget;

  return {
    ...widget,
    lastRefresh: refreshedAt,
    isOffline: false,
    error: null,
    embedBlocked: false,
  };
}
