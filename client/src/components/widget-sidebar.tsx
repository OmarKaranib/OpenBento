import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Search, Tv, LayoutGrid, Grip, Newspaper, Rocket, TrendingUp, Layers, Layout, FileText, Square, Image as ImageIcon, Video, Upload, Gamepad2, RefreshCw, Star, Trash2, Globe, Heart, DollarSign, Zap } from 'lucide-react';
import { checkChannelLiveStatus as checkChannelLiveStatusAPI, searchChannelLiveStream as searchChannelLiveStreamAPI } from '@/lib/stream-api';

// Global cache for failed logo URLs - prevents retrying 404s
const failedLogoCache = new Set<string>();

// Channel logo URLs - Using Google Favicon API for reliable high-quality logos
// Maps channel ID to official website domain for best logo quality
const CHANNEL_LOGOS: Record<string, string> = {
  // News channels - Official website domains for high-quality favicons
  'sky-news': 'https://www.google.com/s2/favicons?domain=news.sky.com&sz=128',
  'abc-news': 'https://www.google.com/s2/favicons?domain=abcnews.go.com&sz=128',
  'nasa-live': 'https://www.google.com/s2/favicons?domain=nasa.gov&sz=128',
  'reuters-live': 'https://www.google.com/s2/favicons?domain=reuters.com&sz=128',
  'al-jazeera': 'https://www.google.com/s2/favicons?domain=aljazeera.com&sz=128',
  'france-24': 'https://www.google.com/s2/favicons?domain=france24.com&sz=128',
  'cnn-live': 'https://www.google.com/s2/favicons?domain=cnn.com&sz=128',
  'bbc-news': 'https://www.google.com/s2/favicons?domain=bbc.com&sz=128',
  'dw-news': 'https://www.google.com/s2/favicons?domain=dw.com&sz=128',
  'euronews': 'https://www.google.com/s2/favicons?domain=euronews.com&sz=128',
  'nbc-news': 'https://www.google.com/s2/favicons?domain=nbcnews.com&sz=128',
  'cbs-news': 'https://www.google.com/s2/favicons?domain=cbsnews.com&sz=128',
  'fox-news': 'https://www.google.com/s2/favicons?domain=foxnews.com&sz=128',
  'msnbc-live': 'https://www.google.com/s2/favicons?domain=msnbc.com&sz=128',
  'nhk-world': 'https://www.google.com/s2/favicons?domain=nhk.or.jp&sz=128',
  'cgtn-news': 'https://www.google.com/s2/favicons?domain=cgtn.com&sz=128',
  'arirang-news': 'https://www.google.com/s2/favicons?domain=arirang.com&sz=128',
  'abc-australia': 'https://www.google.com/s2/favicons?domain=abc.net.au&sz=128',
  'wion-news': 'https://www.google.com/s2/favicons?domain=wionews.com&sz=128',
  'india-today': 'https://www.google.com/s2/favicons?domain=indiatoday.in&sz=128',
  'ndtv-news': 'https://www.google.com/s2/favicons?domain=ndtv.com&sz=128',
  'times-now': 'https://www.google.com/s2/favicons?domain=timesnownews.com&sz=128',
  'trt-world': 'https://www.google.com/s2/favicons?domain=trtworld.com&sz=128',
  'cna-news': 'https://www.google.com/s2/favicons?domain=channelnewsasia.com&sz=128',
  'abc7-la': 'https://www.google.com/s2/favicons?domain=abc7.com&sz=128',
  'fox11-la': 'https://www.google.com/s2/favicons?domain=foxla.com&sz=128',
  'pbs-newshour': 'https://www.google.com/s2/favicons?domain=pbs.org&sz=128',
  'cbsn-live': 'https://www.google.com/s2/favicons?domain=cbsnews.com&sz=128',
  'newsy-live': 'https://www.google.com/s2/favicons?domain=newsy.com&sz=128',
  'livennow-fox': 'https://www.google.com/s2/favicons?domain=foxnews.com&sz=128',
  'court-tv': 'https://www.google.com/s2/favicons?domain=courttv.com&sz=128',
  'law-crime': 'https://www.google.com/s2/favicons?domain=lawandcrime.com&sz=128',
  'c-span': 'https://www.google.com/s2/favicons?domain=c-span.org&sz=128',
  'un-webtv': 'https://www.google.com/s2/favicons?domain=webtv.un.org&sz=128',
  'global-news': 'https://www.google.com/s2/favicons?domain=globalnews.ca&sz=128',
  'cp24-live': 'https://www.google.com/s2/favicons?domain=cp24.com&sz=128',
  'ctv-news': 'https://www.google.com/s2/favicons?domain=ctvnews.ca&sz=128',
  'cbc-news': 'https://www.google.com/s2/favicons?domain=cbc.ca&sz=128',
  'weather-channel': 'https://www.google.com/s2/favicons?domain=weather.com&sz=128',
  
  // Finance channels
  'bloomberg-live': 'https://www.google.com/s2/favicons?domain=bloomberg.com&sz=128',
  'cnbc-live': 'https://www.google.com/s2/favicons?domain=cnbc.com&sz=128',
  'yahoo-finance': 'https://www.google.com/s2/favicons?domain=finance.yahoo.com&sz=128',
  'cheddar-news': 'https://www.google.com/s2/favicons?domain=cheddar.com&sz=128',
  
  // Science & Space channels
  'iss-hd-earth': 'https://www.google.com/s2/favicons?domain=nasa.gov&sz=128',
  'space-videos': 'https://www.google.com/s2/favicons?domain=space.com&sz=128',
  'nasa-tv': 'https://www.google.com/s2/favicons?domain=nasa.gov&sz=128',
  'aquarium-live': 'https://www.google.com/s2/favicons?domain=montereybayaquarium.org&sz=128',
  'explore-africa': 'https://www.google.com/s2/favicons?domain=explore.org&sz=128',
  'explore-bears': 'https://www.google.com/s2/favicons?domain=explore.org&sz=128',
  'sea-otter-cam': 'https://www.google.com/s2/favicons?domain=montereybayaquarium.org&sz=128',
  'jellyfish-cam': 'https://www.google.com/s2/favicons?domain=montereybayaquarium.org&sz=128',
  'spacex-live': 'https://www.google.com/s2/favicons?domain=spacex.com&sz=128',
  
  // Live Cams
  'earth-cam-nyc': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-tokyo': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-paris': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-london': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-dubai': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  
  // Sports
  'nfl-network': 'https://www.google.com/s2/favicons?domain=nfl.com&sz=128',
  'nba-tv': 'https://www.google.com/s2/favicons?domain=nba.com&sz=128',
  'espn-live': 'https://www.google.com/s2/favicons?domain=espn.com&sz=128',
  'free-sports-tv': 'https://www.google.com/s2/favicons?domain=freesports.tv&sz=128',
  
  // Twitch - Esports & Gaming
  'twitch-esl': 'https://www.google.com/s2/favicons?domain=esl.com&sz=128',
  'twitch-rocketleague': 'https://www.google.com/s2/favicons?domain=rocketleague.com&sz=128',
  'twitch-valorant': 'https://www.google.com/s2/favicons?domain=playvalorant.com&sz=128',
  'twitch-lol': 'https://www.google.com/s2/favicons?domain=leagueoflegends.com&sz=128',
  'twitch-dota2': 'https://www.google.com/s2/favicons?domain=dota2.com&sz=128',
  'twitch-fortnite': 'https://www.google.com/s2/favicons?domain=fortnite.com&sz=128',
  'twitch-overwatch': 'https://www.google.com/s2/favicons?domain=overwatch.blizzard.com&sz=128',
  'twitch-cdl': 'https://www.google.com/s2/favicons?domain=callofdutyleague.com&sz=128',
  'twitch-pgl': 'https://www.google.com/s2/favicons?domain=pgl.gg&sz=128',
  'twitch-blast': 'https://www.google.com/s2/favicons?domain=blastpremier.com&sz=128',
  'twitch-chess': 'https://www.google.com/s2/favicons?domain=chess.com&sz=128',
  
  // Twitch - Streamers (use Twitch favicon)
  'twitch-gaules': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-pokimane': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-shroud': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-summit1g': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-timthetatman': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-nickmercs': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-drlupo': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-lirik': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-myth': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-xqc': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-hasanabi': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-ludwig': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-mizkif': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  'twitch-nmplol': 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=128',
  
  // Kick - Streamers
  'kick-xqc': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-adinross': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-trainwreckstv': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-amouranth': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-roshtein': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-destiny': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-nickeh30': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
  'kick-ice': 'https://www.google.com/s2/favicons?domain=kick.com&sz=128',
};
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WidgetType } from '@/App';
import { useQuery } from '@tanstack/react-query';

