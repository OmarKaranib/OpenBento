import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction, MutableRefObject } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, X, ChevronDown, Edit3, Lock, RefreshCw, GripVertical, FileText, Square, Image as ImageIcon, Trash2, Settings, PanelLeftClose, PanelLeftOpen, Pause, Play, Maximize2, Minimize2, MoveDiagonal2, Sliders, LockKeyhole, AlertCircle, Star } from 'lucide-react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget, WidgetType } from '@/App';
import { YouTubePlayer } from '@/components/youtube-player';
import { SavedChannel, loadPersonalLibrary, savePersonalLibrary } from '@/components/widget-sidebar';

const GRID_COLS = 12;
const GRID_ROWS = 6;

interface SortableWidgetProps {
  widget: Widget;
  isEditMode: boolean;
  children: React.ReactNode;
}

const SortableWidget = ({ widget, isEditMode, children }: SortableWidgetProps) => {
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `${widget.x + 1} / span ${Math.min(widget.w, GRID_COLS - widget.x)}`,
    gridRow: `${widget.y + 1} / span ${Math.min(widget.h, GRID_ROWS - widget.y)}`
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`dashboard-slot relative bg-slate-900/50 backdrop-blur-sm border group transition-all duration-300 shadow-xl overflow-hidden ${
        isEditMode
          ? 'border-purple-500/70 ring-1 ring-purple-400/30 animate-jiggle'
          : 'border-slate-700/50 hover:border-cyan-500/50'
      } ${isDragging ? 'z-[9999]' : 'z-10'}`}
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
  addWidget: (type: WidgetType, w?: number, h?: number, extraData?: Partial<Widget>) => string;
  isFullscreen: boolean;
  setIsFullscreen: Dispatch<SetStateAction<boolean>>;
  ghostPosition: { x: number; y: number; w: number; h: number } | null;
  gridContainerRef: MutableRefObject<HTMLDivElement | null>;
  isGridFull: boolean;
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
  isGridFull
}: MasterControlDashboardProps) => {
  const [masterMute, setMasterMute] = useState(true);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [exitButtonDismissed, setExitButtonDismissed] = useState(false);
  const [seekModeWidgets, setSeekModeWidgets] = useState<Set<string>>(new Set());
  const [inlineInputWidgetId, setInlineInputWidgetId] = useState<string | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [clearHoldProgress, setClearHoldProgress] = useState(0);
  const [personalLibrary, setPersonalLibrary] = useState<SavedChannel[]>(() => loadPersonalLibrary());
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

  // Save widget to Personal Library
  const saveWidgetToLibrary = useCallback((widget: Widget) => {
    if (widget.type !== 'video') return;
    
    // Generate descriptive name based on platform and channel
    let name = 'Saved Stream';
    if (widget.isYouTube) {
      name = widget.youtubeChannelId 
        ? `YouTube: ${widget.youtubeChannelId}` 
        : widget.videoId 
          ? `YouTube Video` 
          : 'YouTube Stream';
    } else if (widget.isTwitch && widget.twitchChannel) {
      name = `Twitch: ${widget.twitchChannel}`;
    } else if (widget.isKick && widget.kickChannel) {
      name = `Kick: ${widget.kickChannel}`;
    }
    
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
  }, []);

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
      // Dispatch event to sync sidebar
      window.dispatchEvent(new CustomEvent('personalLibraryUpdated'));
      return updated;
    });
  }, []);

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

  // 10-minute refresh interval for live widgets only
  // Normal videos (isLive=false) do not get automatic refresh
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const liveWidgetCount = widgets.filter(w => w.type === 'video' && w.isLive === true).length;
  
  useEffect(() => {
    if (liveWidgetCount === 0) {
      return; // No live widgets, no need for refresh interval
    }
    
    console.log(`[Dashboard] Starting 10-min refresh interval for ${liveWidgetCount} live widget(s)`);
    
    const refreshInterval = setInterval(() => {
      const now = Date.now();
      console.log('[Dashboard] Running 10-min live widget refresh check');
      
      setWidgets(prev => prev.map(w => {
        // Only refresh live video widgets
        if (w.type !== 'video' || w.isLive !== true) {
          return w;
        }
        
        // Check if 10 minutes have passed since last refresh
        const timeSinceRefresh = now - (w.lastRefresh || 0);
        if (timeSinceRefresh >= TEN_MINUTES_MS) {
          console.log(`[Dashboard] Refreshing live widget: ${w.id}`);
          return { ...w, lastRefresh: now };
        }
        
        return w;
      }));
    }, TEN_MINUTES_MS);
    
    return () => {
      console.log('[Dashboard] Cleaning up live widget refresh interval');
      clearInterval(refreshInterval);
    };
  }, [liveWidgetCount, setWidgets]);

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

  // YouTube Live ID Watchdog - Auto-refresh YouTube embeds every 60 seconds to recover from errors
  useEffect(() => {
    const WATCHDOG_INTERVAL = 60000; // 60 seconds

    const checkAndRefreshYouTubeWidgets = () => {
      const now = Date.now();

      setWidgets(prev => prev.map(widget => {
        // Only check YouTube widgets with video IDs
        if (widget.type === 'video' && widget.isYouTube && widget.videoId) {
          const lastRefresh = widget.lastRefresh || 0;
          const timeSinceRefresh = now - lastRefresh;

          // If widget hasn't been refreshed in 60+ seconds, trigger a refresh
          // by updating the lastRefresh timestamp (which forces iframe re-render)
          if (timeSinceRefresh >= WATCHDOG_INTERVAL) {
            console.log(`[YouTube Watchdog] Refreshing widget ${widget.id} (${timeSinceRefresh}ms since last refresh)`);
            return {
              ...widget,
              lastRefresh: now
            };
          }
        }
        return widget;
      }));
    };

    const intervalId = setInterval(checkAndRefreshYouTubeWidgets, WATCHDOG_INTERVAL);

    return () => clearInterval(intervalId);
  }, [setWidgets]);

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
  const findNextAvailableSlot = (
    widget: Widget,
    allWidgets: Widget[],
    excludeId: string
  ): { x: number; y: number } | null => {
    // Try each position in the grid (row by row, left to right)
    for (let y = 0; y <= GRID_ROWS - widget.h; y++) {
      for (let x = 0; x <= GRID_COLS - widget.w; x++) {
        let collision = false;
        for (const other of allWidgets) {
          if (other.id === widget.id || other.id === excludeId) continue;
          if (checkCollision(x, y, widget.w, widget.h, other.x, other.y, other.w, other.h)) {
            collision = true;
            break;
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
  }, [resizing, setWidgets]);

  // Privacy-enhanced YouTube embed using no-cookie domain with proper Referer handling
  // referrerPolicy="strict-origin-when-cross-origin" is set on iframes for valid Referer header
  const getYouTubeEmbedUrl = (videoId: string): string => {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&modestbranding=1&rel=0&enablejsapi=1&origin=${window.location.origin}`;
  };

  // Generate embed URL for YouTube channel-based live streams (permanent, never expires)
  const getYouTubeChannelEmbedUrl = (channelId: string): string => {
    return `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1&modestbranding=1&rel=0&enablejsapi=1&origin=${window.location.origin}`;
  };

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

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const toggleWidgetMute = (widgetId: string) => {
    setWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        const newMuted = !w.isMuted;
        if (w.isYouTube) {
          sendYouTubeCommand(widgetId, newMuted ? 'mute' : 'unMute');
        }
        return { ...w, isMuted: newMuted };
      }
      return w;
    }));
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

  const handleRefreshWidget = (widgetId: string) => {
    setWidgets(prev => {
      const updated = prev.map(w => {
        if (w.id === widgetId && w.type === 'video') {
          return { ...w, url: '', lastRefresh: Date.now(), isOffline: false };
        }
        return w;
      });
      return updated;
    });

    setTimeout(() => {
      setWidgets(prev => {
        const widget = prev.find(w => w.id === widgetId);
        if (widget) {
          const videoId = widget.videoId;
          const youtubeChannelId = widget.youtubeChannelId;
          const twitchChannel = widget.twitchChannel;
          return prev.map(w => {
            if (w.id === widgetId) {
              if (w.isYouTube && youtubeChannelId) {
                return { ...w, url: `https://www.youtube.com/embed/live_stream?channel=${youtubeChannelId}` };
              } else if (w.isYouTube && videoId) {
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
          if (w.isYouTube && w.youtubeChannelId) {
            return { ...w, url: `https://www.youtube.com/embed/live_stream?channel=${w.youtubeChannelId}` };
          } else if (w.isYouTube && w.videoId) {
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
      if (w.type === 'video' && w.isYouTube) {
        sendYouTubeCommand(w.id, newMute ? 'mute' : 'unMute');
      }
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

  // Offline Placeholder Component
  const OfflinePlaceholder = ({ widget }: { widget: Widget }) => {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/50 p-[1.5rem]">
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
        >
          <RefreshCw className="w-[1.2rem] h-[1.2rem]" />
          Check Again
        </button>
      </div>
    );
  };

  const renderWidgetContent = (widget: Widget) => {
    const isSeekMode = seekModeWidgets.has(widget.id);

    switch (widget.type) {
      case 'video':
        // Show offline placeholder if stream is offline
        if (widget.isOffline) {
          return <OfflinePlaceholder widget={widget} />;
        }

        // YouTube IFrame API with MediaSession for background play, rel=0, iv_load_policy=3
        // Key is ONLY widget.id for stability - refreshKey prop handles manual refresh
        if (widget.isYouTube && (widget.videoId || widget.youtubeChannelId)) {
          return (
            <YouTubePlayer
              key={widget.id}
              widgetId={widget.id}
              videoId={widget.videoId}
              channelId={widget.youtubeChannelId}
              isMuted={widget.isMuted}
              isPaused={widget.isPaused}
              isSeekMode={isSeekMode}
              refreshKey={widget.lastRefresh || 0}
              onReady={() => {
                console.log(`[YouTube] Player ready: ${widget.id}`);
              }}
              onError={() => {
                console.log(`[YouTube] Error for widget: ${widget.id}`);
                setWidgets(prev => prev.map(w => 
                  w.id === widget.id ? { ...w, isOffline: true } : w
                ));
              }}
              onMutedChange={(muted) => {
                setWidgets(prev => prev.map(w =>
                  w.id === widget.id ? { ...w, isMuted: muted } : w
                ));
              }}
              onPausedChange={(paused) => {
                setWidgets(prev => prev.map(w =>
                  w.id === widget.id ? { ...w, isPaused: paused } : w
                ));
              }}
            />
          );
        } else if (widget.isTwitch && widget.twitchChannel) {
          // Stable key with refresh in src parameter for controlled refresh
          const twitchSrc = `${getTwitchEmbedUrl(widget.twitchChannel)}${widget.lastRefresh ? `&_r=${widget.lastRefresh}` : ''}`;
          return (
            <iframe
              key={widget.id}
              ref={(el) => { iframeRefs.current[widget.id] = el; }}
              src={twitchSrc}
              className="w-full h-full"
              style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
              title={`Twitch - ${widget.id}`}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              onError={() => {
                console.log(`[Error] Twitch embed failed for ${widget.twitchChannel}`);
                setWidgets(prev => prev.map(w => 
                  w.id === widget.id ? { ...w, isOffline: true } : w
                ));
              }}
            />
          );
        } else if (widget.isKick && widget.kickChannel) {
          // Stable key with refresh in src parameter for controlled refresh
          const kickSrc = `${getKickEmbedUrl(widget.kickChannel)}${widget.lastRefresh ? `&_r=${widget.lastRefresh}` : ''}`;
          return (
            <iframe
              key={widget.id}
              ref={(el) => { iframeRefs.current[widget.id] = el; }}
              src={kickSrc}
              className="w-full h-full"
              style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
              title={`Kick - ${widget.id}`}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              onError={() => {
                console.log(`[Error] Kick embed failed for ${widget.kickChannel}`);
                setWidgets(prev => prev.map(w => 
                  w.id === widget.id ? { ...w, isOffline: true } : w
                ));
              }}
            />
          );
        } else if (widget.url) {
          return (
            <iframe
              src={widget.url}
              className="w-full h-full"
              style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
              title={widget.id}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          );
        }
        // Show inline URL input when this widget is selected for inline editing
        if (inlineInputWidgetId === widget.id) {
          return (
            <div className="w-full h-full flex flex-col items-center justify-center p-[1.5rem] gap-[1rem]">
              <div className="text-cyan-400 text-[1.2rem] font-semibold">Paste Video URL</div>
              <input
                type="text"
                value={inlineInputValue}
                onChange={(e) => setInlineInputValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && inlineInputValue.trim()) {
                    onInlineUrlSubmit(widget.id, inlineInputValue.trim());
                    setInlineInputWidgetId(null);
                    setInlineInputValue('');
                  } else if (e.key === 'Escape') {
                    setInlineInputWidgetId(null);
                    setInlineInputValue('');
                  }
                }}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full max-w-[28rem] px-[1rem] py-[0.8rem] bg-slate-800 border border-cyan-500/50 rounded-lg focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all text-[1.2rem] text-white placeholder:text-slate-500"
                autoFocus
                data-testid={`input-inline-url-${widget.id}`}
              />
              <div className="flex gap-[0.8rem]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inlineInputValue.trim()) {
                      onInlineUrlSubmit(widget.id, inlineInputValue.trim());
                      setInlineInputWidgetId(null);
                      setInlineInputValue('');
                    }
                  }}
                  className="px-[1.2rem] py-[0.6rem] bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors text-[1.1rem]"
                  data-testid={`button-submit-url-${widget.id}`}
                >
                  Add
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInlineInputWidgetId(null);
                    setInlineInputValue('');
                  }}
                  className="px-[1.2rem] py-[0.6rem] bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors text-[1.1rem]"
                  data-testid={`button-cancel-url-${widget.id}`}
                >
                  Cancel
                </button>
              </div>
              <div className="text-slate-500 text-[1rem]">Supports YouTube, Twitch, Kick</div>
            </div>
          );
        }

        return (
          <div className="w-full h-full flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInlineInputWidgetId(widget.id);
                setInlineInputValue('');
              }}
              className="flex flex-col items-center gap-2 text-cyan-400/60 hover:text-cyan-400 transition-colors"
              data-testid={`button-add-video-${widget.id}`}
            >
              <Plus className="w-[3rem] h-[3rem]" />
              <span className="text-[1.1rem]">Add Video</span>
            </button>
          </div>
        );

      case 'note':
        return (
          <div className="w-full h-full p-[1rem] flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-yellow-400">
              <FileText className="w-[1.4rem] h-[1.4rem]" />
              <span className="text-[1.1rem] font-semibold">Note</span>
            </div>
            <textarea
              value={widget.noteContent || ''}
              onChange={(e) => updateNoteContent(widget.id, e.target.value)}
              placeholder="Type your note here..."
              className="flex-1 w-full bg-transparent border-none outline-none resize-none text-slate-200 text-[1.2rem] placeholder:text-slate-500"
              style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}
              data-testid={`textarea-note-${widget.id}`}
            />
          </div>
        );

      case 'spacer':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Square className="w-[2rem] h-[2rem]" />
              <span className="text-[1rem]">Spacer</span>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
            {widget.imageUrl ? (
              <img 
                src={widget.imageUrl} 
                alt="Widget image" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-purple-400/60">
                <ImageIcon className="w-[2.5rem] h-[2.5rem]" />
                <span className="text-[1rem]">Image Widget</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-mono flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:pl-[32rem]' : ''}`} style={{ padding: isFullscreen && !headerVisible ? '0' : '1.6rem' }}>
      <div className="fixed inset-0 opacity-30 pointer-events-none z-0">
        <div className="absolute top-[8rem] left-[8rem] w-[38rem] h-[38rem] bg-cyan-500 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[8rem] right-[8rem] w-[38rem] h-[38rem] bg-purple-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
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
            ? 'fixed top-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md px-[1.6rem] py-[0.8rem] shadow-lg border-b border-slate-800/50' 
            : 'relative'
        }`}
        style={{ 
          height: isFullscreen ? 'auto' : 'var(--header-height)',
          transform: isFullscreen && !headerVisible ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 10001
        }}
        onMouseLeave={() => isFullscreen && setHeaderVisible(false)}
        data-testid="header-container"
      >
        <div className="flex items-center justify-between mb-[0.8rem] flex-wrap gap-[0.8rem]">
          <div className="flex items-center gap-[1.2rem]">
            <button
              onClick={() => {
                if (isFullscreen) {
                  exitFullscreenAndRestoreHeader();
                } else {
                  document.documentElement.requestFullscreen?.().catch(() => {});
                  setIsFullscreen(true);
                }
              }}
              className={`p-[0.6rem] slot-button transition-all duration-300 border ${
                isFullscreen 
                  ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500/50' 
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-600/50 hover:border-cyan-500/50'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
              data-testid="button-toggle-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-[1.6rem] h-[1.6rem] text-white" /> : <Maximize2 className="w-[1.6rem] h-[1.6rem] text-slate-400" />}
            </button>
            <div className="relative">
              <Power className="w-[2rem] h-[2rem] text-cyan-400 animate-pulse" data-testid="icon-power" />
              <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50 pointer-events-none"></div>
            </div>
            <h1 className="text-[2rem] font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent" data-testid="text-title">
              MASTER CONTROL
            </h1>
            <span className="text-[1rem] text-slate-400 bg-slate-800/50 px-[0.8rem] py-[0.3rem] rounded-full">
              {widgets.length} widgets
            </span>
            <span className="text-[0.9rem] text-cyan-400/70 bg-cyan-900/30 px-[0.6rem] py-[0.2rem] rounded-full border border-cyan-500/30">
              {GRID_COLS}-col grid
            </span>
            
          </div>

          <div className="flex gap-[0.8rem] items-center">
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
                className="relative px-[1.2rem] py-[0.6rem] bg-slate-700 hover:bg-slate-600 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 shadow-lg shadow-slate-900/50 text-[1.2rem] overflow-hidden border border-slate-600"
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

            <button
              onClick={handleOpenSidebarToContent}
              disabled={isGridFull}
              className={`px-[1.2rem] py-[0.6rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform shadow-lg text-[1.2rem] ${
                isGridFull 
                  ? 'bg-slate-600 cursor-not-allowed opacity-60 shadow-slate-900/50' 
                  : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105 shadow-emerald-900/50'
              }`}
              title={isGridFull ? 'Grid Full - No space available' : 'Add a new block'}
              data-testid="button-add-block"
            >
              <Plus className="w-[1.4rem] h-[1.4rem]" />
              {isGridFull ? 'Grid Full' : 'Add Block'}
            </button>

            <button
              onClick={handleRefreshAllWidgets}
              className="px-[1.2rem] py-[0.6rem] bg-cyan-600 hover:bg-cyan-500 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-900/50 text-[1.2rem]"
              data-testid="button-refresh-all"
            >
              <RefreshCw className="w-[1.4rem] h-[1.4rem]" />
              Refresh All
            </button>

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-[1.2rem] py-[0.6rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] ${
                isEditMode 
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/50 ring-2 ring-purple-400' 
                  : 'bg-slate-700 hover:bg-slate-600 shadow-lg shadow-slate-900/50'
              }`}
              data-testid="button-edit-layout"
            >
              {isEditMode ? <Lock className="w-[1.4rem] h-[1.4rem]" /> : <Edit3 className="w-[1.4rem] h-[1.4rem]" />}
              {isEditMode ? 'LOCK' : 'EDIT LAYOUT'}
            </button>


            <button
              onClick={handleMasterMute}
              className={`px-[1.2rem] py-[0.6rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] ${
                masterMute 
                  ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/50' 
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/50'
              }`}
              data-testid="button-master-mute"
            >
              {masterMute ? <VolumeX className="w-[1.4rem] h-[1.4rem]" /> : <Volume2 className="w-[1.4rem] h-[1.4rem]" />}
              {masterMute ? 'MUTED' : 'LIVE'}
            </button>

            <button
              id="save-button"
              onClick={handleSaveLayout}
              className="px-[1.2rem] py-[0.6rem] bg-cyan-700 hover:bg-cyan-600 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-900/50 text-[1.2rem]"
              data-testid="button-save-layout"
            >
              <Save className="w-[1.4rem] h-[1.4rem]" />
              SAVE
            </button>
          </div>
        </div>

        <div className="h-[0.2rem] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full"></div>
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
            className="absolute inset-[1rem] grid gap-[1rem] pointer-events-none z-[5]"
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
        {widgets.map((widget) => (
          <SortableWidget key={widget.id} widget={widget} isEditMode={isEditMode}>
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

                  <button
                    onClick={() => toggleWidgetMute(widget.id)}
                    className={`w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 ${
                      widget.isMuted 
                        ? 'bg-red-600/90 hover:bg-red-500' 
                        : 'bg-emerald-600/90 hover:bg-emerald-500'
                    }`}
                    title={widget.isMuted ? 'Unmute' : 'Mute'}
                    data-testid={`button-mute-${widget.id}`}
                  >
                    {widget.isMuted ? <VolumeX className="w-[2rem] h-[2rem]" /> : <Volume2 className="w-[2rem] h-[2rem]" />}
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
                    className={`w-[4rem] h-[4rem] rounded-full transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 ${
                      isWidgetSaved(widget)
                        ? 'bg-amber-500/90 hover:bg-amber-400'
                        : 'bg-slate-600/90 hover:bg-amber-500'
                    }`}
                    title={isWidgetSaved(widget) ? 'Remove from Personal Library' : 'Save to Personal Library'}
                    data-testid={`button-save-${widget.id}`}
                  >
                    <Star className={`w-[2rem] h-[2rem] transition-colors ${isWidgetSaved(widget) ? 'fill-amber-300 text-amber-300' : 'text-white'}`} />
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleOpenSidebar(widget.id);
                  }}
                  className="w-[4rem] h-[4rem] rounded-full bg-cyan-600/90 hover:bg-cyan-500 transition-all duration-300 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30"
                  title="Edit widget content"
                  data-testid={`button-edit-${widget.id}`}
                >
                  <Settings className="w-[2rem] h-[2rem]" />
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

            <div 
              className="w-full h-full"
              style={{ 
                pointerEvents: widget.type === 'video' && !isEditMode && !seekModeWidgets.has(widget.id) ? 'none' : 'auto'
              }}
            >
              {renderWidgetContent(widget)}
            </div>

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


        {widgets.length === 0 && !isEditMode && (
          <div 
            className="flex flex-col items-center justify-center text-slate-400 col-span-12"
            data-testid="empty-state"
          >
            <Power className="w-[6rem] h-[6rem] mb-[1.5rem] text-cyan-400/30" />
            <h3 className="text-[1.6rem] font-bold mb-[0.8rem] text-slate-300">Dashboard Empty</h3>
            <p className="text-[1.2rem] mb-[1.5rem]">Click "Add Block" to add blocks to your dashboard</p>
            <button
              onClick={() => setIsEditMode(true)}
              className="px-[2rem] py-[1rem] bg-cyan-600 hover:bg-cyan-500 slot-button font-semibold flex items-center gap-[0.8rem] transition-all duration-300 text-[1.3rem]"
              data-testid="button-start-editing"
            >
              <Edit3 className="w-[1.6rem] h-[1.6rem]" />
              Start Building
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default MasterControlDashboard;