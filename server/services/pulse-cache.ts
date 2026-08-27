import { db } from '../db';
import { streamStatusCache } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import { checkStreamHealth, healStream } from './youtube-api';
import { PULSE_INTERVAL_MS, TOP_CHANNELS_LIMIT } from './pulse-policy';

interface GlobalStreamStatus {
  [channelId: string]: {
    channelName: string;
    platform: string;
    currentVideoId: string | null;
    isLive: boolean;
    isHealthy: boolean;
    lastChecked: Date;
    errorCode?: string;
  };
}

let globalStreamStatus: GlobalStreamStatus = {};
let pulseInterval: NodeJS.Timeout | null = null;

export function getGlobalStreamStatus(): GlobalStreamStatus {
  return globalStreamStatus;
}

export function getStreamStatus(channelId: string) {
  return globalStreamStatus[channelId] || null;
}

async function loadCacheFromDatabase(): Promise<void> {
  try {
    const cached = await db.select()
      .from(streamStatusCache)
      .orderBy(desc(streamStatusCache.lastChecked))
      .limit(TOP_CHANNELS_LIMIT);
    
    for (const entry of cached) {
      globalStreamStatus[entry.channelId] = {
        channelName: entry.channelName,
        platform: entry.platform,
        currentVideoId: entry.currentVideoId,
        isLive: entry.isLive ?? false,
        isHealthy: entry.isHealthy ?? true,
        lastChecked: entry.lastChecked ?? new Date(),
        errorCode: entry.errorCode ?? undefined,
      };
    }
    
    console.log(`[PulseCache] Loaded ${cached.length} channels from database`);
  } catch (error) {
    console.error('[PulseCache] Failed to load cache from database:', error);
  }
}

async function updateCacheEntry(
  channelId: string,
  updates: Partial<GlobalStreamStatus[string]>
): Promise<void> {
  if (globalStreamStatus[channelId]) {
    globalStreamStatus[channelId] = {
      ...globalStreamStatus[channelId],
      ...updates,
      lastChecked: new Date(),
    };
  }
  
  try {
    await db.update(streamStatusCache)
      .set({
        ...updates,
        lastChecked: new Date(),
      })
      .where(eq(streamStatusCache.channelId, channelId));
  } catch (error) {
    console.error(`[PulseCache] Failed to update cache for ${channelId}:`, error);
  }
}

async function runPulseCheck(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    console.warn('[PulseCache] No YouTube API key configured - skipping pulse check');
    return;
  }
  
  console.log('[PulseCache] Starting pulse check...');
  const channelIds = Object.keys(globalStreamStatus);
  
  for (const channelId of channelIds) {
    const status = globalStreamStatus[channelId];
    
    if (status.platform !== 'youtube' || !status.currentVideoId) {
      continue;
    }
    
    const health = await checkStreamHealth(status.currentVideoId, apiKey);

    if (health.apiError) {
      console.warn(`[PulseCache] YouTube check failed for ${status.channelName}; keeping the last known stream`);
      continue;
    }
    
    // True Live Filter: Check if video is actually live
    const isVideoLive = health.isLive ?? false;
    
    if (!health.isHealthy) {
      console.log(`[PulseCache] Unhealthy stream detected: ${status.channelName}`);
      
      const healResult = await healStream(status.channelName, channelId, apiKey);
      
      if (healResult.success && healResult.newVideoId) {
        await updateCacheEntry(channelId, {
          currentVideoId: healResult.newVideoId,
          isHealthy: true,
          isLive: true,
          errorCode: undefined,
        });
        console.log(`[PulseCache] Healed ${status.channelName} with new videoId: ${healResult.newVideoId}`);
      } else {
        await updateCacheEntry(channelId, {
          isHealthy: false,
          isLive: false,
          errorCode: health.errorCode,
        });
      }
    } else if (!isVideoLive) {
      // Video exists but is not currently live
      console.log(`[PulseCache] Stream offline: ${status.channelName} (liveBroadcastContent is not 'live')`);
      await updateCacheEntry(channelId, { 
        isHealthy: true, 
        isLive: false, 
        errorCode: 'notLive' 
      });
    } else {
      await updateCacheEntry(channelId, { isHealthy: true, isLive: true, errorCode: undefined });
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('[PulseCache] Pulse check complete');
}

export async function initializePulseCache(): Promise<void> {
  console.log('[PulseCache] Initializing...');
  await loadCacheFromDatabase();
  
  pulseInterval = setInterval(runPulseCheck, PULSE_INTERVAL_MS);
  
  setTimeout(runPulseCheck, 5000);
}

export function stopPulseCache(): void {
  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
  }
}

export async function registerChannel(
  channelId: string,
  channelName: string,
  platform: string,
  videoId?: string
): Promise<void> {
  globalStreamStatus[channelId] = {
    channelName,
    platform,
    currentVideoId: videoId || null,
    isLive: true,
    isHealthy: true,
    lastChecked: new Date(),
  };
  
  try {
    const existing = await db.select()
      .from(streamStatusCache)
      .where(eq(streamStatusCache.channelId, channelId))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(streamStatusCache).values({
        channelId,
        channelName,
        platform,
        currentVideoId: videoId,
        isLive: true,
        isHealthy: true,
      });
    } else {
      await db.update(streamStatusCache)
        .set({ currentVideoId: videoId, lastChecked: new Date() })
        .where(eq(streamStatusCache.channelId, channelId));
    }
  } catch (error) {
    console.error(`[PulseCache] Failed to register channel ${channelId}:`, error);
  }
}