// Personal Library storage key
const PERSONAL_LIBRARY_KEY = 'openBentoPersonalLibrary';

// Blocked Channels storage key
const BLOCKED_CHANNELS_KEY = 'openBentoBlockedChannels';

// Saved channel type for Personal Library
export interface SavedChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'finance' | 'gaming' | 'default';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  verifiedLiveId?: string | null; // Static 24/7 embed ID for Zero-Gate Rendering
  latestVideoId?: string | null; // Fallback when live stream not available
  savedAt: number;
}

// Blocked channel type - preserves all channel data including logo info
export interface BlockedChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'finance' | 'gaming' | 'default';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  verifiedLiveId?: string | null; // Static 24/7 embed ID for Zero-Gate Rendering
  latestVideoId?: string | null; // Fallback when live stream not available
  blockedAt: number;
}

// Load personal library from localStorage
function loadPersonalLibrary(): SavedChannel[] {
  try {
    const stored = localStorage.getItem(PERSONAL_LIBRARY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save personal library to localStorage
function savePersonalLibrary(channels: SavedChannel[]): void {
  try {
    localStorage.setItem(PERSONAL_LIBRARY_KEY, JSON.stringify(channels));
  } catch (e) {
    console.error('[Personal Library] Save error:', e);
  }
}

// Load blocked channels from localStorage
function loadBlockedChannels(): BlockedChannel[] {
  try {
    const stored = localStorage.getItem(BLOCKED_CHANNELS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save blocked channels to localStorage
function saveBlockedChannels(channels: BlockedChannel[]): void {
  try {
    localStorage.setItem(BLOCKED_CHANNELS_KEY, JSON.stringify(channels));
  } catch (e) {
    console.error('[Blocked Channels] Save error:', e);
  }
}

export interface TrendingChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'finance' | 'gaming' | 'default';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  verifiedLiveId?: string | null; // Static 24/7 embed ID for Zero-Gate Rendering
  latestVideoId?: string | null; // Fallback when live stream not available
  lastUpdated?: number;
  isLive?: boolean; // True for live streams (10-min refresh), false for normal videos (no refresh)
}

export interface LiveStatus {
  channelId: string;
  isLive: boolean;
  isOffline?: boolean;
  viewerCount?: number;
  lastChecked: number;
  apiError?: boolean; // True if YouTube API returned 403/error - don't lie, show "System Maintenance"
}

export interface WidgetTemplate {
  id: string;
  name: string;
  widgetType: WidgetType;
  w: number;
  h: number;
  icon: 'video' | 'note' | 'spacer' | 'image';
  color: string;
}

// ORIGIN LOCKDOWN: Hardcoded production domain for YouTube postMessage handshake
const getProYouTubeEmbedUrl = (videoId: string): string => {
  const origin = 'https://openbento.tv';
  return `https://www.youtube.com/embed/${videoId}?origin=${encodeURIComponent(origin)}&enablejsapi=1&autoplay=1&mute=1&widget_referrer=${encodeURIComponent(origin)}`;
};

// NOTE: live_stream?channel= format is deprecated - we now require real videoIds from /api/links

// Fallback channels (used when API is not available) - Music/Lofi content removed
const FALLBACK_CHANNELS: TrendingChannel[] = [
  { id: 'nasa-live', name: 'NASA Live', url: getProYouTubeEmbedUrl('21X5lGlDOfg'), iconType: 'science', category: 'Science', platform: 'youtube', channelId: undefined },
  { id: 'sky-news', name: 'Sky News', url: getProYouTubeEmbedUrl('9Auqkrry-jE'), iconType: 'news', category: 'News', platform: 'youtube', channelId: undefined },
  { id: 'abc-news', name: 'ABC News', url: getProYouTubeEmbedUrl('I9u-j-2V_Vw'), iconType: 'news', category: 'News', platform: 'youtube', channelId: undefined },
  { id: 'twitch-esl', name: 'ESL CS:GO', url: 'https://www.twitch.tv/esl_csgo', iconType: 'gaming', category: 'Esports', platform: 'twitch', channelId: 'esl_csgo' },
  { id: 'twitch-rocket', name: 'Rocket League', url: 'https://www.twitch.tv/rocketleague', iconType: 'gaming', category: 'Esports', platform: 'twitch', channelId: 'rocketleague' },
  { id: 'twitch-gaules', name: 'Gaules', url: 'https://www.twitch.tv/gaules', iconType: 'gaming', category: 'Gaming', platform: 'twitch', channelId: 'gaules' },
  { id: 'kick-xqc', name: 'xQc', url: 'https://kick.com/xqc', iconType: 'gaming', category: 'Gaming', platform: 'kick', channelId: 'xqc' },
  { id: 'kick-adin', name: 'Adin Ross', url: 'https://kick.com/adinross', iconType: 'gaming', category: 'Gaming', platform: 'kick', channelId: 'adinross' },
];

// API response type
interface LinksApiResponse {
  channels: TrendingChannel[];
  lastRefresh: number;
  origin: string;
}

// Live status polling interval (5 minutes for initial checks)
const LIVE_STATUS_POLL_INTERVAL = 5 * 60 * 1000;
// Hourly revalidation interval (60 minutes) for deep YouTube API checks
const HOURLY_REVALIDATION_INTERVAL = 60 * 60 * 1000;

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { id: 'template-video', name: 'Video', widgetType: 'video', w: 3, h: 2, icon: 'video', color: 'cyan' },
  { id: 'template-note', name: 'Note', widgetType: 'note', w: 3, h: 2, icon: 'note', color: 'yellow' },
  { id: 'template-spacer', name: 'Spacer', widgetType: 'spacer', w: 2, h: 1, icon: 'spacer', color: 'slate' },
  { id: 'template-image', name: 'Photo', widgetType: 'image', w: 3, h: 2, icon: 'image', color: 'purple' },
];

type SidebarTab = 'content' | 'library';
type ContentCategory = 'all' | 'news' | 'gaming' | 'personal' | 'blocked';

interface DraggableChannelProps {
  channel: TrendingChannel | SavedChannel | BlockedChannel;
  onClick?: () => void;
  isLive?: boolean;
  isSaved?: boolean;
  isBlocked?: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  showSaveButton?: boolean;
}

function getChannelIcon(iconType: TrendingChannel['iconType']) {
  switch (iconType) {
    case 'news':
      return <Newspaper className="w-[1.6rem] h-[1.6rem] text-cyan-400" />;
    case 'science':
      return <Rocket className="w-[1.6rem] h-[1.6rem] text-purple-400" />;
    case 'finance':
      return <TrendingUp className="w-[1.6rem] h-[1.6rem] text-emerald-400" />;
    case 'gaming':
      return <Gamepad2 className="w-[1.6rem] h-[1.6rem] text-green-400" />;
    default:
      return <Tv className="w-[1.6rem] h-[1.6rem] text-slate-400" />;
  }
}

function getTemplateIcon(icon: WidgetTemplate['icon'], color: string) {
  const colorClass = `text-${color}-400`;
  switch (icon) {
    case 'video':
      return <Video className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    case 'note':
      return <FileText className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    case 'spacer':
      return <Square className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    case 'image':
      return <ImageIcon className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    default:
      return <Square className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
  }
}

function DraggableChannel({ channel, onClick, isLive, isSaved, isBlocked, onSave, onRemove, onBlock, onUnblock, showSaveButton }: DraggableChannelProps) {
  const [logoError, setLogoError] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `channel-${channel.id}`,
    data: { type: 'channel', channel }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && onClick) {
      onClick();
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isSaved && onRemove) {
      onRemove();
    } else if (onSave) {
      onSave();
    }
  };

  const handleBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBlocked && onUnblock) {
      onUnblock();
    } else if (onBlock) {
      onBlock();
    }
  };

  // Get channel logo URL from CHANNEL_LOGOS map with fallback caching
  // If a URL fails once (404/error), it's cached and won't be retried
  const getLogoUrl = () => {
    const mappedUrl = CHANNEL_LOGOS[channel.id];
    
    // If we have a mapped URL and it hasn't failed before, use it
    if (mappedUrl && !failedLogoCache.has(mappedUrl)) {
      return mappedUrl;
    }
    
    // No mapped URL or it already failed - return null for local fallback
    return null;
  };
  
  const logoUrl = getLogoUrl();
  
  // Get color based on category for fallback circle
  const getFallbackColor = () => {
    switch (channel.iconType) {
      case 'news':
        return 'bg-blue-500';
      case 'science':
        return 'bg-purple-500';
      case 'gaming':
        return 'bg-green-500';
      case 'finance':
        return 'bg-amber-500';
      default:
        return 'bg-cyan-500';
    }
  };

  // Fallback: Generic play button icon (local, no network request)
  const getFallbackIcon = () => {
    const bgColor = getFallbackColor();
    return (
      <div className={`w-full h-full ${bgColor} flex items-center justify-center rounded-lg`}>
        <Tv className="w-[1.6rem] h-[1.6rem] text-white" />
      </div>
    );
  };

  // Show logo if available and not errored, otherwise show fallback icon
  const showLogo = logoUrl && !logoError;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="channel-item flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border border-slate-700/50 hover:border-cyan-500/50"
      data-testid={`draggable-channel-${channel.id}`}
    >
      <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center relative overflow-hidden">
        {showLogo ? (
          <img 
            src={logoUrl} 
            alt={channel.name} 
            className="w-full h-full object-cover rounded-lg"
            onError={() => {
              // Add to failed cache to prevent retrying this URL
              if (logoUrl) failedLogoCache.add(logoUrl);
              setLogoError(true);
            }}
          />
        ) : (
          getFallbackIcon()
        )}
        {isLive === true && (
          <div className="live-badge absolute -top-1 -right-1 w-[1rem] h-[1rem] bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[0.6rem]">
          <p className="text-[1.2rem] font-semibold text-slate-200 truncate">{channel.name}</p>
          {isLive === true && (
            <span className="live-badge flex items-center gap-[0.3rem] px-[0.5rem] py-[0.1rem] bg-red-500/20 border border-red-500/50 rounded-full text-[0.8rem] font-bold text-red-400 uppercase tracking-wider" data-testid={`live-badge-${channel.id}`}>
              <span className="live-badge w-[0.6rem] h-[0.6rem] rounded-full bg-red-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <p className="text-[1rem] text-slate-400">{channel.category} • {channel.platform === 'youtube' ? 'YouTube' : channel.platform === 'kick' ? 'Kick' : channel.platform}</p>
      </div>
      {showSaveButton && (
        <button
          onClick={handleSaveClick}
          onPointerDown={(e) => e.stopPropagation()}
          className={`p-[0.6rem] rounded-lg transition-colors ${
            isSaved 
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' 
              : 'hover:bg-slate-700 text-slate-500 hover:text-amber-400'
          }`}
          title={isSaved ? 'Remove from Personal Library' : 'Save to Personal Library'}
          data-testid={`save-channel-${channel.id}`}
        >
          <Star className={`w-[1.4rem] h-[1.4rem] ${isSaved ? 'fill-amber-400' : ''}`} />
        </button>
      )}
      {showSaveButton && (
        <button
          onClick={handleBlockClick}
          onPointerDown={(e) => e.stopPropagation()}
          className={`p-[0.6rem] rounded-lg transition-colors ${
            isBlocked 
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
              : 'hover:bg-slate-700 text-slate-500 hover:text-red-400'
          }`}
          title={isBlocked ? 'Unblock channel' : 'Block channel'}
          data-testid={`block-channel-${channel.id}`}
        >
          <Trash2 className={`w-[1.4rem] h-[1.4rem] ${isBlocked ? 'fill-red-400' : ''}`} />
        </button>
      )}
      <Grip className="w-[1.6rem] h-[1.6rem] text-slate-500" />
    </div>
  );
}

interface DraggableTemplateProps {
  template: WidgetTemplate;
  onClick?: () => void;
}

function DraggableTemplate({ template, onClick }: DraggableTemplateProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'widget-template', template }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && onClick) {
      onClick();
    }
  };

  const colorBorder = template.color === 'cyan' ? 'border-cyan-500/50 hover:border-cyan-400' 
    : template.color === 'yellow' ? 'border-yellow-500/50 hover:border-yellow-400'
    : template.color === 'purple' ? 'border-purple-500/50 hover:border-purple-400'
    : 'border-slate-500/50 hover:border-slate-400';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border ${colorBorder}`}
      data-testid={`draggable-template-${template.id}`}
    >
      <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center">
        {getTemplateIcon(template.icon, template.color)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[1.2rem] font-semibold text-slate-200 truncate">{template.name}</p>
        <p className="text-[1rem] text-slate-400">
          Resizable block
        </p>
      </div>
      <Grip className="w-[1.6rem] h-[1.6rem] text-slate-500" />
    </div>
  );
}

interface WidgetSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelClick?: (channel: TrendingChannel) => void;
  onTemplateClick?: (template: WidgetTemplate) => void;
  urlValue?: string;
  onUrlChange?: (value: string) => void;
  onUrlSubmit?: (url: string) => void;
  activeWidgetId?: string | null;
  onImageUpload?: (imageUrl: string) => void;
  isAuthenticated?: boolean;
  openLoginModal?: (reason?: string) => void;
}

export function WidgetSidebar({ 
  isOpen, 
  onClose, 
  onChannelClick,
  onTemplateClick,
  urlValue = '',
  onUrlChange,
  onUrlSubmit,
  activeWidgetId,
  onImageUpload,
  isAuthenticated = false,
  openLoginModal
}: WidgetSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('content');
  const [activeCategory, setActiveCategory] = useState<ContentCategory>('all');
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [personalLibrary, setPersonalLibrary] = useState<SavedChannel[]>(() => loadPersonalLibrary());
  const [blockedChannels, setBlockedChannels] = useState<BlockedChannel[]>(() => loadBlockedChannels());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for personal library updates from dashboard (block star button)
  useEffect(() => {
    const handleLibraryUpdate = () => {
      setPersonalLibrary(loadPersonalLibrary());
    };
    
    window.addEventListener('personalLibraryUpdated', handleLibraryUpdate);
    return () => window.removeEventListener('personalLibraryUpdated', handleLibraryUpdate);
  }, []);

  // Listen for blocked channels updates
  useEffect(() => {
    const handleBlockedUpdate = () => {
      setBlockedChannels(loadBlockedChannels());
    };
    
    window.addEventListener('blockedChannelsUpdated', handleBlockedUpdate);
    return () => window.removeEventListener('blockedChannelsUpdated', handleBlockedUpdate);
  }, []);

  // Save to Personal Library
  // AUTH GATE: Block guests from saving to library
  const saveToPersonalLibrary = useCallback((channel: TrendingChannel) => {
    // Guest users cannot save - show Sign Up Required popup
    if (!isAuthenticated) {
      openLoginModal?.('Sign Up Required: Please log in or sign up to save channels to your library.');
      return;
    }
    
    setPersonalLibrary(prev => {
      const exists = prev.some(c => c.id === channel.id);
      if (exists) return prev;
      
      const savedChannel: SavedChannel = {
        id: channel.id,
        name: channel.name,
        url: channel.url,
        iconType: channel.iconType,
        category: channel.category,
        platform: channel.platform,
        channelId: channel.channelId,
        videoId: channel.videoId,
        savedAt: Date.now()
      };
      
      const updated = [...prev, savedChannel];
      savePersonalLibrary(updated);
      // Dispatch event to sync dashboard star buttons
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return updated;
    });
  }, [isAuthenticated, openLoginModal]);

  // Remove from Personal Library
  const removeFromPersonalLibrary = useCallback((channelId: string) => {
    setPersonalLibrary(prev => {
      const updated = prev.filter(c => c.id !== channelId);
      savePersonalLibrary(updated);
      // Dispatch event to sync dashboard
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return updated;
    });
  }, []);

  // Check if channel is in Personal Library
  const isInPersonalLibrary = useCallback((channelId: string) => {
    return personalLibrary.some(c => c.id === channelId);
  }, [personalLibrary]);

  // Block a channel - preserves all channel data including logo info
  const blockChannel = useCallback((channel: TrendingChannel) => {
    setBlockedChannels(prev => {
      const exists = prev.some(c => c.id === channel.id);
      if (exists) return prev;
      
      const blockedChannel: BlockedChannel = {
        id: channel.id,
        name: channel.name,
        url: channel.url,
        iconType: channel.iconType,
        category: channel.category,
        platform: channel.platform,
        channelId: channel.channelId,
        videoId: channel.videoId,
        blockedAt: Date.now()
      };
      
      const updated = [...prev, blockedChannel];
      saveBlockedChannels(updated);
      window.dispatchEvent(new CustomEvent('blockedChannelsUpdated'));
      return updated;
    });
  }, []);

  // Unblock a channel
  const unblockChannel = useCallback((channelId: string) => {
    setBlockedChannels(prev => {
      const updated = prev.filter(c => c.id !== channelId);
      saveBlockedChannels(updated);
      window.dispatchEvent(new CustomEvent('blockedChannelsUpdated'));
      return updated;
    });
  }, []);

  // Check if channel is blocked
  const isChannelBlocked = useCallback((channelId: string) => {
    return blockedChannels.some(c => c.id === channelId);
  }, [blockedChannels]);

  // Fetch live channels from API (self-healing video library)
  const { data: linksData, isLoading: isLoadingLinks, refetch: refetchLinks } = useQuery<LinksApiResponse>({
    queryKey: ['/api/links'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
  });

  // Use API channels if available, fallback to hardcoded
  const channels: TrendingChannel[] = linksData?.channels?.length 
    ? linksData.channels 
    : FALLBACK_CHANNELS;

  // Check live status for Kick channels (via server proxy to bypass CORS)
  const checkKickLiveStatus = useCallback(async (channelId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/kick/channel/${channelId}`);
      if (response.ok) {
        const data = await response.json();
        return data?.isLive === true;
      }
      return false;
    } catch {
      return true;
    }
  }, []);

  // Poll live status every 5 minutes (fast check using cached data)
  useEffect(() => {
    const checkAllStatuses = async () => {
      const now = Date.now();
      const newStatuses: Record<string, LiveStatus> = {};

      for (const channel of channels) {
        if (channel.channelId) {
          let isLive = false;
          
          if (channel.platform === 'youtube') {
            // BADGE FINAL FIX: Only show LIVE badge if API specifically returns isLive: true
            // (which comes from liveBroadcastContent: 'live')
            // Do NOT default to true - must have explicit API confirmation
            const hasApiData = 'isLive' in channel;
            isLive = hasApiData ? (channel as any).isLive === true : false;
          } else if (channel.platform === 'twitch') {
            // Twitch: use isLive from API if defined, otherwise check with fallback
            const hasApiData = 'isLive' in channel;
            isLive = hasApiData ? (channel as any).isLive === true : false;
          } else if (channel.platform === 'kick') {
            // Kick uses server proxy for live status check
            isLive = await checkKickLiveStatus(channel.channelId);
          }

          newStatuses[channel.id] = {
            channelId: channel.channelId,
            isLive,
            lastChecked: now
          };
        }
      }

      setLiveStatuses(newStatuses);
    };

    // QUOTA OPTIMIZATION: Only check Kick status on mount (Kick doesn't use YouTube API quota)
    // YouTube status checks are disabled - user must manually click "Check Again"
    checkAllStatuses();
    
    // Auto-refresh disabled to save YouTube API quota
    console.log('[Sidebar] Auto-refresh disabled for quota optimization. Use "Check Again" for manual refresh.');
    return () => {};
  }, [checkKickLiveStatus, channels]);

  // Ref to track current liveStatuses for hourly revalidation without causing re-renders
  const liveStatusesRef = useRef<Record<string, LiveStatus>>({});
  useEffect(() => {
    liveStatusesRef.current = liveStatuses;
  }, [liveStatuses]);

  // QUOTA OPTIMIZATION: Hourly revalidation DISABLED to save YouTube API quota
  // Previously used search.list (100 units per call) which exhausted quota quickly
  // Now live status is only updated via manual "Check Again" button clicks
  // which uses videos.list (1 unit per call) - 100x more efficient
  useEffect(() => {
    console.log('[Sidebar] HourlyRevalidation DISABLED for quota optimization. Use "Check Again" for manual refresh.');
    return () => {};
  }, [channels]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      onImageUpload?.(imageUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filter channels by search query and category - also filters out blocked channels from main views
  // DYNAMIC RANK SORTING: Live streams pinned to top, offline streams at bottom
  const filteredChannels = useMemo(() => {
    let filtered: TrendingChannel[] = channels;
    
    // Filter by category - Music/Lofi content excluded from all views
    filtered = channels.filter(c => 
      c.category !== 'Lofi/Music' && 
      c.category !== 'Music'
    );
    
    // Filter out blocked channels from main view (except when viewing blocked category)
    if (activeCategory !== 'blocked') {
      filtered = filtered.filter(c => !isChannelBlocked(c.id));
    }
    
    if (activeCategory === 'news') {
      filtered = filtered.filter(c => c.category === 'News' || c.category === 'Finance' || c.category === 'Science' || c.category === 'Live Cams');
    } else if (activeCategory === 'gaming') {
      filtered = filtered.filter(c => c.category === 'Gaming' || c.category === 'Esports' || c.category === 'Sports');
    }
    // 'all' shows everything (except music and blocked), 'personal' and 'blocked' are handled separately
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (channel: TrendingChannel) => 
          channel.name.toLowerCase().includes(query) ||
          channel.category.toLowerCase().includes(query) ||
          channel.platform.toLowerCase().includes(query)
      );
    }
    
    // DYNAMIC RANK SORTING: Live streams pinned to top, offline streams at bottom
    // Sort by live status: online (true) first, then unknown (undefined), then offline (false)
    filtered = [...filtered].sort((a, b) => {
      const statusA = liveStatuses[a.id];
      const statusB = liveStatuses[b.id];
      
      // Get live status values (true = 2, undefined = 1, false = 0)
      const rankA = statusA?.isLive === true ? 2 : statusA?.isLive === false ? 0 : 1;
      const rankB = statusB?.isLive === true ? 2 : statusB?.isLive === false ? 0 : 1;
      
      // Sort descending (live first, then unknown, then offline)
      return rankB - rankA;
    });
    
    return filtered;
  }, [searchQuery, channels, activeCategory, isChannelBlocked, liveStatuses]);

  // Filter personal library by search
  const filteredPersonalLibrary = useMemo(() => {
    if (!searchQuery.trim()) return personalLibrary;
    const query = searchQuery.toLowerCase();
    return personalLibrary.filter(
      (channel: SavedChannel) => 
        channel.name.toLowerCase().includes(query) ||
        channel.category.toLowerCase().includes(query) ||
        channel.platform.toLowerCase().includes(query)
    );
  }, [searchQuery, personalLibrary]);

  // Filter blocked channels by search - logos are preserved because BlockedChannel stores all data
  const filteredBlockedChannels = useMemo(() => {
    if (!searchQuery.trim()) return blockedChannels;
    const query = searchQuery.toLowerCase();
    return blockedChannels.filter(
      (channel: BlockedChannel) => 
        channel.name.toLowerCase().includes(query) ||
        channel.category.toLowerCase().includes(query) ||
        channel.platform.toLowerCase().includes(query)
    );
  }, [searchQuery, blockedChannels]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[99] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: 'var(--header-height)' }}
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="sidebar-overlay"
      />
      
      <div
        className="fixed left-0 h-[calc(100vh-var(--header-height)-1rem)] bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden shadow-2xl transition-all duration-300"
        style={{ 
          width: isOpen ? 'min(32rem, 100vw)' : '0',
          visibility: isOpen ? 'visible' : 'hidden',
          opacity: isOpen ? 1 : 0,
          zIndex: isOpen ? 100 : -1,
          top: 'calc(var(--header-height) + 1rem)',
          borderTopRightRadius: 'var(--outer-radius)',
          borderBottomRightRadius: 'var(--outer-radius)',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        data-testid="widget-sidebar"
      >
        <div className="p-[1.6rem] border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-[1.2rem]">
            <h2 className="text-[1.8rem] font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-[0.8rem]">
              <LayoutGrid className="w-[2rem] h-[2rem] text-cyan-400" />
              Block Library
            </h2>
            <button
              onClick={onClose}
              className="p-[0.6rem] hover:bg-slate-800 slot-button transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="w-[1.8rem] h-[1.8rem] text-slate-400" />
            </button>
          </div>
          
          {/* Streams-only tab - Library tab hidden since builder tools are hidden */}
          <div className="flex gap-[0.4rem] bg-slate-800 p-[0.4rem] rounded-lg">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 flex items-center justify-center gap-[0.6rem] py-[0.8rem] px-[1.2rem] rounded-md text-[1.2rem] font-medium transition-all duration-200 bg-cyan-600 text-white shadow-lg`}
              data-testid="tab-content"
            >
              <Layers className="w-[1.4rem] h-[1.4rem]" />
              News / Stream Library
            </button>
          </div>
          
          <div className="mt-[1.2rem]">
            <label className="block text-[1rem] font-semibold mb-[0.4rem] text-cyan-400">
              {activeWidgetId ? 'UPDATE WIDGET URL' : 'ADD VIDEO BY URL'}
            </label>
            <div className="flex gap-[0.6rem]">
              <input
                type="text"
                value={urlValue}
                onChange={(e) => onUrlChange?.(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && urlValue.trim()) {
                    e.preventDefault();
                    onUrlSubmit?.(urlValue);
                  }
                }}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem]"
                data-testid="input-url-sidebar"
              />
              <button
                onClick={() => urlValue.trim() && onUrlSubmit?.(urlValue)}
                disabled={!urlValue.trim()}
                className="px-[1.2rem] py-[0.8rem] bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed slot-button font-semibold transition-colors text-[1.1rem]"
                data-testid="button-load-url"
              >
                ADD
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-[1.6rem]">
          {activeTab === 'library' && (
            <div className="space-y-[1.6rem]">
              {/* All builder tools hidden for dashboard-only view */}
              {/* Block Types, Upload Image, and OpenBento Grid - Hidden */}
              {/* 
              <div>
                <h3 className="text-[1.4rem] font-semibold text-purple-400 mb-[1rem] flex items-center gap-[0.6rem]">
                  <LayoutGrid className="w-[1.6rem] h-[1.6rem]" />
                  Block Types
                </h3>
                <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                  Click to add - Resize in Edit Mode
                </p>
                <div className="space-y-[0.8rem]">
                  {WIDGET_TEMPLATES.map((template) => (
                    <DraggableTemplate 
                      key={template.id} 
                      template={template}
                      onClick={() => onTemplateClick?.(template)}
                    />
                  ))}
                </div>
              </div>
              
              <div className="bg-purple-900/30 p-[1.2rem] rounded-lg border border-purple-500/50">
                <h4 className="text-[1.2rem] font-semibold text-purple-300 mb-[0.8rem] flex items-center gap-[0.6rem]">
                  <ImageIcon className="w-[1.4rem] h-[1.4rem]" />
                  Upload Image
                </h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-[0.8rem] px-[1.2rem] py-[1rem] bg-purple-600 hover:bg-purple-500 slot-button font-semibold transition-colors text-[1.2rem]"
                  data-testid="button-upload-image"
                >
                  <Upload className="w-[1.6rem] h-[1.6rem]" />
                  Upload from Computer
                </button>
                <p className="text-[1rem] text-purple-300/70 mt-[0.8rem] text-center">
                  {activeWidgetId ? 'Replace existing image' : 'Creates a new image widget'}
                </p>
              </div>

              <div className="bg-slate-800/50 p-[1.2rem] rounded-lg border border-slate-700/50">
                <h4 className="text-[1.2rem] font-semibold text-slate-300 mb-[0.8rem]">OpenBento Grid</h4>
                <ul className="text-[1.1rem] text-slate-400 space-y-[0.4rem]">
                  <li className="flex items-center gap-[0.6rem]">
                    <span className="text-cyan-400">12</span>
                    <span>column magnetic grid</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <Video className="w-[1.4rem] h-[1.4rem] text-cyan-400" />
                    <span>Video: Mute, Refresh, Delete</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <FileText className="w-[1.4rem] h-[1.4rem] text-yellow-400" />
                    <span>Note: Editable text</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <ImageIcon className="w-[1.4rem] h-[1.4rem] text-purple-400" />
                    <span>Photo: File upload</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <Square className="w-[1.4rem] h-[1.4rem] text-slate-400" />
                    <span>Spacer: Layout block</span>
                  </li>
                </ul>
              </div>
              */}
            </div>
          )}
          
          {activeTab === 'content' && (
            <div className="space-y-[1.6rem]">
              <div className="relative">
                <Search className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 100+ streams..."
                  className="w-full pl-[3.6rem] pr-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem]"
                  data-testid="input-search-channels"
                />
              </div>
              
              <div className="flex flex-wrap gap-[0.4rem]">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                    activeCategory === 'all'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  data-testid="category-all"
                >
                  <Layers className="w-[1.2rem] h-[1.2rem]" />
                  All
                </button>
                <button
                  onClick={() => setActiveCategory('news')}
                  className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                    activeCategory === 'news'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  data-testid="category-news"
                >
                  <Globe className="w-[1.2rem] h-[1.2rem]" />
                  News
                </button>
                <button
                  onClick={() => setActiveCategory('gaming')}
                  className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                    activeCategory === 'gaming'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  data-testid="category-gaming"
                >
                  <Gamepad2 className="w-[1.2rem] h-[1.2rem]" />
                  Gaming
                </button>
                <button
                  onClick={() => setActiveCategory('personal')}
                  className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                    activeCategory === 'personal'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  data-testid="category-personal"
                >
                  <Heart className="w-[1.2rem] h-[1.2rem]" />
                  Saved
                  {personalLibrary.length > 0 && (
                    <span className="ml-[0.2rem] px-[0.5rem] py-[0.1rem] bg-amber-500/30 rounded-full text-[0.9rem]">
                      {personalLibrary.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveCategory('blocked')}
                  className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                    activeCategory === 'blocked'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  data-testid="category-blocked"
                >
                  <Trash2 className="w-[1.2rem] h-[1.2rem]" />
                  Blocked
                  {blockedChannels.length > 0 && (
                    <span className="ml-[0.2rem] px-[0.5rem] py-[0.1rem] bg-red-500/30 rounded-full text-[0.9rem]">
                      {blockedChannels.length}
                    </span>
                  )}
                </button>
              </div>
              
              {activeCategory !== 'personal' && activeCategory !== 'blocked' ? (
                <div>
                  <div className="flex items-center justify-between mb-[1rem]">
                    <h3 className="text-[1.4rem] font-semibold text-cyan-400 flex items-center gap-[0.6rem]">
                      <Tv className="w-[1.6rem] h-[1.6rem]" />
                      {activeCategory === 'all' && 'All Streams'}
                      {activeCategory === 'news' && 'Global News'}
                      {activeCategory === 'gaming' && 'Gaming & Esports'}
                      <span className="text-[1.1rem] text-slate-500 font-normal ml-[0.4rem]">
                        ({filteredChannels.length})
                      </span>
                    </h3>
                    <button
                      onClick={() => refetchLinks()}
                      className="p-[0.6rem] hover:bg-slate-800 slot-button transition-colors"
                      title="Refresh stream links"
                      data-testid="button-refresh-links"
                    >
                      <RefreshCw className={`w-[1.4rem] h-[1.4rem] text-cyan-400 ${isLoadingLinks ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                    {linksData?.lastRefresh 
                      ? `Auto-updated ${new Date(linksData.lastRefresh).toLocaleDateString()} • Click star to save`
                      : 'Click star to save to Personal Library'}
                  </p>
                  <div className="space-y-[0.8rem]">
                    {filteredChannels.map((channel) => (
                      <DraggableChannel 
                        key={channel.id} 
                        channel={channel} 
                        onClick={() => onChannelClick?.(channel)}
                        isLive={liveStatuses[channel.id]?.isLive}
                        showSaveButton={true}
                        isSaved={isInPersonalLibrary(channel.id)}
                        isBlocked={isChannelBlocked(channel.id)}
                        onSave={() => saveToPersonalLibrary(channel)}
                        onRemove={() => removeFromPersonalLibrary(channel.id)}
                        onBlock={() => blockChannel(channel)}
                        onUnblock={() => unblockChannel(channel.id)}
                      />
                    ))}
                    {filteredChannels.length === 0 && (
                      <p className="text-[1.2rem] text-slate-500 text-center py-[2rem]">
                        No streams found
                      </p>
                    )}
                  </div>
                </div>
              ) : activeCategory === 'personal' ? (
                <div>
                  <div className="flex items-center justify-between mb-[1rem]">
                    <h3 className="text-[1.4rem] font-semibold text-amber-400 flex items-center gap-[0.6rem]">
                      <Heart className="w-[1.6rem] h-[1.6rem]" />
                      Personal Library
                      <span className="text-[1.1rem] text-slate-500 font-normal ml-[0.4rem]">
                        ({filteredPersonalLibrary.length})
                      </span>
                    </h3>
                  </div>
                  <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                    Your saved streams • Click star to remove
                  </p>
                  {filteredPersonalLibrary.length > 0 ? (
                    <div className="space-y-[0.8rem]">
                      {filteredPersonalLibrary.map((channel) => (
                        <DraggableChannel 
                          key={channel.id} 
                          channel={channel as TrendingChannel} 
                          onClick={() => onChannelClick?.(channel as TrendingChannel)}
                          isLive={liveStatuses[channel.id]?.isLive}
                          showSaveButton={true}
                          isSaved={true}
                          onRemove={() => removeFromPersonalLibrary(channel.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-[3rem]">
                      <Star className="w-[3rem] h-[3rem] text-slate-600 mx-auto mb-[1rem]" />
                      <p className="text-[1.2rem] text-slate-500 mb-[0.5rem]">
                        No saved streams yet
                      </p>
                      <p className="text-[1.1rem] text-slate-600">
                        Click the star icon on any stream to save it here
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-[1rem]">
                    <h3 className="text-[1.4rem] font-semibold text-red-400 flex items-center gap-[0.6rem]">
                      <Trash2 className="w-[1.6rem] h-[1.6rem]" />
                      Blocked Channels
                      <span className="text-[1.1rem] text-slate-500 font-normal ml-[0.4rem]">
                        ({filteredBlockedChannels.length})
                      </span>
                    </h3>
                  </div>
                  <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                    Hidden from stream library • Click trash to unblock
                  </p>
                  {filteredBlockedChannels.length > 0 ? (
                    <div className="space-y-[0.8rem]">
                      {filteredBlockedChannels.map((channel) => (
                        <DraggableChannel 
                          key={channel.id} 
                          channel={channel} 
                          onClick={() => onChannelClick?.(channel as TrendingChannel)}
                          isLive={false}
                          showSaveButton={true}
                          isSaved={false}
                          isBlocked={true}
                          onUnblock={() => unblockChannel(channel.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-[3rem]">
                      <Trash2 className="w-[3rem] h-[3rem] text-slate-600 mx-auto mb-[1rem]" />
                      <p className="text-[1.2rem] text-slate-500 mb-[0.5rem]">
                        No blocked channels
                      </p>
                      <p className="text-[1.1rem] text-slate-600">
                        Click the trash icon on any stream to hide it
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-[1.6rem] border-t border-slate-700 flex-shrink-0">
          <p className="text-[1rem] text-slate-500 text-center mb-[1rem]">
            {activeTab === 'library' 
              ? 'Drag blocks to add • Resize in Edit Mode' 
              : 'Click or drag streams to add'}
          </p>
          <div className="text-center text-[10px] text-slate-600">
            <span>© 2026 ANCU LABS FZC LLC</span>
            <span className="mx-2">•</span>
            <a href="/terms" className="hover:text-slate-400 transition-colors" data-testid="link-terms-sidebar">Terms</a>
            <span className="mx-2">•</span>
            <a href="/privacy" className="hover:text-slate-400 transition-colors" data-testid="link-privacy-sidebar">Privacy</a>
          </div>
        </div>
      </div>
    </>
  );
}

export { FALLBACK_CHANNELS as TRENDING_CHANNELS, loadPersonalLibrary, savePersonalLibrary };
