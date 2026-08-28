const TWITCH_HANDLE = /^[a-z0-9_]{1,25}$/i;
const KICK_HANDLE = /^[a-z0-9_-]{1,40}$/i;

const TWITCH_RESERVED_PATHS = new Set([
  'directory',
  'downloads',
  'jobs',
  'p',
  'search',
  'settings',
  'subscriptions',
  'videos',
]);

const KICK_RESERVED_PATHS = new Set([
  'browse',
  'categories',
  'dashboard',
  'following',
  'search',
  'video',
]);

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function firstPathSegment(url: URL): string | null {
  const segment = url.pathname.split('/').filter(Boolean)[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment).toLowerCase();
  } catch {
    return null;
  }
}

export function extractTwitchChannel(url: string): string | null {
  const parsed = parseHttpUrl(url);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  let channel: string | null;

  if (host === 'player.twitch.tv') {
    channel = parsed.searchParams.get('channel')?.toLowerCase() ?? null;
  } else if (host === 'twitch.tv' || host === 'www.twitch.tv' || host === 'm.twitch.tv') {
    channel = firstPathSegment(parsed);
  } else {
    return null;
  }

  if (!channel || TWITCH_RESERVED_PATHS.has(channel) || !TWITCH_HANDLE.test(channel)) return null;
  return channel;
}

export function extractKickChannel(url: string): string | null {
  const parsed = parseHttpUrl(url);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  if (host !== 'kick.com' && host !== 'www.kick.com' && host !== 'player.kick.com') return null;

  const channel = firstPathSegment(parsed);
  if (!channel || KICK_RESERVED_PATHS.has(channel) || !KICK_HANDLE.test(channel)) return null;
  return channel;
}
