interface YouTubeWidgetCandidate {
  type?: string;
  isYouTube?: boolean;
  videoId?: string | null;
  isOffline?: boolean;
}

export function shouldCheckYouTubeWidget(
  widget: YouTubeWidgetCandidate,
  checkedVideoIds: ReadonlySet<string>,
  shouldRevalidate: boolean,
): boolean {
  if (widget.type !== 'video' || !widget.isYouTube || !widget.videoId) {
    return false;
  }

  return widget.isOffline
    ? shouldRevalidate
    : !checkedVideoIds.has(widget.videoId);
}

export type ManualYouTubeCheckAction =
  | 'preserve'
  | 'accept-live'
  | 'search-replacement'
  | 'accept-offline';

export function manualYouTubeCheckAction(
  status: { isLive: boolean; apiError?: boolean },
  hasChannelHandle: boolean,
): ManualYouTubeCheckAction {
  if (status.apiError) return 'preserve';
  if (status.isLive) return 'accept-live';
  return hasChannelHandle ? 'search-replacement' : 'accept-offline';
}
