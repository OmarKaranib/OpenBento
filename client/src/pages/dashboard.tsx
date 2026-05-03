import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction, MutableRefObject } from 'react';
import { Volume2, VolumeX, Volume1, Plus, Save, Power, X, ChevronDown, Edit3, RefreshCw, GripVertical, FileText, Square, Image as ImageIcon, Trash2, Settings, PanelLeftClose, PanelLeftOpen, Pause, Play, Maximize2, Minimize2, MoveDiagonal2, Sliders, LockKeyhole, AlertCircle, Star, Palette, Paintbrush, ImagePlus, Sun, Moon, LogIn, LogOut, User, Loader2, Shield, MessageSquare, Lightbulb, Bug } from 'lucide-react';
import { Link } from 'wouter';
import { ADMIN_EMAIL } from '@/pages/admin';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget, WidgetType, WidgetRenderer } from '@/App';
import { VideoWidget } from '@/widgets/video-widget';
import { YouTubePlayer } from '@/components/youtube-player';
import { SavedChannel, loadPersonalLibrary, savePersonalLibrary } from '@/components/widget-sidebar';
import { useStreamHealing } from '@/hooks/use-stream-healing';
import { useToast } from '@/hooks/use-toast';
import { FloatingTutorial } from '@/components/floating-tutorial';
import { NoteWidget } from '@/components/note-widget';
import { AdBlock, AdBlockData } from '@/components/ad-block';
import { CastPopover } from '@/components/cast-popover';
import { checkVideoLiveStatus, searchChannelLiveStream } from '@/lib/stream-api';

const GRID_COLS = 12;
const GRID_ROWS = 6;

interface SortableWidgetProps {
  widget: Widget;
  isEditMode: boolean;
  isDarkMode: boolean;
  onColorPickerOpen?: () => void;
  children: React.ReactNode;
}

