interface RefreshableVideoCandidate {
  type?: string;
  url?: string | null;
  videoId?: string | null;
  youtubeChannelId?: string | null;
  twitchChannel?: string | null;
  kickChannel?: string | null;
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
