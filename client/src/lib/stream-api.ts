const API_BASE = '';

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
  channelId?: string;
  videoId?: string;
  logoUrl?: string;
  category?: string;
  isLive?: boolean;
  customColor?: string;
  createdAt?: string;
  updatedAt?: string;
}

let cachedStreamStatus: { [channelId: string]: StreamStatus } = {};
let lastFetch: number = 0;
const CACHE_TTL_MS = 30000;

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

export async function registerStreamChannel(
  channelId: string,
  channelName: string,
  platform: string,
  videoId?: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/stream/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, channelName, platform, videoId }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[StreamAPI] Register failed:', error);
    return false;
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

export async function fetchUserLibrary(): Promise<LibraryItem[]> {
  try {
    const response = await fetch(`${API_BASE}/api/library`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      if (response.status === 401) return [];
      throw new Error('Failed to fetch library');
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('[StreamAPI] Fetch library failed:', error);
    return [];
  }
}

export async function addToLibrary(item: Omit<LibraryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<LibraryItem | null> {
  try {
    const response = await fetch(`${API_BASE}/api/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      credentials: 'include',
    });
    
    return response.ok;
  } catch (error) {
    console.error('[StreamAPI] Remove from library failed:', error);
    return false;
  }
}

export async function updateLibraryItem(id: string, updates: Partial<LibraryItem>): Promise<LibraryItem | null> {
  try {
    const response = await fetch(`${API_BASE}/api/library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
