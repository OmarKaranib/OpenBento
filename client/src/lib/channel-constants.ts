// VERIFIED_CHANNELS: Protected 24/7 Live IDs that API CANNOT overwrite
// These are manually verified, permanent stream IDs for major news networks
// Keyed by channelHandle (lowercase normalized) - API results are IGNORED for these channels
export const VERIFIED_CHANNELS: Record<string, { liveId: string; fallbackId: string; name: string }> = {
  'abcnews': { liveId: 'w_Ma8oQLmSM', fallbackId: 'iipR5yUp36o', name: 'ABC News' },
  'reuters': { liveId: 'NvKaVw0X3oU', fallbackId: '_Xh7Sst91yQ', name: 'Reuters' }, // Updated: verified open-embed fallback
  'skynews': { liveId: '9Auq9mYxFEe', fallbackId: '9Auq9mYxFEe', name: 'Sky News' }, // Updated: verified open-embed ID
};

// BLACKLISTED_VIDEO_IDS: Known restricted videos that should NOT be used as fallbacks
// If a video ID is in this list, skip it and show "Content Restricted" UI
export const BLACKLISTED_VIDEO_IDS: Set<string> = new Set([
  'siyW0GOBtbo', // Sky News - restricted
  'YDvsBbKfLPA', // Sky News - restricted
  'IEmqRjrIkF0', // Reuters - restricted
  // Add more known restricted IDs here as discovered
]);

// STATIC_LIVE_IDS: Secondary mapping for channels without VERIFIED status
// These are used when VERIFIED_CHANNELS doesn't have an entry
// Keyed by channelHandle (lowercase normalized)
// NOTE: Al Jazeera, CNN, Euronews REMOVED - they work dynamically without 150 errors
export const STATIC_LIVE_IDS: Record<string, string> = {
  'nasa': 'tz4THVd5rdI',
  'nasatelevision': '21X5lGlDOfg',
  'nbcnews': 'sVEGHdVRIoU',
  'msnbc': 'nlKwThfNggk',
  'lofigirl': 'jfKfPfyJRdk',
  'france24english': 'l8PMl7tUDIE',
  'ndtv': 'NvqKZHpKs-g',
};

// FALLBACK_VIDEO_IDS: Hardcoded Featured Video defaults when 150 errors occur and API fails
// These are each channel's most popular/featured video as ultimate fallback
// Keyed by channelHandle (lowercase normalized)
export const FALLBACK_VIDEO_IDS: Record<string, string> = {
  'abcnews': 'iipR5yUp36o',
  'reuters': '_Xh7Sst91yQ', // Updated: verified open-embed fallback
  'skynews': '9Auq9mYxFEe', // Updated: verified open-embed ID
  'nasa': 'xCrPD7tfcr0',
  'nbcnews': 'Xfzjnt6p5jU',
  'msnbc': 'B8AQJB9c3u8',
  'aljazeeraenglish': 'gCNeDWCI0vo',
  'france24english': 'l8PMl7tUDIE',
  'ndtv': 'bjYzJfjD7WE',
  'cnn': 'tP0awqtu3Ag', // CNN featured video
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

// Check if a video ID is blacklisted (known to be restricted)
export function isVideoBlacklisted(videoId: string | null | undefined): boolean {
  if (!videoId) return false;
  return BLACKLISTED_VIDEO_IDS.has(videoId);
}
