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
): Promise<{ isHealthy: boolean; errorCode?: string; isLive?: boolean }> {
  const details = await getVideoDetails(videoId, apiKey);
  
  if (!details) {
    return { isHealthy: false, errorCode: 'notFound' };
  }
  
  if (!details.isEmbeddable) {
    return { isHealthy: false, errorCode: 'notEmbeddable' };
  }
  
  // FALSE OFFLINE FIX: Stream is LIVE unless liveBroadcastContent is explicitly 'none'
  // This catches 'live' and 'upcoming' as online
  const isLive = details.liveBroadcastContent !== 'none';
  
  return { isHealthy: true, isLive };
}

// QUOTA OPTIMIZATION: Use videos.list (1 unit) instead of search.list (100 units)
// Requires a known videoId - verifies if that specific video is currently live
export async function checkVideoLiveStatusById(
  videoId: string,
  apiKey: string
): Promise<{ isLive: boolean; liveVideoId: string | null; title: string | null; apiError?: boolean }> {
  // Use YouTube Videos API (1 unit) instead of Search API (100 units)
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,status&id=${videoId}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[YouTube API] Video status check failed:', response.status);
      return { isLive: false, liveVideoId: null, title: null, apiError: true };
    }
    
    const data = await response.json();
    const video = data.items?.[0];
    
    if (!video) {
      // Video not found - may have ended
      return { isLive: false, liveVideoId: null, title: null, apiError: false };
    }
    
    // FALSE OFFLINE FIX: Stream is LIVE unless liveBroadcastContent is explicitly 'none'
    const liveBroadcastContent = video.snippet?.liveBroadcastContent;
    const isLive = liveBroadcastContent !== 'none';
    
    return {
      isLive,
      liveVideoId: isLive ? videoId : null,
      title: video.snippet?.title ?? null,
      apiError: false,
    };
  } catch (error) {
    console.error('[YouTube API] Video status check error:', error);
    return { isLive: false, liveVideoId: null, title: null, apiError: true };
  }
}

// DEPRECATED: Search-based channel live check - costs 100 units per call
// Only used as fallback when no videoId is available (should be rare)
export async function checkChannelLiveStatus(
  channelId: string,
  apiKey: string
): Promise<{ isLive: boolean; liveVideoId: string | null; title: string | null; apiError?: boolean }> {
  console.warn('[YouTube API] Using expensive search.list (100 units) - should have videoId for videos.list (1 unit)');
  // Use YouTube Search API with channelId and eventType=live
  const url = `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&eventType=live&maxResults=1&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[YouTube API] Channel live check failed:', response.status);
      // Return apiError=true so client knows this was an API failure, not genuinely offline
      return { isLive: false, liveVideoId: null, title: null, apiError: true };
    }
    
    const data = await response.json();
    const items = data.items || [];
    
    if (items.length === 0) {
      // No active live broadcasts for this channel - genuinely offline
      return { isLive: false, liveVideoId: null, title: null, apiError: false };
    }
    
    // eventType=live returns ONLY live streams - if we get a result, it's LIVE
    const liveItem = items[0];
    return {
      isLive: true,
      liveVideoId: liveItem.id.videoId,
      title: liveItem.snippet.title,
      apiError: false,
    };
  } catch (error) {
    console.error('[YouTube API] Channel live check error:', error);
    return { isLive: false, liveVideoId: null, title: null, apiError: true };
  }
}

// Verify if a specific video is currently a live broadcast
// FALSE OFFLINE FIX: Consider stream ONLINE unless liveBroadcastContent is explicitly 'none'
// liveBroadcastContent values: 'live' (currently live), 'upcoming' (scheduled), 'none' (not live)
export async function verifyVideoIsLive(
  videoId: string,
  apiKey: string
): Promise<{ isLive: boolean; liveBroadcastContent: string | null; apiError?: boolean }> {
  const details = await getVideoDetails(videoId, apiKey);
  
  if (!details) {
    // API failed - return apiError so client shows "System Maintenance" not "Offline"
    return { isLive: false, liveBroadcastContent: null, apiError: true };
  }
  
  // FALSE OFFLINE FIX: Stream is LIVE unless liveBroadcastContent is explicitly 'none'
  // This catches 'live' and 'upcoming' as online
  const isLive = details.liveBroadcastContent !== 'none';
  
  return {
    isLive,
    liveBroadcastContent: details.liveBroadcastContent,
    apiError: false,
  };
}

// Resolve YouTube channel handle/username to channel ID
export async function resolveChannelHandle(
  handle: string,
  apiKey: string
): Promise<string | null> {
  // Resolve a handle directly. channels.list costs one normal quota unit;
  // using search.list here would waste a limited search call before the
  // separate live-stream search even begins.
  const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const url = `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(normalizedHandle)}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[YouTube API] Direct channel handle resolution failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const items = data.items || [];
    
    if (items.length === 0) {
      return null;
    }
    
    return typeof items[0]?.id === 'string' ? items[0].id : null;
  } catch (error) {
    console.error('[YouTube API] Channel handle resolution error:', error);
    return null;
  }
}

