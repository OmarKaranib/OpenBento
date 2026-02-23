import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X, Search, Tv, LayoutGrid, Grip, Layers,
  Gamepad2, RefreshCw, Star,
  Trash2, Globe, Heart, Radio, PenLine, Clock
} from 'lucide-react';

const failedLogoCache = new Set<string>();

const CHANNEL_LOGOS: Record<string, string> = {
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
  'bloomberg-live': 'https://www.google.com/s2/favicons?domain=bloomberg.com&sz=128',
  'cnbc-live': 'https://www.google.com/s2/favicons?domain=cnbc.com&sz=128',
  'yahoo-finance': 'https://www.google.com/s2/favicons?domain=finance.yahoo.com&sz=128',
  'cheddar-news': 'https://www.google.com/s2/favicons?domain=cheddar.com&sz=128',
  'iss-hd-earth': 'https://www.google.com/s2/favicons?domain=nasa.gov&sz=128',
  'space-videos': 'https://www.google.com/s2/favicons?domain=space.com&sz=128',
  'nasa-tv': 'https://www.google.com/s2/favicons?domain=nasa.gov&sz=128',
  'aquarium-live': 'https://www.google.com/s2/favicons?domain=montereybayaquarium.org&sz=128',
  'explore-africa': 'https://www.google.com/s2/favicons?domain=explore.org&sz=128',
  'explore-bears': 'https://www.google.com/s2/favicons?domain=explore.org&sz=128',
  'sea-otter-cam': 'https://www.google.com/s2/favicons?domain=montereybayaquarium.org&sz=128',
  'jellyfish-cam': 'https://www.google.com/s2/favicons?domain=montereybayaquarium.org&sz=128',
  'spacex-live': 'https://www.google.com/s2/favicons?domain=spacex.com&sz=128',
  'earth-cam-nyc': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-tokyo': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-paris': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-london': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'earth-cam-dubai': 'https://www.google.com/s2/favicons?domain=earthcam.com&sz=128',
  'nfl-network': 'https://www.google.com/s2/favicons?domain=nfl.com&sz=128',
  'nba-tv': 'https://www.google.com/s2/favicons?domain=nba.com&sz=128',
  'espn-live': 'https://www.google.com/s2/favicons?domain=espn.com&sz=128',
  'free-sports-tv': 'https://www.google.com/s2/favicons?domain=freesports.tv&sz=128',
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

const PERSONAL_LIBRARY_KEY = 'openBentoPersonalLibrary';
const BLOCKED_CHANNELS_KEY = 'openBentoBlockedChannels';

// ─── Exported interfaces ──────────────────────────────────────────────────────

export interface SavedChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'finance' | 'gaming' | 'default';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  verifiedLiveId?: string | null;
  latestVideoId?: string | null;
  isManualOverride?: boolean;
  savedAt: number;
}

export interface BlockedChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'finance' | 'gaming' | 'default';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  verifiedLiveId?: string | null;
  latestVideoId?: string | null;
  isManualOverride?: boolean;
  blockedAt: number;
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
  verifiedLiveId?: string | null;
  latestVideoId?: string | null;
  isManualOverride?: boolean;
  rank?: number;
  logoUrl?: string | null;
  lastUpdated?: number;
  isLive?: boolean;
}

export interface LiveStatus {
  channelId: string;
  isLive: boolean;
  isOffline?: boolean;
  viewerCount?: number;
  lastChecked: number;
  apiError?: boolean;
}

// ── WidgetTemplate ─────────────────────────────────────────────────────────────
// CRITICAL: widgetType MUST be strictly lowercase to exactly match the cases
// in the WidgetRenderer switch in App.tsx:
//   'video' | 'note' | 'spacer' | 'image' | 'zoom' | 'clock'
// A case mismatch (e.g. 'Clock' vs 'clock') lands in the default branch and
// renders the "Unknown Widget Type" debug tile instead of the real widget.
export interface WidgetTemplate {
  id: string;
  name: string;
  widgetType: WidgetType; // strictly lowercase — must match App.tsx switch cases
  w: number;
  h: number;
  icon: 'video' | 'note' | 'spacer' | 'image' | 'zoom' | 'clock';
  color: string;
}

