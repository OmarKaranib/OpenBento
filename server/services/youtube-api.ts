const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MUSIC_CATEGORY_ID = '10';

interface YouTubeSearchResult {
  videoId: string;
  channelId: string;
  title: string;
  categoryId?: string;
}

interface YouTubeVideoDetails {
  videoId: string;
  channelId: string;
  categoryId: string;
  liveBroadcastContent: string;
  isEmbeddable: boolean;
}

export async function searchLiveStream(
  channelName: string,
  apiKey: string
): Promise<YouTubeSearchResult[]> {
  const searchQuery = encodeURIComponent(`${channelName} Live`);
  const url = `${YOUTUBE_API_BASE}/search?part=snippet&q=${searchQuery}&type=video&eventType=live&maxResults=10&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[YouTube API] Search failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      videoId: item.id.videoId,
      channelId: item.snippet.channelId,
      title: item.snippet.title,
    }));
  } catch (error) {
    console.error('[YouTube API] Search error:', error);
    return [];
  }
}

export async function getVideoDetails(
  videoId: string,
  apiKey: string
): Promise<YouTubeVideoDetails | null> {
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,status,contentDetails&id=${videoId}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[YouTube API] Video details failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const video = data.items?.[0];
    
    if (!video) return null;
    
    return {
      videoId: video.id,
      channelId: video.snippet.channelId,
      categoryId: video.snippet.categoryId,
      liveBroadcastContent: video.snippet.liveBroadcastContent,
      isEmbeddable: video.status?.embeddable ?? false,
    };
  } catch (error) {
    console.error('[YouTube API] Video details error:', error);
    return null;
  }
}

export function isMusicCategory(categoryId: string): boolean {
  return categoryId === MUSIC_CATEGORY_ID;
}

export async function healStream(
  channelName: string,
  expectedChannelId: string,
  apiKey: string
): Promise<{ success: boolean; newVideoId?: string; reason?: string }> {
  console.log(`[Self-Healing] Starting healing for ${channelName} (channelId: ${expectedChannelId})`);
  
  const searchResults = await searchLiveStream(channelName, apiKey);
  
  if (searchResults.length === 0) {
    return { success: false, reason: 'No live streams found' };
  }
  
  for (const result of searchResults) {
    if (result.channelId !== expectedChannelId) {
      console.log(`[Self-Healing] Skipping ${result.videoId} - channel mismatch`);
      continue;
    }
    
    const details = await getVideoDetails(result.videoId, apiKey);
    
    if (!details) {
      console.log(`[Self-Healing] Skipping ${result.videoId} - no details`);
      continue;
    }
    
    if (isMusicCategory(details.categoryId)) {
      console.log(`[Self-Healing] Skipping ${result.videoId} - music category (Haram filter)`);
      continue;
    }
    
    if (!details.isEmbeddable) {
      console.log(`[Self-Healing] Skipping ${result.videoId} - not embeddable`);
      continue;
    }
    
    if (details.liveBroadcastContent !== 'live') {
      console.log(`[Self-Healing] Skipping ${result.videoId} - not currently live`);
      continue;
    }
    
    console.log(`[Self-Healing] Found valid stream: ${result.videoId}`);
    return { success: true, newVideoId: result.videoId };
  }
  
  return { success: false, reason: 'No valid streams found after filtering' };
}

export async function checkStreamHealth(
  videoId: string,
  apiKey: string
): Promise<{ isHealthy: boolean; errorCode?: string }> {
  const details = await getVideoDetails(videoId, apiKey);
  
  if (!details) {
    return { isHealthy: false, errorCode: 'notFound' };
  }
  
  if (!details.isEmbeddable) {
    return { isHealthy: false, errorCode: 'notEmbeddable' };
  }
  
  return { isHealthy: true };
}
