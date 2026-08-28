export function buildTwitchEmbedUrl(
  channel: string,
  parent: string,
  muted = true,
): string {
  const query = new URLSearchParams({
    channel,
    parent,
    muted: String(muted),
    autoplay: 'true',
  });
  return `https://player.twitch.tv/?${query.toString()}`;
}

export function buildKickEmbedUrl(
  channel: string,
  parent: string,
  muted = true,
): string {
  const query = new URLSearchParams({
    autoplay: 'true',
    muted: String(muted),
    parent,
  });
  return `https://player.kick.com/${encodeURIComponent(channel)}?${query.toString()}`;
}