const SortableWidget = ({ widget, isEditMode, isDarkMode, onColorPickerOpen, children }: SortableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: widget.id,
    disabled: !isEditMode,
    data: {
      type: 'sortable-widget',
      widget: widget
    }
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `${widget.x + 1} / span ${Math.min(widget.w, GRID_COLS - widget.x)}`,
    gridRow: `${widget.y + 1} / span ${Math.min(widget.h, GRID_ROWS - widget.y)}`,
    ...(widget.customColor ? { '--widget-bg': widget.customColor, backgroundColor: widget.customColor } as React.CSSProperties : {})
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`dashboard-slot relative border-2 group shadow-xl overflow-hidden ${
        isEditMode
          ? 'border-purple-500/80 ring-1 ring-purple-400/40 animate-jiggle is-editing'
          : isDarkMode 
            ? 'border-slate-600/70' 
            : 'border-slate-400 shadow-lg'
      } ${isDragging ? 'z-[9999] is-dragging' : 'z-10'}`}
      data-testid={`widget-${widget.id}`}
    >
      {/* Overlay blocks iframe interactions in Edit Mode but not buttons */}
      {isEditMode && (
        <div 
          className="absolute inset-0 bg-transparent"
          style={{ pointerEvents: 'none', zIndex: 10 }}
          data-testid={`widget-overlay-${widget.id}`}
        />
      )}

      {isEditMode && (
        <div className="absolute top-[0.6rem] left-[0.6rem] z-[10000] flex items-center gap-[0.4rem]" style={{ pointerEvents: 'auto' }}>
          <div 
            className="p-[0.4rem] bg-cyan-600/90 hover:bg-cyan-500 slot-button cursor-grab active:cursor-grabbing transition-colors touch-none"
            title="Drag to move"
            data-testid={`grip-handle-${widget.id}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-[1.2rem] h-[1.2rem] text-white" />
          </div>
          <span className="bg-slate-800/90 backdrop-blur-sm px-[0.5rem] py-[0.2rem] slot-button text-[0.8rem] font-bold text-cyan-400 border border-cyan-500/30">
            {widget.w}x{widget.h}
          </span>
          {widget.type !== 'video' && (
            <span className="bg-slate-800/90 backdrop-blur-sm px-[0.5rem] py-[0.2rem] slot-button text-[0.8rem] font-medium text-purple-400 border border-purple-500/30 capitalize">
              {widget.type}
            </span>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

// Supabase User type (simplified)
interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

interface MasterControlDashboardProps {
  widgets: Widget[];
  setWidgets: Dispatch<SetStateAction<Widget[]>>;
  isEditMode: boolean;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;
  sidebarOpen: boolean;
  activeId: UniqueIdentifier | null;
  handleOpenSidebar: (widgetId?: string) => void;
  onInlineUrlSubmit: (widgetId: string, url: string) => void;
  handleOpenSidebarToContent: () => void;
  addWidget: (type: WidgetType, w?: number, h?: number, extraData?: Partial<Widget>) => string | null;
  isFullscreen: boolean;
  setIsFullscreen: Dispatch<SetStateAction<boolean>>;
  ghostPosition: { x: number; y: number; w: number; h: number } | null;
  gridContainerRef: MutableRefObject<HTMLDivElement | null>;
  isGridFull: boolean;
  user: SupabaseUser | null;
  onLogout: () => void;
  isAuthenticated: boolean;
  openLoginModal: (reason?: string) => void;
  ad: AdBlockData | null;
  skipAd: () => void;
  triggerAd: () => void;
  isAdActive: boolean;
}

interface ResizeState {
  widgetId: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

const MasterControlDashboard = ({
  widgets,
  setWidgets,
  isEditMode,
  setIsEditMode,
  sidebarOpen,
  activeId,
  handleOpenSidebar,
  onInlineUrlSubmit,
  handleOpenSidebarToContent,
  addWidget,
  isFullscreen,
  setIsFullscreen,
  ghostPosition,
  gridContainerRef,
  isGridFull,
  user,
  onLogout,
  isAuthenticated,
  openLoginModal,
  ad,
  skipAd,
  triggerAd,
  isAdActive
}: MasterControlDashboardProps) => {
  const [masterMute, setMasterMute] = useState(true);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [exitButtonDismissed, setExitButtonDismissed] = useState(false);
  const [seekModeWidgets, setSeekModeWidgets] = useState<Set<string>>(new Set());
  const [volumeSliderWidget, setVolumeSliderWidget] = useState<string | null>(null);
  const [inlineInputWidgetId, setInlineInputWidgetId] = useState<string | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [clearHoldProgress, setClearHoldProgress] = useState(0);
  const [personalLibrary, setPersonalLibrary] = useState<SavedChannel[]>(() => loadPersonalLibrary());
  const [colorPickerWidget, setColorPickerWidget] = useState<string | null>(null);
  const [hasStartedBuilding, setHasStartedBuilding] = useState(false);

  useEffect(() => {
    if (widgets.length > 0 && !hasStartedBuilding) {
      setHasStartedBuilding(true);
    }
  }, [widgets.length, hasStartedBuilding]);

  const { triggerHeal, getHealingState, registerChannel } = useStreamHealing();
  const { toast } = useToast();

  // Theme Mode (dark/light) - User toggleable
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('openBentoTheme');
    return saved !== 'light'; // Default to dark mode
  });

  const clearHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clearHoldStartRef = useRef<number | null>(null);
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  // Listen for personal library updates from sidebar
  useEffect(() => {
    const handleLibraryUpdate = () => {
      setPersonalLibrary(loadPersonalLibrary());
    };

    window.addEventListener('personalLibraryUpdated', handleLibraryUpdate);
    return () => window.removeEventListener('personalLibraryUpdated', handleLibraryUpdate);
  }, []);

  // Theme toggle effect - apply dark/light mode using class on document element
  useEffect(() => {
    localStorage.setItem('openBentoTheme', isDarkMode ? 'dark' : 'light');

    // Toggle dark class on document element (standard Tailwind dark mode approach)
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }
  }, [isDarkMode]);

  // Auto-save widgets to localStorage so layouts persist across refreshes
  // for both signed-in users and guests. When a guest signs up later,
  // their existing layout is preserved locally and continues to work.
  const widgetsJsonRef = useRef<string>('');
  useEffect(() => {
    const widgetsJson = JSON.stringify(widgets);
    // Only save if actual content changed (not just reference)
    if (widgetsJson !== widgetsJsonRef.current) {
      widgetsJsonRef.current = widgetsJson;
      localStorage.setItem('openBentoWidgets', widgetsJson);
    }
  }, [widgets]);

  // On logout (authenticated → unauthenticated transition only), clear the
  // Personal Library since it is an authenticated-only feature
  // (saveWidgetToLibrary requires login). We deliberately do NOT clear it
  // for guests who never signed in, and we do NOT clear widget layouts —
  // those persist for everyone so guests can build before signing up.
  const wasAuthenticatedRef = useRef<boolean>(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      localStorage.removeItem('openBentoPersonalLibrary');
      setPersonalLibrary([]);
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Set custom color for a specific widget (Bento.me Color Droplet)
  const setWidgetColor = useCallback((widgetId: string, color: string | undefined) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, customColor: color } : w
    ));
    setColorPickerWidget(null);
  }, [setWidgets]);

  const toggleClock24Hour = useCallback((widgetId: string) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, clockUse24Hour: !w.clockUse24Hour } : w
    ));
  }, [setWidgets]);

  // Save widget to Personal Library
  // LIBRARY PERMISSIONS: Only logged-in users can add to personal library
  const saveWidgetToLibrary = useCallback((widget: Widget) => {
    if (widget.type !== 'video') return;
    
    // Guest users cannot add to library - prompt login with required message
    if (!isAuthenticated) {
      openLoginModal('Authentication Required: Please log in or sign up to save channels to your library.');
      return;
    }

    let name = widget.channelName
      || widget.youtubeChannelId
      || widget.twitchChannel
      || widget.kickChannel
      || 'Saved Stream';

    const savedChannel: SavedChannel = {
      id: `saved-${Date.now()}-${widget.videoId || widget.twitchChannel || widget.kickChannel || 'stream'}`,
      name,
      url: widget.url || '',
      iconType: widget.isYouTube ? 'news' : widget.isTwitch ? 'gaming' : widget.isKick ? 'gaming' : 'news',
      category: 'Saved',
      platform: widget.isYouTube ? 'youtube' : widget.isTwitch ? 'twitch' : widget.isKick ? 'kick' : 'youtube',
      channelId: widget.youtubeChannelId || widget.twitchChannel || widget.kickChannel || undefined,
      videoId: widget.videoId,
      savedAt: Date.now()
    };

    setPersonalLibrary(prev => {
      const exists = prev.some(c => 
        (savedChannel.videoId && c.videoId === savedChannel.videoId) || 
        (savedChannel.channelId && c.channelId === savedChannel.channelId)
      );
      if (exists) return prev;

      const updated = [...prev, savedChannel];
      savePersonalLibrary(updated);
      // Dispatch event to sync sidebar
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return updated;
    });
  }, [isAuthenticated, openLoginModal]);

  // Check if widget is saved in Personal Library
  const isWidgetSaved = useCallback((widget: Widget) => {
    return personalLibrary.some(c => 
      (widget.videoId && c.videoId === widget.videoId) ||
      (widget.youtubeChannelId && c.channelId === widget.youtubeChannelId) ||
      (widget.twitchChannel && c.channelId === widget.twitchChannel) ||
      (widget.kickChannel && c.channelId === widget.kickChannel)
    );
  }, [personalLibrary]);

  // Remove widget from Personal Library
  const removeWidgetFromLibrary = useCallback((widget: Widget) => {
    setPersonalLibrary(prev => {
      const updated = prev.filter(c => 
        !(
          (widget.videoId && c.videoId === widget.videoId) ||
          (widget.youtubeChannelId && c.channelId === widget.youtubeChannelId) ||
          (widget.twitchChannel && c.channelId === widget.twitchChannel) ||
          (widget.kickChannel && c.channelId === widget.kickChannel)
        )
      );
      savePersonalLibrary(updated);
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return updated;
    });
  }, []);

  const handleVideoError = useCallback(async (widget: Widget, errorCode?: number) => {
    console.log(`[Self-Healing] Error detected for widget: ${widget.id}, errorCode: ${errorCode}`);

    // Import hardcoded fallback helper from shared constants (avoids circular import)
    const { getFallbackVideoId } = await import('@/lib/channel-constants');

    // THE 150/101 OVERRIDE: Force latestVideoId fallback on restriction errors
    // Both errors swap to latestVideoId without showing "Unavailable" screen
    if (errorCode === 150 || errorCode === 101) {
      const errorType = errorCode === 150 ? 'EmbedRestriction' : 'AccountRestriction';
      const channelHandle = widget.channelHandle || widget.youtubeChannelId;
      
      // LOOP PROTECTION: If already playing latestVideo and still getting errors,
      // skip swap and go straight to pure iframe mode
      if (widget.isPlayingLatestVideo) {
        console.log(`[${errorType}] Already playing latestVideo - switching to pure iframe mode`);
        setWidgets(prev => prev.map(w => 
          w.id === widget.id ? { ...w, isLive: false, apiError: false, usePureIframe: true } : w
        ));
        return;
      }
      
      // HARDCODED FALLBACK PRIORITY:
      // 1. widget.latestVideoId (already stored fallback)
      // 2. getFallbackVideoId(channelHandle) (hardcoded Featured Video default - normalized lookup)
      // 3. API fetch (last resort)
      const hardcodedFallback = getFallbackVideoId(channelHandle);
      const fallbackId = widget.latestVideoId || hardcodedFallback;
      
      if (fallbackId) {
        console.log(`[${errorType}Fallback] Widget ${widget.id} using fallbackId: ${fallbackId} (source: ${widget.latestVideoId ? 'stored' : 'hardcoded'})`);
        setWidgets(prev => prev.map(w => 
          w.id === widget.id 
            ? { ...w, videoId: fallbackId, latestVideoId: fallbackId, isLive: false, isPlayingLatestVideo: true, isOffline: false, apiError: false, usePureIframe: false } 
            : w
        ));
        return;
      }
      
      // If no hardcoded fallback, try API fetch
      if (channelHandle) {
        console.log(`[${errorType}Fallback] No hardcoded fallback, fetching from API for ${channelHandle}...`);
        try {
          const { searchChannelLiveStream } = await import('@/lib/stream-api');
          const status = await searchChannelLiveStream(channelHandle, true);
          if (status?.latestVideoId) {
            console.log(`[${errorType}Fallback] Got latestVideoId from API: ${status.latestVideoId}`);
            setWidgets(prev => prev.map(w => 
              w.id === widget.id 
                ? { ...w, videoId: status.latestVideoId, latestVideoId: status.latestVideoId, isLive: false, isPlayingLatestVideo: true, isOffline: false, apiError: false, usePureIframe: false } 
                : w
            ));
            return;
          }
        } catch (e) {
          console.log(`[${errorType}Fallback] API fetch failed:`, e);
        }
      }
      
      // PURE IFRAME FALLBACK: If no fallback ID available but videoId exists, switch to pure iframe mode
      // This avoids IFrame API postMessage errors by using standard HTML iframe
      // Only enable if widget.videoId exists - otherwise there's nothing to render
      if (widget.videoId) {
        console.log(`[${errorType}Fallback] No fallback available, switching to pure iframe mode with existing videoId: ${widget.videoId}`);
        setWidgets(prev => prev.map(w => 
          w.id === widget.id ? { ...w, isLive: false, apiError: false, usePureIframe: true } : w
        ));
      } else {
        console.log(`[${errorType}Fallback] No fallback available and no videoId - cannot switch to pure iframe`);
        setWidgets(prev => prev.map(w => 
          w.id === widget.id ? { ...w, isLive: false, apiError: false } : w
        ));
      }
      return;
    }

    // ARCHITECTURE PIVOT: Never set isOffline=true if videoId exists
    // Only update isLive for badge state - embed should always render
    setWidgets(prev => prev.map(w => 
      w.id === widget.id ? { ...w, isLive: false } : w // Badge only, not offline
    ));

    if (widget.isYouTube && widget.youtubeChannelId) {
      const channelName = widget.channelName || widget.youtubeChannelId;

      // Clear cache on error - force fresh fetch (Robot Copy-Paste re-fetch on error)
      const { clearCachedVideoId, fetchFreshVideoId } = await import('@/lib/video-cache');
      clearCachedVideoId(widget.youtubeChannelId);
      console.log(`[RobotPaste] Cleared cache for ${widget.youtubeChannelId}, fetching fresh...`);

      // Try to fetch fresh videoId directly (Robot Copy-Paste style)
      const freshVideoId = await fetchFreshVideoId(widget.youtubeChannelId);

      if (freshVideoId) {
        console.log(`[RobotPaste] Got fresh videoId: ${freshVideoId} for ${widget.id}`);
        setWidgets(prev => prev.map(w => 
          w.id === widget.id 
            ? { ...w, videoId: freshVideoId, isOffline: false, lastRefresh: Date.now() } 
            : w
        ));
      } else {
        // Fall back to triggerHeal if direct fetch fails
        triggerHeal(
          widget.id,
          widget.youtubeChannelId,
          channelName,
          widget.videoId || undefined,
          (newVideoId) => {
            console.log(`[Self-Healing] Healed ${widget.id} with new videoId: ${newVideoId}`);
            setWidgets(prev => prev.map(w => 
              w.id === widget.id 
                ? { ...w, videoId: newVideoId, isOffline: false, lastRefresh: Date.now() } 
                : w
            ));
          }
        );
      }
    }
  }, [triggerHeal, setWidgets]);

  // Proactive True Live Filter: Check YouTube widgets' live status on load
  const checkedVideoIds = useRef<Set<string>>(new Set());
  const lastRevalidationRef = useRef<number>(0);
  const REVALIDATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  useEffect(() => {
    const checkYouTubeLiveStatus = async () => {
      const now = Date.now();
      const shouldRevalidate = now - lastRevalidationRef.current > REVALIDATION_INTERVAL_MS;
      
      // Find new widgets to check AND offline widgets for periodic revalidation
      const youtubeWidgets = widgets.filter(w => 
        w.type === 'video' && 
        w.isYouTube && 
        w.videoId && 
        (!w.isOffline && !checkedVideoIds.current.has(w.videoId!)) || 
        (w.isOffline && shouldRevalidate)
      );
      
      if (youtubeWidgets.length === 0) return;
      
      if (shouldRevalidate) {
        lastRevalidationRef.current = now;
        console.log('[TrueLiveFilter] Running periodic revalidation for offline widgets');
      }
      
      for (const widget of youtubeWidgets) {
        if (!widget.videoId) continue;
        
        try {
          const liveStatus = await checkVideoLiveStatus(widget.videoId);
          
          if (liveStatus.isLive) {
            // Widget is now live - mark as online and update checkedVideoIds
            if (widget.isOffline) {
              console.log(`[TrueLiveFilter] Video ${widget.videoId} is now LIVE, marking as online`);
              setWidgets(prev => prev.map(w => 
                w.id === widget.id ? { ...w, isOffline: false } : w
              ));
            }
            checkedVideoIds.current.add(widget.videoId);
          } else if (!liveStatus.isLive && liveStatus.liveBroadcastContent !== null) {
            // Widget is not live - ONLY update badge, never set offline if videoId exists
            console.log(`[TrueLiveFilter] Video ${widget.videoId} is not live (${liveStatus.liveBroadcastContent}), updating badge only`);
            setWidgets(prev => prev.map(w => 
              w.id === widget.id ? { ...w, isLive: false } : w // Badge only, embed keeps rendering
            ));
            checkedVideoIds.current.add(widget.videoId);
          }
        } catch (error) {
          console.error(`[TrueLiveFilter] Error checking live status for ${widget.videoId}:`, error);
        }
        
        // Rate limit API calls
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };
    
    // QUOTA OPTIMIZATION: Disabled all auto-refresh to save API quota
    // Live status is only updated when user manually clicks "Check Again" on a widget
    // This saves 100x quota (videos.list = 1 unit vs search.list = 100 units)
    console.log('[Dashboard] Auto-refresh disabled for quota optimization. Use "Check Again" for manual refresh.');
    
    return () => {
      // No intervals to clean up
    };
  }, [widgets, setWidgets]);

  const minCellHeight = 80;

  // Hover detection for fullscreen mode - show header when mouse is in top 15px
  useEffect(() => {
    if (!isFullscreen) {
      setHeaderVisible(true);
      setExitButtonDismissed(false);
      return;
    }

    // Reset exit button state when entering fullscreen - it should be visible initially
    setExitButtonDismissed(false);

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 15) {
        setHeaderVisible(true);
      } else if (e.clientY > 80 && headerVisible) {
        setHeaderVisible(false);
      }
    };

    // Initially hide header in fullscreen mode
    setHeaderVisible(false);

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isFullscreen, headerVisible]);

  // Helper function to exit fullscreen and restore header
  const exitFullscreenAndRestoreHeader = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    setHeaderVisible(true);
    setExitButtonDismissed(false);
  };

  // ESC key to exit fullscreen (but not enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        exitFullscreenAndRestoreHeader();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Fullscreenchange event listener to sync state when browser exits fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Browser exited fullscreen (via ESC or other means)
        setIsFullscreen(false);
        setHeaderVisible(true);
        setExitButtonDismissed(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setIsFullscreen]);

  // Toggle seek mode for a specific widget
  const toggleSeekMode = (widgetId: string) => {
    setSeekModeWidgets(prev => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      return next;
    });
  };

  // Helper: Check if two widget bounds overlap
  const checkCollision = (
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean => {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  };

  // Helper: Find next available slot for a pushed widget
  // Also checks ad collision to ensure widgets don't get pushed into ad space
  const findNextAvailableSlot = (
    widget: Widget,
    allWidgets: Widget[],
    excludeId: string
  ): { x: number; y: number } | null => {
    // Try each position in the grid (row by row, left to right)
    for (let y = 0; y <= GRID_ROWS - widget.h; y++) {
      for (let x = 0; x <= GRID_COLS - widget.w; x++) {
        let collision = false;
        
        // Check collision with other widgets
        for (const other of allWidgets) {
          if (other.id === widget.id || other.id === excludeId) continue;
          if (checkCollision(x, y, widget.w, widget.h, other.x, other.y, other.w, other.h)) {
            collision = true;
            break;
          }
        }
        
        // AD-BLOCK SOLIDIFICATION: Check collision with ad
        if (!collision && ad) {
          if (checkCollision(x, y, widget.w, widget.h, ad.x, ad.y, ad.w, ad.h)) {
            collision = true;
          }
        }
        
        if (!collision) {
          return { x, y };
        }
      }
    }
    return null; // No available slot
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridContainerRef.current) return;

      const gridRect = gridContainerRef.current.getBoundingClientRect();
      const cellWidth = gridRect.width / GRID_COLS;
      const cellHeight = Math.max(minCellHeight, gridRect.height / GRID_ROWS);

      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      const colChange = Math.round(deltaX / cellWidth);
      const rowChange = Math.round(deltaY / cellHeight);

      const newW = Math.max(1, Math.min(GRID_COLS, resizing.startW + colChange));
      const newH = Math.max(1, Math.min(GRID_ROWS, resizing.startH + rowChange));

      setWidgets(prev => {
        const resizingWidget = prev.find(w => w.id === resizing.widgetId);
        if (!resizingWidget) return prev;

        // Calculate new bounds of the resizing widget
        const newBounds = {
          x: resizingWidget.x,
          y: resizingWidget.y,
          w: newW,
          h: newH
        };

        // Check if new size exceeds grid bounds
        if (newBounds.x + newW > GRID_COLS || newBounds.y + newH > GRID_ROWS) {
          // Block resize - exceeds grid
          return prev;
        }

        // AD-BLOCK SOLIDIFICATION: Block resize if it would collide with the ad
        // The ad is a solid grid item that widgets cannot resize into
        if (ad) {
          const collidesWithAd = checkCollision(
            newBounds.x, newBounds.y, newW, newH,
            ad.x, ad.y, ad.w, ad.h
          );
          if (collidesWithAd) {
            // Block resize - cannot resize into ad space
            return prev;
          }
        }

        // Find all widgets that would collide with the new size
        const collidingWidgets = prev.filter(w => {
          if (w.id === resizing.widgetId) return false;
          return checkCollision(
            newBounds.x, newBounds.y, newW, newH,
            w.x, w.y, w.w, w.h
          );
        });

        if (collidingWidgets.length === 0) {
          // No collision - allow resize
          return prev.map(w => 
            w.id === resizing.widgetId ? { ...w, w: newW, h: newH } : w
          );
        }

        // Push logic: Try to move each colliding widget to next available slot
        let updatedWidgets = [...prev];

        // First, update the resizing widget
        updatedWidgets = updatedWidgets.map(w => 
          w.id === resizing.widgetId ? { ...w, w: newW, h: newH } : w
        );

        for (const collidingWidget of collidingWidgets) {
          const newSlot = findNextAvailableSlot(collidingWidget, updatedWidgets, collidingWidget.id);

          if (newSlot === null) {
            // No room to push - block the resize entirely
            return prev;
          }

          // Move the colliding widget to the new slot
          updatedWidgets = updatedWidgets.map(w =>
            w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w
          );
        }

        return updatedWidgets;
      });
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, setWidgets, ad]);

  // ORIGIN LOCKDOWN: Hardcoded production domain for YouTube postMessage handshake
  // referrerPolicy="strict-origin-when-cross-origin" is set on iframes for valid Referer header
  const getYouTubeEmbedUrl = (videoId: string): string => {
    const origin = 'https://openbento.tv';
    return `https://www.youtube.com/embed/${videoId}?origin=${encodeURIComponent(origin)}&enablejsapi=1&autoplay=1&mute=1&modestbranding=1&rel=0&widget_referrer=${encodeURIComponent(origin)}`;
  };

  // NOTE: live_stream?channel= format is deprecated - we now require real videoIds

  // CRITICAL FIX: Dynamic Twitch Parent Detection
  const getTwitchEmbedUrl = (channel: string): string => {
    // Use dynamic hostname detection for any Replit subdomain
    return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=true&autoplay=true`;
  };

  const getKickEmbedUrl = (channel: string): string => {
    const parentDomain = window.location.hostname;
    return `https://player.kick.com/${channel}?muted=true&autoplay=true&parent=${parentDomain}`;
  };


  const sendYouTubeCommand = useCallback((widgetId: string, command: string, value?: number | boolean) => {
    const iframe = iframeRefs.current[widgetId];
    if (iframe && iframe.contentWindow) {
      const message = {
        event: 'command',
        func: command,
        args: value !== undefined ? [value] : []
      };
      iframe.contentWindow.postMessage(JSON.stringify(message), '*');
    }
  }, []);

  // Twitch Interactive Frames API - Volume sync via postMessage
  // Docs: https://dev.twitch.tv/docs/embed/video-and-clips/#interactive-frames-for-live-streams
  const sendTwitchCommand = useCallback((widgetId: string, command: 'setMuted' | 'setVolume', value: boolean | number) => {
    const iframe = iframeRefs.current[widgetId];
    if (iframe && iframe.contentWindow) {
      const message = { eventName: command, params: { value } };
      iframe.contentWindow.postMessage(message, 'https://player.twitch.tv');
    }
  }, []);

  // Kick Player Messaging - Volume sync via postMessage
  // Kick uses a similar postMessage API for embedded players
  const sendKickCommand = useCallback((widgetId: string, command: 'setMuted' | 'setVolume', value: boolean | number) => {
    const iframe = iframeRefs.current[widgetId];
    if (iframe && iframe.contentWindow) {
      const message = { event: command, data: value };
      iframe.contentWindow.postMessage(message, 'https://player.kick.com');
    }
  }, []);

  const handleRemoveWidget = (widgetId: string) => {
    // DOM EXCEPTION SHIELD: Safe widget deletion with delayed removal
    // First mark widget as hidden to trigger React unmount gracefully,
    // then remove from state after a short delay
    try {
      // Step 1: Hide the widget first (triggers YouTube cleanup)
      setWidgets(prev => prev.map(w => 
        w.id === widgetId ? { ...w, isDeleting: true } : w
      ));
      
      // Step 2: Actually remove after delay (gives YouTube time to cleanup)
      setTimeout(() => {
        try {
          setWidgets(prev => prev.filter(w => w.id !== widgetId));
        } catch (e) {
          console.log('[Dashboard] Widget removal caught error:', e);
        }
      }, 100);
    } catch (e) {
      console.log('[Dashboard] handleRemoveWidget caught error:', e);
      // Fallback: force remove immediately
      setWidgets(prev => prev.filter(w => w.id !== widgetId));
    }
  };

  const toggleWidgetMute = (widgetId: string) => {
    setWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        const newMuted = !w.isMuted;
        // Send mute command to appropriate platform
        if (w.isYouTube) {
          sendYouTubeCommand(widgetId, newMuted ? 'mute' : 'unMute');
        } else if (w.isTwitch) {
          sendTwitchCommand(widgetId, 'setMuted', newMuted);
          if (!newMuted) {
            // When unmuting Twitch, also set volume
            const restoreVolume = w.previousVolume || 50;
            sendTwitchCommand(widgetId, 'setVolume', restoreVolume / 100);
          }
        } else if (w.isKick) {
          sendKickCommand(widgetId, 'setMuted', newMuted);
          if (!newMuted) {
            // When unmuting Kick, also set volume
            const restoreVolume = w.previousVolume || 50;
            sendKickCommand(widgetId, 'setVolume', restoreVolume / 100);
          }
        }
        if (newMuted) {
          // When muting, store current volume for later restore
          return { ...w, isMuted: true, previousVolume: w.volume > 0 ? w.volume : (w.previousVolume || 50), volume: 0 };
        } else {
          // When unmuting, restore to previous volume (or default 50)
          const restoreVolume = w.previousVolume || 50;
          return { ...w, isMuted: false, volume: restoreVolume };
        }
      }
      return w;
    }));
  };

  // Set volume for a widget (0-100)
  const setWidgetVolume = (widgetId: string, volume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    setWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        // Auto-mute if volume is 0, auto-unmute if volume > 0
        const newMuted = clampedVolume === 0;
        // Update previousVolume when setting non-zero volume so mute/unmute restores correctly
        const newPreviousVolume = clampedVolume > 0 ? clampedVolume : w.previousVolume;
        
        // Send volume command to appropriate platform
        if (w.isTwitch) {
          sendTwitchCommand(widgetId, 'setVolume', clampedVolume / 100);
          sendTwitchCommand(widgetId, 'setMuted', newMuted);
        } else if (w.isKick) {
          sendKickCommand(widgetId, 'setVolume', clampedVolume / 100);
          sendKickCommand(widgetId, 'setMuted', newMuted);
        }
        
        return { ...w, volume: clampedVolume, isMuted: newMuted, previousVolume: newPreviousVolume };
      }
      return w;
    }));
  };

  // Get volume icon based on current volume level
  const getVolumeIcon = (widget: Widget) => {
    if (widget.isMuted || widget.volume === 0) {
      return <VolumeX className="w-[2rem] h-[2rem]" />;
    } else if (widget.volume < 50) {
      return <Volume1 className="w-[2rem] h-[2rem]" />;
    } else {
      return <Volume2 className="w-[2rem] h-[2rem]" />;
    }
  };

  const toggleWidgetPause = (widgetId: string) => {
    setWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        const newPaused = !w.isPaused;
        if (w.isYouTube) {
          sendYouTubeCommand(widgetId, newPaused ? 'pauseVideo' : 'playVideo');
        }
        return { ...w, isPaused: newPaused };
      }
      return w;
    }));
  };

  const handleRefreshWidget = async (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    // QUOTA OPTIMIZATION: Prefer videos.list (1 unit) over search.list (100 units)
    // If widget has a videoId, check if it's still live using videos.list first
    if (widget.isYouTube && widget.videoId) {
      console.log(`[CheckAgain] QUOTA OPT: Using videos.list (1 unit) for videoId: ${widget.videoId}`);
      
      try {
        const liveStatus = await checkVideoLiveStatus(widget.videoId);
        
        if (liveStatus.isLive) {
          console.log(`[CheckAgain] Video ${widget.videoId} is LIVE (videos.list 1 unit)`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId 
              ? { 
                  ...w, 
                  url: '', 
                  lastRefresh: Date.now(), 
                  isOffline: false,
                  isLive: true,
                  apiError: false,
                  error: null,
                  embedBlocked: false,
                } 
              : w
          ));
          return;
        } else {
          // Video is no longer live - ONLY update badge, keep embed rendering
          // ARCHITECTURE PIVOT: Never set isOffline=true if videoId exists
          console.log(`[CheckAgain] Video ${widget.videoId} is not live (badge update only)`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { 
              ...w, 
              isLive: false, // Badge only - embed keeps rendering
              error: null,
              embedBlocked: false,
            } : w
          ));
          return;
        }
      } catch (error) {
        console.error('[CheckAgain] Error checking video status:', error);
        // ARCHITECTURE PIVOT: Don't set offline on error - badge update only
        setWidgets(prev => prev.map(w => 
          w.id === widgetId ? { 
            ...w, 
            isLive: false, // Badge only
          } : w
        ));
        return;
      }
    }
    
    // FALLBACK: Only use search.list (100 units) if no videoId exists
    // This path should be rare - only for widgets without a stored videoId
    if (widget.isYouTube && widget.channelHandle && !widget.videoId) {
      console.warn(`[CheckAgain] EXPENSIVE: Using search.list (100 units) for @${widget.channelHandle} - no videoId stored`);
      
      try {
        const result = await searchChannelLiveStream(widget.channelHandle, true);
        
        if (result.isLive && result.liveVideoId) {
          console.log(`[CheckAgain] Found live stream: ${result.liveVideoId} for @${widget.channelHandle}`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId 
              ? { 
                  ...w, 
                  videoId: result.liveVideoId, 
                  youtubeChannelId: result.channelId,
                  url: '', 
                  lastRefresh: Date.now(), 
                  isOffline: false,
                  isLive: true,
                  isPlayingLatestVideo: false, // Playing live stream, not fallback
                  apiError: false,
                  error: null,
                  embedBlocked: false,
                } 
              : w
          ));
          checkedVideoIds.current.delete(widget.videoId || '');
          return;
        } else if (result.latestVideoId) {
          // LATEST-VIDEO FALLBACK: Channel not live, but we have their latest video
          // AUTO-SPLICING: Refresh the player with latestVideoId - no error shown
          console.log(`[CheckAgain] Channel @${widget.channelHandle} not live - auto-splicing latest video: ${result.latestVideoId}`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId 
              ? { 
                  ...w, 
                  videoId: result.latestVideoId, 
                  youtubeChannelId: result.channelId,
                  url: '', 
                  lastRefresh: Date.now(), 
                  isOffline: false, // Has content to show - no offline overlay
                  isLive: false, // Badge lockdown: LIVE badge hidden
                  isPlayingLatestVideo: true, // Flag for latest video fallback
                  apiError: false,
                  error: null,
                  embedBlocked: false,
                } 
              : w
          ));
          return;
        } else {
          // No liveVideoId and no latestVideoId - channel has no playable content
          const hasApiError = result.apiError === true;
          console.log(`[CheckAgain] Channel @${widget.channelHandle} has no playable content (apiError: ${hasApiError})`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { 
              ...w, 
              isOffline: true, // No content available - show offline state
              isLive: false,
              isPlayingLatestVideo: false,
              apiError: hasApiError,
              error: null,
              embedBlocked: false,
            } : w
          ));
          return;
        }
      } catch (error) {
        console.error('[CheckAgain] Error searching for live stream:', error);
        setWidgets(prev => prev.map(w => 
          w.id === widgetId ? { 
            ...w, 
            isOffline: true, 
            isLive: false,
            apiError: true,
            error: null,
          } : w
        ));
        return;
      }
    }

    // For YouTube widgets without channelHandle or videoId, just refresh
    if (widget.isYouTube && widget.videoId && !widget.channelHandle) {
      setWidgets(prev => prev.map(w => 
        w.id === widgetId && w.type === 'video' 
          ? { ...w, url: '', lastRefresh: Date.now(), isOffline: false, error: null, embedBlocked: false } 
          : w
      ));

      try {
        const liveStatus = await checkVideoLiveStatus(widget.videoId);
        if (liveStatus.isLive) {
          // Video is live - ensure consistent state
          console.log(`[TrueLiveFilter] Video ${widget.videoId} is LIVE`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { ...w, isOffline: false, isLive: true, error: null, embedBlocked: false } : w
          ));
        } else {
          console.log(`[TrueLiveFilter] Video ${widget.videoId} is not live (${liveStatus.liveBroadcastContent})`);
          setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { ...w, isOffline: true, isLive: false, error: null, embedBlocked: false } : w
          ));
        }
        return;
      } catch (error) {
        console.error('[TrueLiveFilter] Error checking live status:', error);
      }
      return;
    }

    // For non-YouTube widgets (Twitch/Kick), just refresh
    setWidgets(prev => prev.map(w => 
      w.id === widgetId && w.type === 'video' 
        ? { ...w, url: '', lastRefresh: Date.now(), isOffline: false, error: null, embedBlocked: false } 
        : w
    ));

    setTimeout(() => {
      setWidgets(prev => {
        const widget = prev.find(w => w.id === widgetId);
        if (widget) {
          const videoId = widget.videoId;
          const twitchChannel = widget.twitchChannel;
          return prev.map(w => {
            if (w.id === widgetId) {
              if (w.isYouTube && videoId) {
                return { ...w, url: `https://www.youtube.com/watch?v=${videoId}` };
              } else if (w.isTwitch && twitchChannel) {
                return { ...w, url: `https://www.twitch.tv/${twitchChannel}` };
              }
            }
            return w;
          });
        }
        return prev;
      });
    }, 100);
  };

  const handleRefreshAllWidgets = () => {
    const videoWidgets = widgets.filter(w => w.type === 'video' && w.url);
    if (videoWidgets.length === 0) return;

    setWidgets(prev => prev.map(w => {
      if (w.type === 'video' && w.url) {
        return { ...w, url: '', lastRefresh: Date.now(), isOffline: false };
      }
      return w;
    }));

    setTimeout(() => {
      setWidgets(prev => prev.map(w => {
        if (w.type === 'video') {
          if (w.isYouTube && w.videoId) {
            return { ...w, url: `https://www.youtube.com/watch?v=${w.videoId}` };
          } else if (w.isTwitch && w.twitchChannel) {
            return { ...w, url: `https://www.twitch.tv/${w.twitchChannel}` };
          }
        }
        return w;
      }));
    }, 100);
  };

  const handleMasterMute = () => {
    const newMute = !masterMute;
    setMasterMute(newMute);

    setWidgets(prev => prev.map(w => {
      if (w.type === 'video') {
        // Send mute command to appropriate platform
        if (w.isYouTube) {
          sendYouTubeCommand(w.id, newMute ? 'mute' : 'unMute');
        } else if (w.isTwitch) {
          sendTwitchCommand(w.id, 'setMuted', newMute);
          if (!newMute) {
            sendTwitchCommand(w.id, 'setVolume', (w.previousVolume || 50) / 100);
          }
        } else if (w.isKick) {
          sendKickCommand(w.id, 'setMuted', newMute);
          if (!newMute) {
            sendKickCommand(w.id, 'setVolume', (w.previousVolume || 50) / 100);
          }
        }
        
        // Update state: When muting, store volume and set to 0. When unmuting, restore volume.
        if (newMute) {
          return { 
            ...w, 
            isMuted: true, 
            previousVolume: w.volume > 0 ? w.volume : (w.previousVolume || 50),
            volume: 0 
          };
        } else {
          const restoreVolume = w.previousVolume || 50;
          return { ...w, isMuted: false, volume: restoreVolume };
        }
      }
      // Non-video widgets just get muted state updated
      return { ...w, isMuted: newMute };
    }));
  };

  const handleSaveLayout = () => {
    localStorage.setItem('openBentoWidgets', JSON.stringify(widgets));

    const saveButton = document.getElementById('save-button');
    if (saveButton) {
      saveButton.classList.add('ring-2', 'ring-cyan-400', 'scale-110');
      setTimeout(() => {
        saveButton.classList.remove('ring-2', 'ring-cyan-400', 'scale-110');
      }, 300);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, widgetId: string, currentW: number, currentH: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      widgetId,
      startX: e.clientX,
      startY: e.clientY,
      startW: currentW,
      startH: currentH
    });
  };

  const updateNoteContent = (widgetId: string, content: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, noteContent: content } : w
    ));
  };

  // Offline Placeholder Component with prominent OFFLINE badge
  const OfflinePlaceholder = ({ widget }: { widget: Widget }) => {
    // Check if this is a sports channel that's "Live during Games"
    const sportsChannelIds = ['nfl-network', 'nba-tv', 'espn-live', 'NFL', 'NBA', 'espn'];
    const widgetUrl = widget.url?.toLowerCase() || '';
    const widgetChannelId = widget.youtubeChannelId?.toLowerCase() || '';
    const isSportsChannel = sportsChannelIds.some(id => 
      widgetUrl.includes(id.toLowerCase()) || 
      widgetChannelId.includes(id.toLowerCase()) ||
      widget.id?.includes(id.toLowerCase())
    );
    
    if (isSportsChannel) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/50 p-[1.5rem] relative">
          {/* OFFLINE Badge */}
          <div className="absolute top-[0.8rem] left-[0.8rem] z-50">
            <span className="px-[0.8rem] py-[0.3rem] bg-gray-600 text-white text-[0.9rem] font-bold tracking-wide rounded shadow-lg uppercase">
              OFFLINE
            </span>
          </div>
          <div className="w-[3rem] h-[3rem] rounded-full bg-blue-500/20 flex items-center justify-center mb-[1rem]">
            <div className="w-[1.5rem] h-[1.5rem] rounded-full bg-blue-500 animate-pulse" />
          </div>
          <h3 className="text-[1.3rem] font-semibold text-blue-400 mb-[0.5rem]">Live During Games</h3>
          <p className="text-slate-400 text-center text-[1rem] mb-[1rem]">
            This channel streams live when games are scheduled
          </p>
          <button
            onClick={() => handleRefreshWidget(widget.id)}
            className="px-[1.2rem] py-[0.6rem] bg-cyan-600 hover:bg-cyan-500 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300"
            data-testid={`button-check-now-${widget.id}`}
          >
            <RefreshCw className="w-[1.2rem] h-[1.2rem]" />
            Check Now
          </button>
        </div>
      );
    }
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/50 p-[1.5rem] relative">
        {/* OFFLINE Badge - prominent corner indicator */}
        <div className="absolute top-[0.8rem] left-[0.8rem] z-50">
          <span className="px-[0.8rem] py-[0.3rem] bg-gray-600 text-white text-[0.9rem] font-bold tracking-wide rounded shadow-lg uppercase">
            OFFLINE
          </span>
        </div>
        <AlertCircle className="w-[3rem] h-[3rem] text-orange-400 mb-[1rem]" />
        <h3 className="text-[1.3rem] font-semibold text-orange-400 mb-[0.5rem]">Stream Offline</h3>
        <p className="text-slate-400 text-center text-[1rem] mb-[1rem]">
          {widget.isTwitch && `@${widget.twitchChannel} is not currently streaming`}
          {widget.isYouTube && `This channel is not currently live`}
          {widget.isKick && `@${widget.kickChannel} is not currently streaming`}
        </p>
        <button
          onClick={() => handleRefreshWidget(widget.id)}
          className="px-[1.2rem] py-[0.6rem] bg-cyan-600 hover:bg-cyan-500 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300"
          data-testid={`button-check-again-${widget.id}`}
        >
          <RefreshCw className="w-[1.2rem] h-[1.2rem]" />
          Check Again
        </button>
      </div>
    );
  };

  const renderWidgetContent = (widget: Widget) => {
    const isSeekMode = seekModeWidgets.has(widget.id);

    const early = WidgetRenderer({
      widget,
      onToggle24Hour: toggleClock24Hour,
      onUpdate: (widgetId, patch) =>
        setWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, ...patch } : w)),
      isDarkMode,
      isEditMode,
    });
    if (early !== false) return early;

    switch (widget.type) {
      case 'video':
        return (
          <VideoWidget
            widget={widget}
            isSeekMode={isSeekMode}
            iframeRefs={iframeRefs}
            inlineInputWidgetId={inlineInputWidgetId}
            inlineInputValue={inlineInputValue}
            setInlineInputWidgetId={setInlineInputWidgetId}
            setInlineInputValue={setInlineInputValue}
            setWidgets={setWidgets}
            handleVideoError={handleVideoError}
            getYouTubeEmbedUrl={getYouTubeEmbedUrl}
            getTwitchEmbedUrl={getTwitchEmbedUrl}
            getKickEmbedUrl={getKickEmbedUrl}
            onInlineUrlSubmit={onInlineUrlSubmit}
            OfflinePlaceholder={OfflinePlaceholder}
          />
        );

      default:
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0f172a',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '0.875rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
            data-testid={`unknown-widget-${widget.id}`}
          >
            Unknown Widget: {widget.type}
          </div>
        );
    }
  };

  return (
    <div 
      className={`h-screen overflow-hidden font-sans flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:pl-[32rem]' : ''}`} 
      style={{ 
        padding: isFullscreen && !headerVisible ? '0' : '1.6rem',
        background: isDarkMode ? '#0f172a' : '#F8F9FA',
        color: isDarkMode ? '#f1f5f9' : '#1A1A1A'
      }}
      data-testid="main-dashboard"
    >
      {/* Starry Night Background - Only visible in dark mode */}
      {isDarkMode && (
        <div className="starry-night" data-testid="starry-night-background">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
          <div className="shooting-star"></div>
          <div className="shooting-star"></div>
          <div className="shooting-star"></div>
        </div>
      )}

      {/* Decorative gradients */}
      <div className={`fixed inset-0 pointer-events-none z-0 ${isDarkMode ? 'opacity-30' : 'opacity-10'}`}>
        <div className={`absolute top-[8rem] left-[8rem] w-[38rem] h-[38rem] rounded-full blur-[120px] ${isDarkMode ? 'bg-cyan-500 animate-pulse' : 'bg-cyan-400'}`}></div>
        <div className={`absolute bottom-[8rem] right-[8rem] w-[38rem] h-[38rem] rounded-full blur-[120px] ${isDarkMode ? 'bg-purple-500 animate-pulse' : 'bg-purple-400'}`} style={isDarkMode ? { animationDelay: '1s' } : {}}></div>
      </div>

      {/* 40px hover zone at top-center - reveals exit button when hovering (only when header hidden) */}
      {isFullscreen && (
        <div 
          className={`fixed top-0 left-1/2 -translate-x-1/2 w-[24rem] h-[40px] z-[10001] group transition-opacity duration-200 ${
            headerVisible ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
          data-testid="hover-zone-top"
        >
          <button
            onClick={exitFullscreenAndRestoreHeader}
            className="absolute top-[0.8rem] left-1/2 -translate-x-1/2 p-[0.8rem] bg-slate-800/90 hover:bg-red-600 backdrop-blur-md slot-button text-slate-300 hover:text-white shadow-lg border border-slate-600/50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
            title="Exit Fullscreen (or press ESC)"
            data-testid="button-exit-fullscreen-floating"
          >
            <X className="w-[1.4rem] h-[1.4rem]" />
          </button>
        </div>
      )}

      <div 
        className={`z-30 mb-[1rem] flex-shrink-0 ${
          isFullscreen 
            ? `fixed top-0 left-0 right-0 backdrop-blur-md px-[1.6rem] py-[0.8rem] shadow-lg border-b ${isDarkMode ? 'bg-slate-950/95 border-slate-800/50' : 'bg-white/95 border-gray-200'}`
            : 'relative'
        }`}
        style={{ 
          height: 'auto',
          transform: isFullscreen && !headerVisible ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 10001
        }}
        onMouseLeave={() => isFullscreen && setHeaderVisible(false)}
        data-testid="header-container"
      >
        <div className="flex items-center justify-between gap-[0.8rem] h-[3.2rem]">
          <div className="flex items-center gap-[1.2rem] h-[3.2rem]">
            <button
              onClick={() => {
                if (isFullscreen) {
                  exitFullscreenAndRestoreHeader();
                } else {
                  document.documentElement.requestFullscreen?.().catch(() => {});
                  setIsFullscreen(true);
                }
              }}
              className={`h-[3.2rem] w-[3.2rem] flex items-center justify-center slot-button transition-all duration-300 border ${
                isFullscreen 
                  ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500/50' 
                  : isDarkMode 
                    ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-600/50 hover:border-cyan-500/50'
                    : 'bg-gray-200 hover:bg-gray-300 border-gray-300 hover:border-cyan-500/50'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
              data-testid="button-toggle-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-[1.6rem] h-[1.6rem] text-white" /> : <Maximize2 className={`w-[1.6rem] h-[1.6rem] ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`} />}
            </button>
            {/* Help/Tutorial Button - Right beside Fullscreen */}
            <FloatingTutorial isDarkMode={isDarkMode} />
            <img 
              src="/t.png" 
              alt="OpenBento Logo" 
              className="h-[2.4rem] w-auto object-contain"
              data-testid="img-logo"
            />
            <h1 className={`text-[1.8rem] font-bold tracking-wider leading-[3.2rem] h-[3.2rem] flex items-center ${isDarkMode ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent' : 'text-gray-900'}`} data-testid="text-title" style={{ fontFamily: 'Inter, sans-serif' }}>
              OpenBento
            </h1>
            <span className={`h-[3.2rem] flex items-center text-[1rem] px-[0.8rem] rounded-full ${isDarkMode ? 'text-slate-400 bg-slate-800/50' : 'text-gray-600 bg-gray-200'}`}>
              {widgets.length} widgets
            </span>
            <span className={`h-[3.2rem] flex items-center text-[0.9rem] px-[0.6rem] rounded-full border ${isDarkMode ? 'text-cyan-400/70 bg-cyan-900/30 border-cyan-500/30' : 'text-cyan-600 bg-cyan-100 border-cyan-300'}`}>
              {GRID_COLS}-col grid
            </span>

          </div>

          <div className="flex gap-[0.8rem] items-center h-[3.2rem]">
            {/* Clear All - Hold to Clear (2 seconds) - Only visible in Edit Mode */}
            {isEditMode && (
              <button
                onMouseDown={() => {
                  clearHoldStartRef.current = Date.now();
                  const updateProgress = () => {
                    if (!clearHoldStartRef.current) return;
                    const elapsed = Date.now() - clearHoldStartRef.current;
                    const progress = Math.min((elapsed / 2000) * 100, 100);
                    setClearHoldProgress(progress);

                    if (progress >= 100) {
                      setWidgets([]);
                      setClearHoldProgress(0);
                      clearHoldStartRef.current = null;
                      if (clearHoldTimerRef.current) {
                        clearInterval(clearHoldTimerRef.current);
                        clearHoldTimerRef.current = null;
                      }
                    }
                  };
                  clearHoldTimerRef.current = setInterval(updateProgress, 50);
                }}
                onMouseUp={() => {
                  if (clearHoldTimerRef.current) {
                    clearInterval(clearHoldTimerRef.current);
                    clearHoldTimerRef.current = null;
                  }
                  clearHoldStartRef.current = null;
                  setClearHoldProgress(0);
                }}
                onMouseLeave={() => {
                  if (clearHoldTimerRef.current) {
                    clearInterval(clearHoldTimerRef.current);
                    clearHoldTimerRef.current = null;
                  }
                  clearHoldStartRef.current = null;
                  setClearHoldProgress(0);
                }}
                className="relative h-[3.2rem] px-[1.2rem] bg-slate-600/60 hover:bg-slate-500/70 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 shadow-md text-[1.2rem] leading-[3.2rem] overflow-hidden border border-slate-500/40"
                title="Hold for 2 seconds to clear all widgets"
                data-testid="button-clear-all"
              >
                <div 
                  className="absolute inset-0 bg-red-600 transition-none"
                  style={{ width: `${clearHoldProgress}%` }}
                />
                <Trash2 className="w-[1.4rem] h-[1.4rem] relative z-10" />
                <span className="relative z-10">{clearHoldProgress > 0 ? 'Hold...' : 'Clear All'}</span>
              </button>
            )}

            {/* Block button - Opens Stream Library sidebar */}
            <button
              onClick={() => {
                handleOpenSidebarToContent();
                if (!isAdActive) {
                  triggerAd();
                }
              }}
              disabled={isGridFull}
              className={`menu-btn h-[3.2rem] px-[1.2rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform shadow-md text-[1.2rem] leading-[3.2rem] ${
                isGridFull
                  ? 'bg-slate-600/60 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600/70 hover:bg-emerald-500/80 hover:scale-105'
              }`}
              title={isGridFull ? 'Grid Full - No space available' : 'Add a new block'}
              data-testid="button-add-block"
            >
              <Plus className="w-[1.4rem] h-[1.4rem]" />
              {isGridFull ? 'Full' : 'Block'}
            </button>

            <button
              onClick={handleRefreshAllWidgets}
              className="menu-btn h-[3.2rem] px-[1.2rem] bg-cyan-600/70 hover:bg-cyan-500/80 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 shadow-md text-[1.2rem] leading-[3.2rem]"
              data-testid="button-refresh-all"
            >
              <RefreshCw className="w-[1.4rem] h-[1.4rem]" />
              Refresh
            </button>

            {/* Edit/Save button */}
            <button
              onClick={() => {
                if (isEditMode) {
                  handleSaveLayout();
                  setIsEditMode(false);
                } else {
                  setIsEditMode(true);
                }
              }}
              className={`menu-btn h-[3.2rem] px-[1.2rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] ${
                isEditMode 
                  ? 'bg-teal-600/70 hover:bg-teal-500/80 shadow-md ring-2 ring-teal-400/60' 
                  : 'bg-orange-600/70 hover:bg-orange-500/80 shadow-md'
              }`}
              data-testid="button-edit-layout"
            >
              {isEditMode ? (
                <>
                  <Save className="w-[1.4rem] h-[1.4rem]" />
                </>
              ) : (
                <Edit3 className="w-[1.4rem] h-[1.4rem]" />
              )}
              {isEditMode ? 'Save' : 'Edit'}
            </button>

            <button
              onClick={handleMasterMute}
              className={`menu-btn indicator-btn h-[3.2rem] px-[1.2rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] ${
                masterMute 
                  ? 'bg-red-600/70 hover:bg-red-500/80 shadow-md' 
                  : 'bg-emerald-600/70 hover:bg-emerald-500/80 shadow-md'
              }`}
              data-testid="button-master-mute"
            >
              {masterMute ? <VolumeX className="w-[1.4rem] h-[1.4rem]" /> : <Volume2 className="w-[1.4rem] h-[1.4rem]" />}
              {masterMute ? 'MUTED' : 'LIVE'}
            </button>

            {/* Theme Toggle - Sun/Moon */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`menu-btn relative h-[3.2rem] px-[1.2rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] overflow-hidden ${
                isDarkMode 
                  ? 'bg-indigo-700/60 hover:bg-indigo-600/70 shadow-md text-slate-100' 
                  : 'bg-amber-400/80 hover:bg-amber-300/90 shadow-md text-amber-900'
              }`}
              data-testid="button-theme-toggle"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Moon className="w-[1.4rem] h-[1.4rem]" /> : <Sun className="w-[1.4rem] h-[1.4rem]" />}
              {isDarkMode ? 'Dark' : 'Light'}
            </button>

            {/* Cast to TV - Popover with paired TV list + manual push */}
            <CastPopover
              widgets={widgets}
              isDarkMode={isDarkMode}
              masterMute={masterMute}
            />

            {/* Request Dropdown */}
            <div className="relative group">
              <button
                className="menu-btn h-[3.2rem] px-[1.2rem] bg-slate-600/60 hover:bg-slate-500/70 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] shadow-md text-white"
                data-testid="button-request"
                title="Submit feedback"
              >
                <MessageSquare className="w-[1.4rem] h-[1.4rem]" />
                Request
                <ChevronDown className="w-[1rem] h-[1rem]" />
              </button>
              <div className="absolute right-0 top-full mt-[0.4rem] w-[16rem] bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[10001]">
                <Link
                  href="/feedback?category=idea"
                  className="flex items-center gap-[0.8rem] px-[1.2rem] py-[1rem] hover-elevate rounded-t-lg text-[1.1rem] text-slate-300"
                  data-testid="link-request-idea"
                >
                  <Lightbulb className="w-[1.2rem] h-[1.2rem] text-amber-400" />
                  Add a new idea
                </Link>
                <Link
                  href="/feedback?category=bug"
                  className="flex items-center gap-[0.8rem] px-[1.2rem] py-[1rem] hover-elevate rounded-b-lg text-[1.1rem] text-slate-300 border-t border-slate-700/50"
                  data-testid="link-request-bug"
                >
                  <Bug className="w-[1.2rem] h-[1.2rem] text-red-400" />
                  Report a bug
                </Link>
              </div>
            </div>

            {/* Login Button - Consistent height with other menu buttons - shown when NOT logged in */}
            {!isAuthenticated && (
              <button
                onClick={() => openLoginModal()}
                className="menu-btn h-[3.2rem] px-[1.2rem] bg-slate-600/60 hover:bg-slate-500/70 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] shadow-md text-white"
                data-testid="button-login"
              >
                <User className="w-[1.4rem] h-[1.4rem]" />
                Login
              </button>
            )}

            {/* User Avatar/Menu - Consistent height with other menu buttons - shown when logged in */}
            {isAuthenticated && user && (
              <div className="relative group">
                <button
                  className="menu-btn h-[3.2rem] px-[1.2rem] bg-slate-600/60 hover:bg-slate-500/70 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] shadow-md text-white"
                  data-testid="button-user-menu"
                  title={`Logged in as ${user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'User'}`}
                >
                  {(user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                    <img 
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture} 
                      alt="User" 
                      className="w-[1.8rem] h-[1.8rem] rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-[1.4rem] h-[1.4rem]" />
                  )}
                  <span className="max-w-[8rem] truncate">{(user.user_metadata?.full_name || user.user_metadata?.name || user.email)?.split(' ')[0] || 'User'}</span>
                  <ChevronDown className="w-[1.2rem] h-[1.2rem]" />
                </button>
                <div className="absolute right-0 top-full mt-[0.4rem] w-[16rem] bg-slate-800 border border-slate-600 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  {user.email === ADMIN_EMAIL && (
                    <Link href="/admin">
                      <a
                        className="flex items-center gap-[0.8rem] px-[1.2rem] py-[1rem] text-[1.2rem] text-cyan-400 hover:bg-slate-700 transition-colors rounded-t-lg"
                        data-testid="link-admin-dashboard"
                      >
                        <Shield className="w-[1.4rem] h-[1.4rem]" />
                        Admin Dashboard
                      </a>
                    </Link>
                  )}
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-[0.8rem] px-[1.2rem] py-[1rem] text-[1.2rem] text-red-400 hover:bg-slate-700 transition-colors rounded-b-lg"
                    data-testid="button-logout"
                  >
                    <LogOut className="w-[1.4rem] h-[1.4rem]" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-[0.2rem] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full mt-[0.8rem]"></div>
      </div>


      <div 
        className={`canvas-container p-[1rem] transition-all duration-300 ${
          isFullscreen && !headerVisible ? 'rounded-none h-screen' : 'rounded-[2rem]'
        }`}
        style={{
          marginTop: isFullscreen && headerVisible ? '6rem' : '0'
        }}
        data-testid="canvas-container"
      >
        <div 
          className="absolute inset-[1rem] grid gap-[1rem] pointer-events-none z-0"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
          }}
          data-testid="ghost-grid"
        >
          {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => (
            <div key={i} className="ghost-cell" />
          ))}
        </div>

        {/* Ghost Preview - shows during drag */}
        {ghostPosition && (
          <div 
            className="absolute inset-[1rem] grid gap-[1rem] pointer-events-none z-[99999]"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
            }}
            data-testid="ghost-preview-grid"
          >
            <div
              className="bg-cyan-500/30 border-2 border-dashed border-cyan-400 backdrop-blur-sm transition-all duration-100"
              style={{
                gridColumn: `${ghostPosition.x + 1} / span ${Math.min(ghostPosition.w, GRID_COLS - ghostPosition.x)}`,
                gridRow: `${ghostPosition.y + 1} / span ${Math.min(ghostPosition.h, GRID_ROWS - ghostPosition.y)}`,
                borderRadius: 'var(--outer-radius)'
              }}
              data-testid="ghost-preview"
            />
          </div>
        )}

        <div 
          ref={gridContainerRef}
          className="relative z-10 grid gap-[1rem] h-full"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gridAutoFlow: 'dense'
          }}
          data-testid="widget-grid"
        >
        {widgets.filter(w => !w.isDeleting).map((widget) => (
          <SortableWidget 
            key={widget.id} 
            widget={widget} 
            isEditMode={isEditMode}
            isDarkMode={isDarkMode}
            onColorPickerOpen={() => setColorPickerWidget(colorPickerWidget === widget.id ? null : widget.id)}
          >
            {widget.type === 'video' && (widget.url || widget.videoId || widget.youtubeChannelId || widget.twitchChannel || widget.kickChannel) && !isEditMode && !widget.isOffline && (
              <>
                {/* Seek Mode "Done" button - always visible when seek mode is active */}
                {seekModeWidgets.has(widget.id) && (
                  <div className="absolute bottom-[0.6rem] left-1/2 -translate-x-1/2 z-50" style={{ pointerEvents: 'auto' }}>
                    <button
                      type="button"
                      disabled={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleSeekMode(widget.id);
                      }}
                      className="px-[1.2rem] py-[0.5rem] slot-button transition-all duration-300 backdrop-blur-sm bg-purple-600/95 hover:bg-purple-500 flex items-center gap-[0.5rem] shadow-lg border border-purple-400/50 cursor-pointer"
                      title="Lock video controls"
                      data-testid={`button-seek-done-${widget.id}`}
                    >
                      <LockKeyhole className="w-[1rem] h-[1rem]" />
                      <span className="text-[1rem] font-semibold">Done</span>
                    </button>
                  </div>
                )}

                {/* Regular hover controls - circular 40px buttons with Life-Box theme */}
                <div 
                  className={`absolute top-[0.6rem] right-[0.6rem] z-50 flex gap-[0.8rem] transition-opacity duration-200 ${seekModeWidgets.has(widget.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  style={{ pointerEvents: 'auto' }}
                >
                  <button
                    type="button"
                    disabled={false}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleSeekMode(widget.id);
                    }}
                    className={`w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm cursor-pointer flex items-center justify-center shadow-lg border border-white/30 ${
                      seekModeWidgets.has(widget.id)
                        ? 'bg-purple-600/90 hover:bg-purple-500 ring-2 ring-purple-400'
                        : 'bg-indigo-600/90 hover:bg-indigo-500'
                    }`}
                    title={seekModeWidgets.has(widget.id) ? 'Disable seek controls' : 'Enable seek controls (rewind/skip)'}
                    data-testid={`button-seek-mode-${widget.id}`}
                  >
                    <Sliders className="w-[2rem] h-[2rem]" />
                  </button>

                  {/* Volume Control Button - Click to toggle mute AND show slider at bottom */}
                  <button
                    onClick={() => {
                      toggleWidgetMute(widget.id);
                      // Toggle volume slider visibility
                      setVolumeSliderWidget(prev => prev === widget.id ? null : widget.id);
                    }}
                    className={`w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 ${
                      widget.isMuted || widget.volume === 0
                        ? 'bg-red-600/90 hover:bg-red-500' 
                        : 'bg-emerald-600/90 hover:bg-emerald-500'
                    }`}
                    title={widget.isMuted ? 'Unmute' : 'Mute'}
                    data-testid={`button-mute-${widget.id}`}
                  >
                    {getVolumeIcon(widget)}
                  </button>

                  <button
                    onClick={() => toggleWidgetPause(widget.id)}
                    className={`w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 ${
                      widget.isPaused 
                        ? 'bg-yellow-600/90 hover:bg-yellow-500' 
                        : 'bg-blue-600/90 hover:bg-blue-500'
                    }`}
                    title={widget.isPaused ? 'Play' : 'Pause'}
                    data-testid={`button-pause-${widget.id}`}
                  >
                    {widget.isPaused ? <Play className="w-[2rem] h-[2rem]" /> : <Pause className="w-[2rem] h-[2rem]" />}
                  </button>

                  <button
                    onClick={() => handleRefreshWidget(widget.id)}
                    className="w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm bg-cyan-600/90 hover:bg-cyan-500 flex items-center justify-center shadow-lg border border-white/30"
                    title="Refresh stream"
                    data-testid={`button-refresh-${widget.id}`}
                  >
                    <RefreshCw className="w-[2rem] h-[2rem]" />
                  </button>

                  <button
                    onClick={() => {
                      if (isWidgetSaved(widget)) {
                        removeWidgetFromLibrary(widget);
                      } else {
                        saveWidgetToLibrary(widget);
                      }
                    }}
                    className="w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 bg-slate-700/90 hover:bg-slate-600"
                    title={isWidgetSaved(widget) ? 'Remove from Personal Library' : 'Save to Personal Library'}
                    data-testid={`button-save-${widget.id}`}
                  >
                    <Star className={`w-[2rem] h-[2rem] transition-colors ${isWidgetSaved(widget) ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
                  </button>

                  <button
                    onClick={() => handleRemoveWidget(widget.id)}
                    className="w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm bg-red-600/90 hover:bg-red-500 flex items-center justify-center shadow-lg border border-white/30"
                    title="Delete widget"
                    data-testid={`button-delete-${widget.id}`}
                  >
                    <Trash2 className="w-[2rem] h-[2rem]" />
                  </button>
                </div>
              </>
            )}

            {isEditMode && (
              <div 
                className="absolute top-[0.6rem] right-[0.6rem] z-40 flex gap-[0.8rem]"
                style={{ pointerEvents: 'auto' }}
              >
                {/* Color Droplet - Same circular shape as other buttons */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setColorPickerWidget(colorPickerWidget === widget.id ? null : widget.id);
                  }}
                  className={`w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 ${
                    widget.customColor 
                      ? 'hover:opacity-80' 
                      : 'bg-purple-600/90 hover:bg-purple-500'
                  }`}
                  style={widget.customColor ? { backgroundColor: widget.customColor } : {}}
                  title="Change block color"
                  data-testid={`color-picker-${widget.id}`}
                >
                  <Palette className="w-[2rem] h-[2rem]" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemoveWidget(widget.id);
                  }}
                  className="w-[4rem] h-[4rem] rounded-full bg-red-600/90 hover:bg-red-500 transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30"
                  title="Remove widget"
                  data-testid={`button-remove-${widget.id}`}
                >
                  <Trash2 className="w-[2rem] h-[2rem]" />
                </button>
              </div>
            )}

            {/* Bento.me Color Picker Popup */}
            {colorPickerWidget === widget.id && isEditMode && (
              <div 
                className="absolute top-[5rem] right-[0.6rem] z-[10001] bg-slate-900/95 backdrop-blur-sm rounded-[1.6rem] p-[1.2rem] shadow-2xl border border-white/20"
                style={{ pointerEvents: 'auto' }}
              >
                <div className="flex flex-col gap-[0.8rem]">
                  <span className="text-[1rem] font-semibold text-white/80 mb-[0.4rem]">Block Color</span>
                  <div className="grid grid-cols-5 gap-[0.6rem]">
                    {[
                      // Row 1: Dark/neutral tones (more visible in light mode)
                      '#374151', '#1f2937', '#27272a', '#292524', '#44403c',
                      // Row 2-4: Vibrant, saturated colors (high visibility)
                      '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488',
                      '#2563eb', '#7c3aed', '#db2777', '#e11d48', '#4f46e5',
                      '#0891b2', '#0284c7', '#9333ea', '#c026d3', '#65a30d'
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => setWidgetColor(widget.id, color)}
                        className={`w-[2.4rem] h-[2.4rem] rounded-full border-2 transition-all hover:scale-110 ${
                          widget.customColor === color ? 'border-white ring-2 ring-white/50' : 'border-white/20'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                        data-testid={`color-swatch-${color}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-[0.6rem] mt-[0.6rem]">
                    <button
                      onClick={() => setWidgetColor(widget.id, undefined)}
                      className="flex-1 px-[0.8rem] py-[0.5rem] bg-slate-700 hover:bg-slate-600 rounded-full text-[0.9rem] font-medium transition-colors"
                      data-testid="button-reset-color"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setColorPickerWidget(null)}
                      className="flex-1 px-[0.8rem] py-[0.5rem] bg-cyan-600 hover:bg-cyan-500 rounded-full text-[0.9rem] font-medium transition-colors"
                      data-testid="button-close-color-picker"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div 
              className="w-full h-full"
              style={{ 
                pointerEvents: widget.type === 'video' && !isEditMode && !seekModeWidgets.has(widget.id) ? 'none' : 'auto'
              }}
            >
              {renderWidgetContent(widget)}
            </div>

            {/* Volume Slider - appears at bottom when volume icon clicked */}
            {widget.type === 'video' && volumeSliderWidget === widget.id && !isEditMode && (
              <div 
                className="absolute bottom-[1rem] left-1/2 -translate-x-1/2 z-50 transition-all duration-300"
                style={{ pointerEvents: 'auto' }}
              >
                <div className="bg-slate-900/95 backdrop-blur-sm rounded-full px-[1.5rem] py-[1rem] flex items-center gap-[1rem] shadow-lg border border-white/20">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={widget.volume}
                    onChange={(e) => setWidgetVolume(widget.id, parseInt(e.target.value))}
                    className="w-[12rem] h-[0.5rem] bg-slate-600 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${widget.volume}%, #475569 ${widget.volume}%, #475569 100%)`
                    }}
                    data-testid={`slider-volume-${widget.id}`}
                  />
                  <span className="text-[1.4rem] font-mono text-white min-w-[3.5rem] text-center" data-testid={`text-volume-${widget.id}`}>
                    {widget.volume}%
                  </span>
                  <button
                    onClick={() => setVolumeSliderWidget(null)}
                    className="ml-[0.5rem] w-[2.5rem] h-[2.5rem] rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                    title="Close volume control"
                    data-testid={`button-close-volume-${widget.id}`}
                  >
                    <X className="w-[1.4rem] h-[1.4rem] text-white" />
                  </button>
                </div>
              </div>
            )}

            {isEditMode && (
              <div
                onMouseDown={(e) => handleResizeStart(e, widget.id, widget.w, widget.h)}
                className="absolute bottom-0 right-0 w-[2.4rem] h-[2.4rem] cursor-se-resize z-[10000] flex items-center justify-center bg-purple-600/80 hover:bg-purple-500 transition-colors"
                style={{ 
                  borderTopLeftRadius: 'var(--inner-radius)',
                  pointerEvents: 'auto'
                }}
                title="Drag to resize"
                data-testid={`resize-handle-${widget.id}`}
              >
                <MoveDiagonal2 className="w-[1.4rem] h-[1.4rem] text-white" />
              </div>
            )}
          </SortableWidget>
        ))}

        {/* DONATION BLOCK - Single "Buy Me a Coffee" ad block with 10-day cooldown */}
        {ad && (
          <div
            key={ad.id}
            style={{
              gridColumn: `${ad.x + 1} / span ${ad.w}`,
              gridRow: `${ad.y + 1} / span ${ad.h}`,
            }}
            className="z-20"
          >
            <AdBlock
              ad={ad}
              onSkip={skipAd}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {widgets.length === 0 && !isEditMode && !hasStartedBuilding && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            data-testid="empty-state"
          >
            <div className="pointer-events-auto flex flex-col items-center justify-center text-center">
              <Power className="w-[6rem] h-[6rem] mb-[1.5rem] text-cyan-400/30" />
              <h3 className="text-[1.6rem] font-bold mb-[0.8rem] text-slate-900 dark:text-white">Dashboard Empty</h3>
              <p className="text-[1.2rem] mb-[1.5rem] text-slate-900 dark:text-white">Click "Block" in the menu bar to add blocks to your dashboard</p>
              <button
                onClick={() => {
                  setHasStartedBuilding(true); // Remove this button from DOM after click
                  setIsEditMode(true);
                  // Automatically open the library sidebar so users can add blocks
                  handleOpenSidebarToContent();
                  // Trigger viral ad on Start Building click (free users only)
                  if (!isAdActive) {
                    triggerAd();
                  }
                }}
                className="px-[2rem] py-[1rem] bg-cyan-600 hover:bg-cyan-500 slot-button font-semibold flex items-center gap-[0.8rem] transition-all duration-300 text-[1.3rem]"
                data-testid="button-start-editing"
              >
                <Edit3 className="w-[1.6rem] h-[1.6rem]" />
                Start Building
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Compact fixed-position footer — visible on the dashboard without
          consuming grid space. Hidden in fullscreen / TV mode to avoid clutter. */}
      {!isFullscreen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center pb-1"
          data-testid="dashboard-footer"
        >
          <div className="pointer-events-auto flex items-center gap-3 px-3 py-1 rounded-full bg-slate-900/70 backdrop-blur-sm border border-slate-700/40 text-[0.7rem] text-slate-400 shadow-lg">
            <span>© 2026 ANCU LABS FZC LLC</span>
            <span className="text-slate-600">·</span>
            <Link
              href="/terms"
              className="hover:text-cyan-300 transition-colors"
              data-testid="link-dashboard-terms"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-cyan-300 transition-colors"
              data-testid="link-dashboard-privacy"
            >
              Privacy
            </Link>
          </div>
        </div>
      )}

    </div>
  );
};

export default MasterControlDashboard;