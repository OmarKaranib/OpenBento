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
