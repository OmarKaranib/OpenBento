import { buildApiHeaders } from './api-auth';
import { supabase } from './supabase';

const API_BASE = '';

async function getLibraryHeaders(hasJsonBody = false): Promise<Record<string, string>> {
  const { data: { session } } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };

  return buildApiHeaders(hasJsonBody, session?.access_token);
}

export interface StreamStatus {
  channelName: string;
  platform: string;
  currentVideoId: string | null;
  isLive: boolean;
  isHealthy: boolean;
  lastChecked: Date;
  errorCode?: string;
}

export interface HealResult {
  success: boolean;
  newVideoId?: string;
  reason?: string;
}

export interface LibraryItem {
  id: string;
  userId: string;
  name: string;
  url: string;
  platform: string;
  channelId?: string | null;
  videoId?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  isLive?: boolean | null;
  customColor?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

let cachedStreamStatus: { [channelId: string]: StreamStatus } = {};
let lastFetch: number = 0;
const CACHE_TTL_MS = 30000;

// Smart localStorage cache for YouTube live status with tiered TTLs
const LIVE_STATUS_CACHE_KEY = 'openbento_live_status_cache';
const CACHE_VERSION_KEY = 'openbento_cache_version';
const CURRENT_CACHE_VERSION = '2.4.0'; // Increment to force cache flush - quota optimization (videos.list 1 unit)
const ONLINE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for LIVE streams
const OFFLINE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for offline streams (faster re-check)
const API_ERROR_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for API errors (retry soon)

interface CachedLiveStatus {
  isLive: boolean;
  liveVideoId: string | null;
  title: string | null;
  timestamp: number;
  apiError?: boolean; // True if this was cached due to API error (403, etc.)
}

interface LiveStatusCache {
  [channelId: string]: CachedLiveStatus;
}

// One-time cache flush on version mismatch (forces new API key usage)
function checkAndFlushCacheVersion(): void {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CURRENT_CACHE_VERSION) {
      console.log('[StreamAPI] Cache version mismatch, flushing old cache...');
      localStorage.removeItem(LIVE_STATUS_CACHE_KEY);
      localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    }
  } catch {
    // ignore
  }
}

// Run immediately on module load
checkAndFlushCacheVersion();

function getLiveStatusCache(): LiveStatusCache {
  try {
    const cached = localStorage.getItem(LIVE_STATUS_CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached);
  } catch {
    return {};
  }
}

