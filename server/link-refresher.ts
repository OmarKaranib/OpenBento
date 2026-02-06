import * as fs from 'fs';
import * as path from 'path';
import { log } from './index';

export interface LiveChannel {
  id: string;
  name: string;
  channelHandle: string;
  videoId: string | null;
  lastUpdated: number;
  platform: 'youtube' | 'twitch' | 'kick';
  iconType: 'news' | 'science' | 'finance' | 'gaming';
  category: string;
  isLive: boolean; // True for live streams (refresh every 10 min), false for normal videos (no refresh)
  isManualOverride?: boolean; // Admin locked - skip during background scrape
}

export interface LinksData {
  channels: LiveChannel[];
  lastRefresh: number;
}

const LINKS_FILE_PATH = path.join(process.cwd(), 'server', 'data', 'links.json');


interface YouTubeFetchResult {
  videoId: string | null;
  isLive: boolean;
}

async function fetchYouTubeLiveVideoId(channelHandle: string): Promise<YouTubeFetchResult> {
  try {
    const liveUrl = `https://www.youtube.com/@${channelHandle}/live`;
    log(`[LinkRefresher] Fetching live stream for @${channelHandle}...`);
    
    const response = await fetch(liveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      log(`[LinkRefresher] Failed to fetch @${channelHandle}: ${response.status}`);
      return { videoId: null, isLive: false };
    }

    const html = await response.text();
    
    // Check if this is an active live broadcast using liveBroadcastContent marker
    const isLiveBroadcast = html.includes('"isLive":true') || 
                            html.includes('"liveBroadcastContent":"live"') ||
                            html.includes('"isLiveContent":true');
    
    const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (videoIdMatch && videoIdMatch[1]) {
      log(`[LinkRefresher] Found video ID for @${channelHandle}: ${videoIdMatch[1]} (isLive: ${isLiveBroadcast})`);
      return { videoId: videoIdMatch[1], isLive: isLiveBroadcast };
    }

    const canonicalMatch = html.match(/href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
    if (canonicalMatch && canonicalMatch[1]) {
      log(`[LinkRefresher] Found canonical video ID for @${channelHandle}: ${canonicalMatch[1]} (isLive: ${isLiveBroadcast})`);
      return { videoId: canonicalMatch[1], isLive: isLiveBroadcast };
    }

    log(`[LinkRefresher] No live stream found for @${channelHandle}`);
    return { videoId: null, isLive: false };
  } catch (error) {
    log(`[LinkRefresher] Error fetching @${channelHandle}: ${error}`);
    return { videoId: null, isLive: false };
  }
}

function ensureDataDirectory(): void {
  const dataDir = path.dirname(LINKS_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log('[LinkRefresher] Created data directory');
  }
}

export function loadLinks(): LinksData {
  try {
    ensureDataDirectory();
    if (fs.existsSync(LINKS_FILE_PATH)) {
      const data = fs.readFileSync(LINKS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`[LinkRefresher] Error loading links: ${error}`);
  }

  return {
    channels: [],
    lastRefresh: 0,
  };
}

function saveLinks(data: LinksData): void {
  try {
    ensureDataDirectory();
    fs.writeFileSync(LINKS_FILE_PATH, JSON.stringify(data, null, 2));
    log('[LinkRefresher] Links saved to disk');
  } catch (error) {
    log(`[LinkRefresher] Error saving links: ${error}`);
  }
}

export async function refreshAllLinks(): Promise<LinksData> {
  log('[LinkRefresher] Starting link refresh...');
  
  const existingData = loadLinks();
  const now = Date.now();
  const channels: LiveChannel[] = [];

  for (const channel of existingData.channels) {
    if (channel.isManualOverride) {
      channels.push({ ...channel, lastUpdated: now });
      log(`[LinkRefresher] SKIP manual override: ${channel.name}`);
      continue;
    }
    if (channel.platform === 'youtube' && channel.isLive) {
      const result = await fetchYouTubeLiveVideoId(channel.channelHandle);
      channels.push({
        ...channel,
        videoId: result.videoId || channel.videoId,
        isLive: result.isLive,
        lastUpdated: now,
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      channels.push({
        ...channel,
        lastUpdated: now,
      });
    }
  }

  const data: LinksData = {
    channels,
    lastRefresh: now,
  };

  saveLinks(data);
  log(`[LinkRefresher] Refresh complete. Updated ${channels.length} channels.`);
  
  return data;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function startLinkRefresher(): void {
  log('[LinkRefresher] Starting background link refresher (6h interval)');
  
  const existingData = loadLinks();
  const timeSinceLastRefresh = Date.now() - existingData.lastRefresh;
  
  if (existingData.channels.length === 0 || timeSinceLastRefresh > SIX_HOURS_MS) {
    log('[LinkRefresher] Running initial refresh...');
    refreshAllLinks().catch(err => log(`[LinkRefresher] Initial refresh error: ${err}`));
  } else {
    log(`[LinkRefresher] Using cached links (last refresh: ${new Date(existingData.lastRefresh).toISOString()})`);
  }

  setInterval(() => {
    log('[LinkRefresher] Running scheduled 6h refresh...');
    refreshAllLinks().catch(err => log(`[LinkRefresher] Scheduled refresh error: ${err}`));
  }, SIX_HOURS_MS);
}

export function getChannelUrl(channel: LiveChannel, origin: string): string {
  // Safely extract origin and hostname
  let safeOrigin = 'https://localhost';
  let safeHostname = 'localhost';
  
  try {
    const url = new URL(origin);
    safeOrigin = url.origin;
    safeHostname = url.hostname;
  } catch {
    // If origin parsing fails, try to extract hostname from the string
    const hostMatch = origin.match(/^https?:\/\/([^\/]+)/);
    if (hostMatch) {
      safeHostname = hostMatch[1];
      safeOrigin = `https://${safeHostname}`;
    }
  }

  if (channel.platform === 'youtube') {
    // If we have a videoId, use it directly in a watch URL (this allows extractYouTubeId to work)
    if (channel.videoId) {
      return `https://www.youtube.com/watch?v=${channel.videoId}`;
    }
    // Fallback to channel live URL
    return `https://www.youtube.com/@${channel.channelHandle}/live`;
  } else if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.channelHandle}`;
  } else if (channel.platform === 'kick') {
    return `https://kick.com/${channel.channelHandle}`;
  }
  return '';
}