// ── WIDGET_TEMPLATES registry ─────────────────────────────────────────────────
// 'zoom' is kept for backwards-compat with saved grid data but is NOT shown in
// the sidebar UI (it's absent from availableWidgets below).
// All widgetType values are lowercase — the switch in App.tsx is case-sensitive.
export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { id: 'template-video',  name: 'Video',        widgetType: 'video',  w: 3, h: 2, icon: 'video',  color: 'cyan'   },
  { id: 'template-note',   name: 'Note',          widgetType: 'note',   w: 3, h: 2, icon: 'note',   color: 'yellow' },
  { id: 'template-spacer', name: 'Spacer',        widgetType: 'spacer', w: 2, h: 1, icon: 'spacer', color: 'slate'  },
  { id: 'template-image',  name: 'Photo',         widgetType: 'image',  w: 3, h: 2, icon: 'image',  color: 'purple' },
  { id: 'template-zoom',   name: 'Zoom Meeting',  widgetType: 'zoom',   w: 3, h: 2, icon: 'zoom',   color: 'blue'   },
  { id: 'template-clock',  name: 'World Clock',   widgetType: 'clock',  w: 3, h: 2, icon: 'clock',  color: 'cyan'   },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadPersonalLibrary(): SavedChannel[] {
  try {
    const stored = localStorage.getItem(PERSONAL_LIBRARY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function savePersonalLibrary(channels: SavedChannel[]): void {
  try {
    localStorage.setItem(PERSONAL_LIBRARY_KEY, JSON.stringify(channels));
  } catch (e) { console.error('[Personal Library] Save error:', e); }
}

function loadBlockedChannels(): BlockedChannel[] {
  try {
    const stored = localStorage.getItem(BLOCKED_CHANNELS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveBlockedChannels(channels: BlockedChannel[]): void {
  try {
    localStorage.setItem(BLOCKED_CHANNELS_KEY, JSON.stringify(channels));
  } catch (e) { console.error('[Blocked Channels] Save error:', e); }
}

// ─── Internal types ───────────────────────────────────────────────────────────

type SidebarTab      = 'streams' | 'widgets';
type ContentCategory = 'all' | 'news' | 'gaming' | 'personal' | 'blocked';

const FALLBACK_CHANNELS: TrendingChannel[] = [];

interface LinksApiResponse {
  channels: TrendingChannel[];
  lastRefresh: number;
  origin: string;
}

// ─── DraggableChannel ─────────────────────────────────────────────────────────

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

function DraggableChannel({
  channel, onClick, isLive, isSaved, isBlocked,
  onSave, onRemove, onBlock, onUnblock, showSaveButton,
}: DraggableChannelProps) {
  const [logoError, setLogoError] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `channel-${channel.id}`,
    data: { type: 'channel', channel },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleSaveClick  = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); isSaved && onRemove ? onRemove() : onSave?.(); };
  const handleBlockClick = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); isBlocked && onUnblock ? onUnblock() : onBlock?.(); };

  const getLogoUrl = () => {
    if ('logoUrl' in channel && (channel as TrendingChannel).logoUrl) {
      const db = (channel as TrendingChannel).logoUrl!;
      if (!failedLogoCache.has(db)) return db;
    }
    const mapped = CHANNEL_LOGOS[channel.id];
    if (mapped && !failedLogoCache.has(mapped)) return mapped;
    return null;
  };
  const logoUrl  = getLogoUrl();
  const showLogo = logoUrl && !logoError;
  const fallbackBg =
    { news: 'bg-blue-500', science: 'bg-purple-500', gaming: 'bg-green-500', finance: 'bg-amber-500' }[channel.iconType] ??
    'bg-cyan-500';

  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={() => { if (!isDragging) onClick?.(); }}
      className="channel-item flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border border-slate-700/50 hover:border-cyan-500/50"
      data-testid={`draggable-channel-${channel.id}`}
    >
      {/* Logo / fallback */}
      <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center relative overflow-hidden flex-shrink-0">
        {showLogo ? (
          <img
            src={logoUrl} alt={channel.name} className="w-full h-full object-cover rounded-lg"
            onError={(e) => { e.currentTarget.src = '/default-icon.png'; if (logoUrl) failedLogoCache.add(logoUrl); setLogoError(true); }}
          />
        ) : (
          <div className={`w-full h-full ${fallbackBg} flex items-center justify-center rounded-lg`}>
            <Tv className="w-[1.6rem] h-[1.6rem] text-white" />
          </div>
        )}
        {isLive === true && (
          <div className="live-badge absolute -top-1 -right-1 w-[1rem] h-[1rem] bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[0.6rem]">
          <p className="text-[1.2rem] font-semibold text-slate-200 truncate">{channel.name}</p>
          {isLive === true && (
            <span
              className="live-badge flex items-center gap-[0.3rem] px-[0.5rem] py-[0.1rem] bg-red-500/20 border border-red-500/50 rounded-full text-[0.8rem] font-bold text-red-400 uppercase tracking-wider"
              data-testid={`live-badge-${channel.id}`}
            >
              <span className="live-badge w-[0.6rem] h-[0.6rem] rounded-full bg-red-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <p className="text-[1rem] text-slate-400">
          {channel.category}{' \u2022 '}
          {channel.platform === 'youtube' ? 'YouTube' : channel.platform === 'kick' ? 'Kick' : channel.platform}
        </p>
      </div>

      {/* Save */}
      {showSaveButton && (
        <button
          onClick={handleSaveClick} onPointerDown={(e) => e.stopPropagation()}
          className={`p-[0.6rem] rounded-lg transition-colors ${isSaved ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' : 'hover:bg-slate-700 text-slate-500 hover:text-amber-400'}`}
          title={isSaved ? 'Remove from Personal Library' : 'Save to Personal Library'}
          data-testid={`save-channel-${channel.id}`}
        >
          <Star className={`w-[1.4rem] h-[1.4rem] ${isSaved ? 'fill-amber-400' : ''}`} />
        </button>
      )}

      {/* Block */}
      {showSaveButton && (
        <button
          onClick={handleBlockClick} onPointerDown={(e) => e.stopPropagation()}
          className={`p-[0.6rem] rounded-lg transition-colors ${isBlocked ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' : 'hover:bg-slate-700 text-slate-500 hover:text-red-400'}`}
          title={isBlocked ? 'Unblock channel' : 'Block channel'}
          data-testid={`block-channel-${channel.id}`}
        >
          <Trash2 className={`w-[1.4rem] h-[1.4rem] ${isBlocked ? 'fill-red-400' : ''}`} />
        </button>
      )}

      <Grip className="w-[1.6rem] h-[1.6rem] text-slate-500 flex-shrink-0" />
    </div>
  );
}

// ─── WidgetSidebar ────────────────────────────────────────────────────────────

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
  openLoginModal,
}: WidgetSidebarProps) {
  const [activeTab, setActiveTab]             = useState<SidebarTab>('streams');
  const [activeCategory, setActiveCategory]   = useState<ContentCategory>('all');
  const [searchQuery, setSearchQuery]         = useState('');
  const [liveStatuses, setLiveStatuses]       = useState<Record<string, LiveStatus>>({});
  const [personalLibrary, setPersonalLibrary] = useState<SavedChannel[]>(() => loadPersonalLibrary());
  const [blockedChannels, setBlockedChannels] = useState<BlockedChannel[]>(() => loadBlockedChannels());

  // Sync personalLibrary across tabs/events
  useEffect(() => {
    const h = () => setPersonalLibrary(loadPersonalLibrary());
    window.addEventListener('personalLibraryUpdated', h);
    return () => window.removeEventListener('personalLibraryUpdated', h);
  }, []);

  // Sync blockedChannels across tabs/events
  useEffect(() => {
    const h = () => setBlockedChannels(loadBlockedChannels());
    window.addEventListener('blockedChannelsUpdated', h);
    return () => window.removeEventListener('blockedChannelsUpdated', h);
  }, []);

  // ── Library actions ─────────────────────────────────────────────────────────
  const saveToPersonalLibrary = useCallback((channel: TrendingChannel) => {
    if (!isAuthenticated) {
      openLoginModal?.('Sign Up Required: Please log in or sign up to save channels to your library.');
      return;
    }
    setPersonalLibrary(prev => {
      if (prev.some(c => c.id === channel.id)) return prev;
      const updated: SavedChannel[] = [
        ...prev,
        {
          id: channel.id, name: channel.name, url: channel.url,
          iconType: channel.iconType, category: channel.category,
          platform: channel.platform, channelId: channel.channelId,
          videoId: channel.videoId, savedAt: Date.now(),
        },
      ];
      savePersonalLibrary(updated);
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return updated;
    });
  }, [isAuthenticated, openLoginModal]);

  const removeFromPersonalLibrary = useCallback((id: string) => {
    setPersonalLibrary(prev => {
      const u = prev.filter(c => c.id !== id);
      savePersonalLibrary(u);
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return u;
    });
  }, []);

  const isInPersonalLibrary = useCallback((id: string) => personalLibrary.some(c => c.id === id), [personalLibrary]);

  const blockChannel = useCallback((channel: TrendingChannel) => {
    setBlockedChannels(prev => {
      if (prev.some(c => c.id === channel.id)) return prev;
      const updated: BlockedChannel[] = [
        ...prev,
        {
          id: channel.id, name: channel.name, url: channel.url,
          iconType: channel.iconType, category: channel.category,
          platform: channel.platform, channelId: channel.channelId,
          videoId: channel.videoId, blockedAt: Date.now(),
        },
      ];
      saveBlockedChannels(updated);
      window.dispatchEvent(new CustomEvent('blockedChannelsUpdated'));
      return updated;
    });
  }, []);

  const unblockChannel = useCallback((id: string) => {
    setBlockedChannels(prev => {
      const u = prev.filter(c => c.id !== id);
      saveBlockedChannels(u);
      window.dispatchEvent(new CustomEvent('blockedChannelsUpdated'));
      return u;
    });
  }, []);

  const isChannelBlocked = useCallback((id: string) => blockedChannels.some(c => c.id === id), [blockedChannels]);

  // ── API ─────────────────────────────────────────────────────────────────────
  const { data: linksData, isLoading: isLoadingLinks, refetch: refetchLinks } = useQuery<LinksApiResponse>({
    queryKey: ['/api/links'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const channels: TrendingChannel[] = linksData?.channels?.length ? linksData.channels : FALLBACK_CHANNELS;

  // ── Live status ─────────────────────────────────────────────────────────────
  const checkKickLiveStatus = useCallback(async (channelId: string): Promise<boolean> => {
    try {
      const r = await fetch(`/api/kick/channel/${channelId}`);
      if (r.ok) { const d = await r.json(); return d?.isLive === true; }
      return false;
    } catch { return true; }
  }, []);

  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      const statuses: Record<string, LiveStatus> = {};
      for (const ch of channels) {
        if (!ch.channelId) continue;
        let isLive = false;
        if (ch.platform === 'youtube' || ch.platform === 'twitch') {
          isLive = 'isLive' in ch ? (ch as any).isLive === true : false;
        } else if (ch.platform === 'kick') {
          isLive = await checkKickLiveStatus(ch.channelId);
        }
        statuses[ch.id] = { channelId: ch.channelId, isLive, lastChecked: now };
      }
      setLiveStatuses(statuses);
    };
    check();
  }, [checkKickLiveStatus, channels]);

  const liveStatusesRef = useRef<Record<string, LiveStatus>>({});
  useEffect(() => { liveStatusesRef.current = liveStatuses; }, [liveStatuses]);

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredChannels = useMemo(() => {
    let f = channels.filter(c => c.category !== 'Lofi/Music' && c.category !== 'Music');
    if (activeCategory !== 'blocked') f = f.filter(c => !isChannelBlocked(c.id));
    if (activeCategory === 'news')   f = f.filter(c => ['News', 'Finance', 'Science', 'Live Cams'].includes(c.category));
    if (activeCategory === 'gaming') f = f.filter(c => ['Gaming', 'Esports', 'Sports'].includes(c.category));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.platform.toLowerCase().includes(q)
      );
    }
    return [...f].sort((a, b) => {
      const ra = a.rank ?? 999, rb = b.rank ?? 999;
      if (ra !== rb) return ra - rb;
      const la = liveStatuses[a.id]?.isLive === true ? 2 : liveStatuses[a.id]?.isLive === false ? 0 : 1;
      const lb = liveStatuses[b.id]?.isLive === true ? 2 : liveStatuses[b.id]?.isLive === false ? 0 : 1;
      return lb - la;
    });
  }, [searchQuery, channels, activeCategory, isChannelBlocked, liveStatuses]);

  const filteredPersonalLibrary = useMemo(() => {
    if (!searchQuery.trim()) return personalLibrary;
    const q = searchQuery.toLowerCase();
    return personalLibrary.filter(c =>
      c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.platform.toLowerCase().includes(q)
    );
  }, [searchQuery, personalLibrary]);

  const filteredBlockedChannels = useMemo(() => {
    if (!searchQuery.trim()) return blockedChannels;
    const q = searchQuery.toLowerCase();
    return blockedChannels.filter(c =>
      c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.platform.toLowerCase().includes(q)
    );
  }, [searchQuery, blockedChannels]);

  // ── Widget button definitions ──────────────────────────────────────────────
  // ONLY 'note' and 'clock' are surfaced in the UI.
  // 'zoom' is intentionally omitted — it renders as null (ghost-box fix).
  //
  // widgetType is strictly lowercase — must match App.tsx WidgetType union and
  // the switch cases inside WidgetRenderer exactly.
  const availableWidgets = [
    {
      id: 'note',
      label: 'Note',
      description: 'Editable sticky note',
      icon: <PenLine className="w-[2rem] h-[2rem] text-yellow-400" />,
      iconBg: 'bg-yellow-500/15',
      border: 'border-yellow-500/30 hover:border-yellow-400/60',
      cardBg: 'bg-slate-800/60',
      badgeColor: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/40',
      template: {
        id: 'template-note',
        name: 'Note',
        widgetType: 'note' as WidgetType, // lowercase — matches case 'note' in WidgetRenderer
        w: 3,
        h: 2,
        icon: 'note' as const,
        color: 'yellow',
      },
    },
    {
      id: 'clock',
      label: 'World Clock',
      description: 'Live time & date display',
      icon: <Clock className="w-[2rem] h-[2rem] text-cyan-400" />,
      iconBg: 'bg-cyan-500/15',
      border: 'border-cyan-500/30 hover:border-cyan-400/60',
      cardBg: 'bg-slate-800/60',
      badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
      template: {
        id: 'template-clock',
        name: 'World Clock',
        widgetType: 'clock' as WidgetType, // lowercase — matches case 'clock' in WidgetRenderer
        w: 3,
        h: 2,
        icon: 'clock' as const,
        color: 'cyan',
      },
    },
  ] as const;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[99] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: 'var(--header-height)' }}
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="sidebar-overlay"
      />

      {/* Panel */}
      <div
        className="fixed left-0 h-[calc(100vh-var(--header-height)-1rem)] bg-slate-900 border-r border-slate-700/80 flex flex-col overflow-hidden shadow-2xl transition-all duration-300"
        style={{
          width: isOpen ? 'min(32rem, 100vw)' : '0',
          visibility: isOpen ? 'visible' : 'hidden',
          opacity: isOpen ? 1 : 0,
          zIndex: isOpen ? 100 : -1,
          top: 'calc(var(--header-height) + 1rem)',
          borderTopRightRadius: 'var(--outer-radius)',
          borderBottomRightRadius: 'var(--outer-radius)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        data-testid="widget-sidebar"
      >
        {/* ── Header ── */}
        <div className="p-[1.6rem] pb-0 border-b border-slate-700/80 flex-shrink-0">
          <div className="flex items-center justify-between mb-[1.4rem]">
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

          {/* Segmented control */}
          <div
            className="flex gap-[0.3rem] bg-slate-800/70 border border-slate-700/60 p-[0.35rem] rounded-xl mb-[1.4rem]"
            role="tablist"
            aria-label="Sidebar sections"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'streams'}
              onClick={() => setActiveTab('streams')}
              data-testid="tab-streams"
              className={`relative flex-1 flex items-center justify-center gap-[0.55rem] py-[0.75rem] px-[1rem] rounded-[0.6rem] text-[1.15rem] font-semibold tracking-tight transition-all duration-200 select-none ${
                activeTab === 'streams'
                  ? 'bg-slate-700 text-white shadow-md shadow-black/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <Radio
                className={`w-[1.3rem] h-[1.3rem] flex-shrink-0 transition-colors ${
                  activeTab === 'streams' ? 'text-cyan-400' : 'text-slate-500'
                }`}
              />
              Streams
              {activeTab === 'streams' && (
                <span className="absolute bottom-[0.3rem] left-1/2 -translate-x-1/2 w-[1.4rem] h-[0.2rem] rounded-full bg-cyan-400 opacity-80" />
              )}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'widgets'}
              onClick={() => setActiveTab('widgets')}
              data-testid="tab-widgets"
              className={`relative flex-1 flex items-center justify-center gap-[0.55rem] py-[0.75rem] px-[1rem] rounded-[0.6rem] text-[1.15rem] font-semibold tracking-tight transition-all duration-200 select-none ${
                activeTab === 'widgets'
                  ? 'bg-slate-700 text-white shadow-md shadow-black/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <LayoutGrid
                className={`w-[1.3rem] h-[1.3rem] flex-shrink-0 transition-colors ${
                  activeTab === 'widgets' ? 'text-purple-400' : 'text-slate-500'
                }`}
              />
              Widgets
              {activeTab === 'widgets' && (
                <span className="absolute bottom-[0.3rem] left-1/2 -translate-x-1/2 w-[1.4rem] h-[0.2rem] rounded-full bg-purple-400 opacity-80" />
              )}
            </button>
          </div>

          {/* URL input — streams tab only */}
          {activeTab === 'streams' && (
            <div className="pb-[1.4rem]">
              <label className="block text-[1rem] font-semibold mb-[0.5rem] text-cyan-400 uppercase tracking-wider">
                {activeWidgetId ? 'Update widget URL' : 'Add video by URL'}
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
                  className="flex-1 px-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem] placeholder:text-slate-600"
                  data-testid="input-url-sidebar"
                />
                <button
                  onClick={() => urlValue.trim() && onUrlSubmit?.(urlValue)}
                  disabled={!urlValue.trim()}
                  className="px-[1.2rem] py-[0.8rem] bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed slot-button font-bold transition-colors text-[1.1rem]"
                  data-testid="button-load-url"
                >
                  ADD
                </button>
              </div>
            </div>
          )}
          {activeTab === 'widgets' && <div className="pb-[0.4rem]" />}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════ STREAMS TAB ════ */}
          {activeTab === 'streams' && (
            <div className="p-[1.6rem] space-y-[1.4rem]">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 100+ streams..."
                  className="w-full pl-[3.6rem] pr-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem] placeholder:text-slate-600"
                  data-testid="input-search-channels"
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-[0.4rem]">
                {([
                  { id: 'all',      label: 'All',     Icon: Layers,   active: 'bg-cyan-600'  },
                  { id: 'news',     label: 'News',    Icon: Globe,    active: 'bg-cyan-600'  },
                  { id: 'gaming',   label: 'Gaming',  Icon: Gamepad2, active: 'bg-green-600' },
                  { id: 'personal', label: 'Saved',   Icon: Heart,    active: 'bg-amber-600' },
                  { id: 'blocked',  label: 'Blocked', Icon: Trash2,   active: 'bg-red-600'   },
                ] as const).map(({ id, label, Icon, active }) => (
                  <button
                    key={id}
                    onClick={() => setActiveCategory(id as ContentCategory)}
                    className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                      activeCategory === id
                        ? `${active} text-white`
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                    data-testid={`category-${id}`}
                  >
                    <Icon className="w-[1.2rem] h-[1.2rem]" />
                    {label}
                    {id === 'personal' && personalLibrary.length > 0 && (
                      <span className="ml-[0.2rem] px-[0.5rem] py-[0.1rem] bg-amber-500/30 rounded-full text-[0.9rem]">
                        {personalLibrary.length}
                      </span>
                    )}
                    {id === 'blocked' && blockedChannels.length > 0 && (
                      <span className="ml-[0.2rem] px-[0.5rem] py-[0.1rem] bg-red-500/30 rounded-full text-[0.9rem]">
                        {blockedChannels.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* All / News / Gaming lists */}
              {activeCategory !== 'personal' && activeCategory !== 'blocked' && (
                <div>
                  <div className="flex items-center justify-between mb-[1rem]">
                    <h3 className="text-[1.4rem] font-semibold text-cyan-400 flex items-center gap-[0.6rem]">
                      <Tv className="w-[1.6rem] h-[1.6rem]" />
                      {activeCategory === 'all' ? 'All Streams' : activeCategory === 'news' ? 'Global News' : 'Gaming & Esports'}
                      <span className="text-[1.1rem] text-slate-500 font-normal">({filteredChannels.length})</span>
                    </h3>
                    <button
                      onClick={() => refetchLinks()}
                      className="p-[0.6rem] hover:bg-slate-800 slot-button transition-colors"
                      title="Refresh"
                      data-testid="button-refresh-links"
                    >
                      <RefreshCw className={`w-[1.4rem] h-[1.4rem] text-cyan-400 ${isLoadingLinks ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                    {linksData?.lastRefresh
                      ? `Updated ${new Date(linksData.lastRefresh).toLocaleDateString()} \u2022 `
                      : ''}
                    Click {'\u2605'} to save
                  </p>
                  <div className="space-y-[0.8rem]">
                    {filteredChannels.map(ch => (
                      <DraggableChannel
                        key={ch.id} channel={ch} onClick={() => onChannelClick?.(ch)}
                        isLive={liveStatuses[ch.id]?.isLive} showSaveButton
                        isSaved={isInPersonalLibrary(ch.id)} isBlocked={isChannelBlocked(ch.id)}
                        onSave={() => saveToPersonalLibrary(ch)}
                        onRemove={() => removeFromPersonalLibrary(ch.id)}
                        onBlock={() => blockChannel(ch)}
                        onUnblock={() => unblockChannel(ch.id)}
                      />
                    ))}
                    {filteredChannels.length === 0 && (
                      <p className="text-[1.2rem] text-slate-500 text-center py-[2rem]">No streams found</p>
                    )}
                  </div>
                </div>
              )}

              {/* Personal Library */}
              {activeCategory === 'personal' && (
                <div>
                  <h3 className="text-[1.4rem] font-semibold text-amber-400 flex items-center gap-[0.6rem] mb-[0.6rem]">
                    <Heart className="w-[1.6rem] h-[1.6rem]" /> Personal Library
                    <span className="text-[1.1rem] text-slate-500 font-normal">({filteredPersonalLibrary.length})</span>
                  </h3>
                  <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                    Your saved streams {'\u2022'} Click {'\u2605'} to remove
                  </p>
                  {filteredPersonalLibrary.length > 0 ? (
                    <div className="space-y-[0.8rem]">
                      {filteredPersonalLibrary.map(ch => (
                        <DraggableChannel
                          key={ch.id} channel={ch as TrendingChannel}
                          onClick={() => onChannelClick?.(ch as TrendingChannel)}
                          isLive={liveStatuses[ch.id]?.isLive} showSaveButton isSaved
                          onRemove={() => removeFromPersonalLibrary(ch.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-[3rem]">
                      <Star className="w-[3rem] h-[3rem] text-slate-700 mx-auto mb-[1rem]" />
                      <p className="text-[1.2rem] text-slate-500 mb-[0.4rem]">No saved streams yet</p>
                      <p className="text-[1.1rem] text-slate-600">Click {'\u2605'} on any stream to save it here</p>
                    </div>
                  )}
                </div>
              )}

              {/* Blocked Channels */}
              {activeCategory === 'blocked' && (
                <div>
                  <h3 className="text-[1.4rem] font-semibold text-red-400 flex items-center gap-[0.6rem] mb-[0.6rem]">
                    <Trash2 className="w-[1.6rem] h-[1.6rem]" /> Blocked Channels
                    <span className="text-[1.1rem] text-slate-500 font-normal">({filteredBlockedChannels.length})</span>
                  </h3>
                  <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                    Hidden from library {'\u2022'} Click trash to unblock
                  </p>
                  {filteredBlockedChannels.length > 0 ? (
                    <div className="space-y-[0.8rem]">
                      {filteredBlockedChannels.map(ch => (
                        <DraggableChannel
                          key={ch.id} channel={ch}
                          onClick={() => onChannelClick?.(ch as TrendingChannel)}
                          isLive={false} showSaveButton isSaved={false} isBlocked
                          onUnblock={() => unblockChannel(ch.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-[3rem]">
                      <Trash2 className="w-[3rem] h-[3rem] text-slate-700 mx-auto mb-[1rem]" />
                      <p className="text-[1.2rem] text-slate-500 mb-[0.4rem]">No blocked channels</p>
                      <p className="text-[1.1rem] text-slate-600">Click trash on any stream to hide it</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ WIDGETS TAB ════ */}
          {activeTab === 'widgets' && (
            <div className="p-[1.6rem] space-y-[2rem]">
              <div>
                <p className="text-[1.25rem] font-semibold text-slate-200 mb-[0.4rem]">Interactive Blocks</p>
                <p className="text-[1.1rem] text-slate-500">
                  Click to add a block to your dashboard. Blocks auto-place on the grid.
                </p>
              </div>

              <div>
                <p className="text-[0.95rem] font-bold text-slate-500 uppercase tracking-[0.1em] mb-[1rem]">Available</p>

                {/*
                  Two widget buttons: Note and World Clock.
                  Zoom is intentionally absent — it renders as null (ghost-box fix).

                  Each button calls onTemplateClick(w.template) which passes a
                  WidgetTemplate with widgetType: 'note' | 'clock' (strictly
                  lowercase). App.tsx's addWidget() receives this string and the
                  WidgetRenderer switch dispatches it to the correct renderer.

                  Ghost-box root cause explained:
                    If widgetType were 'Clock' (capital C), the switch in
                    WidgetRenderer would miss both 'clock' and 'zoom' cases and
                    fall through to the default branch, which returns the
                    "Unknown Widget Type" debug tile — which previously appeared
                    as a transparent ghost box before the default case was added.
                */}
                <div className="grid grid-cols-2 gap-[0.8rem]">
                  {availableWidgets.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => onTemplateClick?.(w.template)}
                      className={`group relative flex flex-col items-center justify-center gap-[0.8rem] p-[1.4rem] rounded-xl border ${w.border} ${w.cardBg} transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}
                      data-testid={`widget-library-${w.id}`}
                    >
                      {/* Icon container */}
                      <div
                        className={`w-[4rem] h-[4rem] rounded-xl ${w.iconBg} border border-slate-700/50 flex items-center justify-center group-hover:border-slate-600 transition-colors`}
                      >
                        {w.icon}
                      </div>

                      {/* Labels */}
                      <div className="text-center">
                        <p className="text-[1.15rem] font-semibold text-slate-200 leading-tight">{w.label}</p>
                        <p className="text-[0.95rem] text-slate-500 mt-[0.2rem] leading-snug">{w.description}</p>
                      </div>

                      {/* ADD badge */}
                      <span
                        className={`absolute top-[0.7rem] right-[0.7rem] text-[0.8rem] font-bold px-[0.55rem] py-[0.2rem] rounded-full border ${w.badgeColor}`}
                      >
                        ADD
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-[1.6rem] border-t border-slate-700/80 flex-shrink-0">
          <a
            href="https://buymeacoffee.com/openbento"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-[0.8rem] px-[1.2rem] py-[1rem] bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 slot-button font-semibold transition-all shadow-lg mb-[1rem] text-[1.2rem]"
            data-testid="button-support-openbento"
          >
            <Heart className="w-[1.6rem] h-[1.6rem]" />
            Support OpenBento
          </a>
          <p className="text-[1rem] text-slate-600 text-center mb-[0.8rem]">
            {activeTab === 'streams' ? 'Click or drag streams to add to grid' : 'Click a widget block to add it'}
          </p>
          <div className="text-center text-[10px] text-slate-700">
            <span>{'\u00A9'} 2026 ANCU LABS FZC LLC</span>
            <span className="mx-2">{'\u2022'}</span>
            <a href="/terms" className="hover:text-slate-400 transition-colors" data-testid="link-terms-sidebar">Terms</a>
            <span className="mx-2">{'\u2022'}</span>
            <a href="/privacy" className="hover:text-slate-400 transition-colors" data-testid="link-privacy-sidebar">Privacy</a>
          </div>
        </div>
      </div>
    </>
  );
}

export { FALLBACK_CHANNELS as TRENDING_CHANNELS, loadPersonalLibrary, savePersonalLibrary };