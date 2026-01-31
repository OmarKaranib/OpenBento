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
  iconType: 'news' | 'science' | 'music' | 'finance' | 'gaming';
  category: string;
}

export interface LinksData {
  channels: LiveChannel[];
  lastRefresh: number;
}

const LINKS_FILE_PATH = path.join(process.cwd(), 'server', 'data', 'links.json');

const YOUTUBE_CHANNELS: Omit<LiveChannel, 'videoId' | 'lastUpdated'>[] = [
  { id: 'nasa-live', name: 'NASA Live', channelHandle: 'NASA', platform: 'youtube', iconType: 'science', category: 'Science' },
  { id: 'lofi-girl', name: 'Lofi Girl', channelHandle: 'LofiGirl', platform: 'youtube', iconType: 'music', category: 'Music' },
  { id: 'sky-news', name: 'Sky News', channelHandle: 'skynews', platform: 'youtube', iconType: 'news', category: 'News' },
  { id: 'abc-news', name: 'ABC News', channelHandle: 'ABCNews', platform: 'youtube', iconType: 'news', category: 'News' },
];

const STATIC_CHANNELS: LiveChannel[] = [
  { id: 'twitch-esl', name: 'ESL CS:GO', channelHandle: 'esl_csgo', videoId: null, lastUpdated: Date.now(), platform: 'twitch', iconType: 'gaming', category: 'Esports' },
  { id: 'twitch-rocket', name: 'Rocket League', channelHandle: 'rocketleague', videoId: null, lastUpdated: Date.now(), platform: 'twitch', iconType: 'gaming', category: 'Esports' },
  { id: 'twitch-gaules', name: 'Gaules', channelHandle: 'gaules', videoId: null, lastUpdated: Date.now(), platform: 'twitch', iconType: 'gaming', category: 'Gaming' },
  { id: 'kick-xqc', name: 'xQc', channelHandle: 'xqc', videoId: null, lastUpdated: Date.now(), platform: 'kick', iconType: 'gaming', category: 'Gaming' },
  { id: 'kick-adin', name: 'Adin Ross', channelHandle: 'adinross', videoId: null, lastUpdated: Date.now(), platform: 'kick', iconType: 'gaming', category: 'Gaming' },
];

async function fetchYouTubeLiveVideoId(channelHandle: string): Promise<string | null> {
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
      return null;
    }

    const html = await response.text();
    
    const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (videoIdMatch && videoIdMatch[1]) {
      log(`[LinkRefresher] Found video ID for @${channelHandle}: ${videoIdMatch[1]}`);
      return videoIdMatch[1];
    }

    const canonicalMatch = html.match(/href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
    if (canonicalMatch && canonicalMatch[1]) {
      log(`[LinkRefresher] Found canonical video ID for @${channelHandle}: ${canonicalMatch[1]}`);
      return canonicalMatch[1];
    }

    log(`[LinkRefresher] No live stream found for @${channelHandle}`);
    return null;
  } catch (error) {
    log(`[LinkRefresher] Error fetching @${channelHandle}: ${error}`);
    return null;
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
  
  const channels: LiveChannel[] = [];
  const now = Date.now();

  for (const channel of YOUTUBE_CHANNELS) {
    const videoId = await fetchYouTubeLiveVideoId(channel.channelHandle);
    channels.push({
      ...channel,
      videoId,
      lastUpdated: now,
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  channels.push(...STATIC_CHANNELS.map(ch => ({ ...ch, lastUpdated: now })));

  const data: LinksData = {
    channels,
    lastRefresh: now,
  };

  saveLinks(data);
  log(`[LinkRefresher] Refresh complete. Updated ${channels.length} channels.`);
  
  return data;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function startLinkRefresher(): void {
  log('[LinkRefresher] Starting background link refresher (24h interval)');
  
  const existingData = loadLinks();
  const timeSinceLastRefresh = Date.now() - existingData.lastRefresh;
  
  if (existingData.channels.length === 0 || timeSinceLastRefresh > TWENTY_FOUR_HOURS_MS) {
    log('[LinkRefresher] Running initial refresh...');
    refreshAllLinks().catch(err => log(`[LinkRefresher] Initial refresh error: ${err}`));
  } else {
    log(`[LinkRefresher] Using cached links (last refresh: ${new Date(existingData.lastRefresh).toISOString()})`);
  }

  setInterval(() => {
    log('[LinkRefresher] Running scheduled 24h refresh...');
    refreshAllLinks().catch(err => log(`[LinkRefresher] Scheduled refresh error: ${err}`));
  }, TWENTY_FOUR_HOURS_MS);
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

  if (channel.platform === 'youtube' && channel.videoId) {
    return `https://www.youtube-nocookie.com/embed/${channel.videoId}?autoplay=1&mute=1&origin=${encodeURIComponent(safeOrigin)}&parent=${encodeURIComponent(safeHostname)}`;
  } else if (channel.platform === 'youtube' && !channel.videoId) {
    return `https://www.youtube-nocookie.com/embed/live_stream?channel=${channel.channelHandle}&autoplay=1&mute=1&origin=${encodeURIComponent(safeOrigin)}&parent=${encodeURIComponent(safeHostname)}`;
  } else if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.channelHandle}`;
  } else if (channel.platform === 'kick') {
    return `https://kick.com/${channel.channelHandle}`;
  }
  return '';
}