// LATEST-VIDEO FALLBACK: Get the most recent video from a channel's uploads playlist
// Uses playlistItems.list (1 unit) - much cheaper than search.list (100 units)
export async function getLatestVideoId(
  channelId: string,
  apiKey: string
): Promise<{ videoId: string | null; title: string | null; apiError?: boolean }> {
  // First, get the channel's uploads playlist ID (derived from channelId: UC... -> UU...)
  // YouTube uploads playlist ID is always channelId with first 'UC' replaced by 'UU'
  const uploadsPlaylistId = channelId.replace(/^UC/, 'UU');
  
  // Fetch the most recent video from the uploads playlist (1 quota unit)
  const url = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[YouTube API] Uploads playlist fetch failed:', response.status);
      return { videoId: null, title: null, apiError: true };
    }
    
    const data = await response.json();
    const items = data.items || [];
    
    if (items.length === 0) {
      console.log('[YouTube API] No videos in uploads playlist');
      return { videoId: null, title: null, apiError: false };
    }
    
    const latestVideo = items[0];
    const videoId = latestVideo.snippet?.resourceId?.videoId;
    const title = latestVideo.snippet?.title;
    
    console.log(`[YouTube API] Latest video fallback: ${videoId} - "${title}"`);
    return { videoId, title, apiError: false };
  } catch (error) {
    console.error('[YouTube API] Uploads playlist fetch error:', error);
    return { videoId: null, title: null, apiError: true };
  }
}

// Search for current live stream by channel handle/username - returns new live video ID
// LATEST-VIDEO FALLBACK: If no live stream, returns latestVideoId from uploads playlist
export async function searchChannelLiveStream(
  channelHandle: string,
  apiKey: string
): Promise<{ isLive: boolean; liveVideoId: string | null; latestVideoId: string | null; channelId: string | null; title: string | null; apiError?: boolean }> {
  console.log(`[YouTube API] Searching live stream for channel handle: ${channelHandle}`);
  
  // First resolve the channel handle to a channel ID
  const channelId = await resolveChannelHandle(channelHandle, apiKey);
  
  if (!channelId) {
    console.log(`[YouTube API] Could not resolve channel handle: ${channelHandle}`);
    // Could not resolve handle - this is an API error, not genuinely offline
    return { isLive: false, liveVideoId: null, latestVideoId: null, channelId: null, title: null, apiError: true };
  }
  
  console.log(`[YouTube API] Resolved ${channelHandle} -> channelId: ${channelId}`);
  
  // Now search for live streams from this channel
  const liveResult = await checkChannelLiveStatus(channelId, apiKey);
  
  // LATEST-VIDEO FALLBACK: If no live stream found, get the latest video instead
  // This ensures users see actual content instead of "Video Unavailable"
  let latestVideoId: string | null = null;
  if (!liveResult.isLive && !liveResult.apiError) {
    console.log(`[YouTube API] No live stream for ${channelHandle}, fetching latest video fallback...`);
    const latestResult = await getLatestVideoId(channelId, apiKey);
    if (latestResult.videoId) {
      latestVideoId = latestResult.videoId;
      console.log(`[YouTube API] Using latest video fallback: ${latestVideoId}`);
    }
  }
  
  return {
    ...liveResult,
    latestVideoId,
    channelId,
  };
}
