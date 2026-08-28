const PRODUCTION_ORIGIN = 'https://openbento.tv';

export function resolveEmbedOrigin(candidate?: string): string {
  if (!candidate) return PRODUCTION_ORIGIN;
  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
      return parsed.origin;
    }
  } catch {
    // Use the production origin when browser location data is malformed.
  }
  return PRODUCTION_ORIGIN;
}

export function currentEmbedOrigin(): string {
  return resolveEmbedOrigin(typeof window === 'undefined' ? undefined : window.location.origin);
}

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
