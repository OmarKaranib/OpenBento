import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Search, Tv, LayoutGrid, Grip, Newspaper, Rocket, Music, TrendingUp, Layers, Layout, FileText, Square, Image as ImageIcon, Video, Upload, Gamepad2, Radio, RefreshCw, Star, Trash2, Globe, Heart } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WidgetType } from '@/App';
import { useQuery } from '@tanstack/react-query';

// Personal Library storage key
const PERSONAL_LIBRARY_KEY = 'openBentoPersonalLibrary';

// Saved channel type for Personal Library
export interface SavedChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'music' | 'finance' | 'gaming';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  savedAt: number;
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

export interface TrendingChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'music' | 'finance' | 'gaming';
  category: string;
  platform: 'youtube' | 'twitch' | 'kick';
  channelId?: string;
  videoId?: string | null;
  lastUpdated?: number;
  isLive?: boolean; // True for live streams (10-min refresh), false for normal videos (no refresh)
}

export interface LiveStatus {
  channelId: string;
  isLive: boolean;
  viewerCount?: number;
  lastChecked: number;
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

// Helper to generate Pro YouTube embed URL with handshake parameters
const getProYouTubeEmbedUrl = (videoId: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&origin=${encodeURIComponent(origin)}&parent=${encodeURIComponent(hostname)}`;
};

// Helper to generate Pro YouTube channel live stream URL
const getProYouTubeChannelUrl = (channelId: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1&origin=${encodeURIComponent(origin)}&parent=${encodeURIComponent(hostname)}`;
};

// Fallback channels (used when API is not available)
const FALLBACK_CHANNELS: TrendingChannel[] = [
  { id: 'nasa-live', name: 'NASA Live', url: getProYouTubeEmbedUrl('21X5lGlDOfg'), iconType: 'science', category: 'Science', platform: 'youtube', channelId: undefined },
  { id: 'lofi-girl', name: 'Lofi Girl', url: getProYouTubeChannelUrl('UCSJ4gkVC6NrvII8umztf0Ow'), iconType: 'music', category: 'Music', platform: 'youtube', channelId: 'UCSJ4gkVC6NrvII8umztf0Ow' },
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

// Live status polling interval (5 minutes)
const LIVE_STATUS_POLL_INTERVAL = 5 * 60 * 1000;

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { id: 'template-video', name: 'Video', widgetType: 'video', w: 3, h: 2, icon: 'video', color: 'cyan' },
  { id: 'template-note', name: 'Note', widgetType: 'note', w: 3, h: 2, icon: 'note', color: 'yellow' },
  { id: 'template-spacer', name: 'Spacer', widgetType: 'spacer', w: 2, h: 1, icon: 'spacer', color: 'slate' },
  { id: 'template-image', name: 'Photo', widgetType: 'image', w: 3, h: 2, icon: 'image', color: 'purple' },
];

type SidebarTab = 'content' | 'library';
type ContentCategory = 'all' | 'news' | 'music' | 'gaming' | 'personal';

interface DraggableChannelProps {
  channel: TrendingChannel | SavedChannel;
  onClick?: () => void;
  isLive?: boolean;
  isSaved?: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  showSaveButton?: boolean;
}

function getChannelIcon(iconType: TrendingChannel['iconType']) {
  switch (iconType) {
    case 'news':
      return <Newspaper className="w-[1.6rem] h-[1.6rem] text-cyan-400" />;
    case 'science':
      return <Rocket className="w-[1.6rem] h-[1.6rem] text-purple-400" />;
    case 'music':
      return <Music className="w-[1.6rem] h-[1.6rem] text-pink-400" />;
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

function DraggableChannel({ channel, onClick, isLive, isSaved, onSave, onRemove, showSaveButton }: DraggableChannelProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border border-slate-700/50 hover:border-cyan-500/50"
      data-testid={`draggable-channel-${channel.id}`}
    >
      <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center relative">
        {getChannelIcon(channel.iconType)}
        {isLive && (
          <div className="absolute -top-1 -right-1 w-[1rem] h-[1rem] bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[0.6rem]">
          <p className="text-[1.2rem] font-semibold text-slate-200 truncate">{channel.name}</p>
          {isLive && (
            <span className="flex items-center gap-[0.3rem] px-[0.5rem] py-[0.1rem] bg-red-500/20 border border-red-500/50 rounded-full text-[0.8rem] font-bold text-red-400 uppercase tracking-wider" data-testid={`live-badge-${channel.id}`}>
              <Radio className="w-[0.8rem] h-[0.8rem]" />
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
  onImageUpload
}: WidgetSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('content');
  const [activeCategory, setActiveCategory] = useState<ContentCategory>('all');
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [personalLibrary, setPersonalLibrary] = useState<SavedChannel[]>(() => loadPersonalLibrary());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for personal library updates from dashboard (block star button)
  useEffect(() => {
    const handleLibraryUpdate = () => {
      setPersonalLibrary(loadPersonalLibrary());
    };
    
    window.addEventListener('personalLibraryUpdated', handleLibraryUpdate);
    return () => window.removeEventListener('personalLibraryUpdated', handleLibraryUpdate);
  }, []);

  // Save to Personal Library
  const saveToPersonalLibrary = useCallback((channel: TrendingChannel) => {
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
  }, []);

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

  // Check live status for Kick channels
  const checkKickLiveStatus = useCallback(async (channelId: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://kick.com/api/v2/channels/${channelId}`);
      if (response.ok) {
        const data = await response.json();
        return data?.livestream !== null;
      }
      return false;
    } catch {
      return true;
    }
  }, []);

  // Poll live status every 5 minutes
  useEffect(() => {
    const checkAllStatuses = async () => {
      const now = Date.now();
      const newStatuses: Record<string, LiveStatus> = {};

      for (const channel of channels) {
        if (channel.channelId) {
          let isLive = false;
          
          if (channel.platform === 'youtube') {
            isLive = true;
          } else if (channel.platform === 'twitch') {
            isLive = true;
          } else if (channel.platform === 'kick') {
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

    checkAllStatuses();

    const interval = setInterval(checkAllStatuses, LIVE_STATUS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkKickLiveStatus, channels]);

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

  // Filter channels by search query and category
  const filteredChannels = useMemo(() => {
    let filtered: TrendingChannel[] = channels;
    
    // Filter by category
    if (activeCategory === 'news') {
      filtered = channels.filter(c => c.category === 'Global News' || c.category === 'Science');
    } else if (activeCategory === 'music') {
      filtered = channels.filter(c => c.category === 'Lofi/Music');
    } else if (activeCategory === 'gaming') {
      filtered = channels.filter(c => c.category === 'Gaming' || c.category === 'Esports');
    }
    // 'all' shows everything, 'personal' is handled separately
    
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
    
    return filtered;
  }, [searchQuery, channels, activeCategory]);

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
          
          <div className="flex gap-[0.4rem] bg-slate-800 p-[0.4rem] rounded-lg">
            <button
              onClick={() => setActiveTab('library')}
              className={`flex-1 flex items-center justify-center gap-[0.6rem] py-[0.8rem] px-[1.2rem] rounded-md text-[1.2rem] font-medium transition-all duration-200 ${
                activeTab === 'library'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              data-testid="tab-library"
            >
              <Layout className="w-[1.4rem] h-[1.4rem]" />
              Library
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 flex items-center justify-center gap-[0.6rem] py-[0.8rem] px-[1.2rem] rounded-md text-[1.2rem] font-medium transition-all duration-200 ${
                activeTab === 'content'
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              data-testid="tab-content"
            >
              <Layers className="w-[1.4rem] h-[1.4rem]" />
              Streams
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
              <div>
                <h3 className="text-[1.4rem] font-semibold text-purple-400 mb-[1rem] flex items-center gap-[0.6rem]">
                  <LayoutGrid className="w-[1.6rem] h-[1.6rem]" />
                  Block Types
                </h3>
                <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                  Click to add • Resize in Edit Mode
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
                  onClick={() => setActiveCategory('music')}
                  className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] rounded-full text-[1.1rem] font-medium transition-all ${
                    activeCategory === 'music'
                      ? 'bg-pink-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  data-testid="category-music"
                >
                  <Music className="w-[1.2rem] h-[1.2rem]" />
                  Lofi
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
              </div>
              
              {activeCategory !== 'personal' ? (
                <div>
                  <div className="flex items-center justify-between mb-[1rem]">
                    <h3 className="text-[1.4rem] font-semibold text-cyan-400 flex items-center gap-[0.6rem]">
                      <Tv className="w-[1.6rem] h-[1.6rem]" />
                      {activeCategory === 'all' && 'All Streams'}
                      {activeCategory === 'news' && 'Global News'}
                      {activeCategory === 'music' && 'Lofi & Music'}
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
                        onSave={() => saveToPersonalLibrary(channel)}
                        onRemove={() => removeFromPersonalLibrary(channel.id)}
                      />
                    ))}
                    {filteredChannels.length === 0 && (
                      <p className="text-[1.2rem] text-slate-500 text-center py-[2rem]">
                        No streams found
                      </p>
                    )}
                  </div>
                </div>
              ) : (
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
                          isLive={true}
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
              )}
            </div>
          )}
        </div>
        
        <div className="p-[1.6rem] border-t border-slate-700 flex-shrink-0">
          <p className="text-[1rem] text-slate-500 text-center">
            {activeTab === 'library' 
              ? 'Drag blocks to add • Resize in Edit Mode' 
              : 'Click or drag streams to add'}
          </p>
        </div>
      </div>
    </>
  );
}

export { FALLBACK_CHANNELS as TRENDING_CHANNELS, loadPersonalLibrary, savePersonalLibrary };
