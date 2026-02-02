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
    return null;
  }
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_EXPIRY_MS) {
    return null;
  }
  
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
}

export function clearCachedVideoId(channelId: string): void {
  const cache = getCache();
  if (cache[channelId]) {
    delete cache[channelId];
    saveCache(cache);
  }
}

export function clearAllCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

export async function fetchFreshVideoId(channelId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/live-video?channelId=${encodeURIComponent(channelId)}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.videoId) {
      setCachedVideoId(channelId, data.videoId);
      return data.videoId;
    }
    
    return null;
  } catch {
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
