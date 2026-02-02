const CACHE_KEY = 'openBentoVideoIdCache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedVideoId {
  videoId: string;
  channelId: string;
  timestamp: number;
}

interface VideoCache {
  [channelId: string]: CachedVideoId;
}

function getCache(): VideoCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: VideoCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[VideoCache] Failed to save cache:', e);
  }
}

export function getCachedVideoId(channelId: string): string | null {
  const cache = getCache();
  const entry = cache[channelId];
  
  if (!entry) {
    console.log(`[VideoCache] No cache for channel: ${channelId}`);
    return null;
  }
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_EXPIRY_MS) {
    console.log(`[VideoCache] Cache expired for channel: ${channelId} (age: ${Math.round(age / 3600000)}h)`);
    return null;
  }
  
  console.log(`[VideoCache] Using cached videoId for ${channelId}: ${entry.videoId} (age: ${Math.round(age / 60000)}min)`);
  return entry.videoId;
}

export function setCachedVideoId(channelId: string, videoId: string): void {
  const cache = getCache();
  cache[channelId] = {
    videoId,
    channelId,
    timestamp: Date.now()
  };
  saveCache(cache);
  console.log(`[VideoCache] Cached videoId for ${channelId}: ${videoId}`);
}

export function clearCachedVideoId(channelId: string): void {
  const cache = getCache();
  if (cache[channelId]) {
    delete cache[channelId];
    saveCache(cache);
    console.log(`[VideoCache] Cleared cache for channel: ${channelId}`);
  }
}

export function clearAllCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log('[VideoCache] Cleared all cached videoIds');
}

export async function fetchFreshVideoId(channelId: string): Promise<string | null> {
  try {
    console.log(`[VideoCache] Fetching fresh videoId for channel: ${channelId}`);
    const response = await fetch(`/api/live-video?channelId=${encodeURIComponent(channelId)}`);
    
    if (!response.ok) {
      console.error(`[VideoCache] Failed to fetch: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.videoId) {
      setCachedVideoId(channelId, data.videoId);
      return data.videoId;
    }
    
    console.log(`[VideoCache] No live video found for channel: ${channelId}`);
    return null;
  } catch (e) {
    console.error('[VideoCache] Fetch error:', e);
    return null;
  }
}

export async function getVideoIdWithCache(channelId: string): Promise<string | null> {
  const cached = getCachedVideoId(channelId);
  if (cached) {
    return cached;
  }
  
  return fetchFreshVideoId(channelId);
}

export async function refetchVideoId(channelId: string): Promise<string | null> {
  clearCachedVideoId(channelId);
  return fetchFreshVideoId(channelId);
}
