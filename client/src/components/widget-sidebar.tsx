  import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
  import {
    X, Search, Tv, LayoutGrid, Grip, Layers,
    Gamepad2, RefreshCw, Star,
    Trash2, Globe, Heart, Radio, PenLine, Clock,
    AlertCircle, CloudSun, BookOpen, QrCode, TrendingUp,
    Hourglass, Github, Rss,
    Flame, Grid3x3, Megaphone, Activity, ImageIcon,
    CloudRain, Droplet, Smile, Users,
    Sparkles, Sun, Globe2, Satellite,
    CalendarDays, Quote as QuoteIcon, Puzzle, HelpCircle,
    Wind, Brush, Code2, ShieldAlert, ExternalLink,
  } from 'lucide-react';
  import {
    SAMPLE_CUSTOM_WIDGETS,
    isAllowedCustomWidgetUrl,
  } from '@shared/widget-sdk-protocol';

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
  import {
    loadPersonalLibrary,
    savedChannelIdentity,
    type SavedChannel,
  } from '@/lib/personal-library';

  const BLOCKED_CHANNELS_KEY = 'openBentoBlockedChannels';

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

  export interface WidgetTemplate {
    id: string;
    name: string;
    widgetType: WidgetType;
    w: number;
    h: number;
    icon: 'video' | 'note' | 'spacer' | 'image' | 'clock' | 'crisis_ticker' | 'weather' | 'dictionary' | 'qr_generator' | 'markets_ticker' | 'world_clocks' | 'countdown' | 'github_pulse' | 'rss_headlines' | 'habit_tracker' | 'quick_launch' | 'big_text_marquee' | 'network_light' | 'photo_loop' | 'focus_soundscape' | 'water_tracker' | 'mood_checkin' | 'standup_roller' | 'lava_lamp' | 'sun_sky' | 'earth_night' | 'iss_tracker' | 'on_this_day' | 'quote' | 'wordle' | 'trivia' | 'air_quality' | 'sketch_pad' | 'custom_widget' | 'default';
    color: string;
  }

  export const WIDGET_TEMPLATES: WidgetTemplate[] = [
    { id: 'template-video',        name: 'Video',        widgetType: 'video',        w: 3, h: 2, icon: 'video',        color: 'cyan'    },
    { id: 'template-note',         name: 'Note',         widgetType: 'note',         w: 3, h: 2, icon: 'note',         color: 'yellow'  },
    { id: 'template-spacer',       name: 'Spacer',       widgetType: 'spacer',       w: 2, h: 1, icon: 'spacer',       color: 'slate'   },
    { id: 'template-image',        name: 'Photo',        widgetType: 'image',        w: 3, h: 2, icon: 'image',        color: 'purple'  },
    { id: 'template-clock',        name: 'Clock',        widgetType: 'clock',        w: 3, h: 2, icon: 'clock',        color: 'cyan'    },
    { id: 'template-crisis-ticker', name: 'Crisis Intel', widgetType: 'crisis_ticker', w: 3, h: 2, icon: 'crisis_ticker', color: 'red'   },
    { id: 'template-markets-ticker', name: 'Markets',    widgetType: 'markets_ticker', w: 3, h: 3, icon: 'markets_ticker', color: 'emerald' },
    { id: 'template-weather',      name: 'Weather',      widgetType: 'weather',      w: 2, h: 2, icon: 'weather',      color: 'sky'     },
    { id: 'template-dictionary',   name: 'Dictionary',   widgetType: 'dictionary',   w: 3, h: 2, icon: 'dictionary',   color: 'indigo'  },
    { id: 'template-qr-generator', name: 'QR Portal',    widgetType: 'qr_generator', w: 3, h: 3, icon: 'qr_generator', color: 'violet'  },
    { id: 'template-world-clocks', name: 'World Clocks', widgetType: 'world_clocks', w: 4, h: 2, icon: 'world_clocks', color: 'amber'   },
    { id: 'template-countdown',    name: 'Countdown',    widgetType: 'countdown',    w: 3, h: 2, icon: 'countdown',    color: 'fuchsia' },
    { id: 'template-github-pulse', name: 'GitHub Pulse', widgetType: 'github_pulse', w: 3, h: 3, icon: 'github_pulse', color: 'slate'   },
    { id: 'template-rss-headlines', name: 'RSS Headlines', widgetType: 'rss_headlines', w: 3, h: 3, icon: 'rss_headlines', color: 'orange' },
    { id: 'template-habit-tracker', name: 'Habit Tracker', widgetType: 'habit_tracker', w: 3, h: 3, icon: 'habit_tracker', color: 'rose' },
    { id: 'template-quick-launch', name: 'Quick Launch', widgetType: 'quick_launch', w: 3, h: 3, icon: 'quick_launch', color: 'teal' },
    { id: 'template-big-text-marquee', name: 'Big Text', widgetType: 'big_text_marquee', w: 4, h: 2, icon: 'big_text_marquee', color: 'pink' },
    { id: 'template-network-light', name: 'Network Light', widgetType: 'network_light', w: 2, h: 2, icon: 'network_light', color: 'lime' },
    { id: 'template-photo-loop', name: 'Photo Loop', widgetType: 'photo_loop', w: 3, h: 3, icon: 'photo_loop', color: 'purple' },
    { id: 'template-focus-soundscape', name: 'Soundscape', widgetType: 'focus_soundscape', w: 2, h: 3, icon: 'focus_soundscape', color: 'cyan' },
    { id: 'template-water-tracker',    name: 'Water',      widgetType: 'water_tracker',    w: 2, h: 2, icon: 'water_tracker',    color: 'sky' },
    { id: 'template-mood-checkin',     name: 'Mood',       widgetType: 'mood_checkin',     w: 3, h: 2, icon: 'mood_checkin',     color: 'violet' },
    { id: 'template-standup-roller',   name: 'Standup',    widgetType: 'standup_roller',   w: 3, h: 3, icon: 'standup_roller',   color: 'emerald' },
    { id: 'template-lava-lamp',        name: 'Lava Lamp',  widgetType: 'lava_lamp',        w: 3, h: 3, icon: 'lava_lamp',        color: 'fuchsia' },
    { id: 'template-sun-sky',          name: 'Sun & Sky',  widgetType: 'sun_sky',          w: 3, h: 2, icon: 'sun_sky',          color: 'amber'   },
    { id: 'template-earth-night',      name: 'Earth Night', widgetType: 'earth_night',     w: 3, h: 3, icon: 'earth_night',      color: 'sky'     },
    { id: 'template-iss-tracker',      name: 'ISS Live',   widgetType: 'iss_tracker',      w: 3, h: 3, icon: 'iss_tracker',      color: 'cyan'    },
    { id: 'template-on-this-day',      name: 'On This Day', widgetType: 'on_this_day',     w: 3, h: 3, icon: 'on_this_day',      color: 'violet'  },
    { id: 'template-quote',            name: 'Quote',      widgetType: 'quote',            w: 3, h: 2, icon: 'quote',            color: 'cyan'    },
    { id: 'template-wordle',           name: 'Wordle',     widgetType: 'wordle',           w: 3, h: 3, icon: 'wordle',           color: 'teal'    },
    { id: 'template-trivia',           name: 'Trivia',     widgetType: 'trivia',           w: 3, h: 3, icon: 'trivia',           color: 'purple'  },
    { id: 'template-air-quality',      name: 'Air Quality', widgetType: 'air_quality',     w: 2, h: 3, icon: 'air_quality',      color: 'emerald' },
    { id: 'template-sketch-pad',       name: 'Sketch Pad', widgetType: 'sketch_pad',       w: 4, h: 3, icon: 'sketch_pad',       color: 'pink'    },
  ];

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

  type SidebarTab      = 'streams' | 'widgets';
  type ContentCategory = 'all' | 'news' | 'gaming' | 'personal' | 'blocked';

  const FALLBACK_CHANNELS: TrendingChannel[] = [];

  interface LinksApiResponse {
    channels: TrendingChannel[];
    lastRefresh: number;
    origin: string;
  }

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
    /**
     * showTrashButton — defaults to true.
     * Pass showTrashButton={false} in the Personal Library section to hide
     * the trash/block icon while keeping the star (unsave) button.
     * All other lists (All / News / Gaming / Blocked) omit this prop so it
     * stays true and renders the trash icon as normal.
     */
    showTrashButton?: boolean;
  }

  function DraggableChannel({
    channel, onClick, isLive, isSaved, isBlocked,
    onSave, onRemove, onBlock, onUnblock,
    showSaveButton,
    showTrashButton = true,
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

    const handleSaveClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isSaved && onRemove) {
        onRemove();
      } else {
        onSave?.();
      }
    };

    const handleTrashClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isBlocked && onUnblock) {
        onUnblock();
      } else if (isSaved && onRemove) {
        onRemove();
      } else {
        onBlock?.();
      }
    };

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
    // Typed lookup so iconType === 'default' is a real key, not an
    // implicit fallback that the type checker has to look the other way on.
    const FALLBACK_BG: Record<typeof channel.iconType, string> = {
      news:    'bg-blue-500',
      science: 'bg-purple-500',
      gaming:  'bg-green-500',
      finance: 'bg-amber-500',
      default: 'bg-cyan-500',
    };
    const fallbackBg = FALLBACK_BG[channel.iconType];

    return (
      <div
        ref={setNodeRef} style={style} {...attributes} {...listeners}
        onClick={() => { if (!isDragging) onClick?.(); }}
        className="channel-item flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border border-slate-700/50 hover:border-cyan-500/50"
        data-testid={`draggable-channel-${channel.id}`}
      >
        <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center relative overflow-hidden flex-shrink-0">
          {showLogo ? (
            <img
              src={logoUrl} alt={channel.name} className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.src = '/default-icon.png';
                if (logoUrl) failedLogoCache.add(logoUrl);
                setLogoError(true);
              }}
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

        {/* Star — save / unsave */}
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

        {/*
          Trash button — hidden in the Personal Library via showTrashButton={false}.
          Visible in All / News / Gaming lists (block channel) and in the
          Blocked list (unblock channel). showTrashButton defaults to true so
          all other call-sites need no change.
        */}
        {showSaveButton && showTrashButton && (
          <button
            onClick={handleTrashClick}
            onPointerDown={(e) => e.stopPropagation()}
            className={`p-[0.6rem] rounded-lg transition-colors ${
              isBlocked
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                : 'hover:bg-slate-700 text-slate-500 hover:text-red-400'
            }`}
            title={isBlocked ? 'Unblock channel' : isSaved ? 'Remove from Personal Library' : 'Block channel'}
            data-testid={`block-channel-${channel.id}`}
          >
            <Trash2 className={`w-[1.4rem] h-[1.4rem] ${isBlocked ? 'fill-red-400' : ''}`} />
          </button>
        )}

        <Grip className="w-[1.6rem] h-[1.6rem] text-slate-500 flex-shrink-0" />
      </div>
    );
  }

  interface WidgetSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onChannelClick?: (channel: TrendingChannel) => void;
    onTemplateClick?: (template: WidgetTemplate) => void;
    onCustomWidgetAdd?: (url: string, opts: { trusted: boolean }) => void;
    urlValue?: string;
    onUrlChange?: (value: string) => void;
    onUrlSubmit?: (url: string) => void;
    activeWidgetId?: string | null;
    onImageUpload?: (imageUrl: string) => void;
    isAuthenticated?: boolean;
    openLoginModal?: (reason?: string) => void;
    /** When set, opens the Custom Widget add modal pre-filled with this
     *  URL (used by the /widgets marketplace install handoff). */
    pendingInstallUrl?: string | null;
    onPendingInstallConsumed?: () => void;
  }

  export function WidgetSidebar({
    isOpen,
    onClose,
    onChannelClick,
    onTemplateClick,
    onCustomWidgetAdd,
    urlValue = '',
    onUrlChange,
    onUrlSubmit,
    activeWidgetId,
    onImageUpload,
    isAuthenticated = false,
    openLoginModal,
    pendingInstallUrl = null,
    onPendingInstallConsumed,
  }: WidgetSidebarProps) {
    const [activeTab, setActiveTab]             = useState<SidebarTab>('streams');
    const [activeCategory, setActiveCategory]   = useState<ContentCategory>('all');
    const [searchQuery, setSearchQuery]         = useState('');
    const [widgetSearchQuery, setWidgetSearchQuery] = useState('');
    const [liveStatuses, setLiveStatuses]       = useState<Record<string, LiveStatus>>({});
    const [personalLibrary, setPersonalLibrary] = useState<SavedChannel[]>(() => loadPersonalLibrary());
    const [blockedChannels, setBlockedChannels] = useState<BlockedChannel[]>(() => loadBlockedChannels());

    // ─── Custom Widget add modal (sandboxed iframe SDK) ─────────────────
    const [customModalOpen, setCustomModalOpen]   = useState(false);
    const [customUrlInput, setCustomUrlInput]     = useState('');
    const [customTrusted, setCustomTrusted]       = useState(false);
    const customUrlValid = isAllowedCustomWidgetUrl(customUrlInput);
    // Marketplace handoff: pop the Custom Widget modal pre-filled.
    useEffect(() => {
      if (!pendingInstallUrl) return;
      setActiveTab('widgets');
      setCustomUrlInput(pendingInstallUrl);
      setCustomTrusted(false);
      setCustomModalOpen(true);
      onPendingInstallConsumed?.();
    }, [pendingInstallUrl, onPendingInstallConsumed]);

    const submitCustomWidget = (url: string, trusted: boolean) => {
      if (!isAllowedCustomWidgetUrl(url)) return;
      onCustomWidgetAdd?.(url, { trusted });
      setCustomModalOpen(false);
      setCustomUrlInput('');
      setCustomTrusted(false);
    };

    useEffect(() => {
      const h = () => setPersonalLibrary(loadPersonalLibrary());
      window.addEventListener('personalLibraryUpdated', h);
      return () => window.removeEventListener('personalLibraryUpdated', h);
    }, []);

    useEffect(() => {
      const h = () => setBlockedChannels(loadBlockedChannels());
      window.addEventListener('blockedChannelsUpdated', h);
      return () => window.removeEventListener('blockedChannelsUpdated', h);
    }, []);

    const saveToPersonalLibrary = useCallback((channel: TrendingChannel) => {
      if (!isAuthenticated) {
        openLoginModal?.('Sign in to save channels to your library and sync them across devices.');
        return;
      }
      void import('@/lib/personal-library-sync').then(({ addSavedChannelToPersonalLibrary }) => {
        void addSavedChannelToPersonalLibrary({
          id: channel.id, name: channel.name, url: channel.url,
          iconType: channel.iconType, category: channel.category,
          platform: channel.platform, channelId: channel.channelId,
          videoId: channel.videoId, savedAt: Date.now(),
        });
      });
    }, [isAuthenticated, openLoginModal]);

    const removeFromPersonalLibrary = useCallback((id: string) => {
      const channel = personalLibrary.find(item => item.id === id);
      if (channel) {
        void import('@/lib/personal-library-sync').then(({ removeSavedChannelFromPersonalLibrary }) => {
          void removeSavedChannelFromPersonalLibrary(channel);
        });
      }
    }, [personalLibrary]);

    const isInPersonalLibrary = useCallback((channel: TrendingChannel) => {
      const identity = savedChannelIdentity(channel);
      return personalLibrary.some(item => savedChannelIdentity(item) === identity);
    }, [personalLibrary]);

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

    const { data: linksData, isLoading: isLoadingLinks, refetch: refetchLinks } = useQuery<LinksApiResponse>({
      queryKey: ['/api/links'],
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
    });

    const channels: TrendingChannel[] = linksData?.channels?.length ? linksData.channels : FALLBACK_CHANNELS;

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
          widgetType: 'note' as WidgetType,
          w: 3, h: 2,
          icon: 'note' as const,
          color: 'yellow',
        },
      },
      {
        id: 'clock',
        label: 'Clock',
        description: 'Live time & date display',
        icon: <Clock className="w-[2rem] h-[2rem] text-cyan-400" />,
        iconBg: 'bg-cyan-500/15',
        border: 'border-cyan-500/30 hover:border-cyan-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
        template: {
          id: 'template-clock',
          name: 'Clock',
          widgetType: 'clock' as WidgetType,
          w: 3, h: 2,
          icon: 'clock' as const,
          color: 'cyan',
        },
      },
      {
        id: 'crisis_ticker',
        label: 'Crisis Intel',
        description: 'Breaking news ticker',
        icon: <AlertCircle className="w-[2rem] h-[2rem] text-red-400" />,
        iconBg: 'bg-red-500/15',
        border: 'border-red-500/30 hover:border-red-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-red-400 bg-red-500/15 border-red-500/40',
        template: {
          id: 'template-crisis-ticker',
          name: 'Crisis Intel',
          widgetType: 'crisis_ticker' as WidgetType,
          w: 3, h: 2,
          icon: 'crisis_ticker' as const,
          color: 'red',
        },
      },
      {
        id: 'weather',
        label: 'Weather',
        description: 'Local weather display',
        icon: <CloudSun className="w-[2rem] h-[2rem] text-sky-400" />,
        iconBg: 'bg-sky-500/15',
        border: 'border-sky-500/30 hover:border-sky-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
        template: {
          id: 'template-weather',
          name: 'Weather',
          widgetType: 'weather' as WidgetType,
          w: 2, h: 2,
          icon: 'weather' as const,
          color: 'sky',
        },
      },
      {
        id: 'dictionary',
        label: 'Dictionary',
        description: 'Daily power word & definition',
        icon: <BookOpen className="w-[2rem] h-[2rem] text-indigo-400" />,
        iconBg: 'bg-indigo-500/15',
        border: 'border-indigo-500/30 hover:border-indigo-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/40',
        template: {
          id: 'template-dictionary',
          name: 'Dictionary',
          widgetType: 'dictionary' as WidgetType,
          w: 3, h: 2,
          icon: 'dictionary' as const,
          color: 'indigo',
        },
      },
      {
        id: 'qr_generator',
        label: 'QR Portal',
        description: 'Instant QR code generator',
        icon: <QrCode className="w-[2rem] h-[2rem] text-violet-400" />,
        iconBg: 'bg-violet-500/15',
        border: 'border-violet-500/30 hover:border-violet-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/40',
        template: {
          id: 'template-qr-generator',
          name: 'QR Portal',
          widgetType: 'qr_generator' as WidgetType,
          w: 3, h: 3,
          icon: 'qr_generator' as const,
          color: 'violet',
        },
      },
      {
        id: 'markets_ticker',
        label: 'Markets',
        description: 'Live crypto & stock prices with sparkline',
        icon: <TrendingUp className="w-[2rem] h-[2rem] text-emerald-400" />,
        iconBg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30 hover:border-emerald-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
        template: {
          id: 'template-markets-ticker',
          name: 'Markets',
          widgetType: 'markets_ticker' as WidgetType,
          w: 3, h: 3,
          icon: 'markets_ticker' as const,
          color: 'emerald',
        },
      },
      {
        id: 'world_clocks',
        label: 'World Clocks',
        description: 'City times around the globe with day/night dot',
        icon: <Globe className="w-[2rem] h-[2rem] text-amber-400" />,
        iconBg: 'bg-amber-500/15',
        border: 'border-amber-500/30 hover:border-amber-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
        template: {
          id: 'template-world-clocks',
          name: 'World Clocks',
          widgetType: 'world_clocks' as WidgetType,
          w: 4, h: 2,
          icon: 'world_clocks' as const,
          color: 'amber',
        },
      },
      {
        id: 'countdown',
        label: 'Countdown',
        description: 'Days, hours and minutes until your big moment',
        icon: <Hourglass className="w-[2rem] h-[2rem] text-fuchsia-400" />,
        iconBg: 'bg-fuchsia-500/15',
        border: 'border-fuchsia-500/30 hover:border-fuchsia-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/40',
        template: {
          id: 'template-countdown',
          name: 'Countdown',
          widgetType: 'countdown' as WidgetType,
          w: 3, h: 2,
          icon: 'countdown' as const,
          color: 'fuchsia',
        },
      },
      {
        id: 'github_pulse',
        label: 'GitHub Pulse',
        description: 'Stars, open PRs, last commit & latest release',
        icon: <Github className="w-[2rem] h-[2rem] text-slate-300" />,
        iconBg: 'bg-slate-500/15',
        border: 'border-slate-500/30 hover:border-slate-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-slate-300 bg-slate-500/15 border-slate-500/40',
        template: {
          id: 'template-github-pulse',
          name: 'GitHub Pulse',
          widgetType: 'github_pulse' as WidgetType,
          w: 3, h: 3,
          icon: 'github_pulse' as const,
          color: 'slate',
        },
      },
      {
        id: 'rss_headlines',
        label: 'RSS Headlines',
        description: 'Scrolling list of any RSS or Atom feed',
        icon: <Rss className="w-[2rem] h-[2rem] text-orange-400" />,
        iconBg: 'bg-orange-500/15',
        border: 'border-orange-500/30 hover:border-orange-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-orange-400 bg-orange-500/15 border-orange-500/40',
        template: {
          id: 'template-rss-headlines',
          name: 'RSS Headlines',
          widgetType: 'rss_headlines' as WidgetType,
          w: 3, h: 3,
          icon: 'rss_headlines' as const,
          color: 'orange',
        },
      },
      {
        id: 'habit_tracker',
        label: 'Habit Tracker',
        description: 'Daily check-ins with 7-day streak strip',
        icon: <Flame className="w-[2rem] h-[2rem] text-rose-400" />,
        iconBg: 'bg-rose-500/15',
        border: 'border-rose-500/30 hover:border-rose-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
        template: {
          id: 'template-habit-tracker',
          name: 'Habit Tracker',
          widgetType: 'habit_tracker' as WidgetType,
          w: 3, h: 3,
          icon: 'habit_tracker' as const,
          color: 'rose',
        },
      },
      {
        id: 'quick_launch',
        label: 'Quick Launch',
        description: 'Grid of named URL tiles you can click to open',
        icon: <Grid3x3 className="w-[2rem] h-[2rem] text-teal-400" />,
        iconBg: 'bg-teal-500/15',
        border: 'border-teal-500/30 hover:border-teal-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-teal-400 bg-teal-500/15 border-teal-500/40',
        template: {
          id: 'template-quick-launch',
          name: 'Quick Launch',
          widgetType: 'quick_launch' as WidgetType,
          w: 3, h: 3,
          icon: 'quick_launch' as const,
          color: 'teal',
        },
      },
      {
        id: 'big_text_marquee',
        label: 'Big Text',
        description: 'Static or scrolling banner — perfect for "ON AIR"',
        icon: <Megaphone className="w-[2rem] h-[2rem] text-pink-400" />,
        iconBg: 'bg-pink-500/15',
        border: 'border-pink-500/30 hover:border-pink-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-pink-400 bg-pink-500/15 border-pink-500/40',
        template: {
          id: 'template-big-text-marquee',
          name: 'Big Text',
          widgetType: 'big_text_marquee' as WidgetType,
          w: 4, h: 2,
          icon: 'big_text_marquee' as const,
          color: 'pink',
        },
      },
      {
        id: 'network_light',
        label: 'Network Light',
        description: 'Pings any URL on a timer with green/red status',
        icon: <Activity className="w-[2rem] h-[2rem] text-lime-400" />,
        iconBg: 'bg-lime-500/15',
        border: 'border-lime-500/30 hover:border-lime-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-lime-400 bg-lime-500/15 border-lime-500/40',
        template: {
          id: 'template-network-light',
          name: 'Network Light',
          widgetType: 'network_light' as WidgetType,
          w: 2, h: 2,
          icon: 'network_light' as const,
          color: 'lime',
        },
      },
      {
        id: 'photo_loop',
        label: 'Photo Loop',
        description: 'Rotating gallery from URLs or uploaded images',
        icon: <ImageIcon className="w-[2rem] h-[2rem] text-purple-400" />,
        iconBg: 'bg-purple-500/15',
        border: 'border-purple-500/30 hover:border-purple-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-purple-400 bg-purple-500/15 border-purple-500/40',
        template: {
          id: 'template-photo-loop',
          name: 'Photo Loop',
          widgetType: 'photo_loop' as WidgetType,
          w: 3, h: 3,
          icon: 'photo_loop' as const,
          color: 'purple',
        },
      },
      {
        id: 'focus_soundscape',
        label: 'Soundscape',
        description: 'Procedural ambient loops — rain, cafe, fire, forest, waves',
        icon: <CloudRain className="w-[2rem] h-[2rem] text-cyan-400" />,
        iconBg: 'bg-cyan-500/15',
        border: 'border-cyan-500/30 hover:border-cyan-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
        template: {
          id: 'template-focus-soundscape',
          name: 'Soundscape',
          widgetType: 'focus_soundscape' as WidgetType,
          w: 2, h: 3,
          icon: 'focus_soundscape' as const,
          color: 'cyan',
        },
      },
      {
        id: 'air_quality',
        label: 'Air Quality',
        description: 'Live AQI, dominant pollutant, optional pollen — refreshes every 30 min',
        icon: <Wind className="w-[2rem] h-[2rem] text-emerald-400" />,
        iconBg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30 hover:border-emerald-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
        template: {
          id: 'template-air-quality',
          name: 'Air Quality',
          widgetType: 'air_quality' as WidgetType,
          w: 2, h: 3,
          icon: 'air_quality' as const,
          color: 'emerald',
        },
      },
      {
        id: 'water_tracker',
        label: 'Water Tracker',
        description: 'Tap +/- cups against a daily target with streak',
        icon: <Droplet className="w-[2rem] h-[2rem] text-sky-400" />,
        iconBg: 'bg-sky-500/15',
        border: 'border-sky-500/30 hover:border-sky-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
        template: {
          id: 'template-water-tracker',
          name: 'Water',
          widgetType: 'water_tracker' as WidgetType,
          w: 2, h: 2,
          icon: 'water_tracker' as const,
          color: 'sky',
        },
      },
      {
        id: 'mood_checkin',
        label: 'Mood Check-in',
        description: 'Daily emoji mood with a 30-day heatmap',
        icon: <Smile className="w-[2rem] h-[2rem] text-violet-400" />,
        iconBg: 'bg-violet-500/15',
        border: 'border-violet-500/30 hover:border-violet-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/40',
        template: {
          id: 'template-mood-checkin',
          name: 'Mood',
          widgetType: 'mood_checkin' as WidgetType,
          w: 3, h: 2,
          icon: 'mood_checkin' as const,
          color: 'violet',
        },
      },
      {
        id: 'standup_roller',
        label: 'Standup Roller',
        description: 'Roster + Roll button to shuffle the speaking order',
        icon: <Users className="w-[2rem] h-[2rem] text-emerald-400" />,
        iconBg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30 hover:border-emerald-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
        template: {
          id: 'template-standup-roller',
          name: 'Standup',
          widgetType: 'standup_roller' as WidgetType,
          w: 3, h: 3,
          icon: 'standup_roller' as const,
          color: 'emerald',
        },
      },
      {
        id: 'lava_lamp',
        label: 'Lava Lamp',
        description: 'Slow blob animation — 5 palettes or match background',
        icon: <Sparkles className="w-[2rem] h-[2rem] text-fuchsia-400" />,
        iconBg: 'bg-fuchsia-500/15',
        border: 'border-fuchsia-500/30 hover:border-fuchsia-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/40',
        template: {
          id: 'template-lava-lamp',
          name: 'Lava Lamp',
          widgetType: 'lava_lamp' as WidgetType,
          w: 3, h: 3,
          icon: 'lava_lamp' as const,
          color: 'fuchsia',
        },
      },
      {
        id: 'sun_sky',
        label: 'Sun & Sky',
        description: 'Sunrise, sunset, golden hour and moon phase',
        icon: <Sun className="w-[2rem] h-[2rem] text-amber-400" />,
        iconBg: 'bg-amber-500/15',
        border: 'border-amber-500/30 hover:border-amber-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
        template: {
          id: 'template-sun-sky',
          name: 'Sun & Sky',
          widgetType: 'sun_sky' as WidgetType,
          w: 3, h: 2,
          icon: 'sun_sky' as const,
          color: 'amber',
        },
      },
      {
        id: 'earth_night',
        label: 'Earth at Night',
        description: 'Slowly rotating night-side globe',
        icon: <Globe2 className="w-[2rem] h-[2rem] text-sky-400" />,
        iconBg: 'bg-sky-500/15',
        border: 'border-sky-500/30 hover:border-sky-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
        template: {
          id: 'template-earth-night',
          name: 'Earth Night',
          widgetType: 'earth_night' as WidgetType,
          w: 3, h: 3,
          icon: 'earth_night' as const,
          color: 'sky',
        },
      },
      {
        id: 'iss_tracker',
        label: 'ISS Live',
        description: 'Live International Space Station position with optional reference city',
        icon: <Satellite className="w-[2rem] h-[2rem] text-cyan-400" />,
        iconBg: 'bg-cyan-500/15',
        border: 'border-cyan-500/30 hover:border-cyan-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
        template: {
          id: 'template-iss-tracker',
          name: 'ISS Live',
          widgetType: 'iss_tracker' as WidgetType,
          w: 3, h: 3,
          icon: 'iss_tracker' as const,
          color: 'cyan',
        },
      },
      {
        id: 'on_this_day',
        label: 'On This Day',
        description: 'Wikipedia historical events for today, auto-rotating',
        icon: <CalendarDays className="w-[2rem] h-[2rem] text-violet-400" />,
        iconBg: 'bg-violet-500/15',
        border: 'border-violet-500/30 hover:border-violet-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/40',
        template: {
          id: 'template-on-this-day',
          name: 'On This Day',
          widgetType: 'on_this_day' as WidgetType,
          w: 3, h: 3,
          icon: 'on_this_day' as const,
          color: 'violet',
        },
      },
      {
        id: 'quote',
        label: 'Random Quote',
        description: 'Daily inspiration with refresh and heart-favourite',
        icon: <QuoteIcon className="w-[2rem] h-[2rem] text-cyan-400" />,
        iconBg: 'bg-cyan-500/15',
        border: 'border-cyan-500/30 hover:border-cyan-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
        template: {
          id: 'template-quote',
          name: 'Quote',
          widgetType: 'quote' as WidgetType,
          w: 3, h: 2,
          icon: 'quote' as const,
          color: 'cyan',
        },
      },
      {
        id: 'wordle',
        label: 'Daily Wordle',
        description: 'One 5-letter puzzle per day — same word for everyone',
        icon: <Puzzle className="w-[2rem] h-[2rem] text-teal-400" />,
        iconBg: 'bg-teal-500/15',
        border: 'border-teal-500/30 hover:border-teal-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-teal-400 bg-teal-500/15 border-teal-500/40',
        template: {
          id: 'template-wordle',
          name: 'Wordle',
          widgetType: 'wordle' as WidgetType,
          w: 3, h: 3,
          icon: 'wordle' as const,
          color: 'teal',
        },
      },
      {
        id: 'trivia',
        label: 'Trivia',
        description: 'Multiple-choice trivia with running score',
        icon: <HelpCircle className="w-[2rem] h-[2rem] text-purple-400" />,
        iconBg: 'bg-purple-500/15',
        border: 'border-purple-500/30 hover:border-purple-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-purple-400 bg-purple-500/15 border-purple-500/40',
        template: {
          id: 'template-trivia',
          name: 'Trivia',
          widgetType: 'trivia' as WidgetType,
          w: 3, h: 3,
          icon: 'trivia' as const,
          color: 'purple',
        },
      },
      {
        id: 'custom_widget',
        label: 'Custom Widget',
        description: 'Mount any third-party widget by URL — sandboxed iframe + SDK',
        icon: <Code2 className="w-[2rem] h-[2rem] text-cyan-400" />,
        iconBg: 'bg-cyan-500/15',
        border: 'border-cyan-500/30 hover:border-cyan-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
        template: {
          id: 'template-custom-widget',
          name: 'Custom Widget',
          widgetType: 'custom_widget' as WidgetType,
          w: 4, h: 4,
          icon: 'custom_widget' as const,
          color: 'cyan',
        },
      },
      {
        id: 'sketch_pad',
        label: 'Sketch Pad',
        description: 'Freehand drawing canvas with brushes, eraser, undo & PNG export',
        icon: <Brush className="w-[2rem] h-[2rem] text-pink-400" />,
        iconBg: 'bg-pink-500/15',
        border: 'border-pink-500/30 hover:border-pink-400/60',
        cardBg: 'bg-slate-800/60',
        badgeColor: 'text-pink-400 bg-pink-500/15 border-pink-500/40',
        template: {
          id: 'template-sketch-pad',
          name: 'Sketch Pad',
          widgetType: 'sketch_pad' as WidgetType,
          w: 4, h: 3,
          icon: 'sketch_pad' as const,
          color: 'pink',
        },
      },
    ] as const;

    const normalizedWidgetSearch = widgetSearchQuery.trim().toLowerCase();
    const filteredAvailableWidgets = normalizedWidgetSearch
      ? availableWidgets.filter((w) => {
          const fields = [
            w.label,
            w.description,
            w.id,
            w.template.name,
            w.template.widgetType,
            w.template.color,
          ];
          return fields.some((field) =>
            String(field).toLowerCase().includes(normalizedWidgetSearch)
          );
        })
      : availableWidgets;

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
          {/* Header */}
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
                <Radio className={`w-[1.3rem] h-[1.3rem] flex-shrink-0 transition-colors ${activeTab === 'streams' ? 'text-cyan-400' : 'text-slate-500'}`} />
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
                <LayoutGrid className={`w-[1.3rem] h-[1.3rem] flex-shrink-0 transition-colors ${activeTab === 'widgets' ? 'text-purple-400' : 'text-slate-500'}`} />
                Widgets
                {activeTab === 'widgets' && (
                  <span className="absolute bottom-[0.3rem] left-1/2 -translate-x-1/2 w-[1.4rem] h-[0.2rem] rounded-full bg-purple-400 opacity-80" />
                )}
              </button>
            </div>

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

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* STREAMS TAB */}
            {activeTab === 'streams' && (
              <div className="p-[1.6rem] space-y-[1.4rem]">

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

                {/* All / News / Gaming — showTrashButton not passed, defaults true */}
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
                          key={ch.id}
                          channel={ch}
                          onClick={() => onChannelClick?.(ch)}
                          isLive={liveStatuses[ch.id]?.isLive}
                          showSaveButton
                          isSaved={isInPersonalLibrary(ch)}
                          isBlocked={isChannelBlocked(ch.id)}
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

                {/*
                  Personal Library — showTrashButton={false} removes the trash
                  icon from every row in this list. The amber star still calls
                  onRemove to unsave the channel. Row alignment is clean because
                  only logo | name+meta | star | grip are rendered.
                */}
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
                            key={ch.id}
                            channel={ch as TrendingChannel}
                            onClick={() => onChannelClick?.(ch as TrendingChannel)}
                            isLive={liveStatuses[ch.id]?.isLive}
                            showSaveButton
                            isSaved
                            isBlocked={false}
                            onRemove={() => removeFromPersonalLibrary(ch.id)}
                            showTrashButton={false}
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

                {/* Blocked Channels — showTrashButton not passed, defaults true */}
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
                            key={ch.id}
                            channel={ch}
                            onClick={() => onChannelClick?.(ch as TrendingChannel)}
                            isLive={false}
                            showSaveButton
                            isSaved={false}
                            isBlocked
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

            {/* WIDGETS TAB */}
            {activeTab === 'widgets' && (
              <div className="p-[1.6rem] space-y-[2rem]">
                <div>
                  <p className="text-[1.25rem] font-semibold text-slate-200 mb-[0.4rem]">Interactive Blocks</p>
                  <p className="text-[1.1rem] text-slate-500">
                    Click to add a block to your dashboard. Blocks auto-place on the grid.
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-slate-500" />
                  <input
                    type="text"
                    value={widgetSearchQuery}
                    onChange={(e) => setWidgetSearchQuery(e.target.value)}
                    placeholder="Search widgets..."
                    className="w-full pl-[3.6rem] pr-[3.6rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem] placeholder:text-slate-600"
                    data-testid="input-search-widgets"
                  />
                  {widgetSearchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setWidgetSearchQuery('')}
                      className="absolute right-[0.8rem] top-1/2 -translate-y-1/2 p-[0.4rem] rounded-md hover:bg-slate-700 transition-colors"
                      aria-label="Clear widget search"
                      data-testid="button-clear-widget-search"
                    >
                      <X className="w-[1.3rem] h-[1.3rem] text-slate-500 hover:text-slate-300" />
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-[0.95rem] font-bold text-slate-500 uppercase tracking-[0.1em] mb-[1rem]">Available</p>
                  {filteredAvailableWidgets.length > 0 ? (
                    <div className="grid grid-cols-2 gap-[0.8rem]">
                      {filteredAvailableWidgets.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => {
                            if (w.id === 'custom_widget') { setCustomModalOpen(true); return; }
                            onTemplateClick?.(w.template);
                          }}
                          className={`group relative flex flex-col items-center justify-center gap-[0.8rem] p-[1.4rem] rounded-xl border ${w.border} ${w.cardBg} transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}
                          data-testid={`widget-library-${w.id}`}
                        >
                          <div className={`w-[4rem] h-[4rem] rounded-xl ${w.iconBg} border border-slate-700/50 flex items-center justify-center group-hover:border-slate-600 transition-colors`}>
                            {w.icon}
                          </div>
                          <div className="text-center">
                            <p className="text-[1.15rem] font-semibold text-slate-200 leading-tight">{w.label}</p>
                            <p className="text-[0.95rem] text-slate-500 mt-[0.2rem] leading-snug">{w.description}</p>
                          </div>
                          <span className={`absolute top-[0.7rem] right-[0.7rem] text-[0.8rem] font-bold px-[0.55rem] py-[0.2rem] rounded-full border ${w.badgeColor}`}>
                            ADD
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-[3rem] bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
                      <Search className="w-[3rem] h-[3rem] text-slate-700 mx-auto mb-[1rem]" />
                      <p className="text-[1.2rem] text-slate-500">No widgets found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom Widget add-modal — overlay inside the sidebar */}
          {customModalOpen && (
            <div
              className="absolute inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-[1.6rem]"
              data-testid="custom-widget-modal"
            >
              <div className="w-full max-w-[28rem] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-[1.6rem] space-y-[1.2rem]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[1.4rem] font-bold text-cyan-400 flex items-center gap-[0.6rem]">
                    <Code2 className="w-[1.6rem] h-[1.6rem]" /> Add Custom Widget
                  </h3>
                  <button
                    onClick={() => setCustomModalOpen(false)}
                    className="p-[0.4rem] hover:bg-slate-800 rounded-md transition-colors"
                    data-testid="button-close-custom-widget-modal"
                  >
                    <X className="w-[1.4rem] h-[1.4rem] text-slate-400" />
                  </button>
                </div>

                <div>
                  <label className="block text-[0.9rem] font-semibold text-slate-400 uppercase tracking-wider mb-[0.5rem]">
                    Widget URL
                  </label>
                  <input
                    type="text"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && customUrlValid) {
                        e.preventDefault();
                        submitCustomWidget(customUrlInput, customTrusted);
                      }
                    }}
                    placeholder="https://example.com/my-widget.html"
                    className="w-full px-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 rounded-md focus:border-cyan-500 focus:outline-none text-[1.1rem] placeholder:text-slate-600"
                    data-testid="input-custom-widget-url"
                  />
                  {customUrlInput && !customUrlValid && (
                    <p className="text-[0.95rem] text-red-400 mt-[0.4rem]">
                      Only http(s) URLs or same-origin paths (starting with /) are allowed.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[0.9rem] font-semibold text-slate-400 uppercase tracking-wider mb-[0.5rem]">
                    Or pick a sample
                  </p>
                  <div className="space-y-[0.5rem]">
                    {SAMPLE_CUSTOM_WIDGETS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setCustomUrlInput(s.url)}
                        className="w-full text-left p-[0.9rem] rounded-md bg-slate-800/60 border border-slate-700 hover:border-cyan-500/60 hover:bg-slate-800 transition-colors"
                        data-testid={`button-sample-custom-widget-${s.id}`}
                      >
                        <p className="text-[1.1rem] font-semibold text-slate-100">{s.name}</p>
                        <p className="text-[0.95rem] text-slate-500 mt-[0.2rem]">{s.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-[0.6rem] p-[0.9rem] rounded-md bg-amber-500/10 border border-amber-500/30">
                  <ShieldAlert className="w-[1.4rem] h-[1.4rem] text-amber-400 flex-shrink-0 mt-[0.1rem]" />
                  <div className="text-[0.95rem] text-amber-100/90 leading-snug">
                    Custom widgets run inside a sandboxed iframe with no access to your
                    dashboard data beyond the SDK. Only run widgets from sources you trust.{' '}
                    <a
                      href="/dev/widgets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-[0.2rem]"
                      data-testid="link-custom-widget-docs"
                    >
                      Read the SDK docs <ExternalLink className="w-[1rem] h-[1rem]" />
                    </a>
                    {' \u00B7 '}
                    <a
                      href="/widgets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-[0.2rem]"
                      data-testid="link-custom-widget-marketplace"
                    >
                      Browse marketplace <ExternalLink className="w-[1rem] h-[1rem]" />
                    </a>
                  </div>
                </div>

                <label className="flex items-center gap-[0.6rem] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={customTrusted}
                    onChange={(e) => setCustomTrusted(e.target.checked)}
                    className="w-[1.4rem] h-[1.4rem] accent-cyan-500"
                    data-testid="input-custom-widget-trust"
                  />
                  <span className="text-[1rem] text-slate-300">I trust this URL — run immediately</span>
                </label>

                <div className="flex justify-end gap-[0.6rem] pt-[0.4rem]">
                  <button
                    onClick={() => setCustomModalOpen(false)}
                    className="px-[1.2rem] py-[0.7rem] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[1rem] font-semibold transition-colors"
                    data-testid="button-cancel-custom-widget"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitCustomWidget(customUrlInput, customTrusted)}
                    disabled={!customUrlValid}
                    className="px-[1.2rem] py-[0.7rem] rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-[1rem] font-bold transition-colors"
                    data-testid="button-submit-custom-widget"
                  >
                    Add widget
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
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

  export { FALLBACK_CHANNELS as TRENDING_CHANNELS };
  export type { SavedChannel } from '@/lib/personal-library';