function setLiveStatusCache(cache: LiveStatusCache): void {
  try {
    localStorage.setItem(LIVE_STATUS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

function getCachedLiveStatus(channelId: string): CachedLiveStatus | null {
  const cache = getLiveStatusCache();
  const entry = cache[channelId];
  if (!entry) return null;
  
  const now = Date.now();
  const age = now - entry.timestamp;
  
  // Smart TTL based on status:
  // - API errors: 2 min TTL (retry soon)
  // - Offline: 5 min TTL (check more often for going live)
  // - Online: 30 min TTL (stable, no need to re-check often)
  let ttl = ONLINE_CACHE_TTL_MS;
  if (entry.apiError) {
    ttl = API_ERROR_CACHE_TTL_MS;
  } else if (!entry.isLive) {
    ttl = OFFLINE_CACHE_TTL_MS;
  }
  
  if (age > ttl) {
    // Cache expired
    return null;
  }
  
  return entry;
}

function setCachedLiveStatus(channelId: string, status: Omit<CachedLiveStatus, 'timestamp'>, apiError: boolean = false): void {
  const cache = getLiveStatusCache();
  cache[channelId] = {
    ...status,
    apiError,
    timestamp: Date.now(),
  };
  setLiveStatusCache(cache);
}

export function clearLiveStatusCache(): void {
  try {
    localStorage.removeItem(LIVE_STATUS_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function fetchGlobalStreamStatus(): Promise<{ [channelId: string]: StreamStatus }> {
  const now = Date.now();
  
  if (now - lastFetch < CACHE_TTL_MS && Object.keys(cachedStreamStatus).length > 0) {
    return cachedStreamStatus;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/stream-status`);
    if (!response.ok) throw new Error('Failed to fetch stream status');
    
    const data = await response.json();
    cachedStreamStatus = data.status || {};
    lastFetch = now;
    return cachedStreamStatus;
  } catch (error) {
    console.error('[StreamAPI] Failed to fetch global status:', error);
    return cachedStreamStatus;
  }
}

export function getCachedStreamStatus(channelId: string): StreamStatus | null {
  return cachedStreamStatus[channelId] || null;
}

export async function requestStreamHeal(
  channelId: string,
  channelName: string,
  currentVideoId?: string
): Promise<HealResult> {
  try {
    const response = await fetch(`${API_BASE}/api/stream/heal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, channelName, currentVideoId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, reason: error.error || 'Request failed' };
    }
    
    return await response.json();
  } catch (error) {
    console.error('[StreamAPI] Heal request failed:', error);
    return { success: false, reason: String(error) };
  }
}

export async function validateVideo(videoId: string): Promise<{
  valid: boolean;
  reason?: string;
  channelId?: string;
  isLive?: boolean;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/stream/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('[StreamAPI] Validate failed:', error);
    return { valid: true, reason: 'Validation unavailable' };
  }
}

export async function fetchUserLibrary(): Promise<LibraryItem[] | null> {
  try {
    const response = await fetch(`${API_BASE}/api/library`, {
      headers: await getLibraryHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error('Failed to fetch library');
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('[StreamAPI] Fetch library failed:', error);
    return null;
  }
}

export async function addToLibrary(item: Omit<LibraryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<LibraryItem | null> {
  try {
    const response = await fetch(`${API_BASE}/api/library`, {
      method: 'POST',
      headers: await getLibraryHeaders(true),
      credentials: 'include',
      body: JSON.stringify(item),
    });
    
    if (!response.ok) throw new Error('Failed to add to library');
    
    const data = await response.json();
    return data.item;
  } catch (error) {
    console.error('[StreamAPI] Add to library failed:', error);
    return null;
  }
}

export async function removeFromLibrary(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/library/${id}`, {
      method: 'DELETE',
      headers: await getLibraryHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) return false;
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[StreamAPI] Remove from library failed:', error);
    return false;
  }
}

export async function updateLibraryItem(id: string, updates: Partial<LibraryItem>): Promise<LibraryItem | null> {
  try {
    const response = await fetch(`${API_BASE}/api/library/${id}`, {
      method: 'PATCH',
      headers: await getLibraryHeaders(true),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) throw new Error('Failed to update library item');
    
    const data = await response.json();
    return data.item;
  } catch (error) {
    console.error('[StreamAPI] Update library item failed:', error);
    return null;
  }
}

// True Live Filter: Check if a YouTube video is currently live
export async function checkVideoLiveStatus(videoId: string): Promise<{
  isLive: boolean;
  liveBroadcastContent: string | null;
  apiError?: boolean;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/youtube/video-live/${videoId}`);
    if (!response.ok) {
      // API error - return apiError so client shows "System Maintenance" not "Offline"
      return { isLive: false, liveBroadcastContent: null, apiError: true };
    }
    const data = await response.json();
    return {
      isLive: data.isLive ?? false,
      liveBroadcastContent: data.liveBroadcastContent ?? null,
      apiError: data.apiError === true,
    };
  } catch (error) {
    console.error('[StreamAPI] Video live check failed:', error);
    return { isLive: false, liveBroadcastContent: null, apiError: true };
  }
}

// True Live Filter: Check if a YouTube channel is currently live (with smart tiered cache)
export async function checkChannelLiveStatus(channelId: string, forceRefresh: boolean = false): Promise<{
  isLive: boolean;
  liveVideoId: string | null;
  title: string | null;
  fromCache?: boolean;
  apiError?: boolean; // True if API returned 403/error - show "System Maintenance" instead of "Offline"
}> {
  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cached = getCachedLiveStatus(channelId);
    if (cached) {
      console.log(`[StreamAPI] Cache HIT for ${channelId}: isLive=${cached.isLive}, apiError=${cached.apiError}`);
      return {
        isLive: cached.isLive,
        liveVideoId: cached.liveVideoId,
        title: cached.title,
        fromCache: true,
        apiError: cached.apiError,
      };
    }
  }
  
  console.log(`[StreamAPI] Cache MISS for ${channelId}, fetching from API...`);
  
  try {
    const response = await fetch(`${API_BASE}/api/youtube/channel-live/${channelId}`);
    if (!response.ok) {
      // On API error (403, etc.), mark as API error - NOT genuine offline
      console.warn(`[StreamAPI] API error for ${channelId}: ${response.status}`);
      setCachedLiveStatus(channelId, { isLive: false, liveVideoId: null, title: null }, true);
      return { isLive: false, liveVideoId: null, title: null, fromCache: false, apiError: true };
    }
    const data = await response.json();
    
    // TRUST THE VIDEOID: If API returns a videoId, the stream is LIVE - no further validation
    const hasVideoId = !!data.liveVideoId;
    
    const result = {
      isLive: hasVideoId ? true : (data.isLive ?? false),
      liveVideoId: data.liveVideoId ?? null,
      title: data.title ?? null,
    };
    
    // Cache the result
    setCachedLiveStatus(channelId, result, false);
    
    return { ...result, fromCache: false, apiError: false };
  } catch (error) {
    console.error('[StreamAPI] Channel live check failed:', error);
    // Cache as API error on exception
    setCachedLiveStatus(channelId, { isLive: false, liveVideoId: null, title: null }, true);
    return { isLive: false, liveVideoId: null, title: null, fromCache: false, apiError: true };
  }
}

// Search for current live stream by channel handle - returns new live video ID (with smart tiered cache)
// LATEST-VIDEO FALLBACK: Also returns latestVideoId when channel is not live
export async function searchChannelLiveStream(channelHandle: string, forceRefresh: boolean = false): Promise<{
  isLive: boolean;
  liveVideoId: string | null;
  latestVideoId: string | null; // LATEST-VIDEO FALLBACK: Returns latest video when not live
  channelId: string | null;
  title: string | null;
  fromCache?: boolean;
  apiError?: boolean; // True if API returned 403/error - show "System Maintenance" instead of "Offline"
}> {
  // Check cache first unless force refresh (use handle as cache key)
  const cacheKey = `handle_${channelHandle}`;
  if (!forceRefresh) {
    const cached = getCachedLiveStatus(cacheKey);
    if (cached) {
      console.log(`[StreamAPI] Cache HIT for handle ${channelHandle}: isLive=${cached.isLive}, apiError=${cached.apiError}`);
      return {
        isLive: cached.isLive,
        liveVideoId: cached.liveVideoId,
        latestVideoId: null, // Cache doesn't store latestVideoId
        channelId: null,
        title: cached.title,
        fromCache: true,
        apiError: cached.apiError,
      };
    }
  }
  
  console.log(`[StreamAPI] Cache MISS for handle ${channelHandle}, fetching from API...`);
  
  try {
    const response = await fetch(`${API_BASE}/api/youtube/search-live/${encodeURIComponent(channelHandle)}`);
    if (!response.ok) {
      // On API error (403, etc.), mark as API error - NOT genuine offline
      console.warn(`[StreamAPI] API error for handle ${channelHandle}: ${response.status}`);
      setCachedLiveStatus(cacheKey, { isLive: false, liveVideoId: null, title: null }, true);
      return { isLive: false, liveVideoId: null, latestVideoId: null, channelId: null, title: null, fromCache: false, apiError: true };
    }
    const data = await response.json();
    
    // TRUST THE VIDEOID: If API returns a videoId, the stream is LIVE - no further validation
    const hasVideoId = !!data.liveVideoId;
    
    const result = {
      isLive: hasVideoId ? true : (data.isLive ?? false),
      liveVideoId: data.liveVideoId ?? null,
      latestVideoId: data.latestVideoId ?? null, // LATEST-VIDEO FALLBACK
      channelId: data.channelId ?? null,
      title: data.title ?? null,
    };
    
    // Cache the result
    setCachedLiveStatus(cacheKey, { isLive: result.isLive, liveVideoId: result.liveVideoId, title: result.title }, false);
    
    return { ...result, fromCache: false, apiError: false };
  } catch (error) {
    console.error('[StreamAPI] Search channel live stream failed:', error);
    // Cache as API error on exception
    setCachedLiveStatus(cacheKey, { isLive: false, liveVideoId: null, title: null }, true);
    return { isLive: false, liveVideoId: null, latestVideoId: null, channelId: null, title: null, fromCache: false, apiError: true };
  }
}
