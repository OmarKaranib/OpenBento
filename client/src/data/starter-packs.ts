import type { TrendingChannel } from '@/components/widget-sidebar';
import type { Widget } from '@/App';

export type StarterTileType =
  | 'video'
  | 'clock'
  | 'weather'
  | 'crisis_ticker'
  | 'qr_generator'
  | 'markets_ticker'
  | 'world_clocks'
  | 'countdown'
  | 'note'
  | 'github_pulse'
  | 'rss_headlines'
  | 'habit_tracker'
  | 'quick_launch'
  | 'big_text_marquee'
  | 'network_light'
  | 'photo_loop';

export interface StarterTile {
  type: StarterTileType;
  x: number;
  y: number;
  w: number;
  h: number;
  channelId?: string;
  noteContent?: string;
}

export interface StarterPack {
  id: string;
  emoji: string;
  label: string;
  description: string;
  tiles: StarterTile[];
}

export const STARTER_PACKS: StarterPack[] = [
  {
    id: 'news',
    emoji: '📺',
    label: 'News Briefing',
    description: 'Six live news streams from around the world.',
    tiles: [
      { type: 'video', channelId: 'sky-news',   x: 0, y: 0, w: 4, h: 3 },
      { type: 'video', channelId: 'abc-news',   x: 4, y: 0, w: 4, h: 3 },
      { type: 'video', channelId: 'al-jazeera', x: 8, y: 0, w: 4, h: 3 },
      { type: 'video', channelId: 'france-24',  x: 0, y: 3, w: 4, h: 3 },
      { type: 'video', channelId: 'euronews',   x: 4, y: 3, w: 4, h: 3 },
      { type: 'video', channelId: 'nbc-news',   x: 8, y: 3, w: 4, h: 3 },
    ],
  },
  {
    id: 'streamers',
    emoji: '🎮',
    label: 'Streamer HQ',
    description: 'A big stream plus clock, weather, QR and notes.',
    tiles: [
      { type: 'video', channelId: 'twitch-xqc', x: 0, y: 0, w: 8, h: 4 },
      { type: 'world_clocks',                   x: 8, y: 0, w: 4, h: 2 },
      { type: 'weather',                        x: 8, y: 2, w: 4, h: 2 },
      { type: 'qr_generator',                   x: 0, y: 4, w: 8, h: 2 },
      {
        type: 'note',
        noteContent: 'Stream notes...',
        x: 8, y: 4, w: 4, h: 2,
      },
    ],
  },
  {
    id: 'markets',
    emoji: '📈',
    label: 'Markets Watch',
    description: 'Finance streams plus markets ticker and breaking-news strip.',
    tiles: [
      { type: 'video', channelId: 'bloomberg-live', x: 0, y: 0, w: 6, h: 4 },
      { type: 'video', channelId: 'cnbc-live',      x: 6, y: 0, w: 6, h: 4 },
      { type: 'markets_ticker',                     x: 0, y: 4, w: 4, h: 2 },
      { type: 'crisis_ticker',                      x: 4, y: 4, w: 5, h: 2 },
      { type: 'countdown',                          x: 9, y: 4, w: 3, h: 2 },
    ],
  },
  {
    id: 'empty',
    emoji: '✨',
    label: 'Empty Canvas',
    description: 'Start fresh and build it your way.',
    tiles: [],
  },
];

function stripLegacyPrefix(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.replace(/^(LIVE:|🔴\s*)+\s*/i, '').trim() || undefined;
}

function makeId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Builds a Widget[] from a starter pack. For video tiles, looks up the
 * matching channel from the live /api/channels response so videoId is
 * fresh. Tiles whose channelId can't be resolved are skipped.
 */
export function buildWidgetsFromPack(
  pack: StarterPack,
  channels: TrendingChannel[],
): Widget[] {
  const byId = new Map(channels.map(c => [c.id, c]));
  const widgets: Widget[] = [];

  for (const tile of pack.tiles) {
    const base = {
      id: makeId(),
      x: tile.x,
      y: tile.y,
      w: tile.w,
      h: tile.h,
      isMuted: true,
      isPaused: false,
      volume: 0,
      previousVolume: 50,
      isOffline: false,
      refreshCounter: 0,
    };

    if (tile.type === 'video') {
      if (!tile.channelId) continue;
      const ch = byId.get(tile.channelId);
      if (!ch) continue; // Channel missing from live data — skip gracefully

      const isYouTube = ch.platform === 'youtube';
      const isTwitch  = ch.platform === 'twitch';
      const isKick    = ch.platform === 'kick';
      // The /api/links response stores the platform handle in `channelId` (see
      // server/routes.ts line 315). Use it as the handle for both YouTube and
      // Twitch/Kick widgets.
      const handle: string | null = ch.channelId ?? null;

      const widget: Widget = {
        ...base,
        type: 'video',
        url: ch.url,
        isYouTube,
        videoId: ch.videoId ?? null,
        youtubeChannelId: handle,
        channelHandle: handle,
        channelName: stripLegacyPrefix(ch.name) ?? ch.name,
        isTwitch,
        twitchChannel: isTwitch ? handle : null,
        isKick,
        kickChannel: isKick ? handle : null,
        isLive: ch.isLive === true,
        lastRefresh: Date.now(),
      };
      widgets.push(widget);
    } else if (tile.type === 'note') {
      widgets.push({ ...base, type: 'note', noteContent: tile.noteContent ?? '' });
    } else {
      widgets.push({ ...base, type: tile.type });
    }
  }

  return widgets;
}
