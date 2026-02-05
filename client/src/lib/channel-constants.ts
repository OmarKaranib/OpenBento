// VERIFIED_CHANNELS: Protected 24/7 Live IDs that API CANNOT overwrite
// These are manually verified, permanent stream IDs for major news networks
// Keyed by channelHandle (lowercase normalized) - API results are IGNORED for these channels
export const VERIFIED_CHANNELS: Record<string, { liveId: string; fallbackId: string; name: string }> = {
  'abcnews': { liveId: 'w_Ma8oQLmSM', fallbackId: 'iipR5yUp36o', name: 'ABC News' },
  'reuters': { liveId: 'NvKaVw0X3oU', fallbackId: 'IEmqRjrIkF0', name: 'Reuters' },
  'skynews': { liveId: '9Auq9mYxFEe', fallbackId: 'siyW0GOBtbo', name: 'Sky News' },
};

// STATIC_LIVE_IDS: Secondary mapping for channels without VERIFIED status
// These are used when VERIFIED_CHANNELS doesn't have an entry
// Keyed by channelHandle (lowercase normalized)
export const STATIC_LIVE_IDS: Record<string, string> = {
  'nasa': 'tz4THVd5rdI',
  'nasatelevision': '21X5lGlDOfg',
  'nbcnews': 'sVEGHdVRIoU',
  'msnbc': 'nlKwThfNggk',
  'lofigirl': 'jfKfPfyJRdk',
  'aljazeeraenglish': 'kxPCFljwJws',
  'france24english': 'l8PMl7tUDIE',
  'ndtv': 'NvqKZHpKs-g',
};

// FALLBACK_VIDEO_IDS: Hardcoded Featured Video defaults when 150 errors occur and API fails
// These are each channel's most popular/featured video as ultimate fallback
// Keyed by channelHandle (lowercase normalized)
export const FALLBACK_VIDEO_IDS: Record<string, string> = {
  'abcnews': 'iipR5yUp36o',
  'reuters': 'IEmqRjrIkF0',
  'skynews': 'siyW0GOBtbo',
  'nasa': 'xCrPD7tfcr0',
  'nbcnews': 'Xfzjnt6p5jU',
  'msnbc': 'B8AQJB9c3u8',
  'aljazeeraenglish': 'gCNeDWCI0vo',
  'france24english': 'l8PMl7tUDIE',
  'ndtv': 'bjYzJfjD7WE',
};

// Helper function to normalize channel handle for lookup
export function normalizeChannelHandle(handle: string | null | undefined): string {
  return (handle || '').toLowerCase().trim();
}

// Get verified channel data (returns null if not verified)
export function getVerifiedChannel(channelId: string | null | undefined): { liveId: string; fallbackId: string; name: string } | null {
  const normalized = normalizeChannelHandle(channelId);
  return VERIFIED_CHANNELS[normalized] || null;
}

// Get static live ID (returns null if not found)
export function getStaticLiveId(channelId: string | null | undefined): string | null {
  const normalized = normalizeChannelHandle(channelId);
  return STATIC_LIVE_IDS[normalized] || null;
}

// Get fallback video ID (returns null if not found)
export function getFallbackVideoId(channelId: string | null | undefined): string | null {
  const normalized = normalizeChannelHandle(channelId);
  return FALLBACK_VIDEO_IDS[normalized] || null;
}
