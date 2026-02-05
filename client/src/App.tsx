import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePremium } from '@/hooks/use-premium';
import { LoginModal } from '@/components/login-modal';
import { PricingModal } from '@/components/pricing-modal';
import { MobileGuard } from '@/components/mobile-guard';
import { useViralAds, AdBlockData } from '@/components/ad-block';
import { searchChannelLiveStream } from '@/lib/stream-api';

// STATIC HANDLE MAPPING: Permanent Live IDs for major 24/7 channels
// Keyed by channelHandle (as used in links.json), NOT YouTube channel IDs
// These channels have stable live stream IDs that rarely change
// Using static IDs saves API quota and ensures immediate playback
const STATIC_LIVE_IDS: Record<string, string> = {
  // News Networks - 24/7 Live (keyed by channelHandle from links.json)
  'skynews': '9Auq9mYxFEe',           // Sky News
  'SkyNews': '9Auq9mYxFEe',           // Sky News (alternate case)
  'ABCNews': 'w_Ma8oQLmSM',           // ABC News Live
  'NASA': 'tz4THVd5rdI',              // NASA TV
  'NASAtelevision': '21X5lGlDOfg',    // NASA TV (alternate channel)
  'NBCNews': 'sVEGHdVRIoU',           // NBC News NOW
  'MSNBC': 'nlKwThfNggk',             // MSNBC Live
  'LofiGirl': 'jfKfPfyJRdk',          // Lofi Girl (24/7 beats)
  'AlJazeeraEnglish': 'kxPCFljwJws',  // Al Jazeera English
  'France24English': 'l8PMl7tUDIE',   // France 24 English
  'France24english': 'l8PMl7tUDIE',   // France 24 (alternate case)
  'NDTV': 'NvqKZHpKs-g',              // NDTV 24x7
  'Reuters': '9hBfiYUpyVo',           // Reuters
};

// Static background - High-contrast light mode
const StaticBackground = () => {
  useEffect(() => {
    const body = document.body;
    body.style.backgroundColor = '#F8F9FA';
    body.style.backgroundImage = 'none';
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'fixed';
    body.style.minHeight = '100vh';
  }, []);

  return null;
};
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import MasterControlDashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import { WidgetSidebar, TrendingChannel, WidgetTemplate, WIDGET_TEMPLATES } from '@/components/widget-sidebar';
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  useSensor, 
  useSensors, 
  PointerSensor,
  UniqueIdentifier,
  rectIntersection
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';

export type WidgetType = 'video' | 'note' | 'spacer' | 'image';

export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  url?: string;
  isYouTube?: boolean;
  videoId?: string | null;
  youtubeChannelId?: string | null;
  channelName?: string;
  channelHandle?: string | null; // YouTube channel handle for searching live streams
  isTwitch?: boolean;
  twitchChannel?: string | null;
  isKick?: boolean;
  kickChannel?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  volume: number;
  previousVolume?: number;
  error?: string | null;
  embedBlocked?: boolean;
  noteContent?: string;
  imageUrl?: string;
  lastRefresh?: number;
  isOffline?: boolean;
  isLive?: boolean;
  isPlayingLatestVideo?: boolean; // True when playing latestVideoId fallback (not a live stream)
  customColor?: string;
  apiError?: boolean; // True if YouTube API returned 403/error - show "System Maintenance" instead of "Offline"
}

const GRID_COLS = 12;

function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Inner App component that uses hooks requiring QueryClientProvider
function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginTriggerReason, setLoginTriggerReason] = useState<string | undefined>();
  
  // Auth state - must be inside QueryClientProvider
  const { user, isAuthenticated, logout } = useAuth();
  
  // Premium status
  const { isPremium } = usePremium();
  
  // Pricing modal state
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  
  // Open login modal with optional reason
  const openLoginModal = useCallback((reason?: string) => {
    setLoginTriggerReason(reason);
    setLoginModalOpen(true);
  }, []);
  
  // Open pricing modal
  const openPricingModal = useCallback(() => {
    setPricingModalOpen(true);
  }, []);

  const activeWidgetIdRef = useRef<string | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const ghostPositionRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    activeWidgetIdRef.current = activeWidgetId;
  }, [activeWidgetId]);

  useEffect(() => {
    if (isFullscreen) {
      setSidebarOpen(false);
    }
  }, [isFullscreen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // New users start with an empty grid - they add widgets manually from the library
  const getDefaultWidgets = (): Widget[] => {
    return [];
  };

  const [widgets, setWidgets] = useState<Widget[]>(() => {
    const saved = localStorage.getItem('openBentoWidgets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Allow empty arrays - users can have an empty grid
        return parsed.map((w: Widget) => ({
          ...w,
          isMuted: w.isMuted ?? true,
          isPaused: w.isPaused ?? false,
          volume: w.volume ?? 0,
          previousVolume: w.previousVolume ?? 50,
          isOffline: w.isOffline ?? false,
          x: w.x ?? 0,
          y: w.y ?? 0,
          w: w.w ?? 3,
          h: w.h ?? 2
        }));
      } catch {
        return getDefaultWidgets();
      }
    }
    return getDefaultWidgets();
  });

  // VIRAL AD MECHANIC: Lifted to App.tsx for drag collision checking
  // Premium users are immune, ads triggered on user action only
  const { ad, skipAd, triggerAd, isAdActive } = useViralAds(isPremium, widgets, setWidgets);

  const extractYouTubeId = (url: string): string | null => {
    // Updated regex to handle youtube-nocookie.com URLs (Pro format) and watch?v= URLs
    const regExp = /^.*((youtu\.be\/)|(youtube(-nocookie)?\.com\/(v\/|u\/\w\/|embed\/|watch\?)))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[6] && match[6].length === 11) ? match[6] : null;
  };

  // Extract YouTube channel ID from channel URLs only (live_stream format removed)
  const extractYouTubeChannelId = (url: string): string | null => {
    const channelRegex2 = /youtube\.com\/@([a-zA-Z0-9_-]+)/;
    const channelRegex3 = /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/;
    const channelRegex4 = /youtube\.com\/c\/([a-zA-Z0-9_-]+)/;
    
    const match = url.match(channelRegex2) || url.match(channelRegex3) || url.match(channelRegex4);
    return match ? match[1] : null;
  };

  const extractTwitchChannel = (url: string): string | null => {
    // Match both twitch.tv/channel and player.twitch.tv/?channel=xxx
    const twitchRegex = /(?:twitch\.tv\/)([a-zA-Z0-9_]+)/;
    const playerRegex = /player\.twitch\.tv\/.*[?&]channel=([a-zA-Z0-9_]+)/;
    const match = url.match(twitchRegex) || url.match(playerRegex);
    return match ? match[1] : null;
  };

  const extractKickChannel = (url: string): string | null => {
    const kickRegex = /(?:kick\.com\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(kickRegex);
    return match ? match[1] : null;
  };


  // Smart auto-filling grid: Find first available position and shrink to fit if needed
  const findSmartPosition = useCallback((requestedW: number, requestedH: number, currentWidgets: Widget[]): { x: number; y: number; w: number; h: number } | null => {
    const GRID_ROWS = 6;
    
    // Helper to check if a position is free for given dimensions
    const isPositionFree = (x: number, y: number, w: number, h: number): boolean => {
      if (x + w > GRID_COLS || y + h > GRID_ROWS) return false;
      
      // Check against widgets
      for (const widget of currentWidgets) {
        const widgetRight = widget.x + widget.w;
        const widgetBottom = widget.y + widget.h;
        const newRight = x + w;
        const newBottom = y + h;
        
        if (x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y) {
          return false;
        }
      }
      
      // Check against ad block (treat as solid grid item)
      if (ad) {
        const adRight = ad.x + ad.w;
        const adBottom = ad.y + ad.h;
        const newRight = x + w;
        const newBottom = y + h;
        
        if (x < adRight && newRight > ad.x && y < adBottom && newBottom > ad.y) {
          return false;
        }
      }
      
      return true;
    };
    
    // Try original size first, scan grid left-to-right, top-to-bottom
    for (let y = 0; y <= GRID_ROWS - requestedH; y++) {
      for (let x = 0; x <= GRID_COLS - requestedW; x++) {
        if (isPositionFree(x, y, requestedW, requestedH)) {
          return { x, y, w: requestedW, h: requestedH };
        }
      }
    }
    
    // Shrink to fit: Try progressively smaller sizes down to 1x1
    for (let tryH = requestedH; tryH >= 1; tryH--) {
      for (let tryW = requestedW; tryW >= 1; tryW--) {
        if (tryW === requestedW && tryH === requestedH) continue; // Already tried
        
        for (let y = 0; y <= GRID_ROWS - tryH; y++) {
          for (let x = 0; x <= GRID_COLS - tryW; x++) {
            if (isPositionFree(x, y, tryW, tryH)) {
              console.log(`[SmartGrid] Shrunk widget from ${requestedW}x${requestedH} to ${tryW}x${tryH} to fit`);
              return { x, y, w: tryW, h: tryH };
            }
          }
        }
      }
    }
    
    // Grid is 100% full - return null to indicate no space
    return null;
  }, [ad]);

  // Check if any space is available for a 1x1 minimum widget
  const isGridFull = useMemo(() => {
    const GRID_ROWS = 6;
    
    // Check every cell to see if at least one 1x1 spot is free
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        let cellFree = true;
        
        // Check against widgets
        for (const widget of widgets) {
          const widgetRight = widget.x + widget.w;
          const widgetBottom = widget.y + widget.h;
          
          if (x < widgetRight && x + 1 > widget.x && y < widgetBottom && y + 1 > widget.y) {
            cellFree = false;
            break;
          }
        }
        
        // Check against ad block (treat as solid grid item)
        if (cellFree && ad) {
          const adRight = ad.x + ad.w;
          const adBottom = ad.y + ad.h;
          
          if (x < adRight && x + 1 > ad.x && y < adBottom && y + 1 > ad.y) {
            cellFree = false;
          }
        }
        
        if (cellFree) return false; // Found a free cell, grid is NOT full
      }
    }
    return true; // No free cells found
  }, [widgets, ad]);

  const addWidget = useCallback((type: WidgetType, w = 3, h = 2, extraData?: Partial<Widget>) => {
    const widgetId = generateWidgetId();
    setWidgets(prev => {
      const smartResult = findSmartPosition(Math.min(w, GRID_COLS), h, prev);
      
      // If grid is full, do NOT add widget (no shifting/shrinking existing blocks)
      if (!smartResult) {
        console.log('[SmartGrid] Grid is full - cannot add widget');
        return prev; // Return unchanged state
      }
      
      const newWidget: Widget = {
        id: widgetId,
        type,
        x: smartResult.x,
        y: smartResult.y,
        w: smartResult.w,
        h: smartResult.h,
        isMuted: true,
        isPaused: false,
        volume: 0,
        previousVolume: 50,
        isOffline: false,
        ...extraData
      };
      return [...prev, newWidget];
    });
    return widgetId;
  }, [findSmartPosition]);

  const addVideoWidget = useCallback((channel: TrendingChannel, w = 3, h = 2) => {
    // Prefer channel.videoId directly from API, fallback to URL extraction
    const videoId = channel.videoId || extractYouTubeId(channel.url);
    const youtubeChannelId = channel.channelId || extractYouTubeChannelId(channel.url);
    const twitchChannel = extractTwitchChannel(channel.url);
    const kickChannel = extractKickChannel(channel.url);
    
    // Determine if this is a live stream - Twitch/Kick are always live, YouTube uses isLive flag
    const isLiveStream = channel.platform === 'twitch' || channel.platform === 'kick' || channel.isLive === true;

    addWidget('video', w, h, {
      url: channel.url,
      isYouTube: channel.platform === 'youtube',
      videoId,
      youtubeChannelId,
      isTwitch: channel.platform === 'twitch',
      twitchChannel,
      isKick: channel.platform === 'kick',
      kickChannel,
      isLive: isLiveStream,
      lastRefresh: Date.now()
    });
  }, [addWidget]);

  const handleSubmitUrl = useCallback((url: string) => {
    if (!url.trim()) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const youtubeId = extractYouTubeId(finalUrl);
    const youtubeChannelId = extractYouTubeChannelId(finalUrl);
    const twitchChannel = extractTwitchChannel(finalUrl);
    const kickChannel = extractKickChannel(finalUrl);
    const currentActiveWidgetId = activeWidgetIdRef.current;

    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w => 
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'video',
          url: finalUrl,
          isYouTube: !!youtubeId || !!youtubeChannelId,
          videoId: youtubeId,
          youtubeChannelId,
          isTwitch: !!twitchChannel,
          twitchChannel,
          isKick: !!kickChannel,
          kickChannel,
          isLive: false, // Manual URL submissions are treated as normal videos (no auto-refresh)
          error: null,
          embedBlocked: false,
          isPaused: false,
          isMuted: true,
          volume: 0,
          isOffline: false,
          lastRefresh: Date.now()
        } : w
      ));
    } else {
      addWidget('video', 3, 2, {
        url: finalUrl,
        isYouTube: !!youtubeId || !!youtubeChannelId,
        videoId: youtubeId,
        youtubeChannelId,
        isTwitch: !!twitchChannel,
        twitchChannel,
        isKick: !!kickChannel,
        kickChannel,
        isLive: false, // Manual URL submissions are treated as normal videos (no auto-refresh)
        lastRefresh: Date.now()
      });
    }

    setUrlInputValue('');
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
  }, [addWidget]);

  // Handle inline URL submission from widget directly (no sidebar)
  const handleInlineUrlSubmit = useCallback((widgetId: string, url: string) => {
    if (!url.trim()) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const youtubeId = extractYouTubeId(finalUrl);
    const youtubeChannelId = extractYouTubeChannelId(finalUrl);
    const twitchChannel = extractTwitchChannel(finalUrl);
    const kickChannel = extractKickChannel(finalUrl);

    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? {
        ...w,
        type: 'video',
        url: finalUrl,
        isYouTube: !!youtubeId || !!youtubeChannelId,
        videoId: youtubeId,
        youtubeChannelId,
        isTwitch: !!twitchChannel,
        twitchChannel,
        isKick: !!kickChannel,
        kickChannel,
        isLive: false, // Inline URL submissions are treated as normal videos (no auto-refresh)
        error: null,
        embedBlocked: false,
        isPaused: false,
        isMuted: true,
        volume: 0,
        isOffline: false,
        lastRefresh: Date.now()
      } : w
    ));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);

    // Get the widget being dragged to determine ghost size
    const activeData = event.active.data.current;
    let ghostPos: { x: number; y: number; w: number; h: number };

    if (activeData?.type === 'channel' || activeData?.type === 'widget-template') {
      // Sidebar items use default 3x2 or template size
      const template = activeData.template as WidgetTemplate | undefined;
      ghostPos = { x: 0, y: 0, w: template?.w || 3, h: template?.h || 2 };
    } else if (activeData?.type === 'sortable-widget') {
      // Sortable widget being dragged - get widget from data
      const widget = activeData.widget as Widget;
      ghostPos = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    } else {
      // Fallback: try to find widget by ID
      const widget = widgets.find(w => w.id === event.active.id);
      if (widget) {
        ghostPos = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
      } else {
        // Default ghost size
        ghostPos = { x: 0, y: 0, w: 3, h: 2 };
      }
    }

    // Update both state and ref
    ghostPositionRef.current = ghostPos;
    setGhostPosition(ghostPos);
  }, [widgets]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!gridContainerRef.current) return;
    if (!ghostPositionRef.current) return;

    const gridRect = gridContainerRef.current.getBoundingClientRect();

    // Use translated rect, fallback to initial rect + delta
    let dragX = 0;
    let dragY = 0;

    const translated = event.active.rect.current.translated;
    const initial = event.active.rect.current.initial;

    if (translated) {
      dragX = translated.left;
      dragY = translated.top;
    } else if (initial && event.delta) {
      dragX = initial.left + event.delta.x;
      dragY = initial.top + event.delta.y;
    } else {
      return;
    }

    // Calculate cell dimensions
    const cellWidth = gridRect.width / GRID_COLS;
    const cellHeight = gridRect.height / 6; // GRID_ROWS = 6

    // Calculate grid position based on the drag overlay's top-left corner
    const relativeX = dragX - gridRect.left;
    const relativeY = dragY - gridRect.top;

    const gridX = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(relativeX / cellWidth)));
    const gridY = Math.max(0, Math.min(5, Math.floor(relativeY / cellHeight))); // 0-5 for 6 rows

    // Get the dragging widget's dimensions
    const activeData = event.active.data.current;
    const draggedWidgetId = event.active.id as string;
    
    if (activeData?.type === 'sortable-widget') {
      const draggedWidget = widgets.find(w => w.id === draggedWidgetId);
      if (draggedWidget) {
        const previewW = draggedWidget.w;
        const previewH = draggedWidget.h;
        
        // Clamp preview position to grid bounds
        const clampedX = Math.max(0, Math.min(GRID_COLS - previewW, gridX));
        const clampedY = Math.max(0, Math.min(5 - previewH + 1, gridY));

        // REAL-TIME COLLISION DETECTION: Treat preview as solid block
        // Find widgets that would collide with the preview position
        const collidingWidgets = widgets.filter(widget => {
          if (widget.id === draggedWidgetId) return false;
          const widgetRight = widget.x + widget.w;
          const widgetBottom = widget.y + widget.h;
          const previewRight = clampedX + previewW;
          const previewBottom = clampedY + previewH;
          return clampedX < widgetRight && previewRight > widget.x && clampedY < widgetBottom && previewBottom > widget.y;
        });

        // Push colliding widgets in real-time
        if (collidingWidgets.length > 0) {
          setWidgets(currentWidgets => {
            let updatedWidgets = [...currentWidgets];
            const GRID_ROWS = 6;
            
            for (const collidingWidget of collidingWidgets) {
              // Find next available slot for the pushed widget
              const findSlot = (w: Widget, allWidgets: Widget[], excludeIds: string[]): { x: number; y: number } | null => {
                for (let y = 0; y <= GRID_ROWS - w.h; y++) {
                  for (let x = 0; x <= GRID_COLS - w.w; x++) {
                    let collision = false;
                    for (const other of allWidgets) {
                      if (excludeIds.includes(other.id)) continue;
                      // Also check against the preview position
                      if (x < other.x + other.w && x + w.w > other.x && y < other.y + other.h && y + w.h > other.y) {
                        collision = true;
                        break;
                      }
                    }
                    // Also check against the preview position
                    if (!collision && x < clampedX + previewW && x + w.w > clampedX && y < clampedY + previewH && y + w.h > clampedY) {
                      collision = true;
                    }
                    if (!collision) {
                      return { x, y };
                    }
                  }
                }
                return null;
              };

              const newSlot = findSlot(collidingWidget, updatedWidgets, [collidingWidget.id, draggedWidgetId]);
              if (newSlot) {
                updatedWidgets = updatedWidgets.map(w =>
                  w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w
                );
              }
            }
            return updatedWidgets;
          });
        }

        // Update ghost position
        ghostPositionRef.current = { x: clampedX, y: clampedY, w: previewW, h: previewH };
        setGhostPosition(ghostPositionRef.current);
        return;
      }
    }

    // Update both ref and state (fallback for non-widget drags)
    ghostPositionRef.current = { ...ghostPositionRef.current, x: gridX, y: gridY };
    setGhostPosition(ghostPositionRef.current);
  }, [widgets, setWidgets]);

  // Helper function to check if a position is occupied by another widget
  const isPositionOccupied = useCallback((x: number, y: number, w: number, h: number, excludeWidgetId: string, currentWidgets: Widget[]): boolean => {
    for (const widget of currentWidgets) {
      if (widget.id === excludeWidgetId) continue;

      // Check for overlap
      const widgetRight = widget.x + widget.w;
      const widgetBottom = widget.y + widget.h;
      const newRight = x + w;
      const newBottom = y + h;

      if (x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y) {
        return true;
      }
    }
    return false;
  }, []);

  // Find nearest available position using spiral search
  const findNearestAvailable = useCallback((targetX: number, targetY: number, w: number, h: number, excludeWidgetId: string, currentWidgets: Widget[]): { x: number; y: number } => {
    const GRID_ROWS = 6;

    // Try the target position first
    if (!isPositionOccupied(targetX, targetY, w, h, excludeWidgetId, currentWidgets)) {
      return { x: targetX, y: targetY };
    }

    // Spiral search for nearest available spot
    for (let distance = 1; distance < Math.max(GRID_COLS, GRID_ROWS); distance++) {
      for (let dx = -distance; dx <= distance; dx++) {
        for (let dy = -distance; dy <= distance; dy++) {
          if (Math.abs(dx) !== distance && Math.abs(dy) !== distance) continue;

          const newX = targetX + dx;
          const newY = targetY + dy;

          // Clamp to grid bounds
          const clampedX = Math.max(0, Math.min(GRID_COLS - w, newX));
          const clampedY = Math.max(0, Math.min(GRID_ROWS - h, newY));

          if (!isPositionOccupied(clampedX, clampedY, w, h, excludeWidgetId, currentWidgets)) {
            return { x: clampedX, y: clampedY };
          }
        }
      }
    }

    // Fallback to original position (shouldn't happen)
    return { x: targetX, y: targetY };
  }, [isPositionOccupied]);

  // Find colliding widgets at a specific position
  const findCollidingWidgets = useCallback((x: number, y: number, w: number, h: number, excludeWidgetId: string, currentWidgets: Widget[]): Widget[] => {
    return currentWidgets.filter(widget => {
      if (widget.id === excludeWidgetId) return false;
      const widgetRight = widget.x + widget.w;
      const widgetBottom = widget.y + widget.h;
      const newRight = x + w;
      const newBottom = y + h;
      return x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y;
    });
  }, []);

  // Find next available slot for a pushed widget (row by row scan)
  // Also checks ad collision to ensure widgets don't get pushed into ad space
  const findNextAvailableSlot = useCallback((widget: Widget, allWidgets: Widget[], excludeIds: string[]): { x: number; y: number } | null => {
    const GRID_ROWS = 6;
    for (let y = 0; y <= GRID_ROWS - widget.h; y++) {
      for (let x = 0; x <= GRID_COLS - widget.w; x++) {
        let collision = false;
        
        // Check collision with other widgets
        for (const other of allWidgets) {
          if (excludeIds.includes(other.id)) continue;
          const widgetRight = other.x + other.w;
          const widgetBottom = other.y + other.h;
          const newRight = x + widget.w;
          const newBottom = y + widget.h;
          if (x < widgetRight && newRight > other.x && y < widgetBottom && newBottom > other.y) {
            collision = true;
            break;
          }
        }
        
        // AD-BLOCK SOLIDIFICATION: Check collision with ad
        if (!collision && ad) {
          const adRight = ad.x + ad.w;
          const adBottom = ad.y + ad.h;
          const newRight = x + widget.w;
          const newBottom = y + widget.h;
          if (x < adRight && newRight > ad.x && y < adBottom && newBottom > ad.y) {
            collision = true;
          }
        }
        
        if (!collision) {
          return { x, y };
        }
      }
    }
    return null; // No available slot
  }, [ad]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active } = event;
    const finalGhostPosition = ghostPositionRef.current; // Use ref for immediate access

    setActiveId(null);
    setGhostPosition(null);
    ghostPositionRef.current = null;

    const activeData = active.data.current;

    // Handle sidebar items being dropped
    if (activeData?.type === 'channel') {
      const channel = activeData.channel as TrendingChannel;
      addVideoWidget(channel, 3, 2);
      setSidebarOpen(false);
      return;
    } else if (activeData?.type === 'widget-template') {
      const template = activeData.template as WidgetTemplate;
      addWidget(template.widgetType, template.w || 3, template.h || 2);
      setSidebarOpen(false);
      return;
    }

    // Handle sortable widget drop - update x/y based on ghost position with push logic
    if (activeData?.type === 'sortable-widget' && finalGhostPosition) {
      const widgetId = active.id as string;

      setWidgets((currentWidgets) => {
        const widgetIndex = currentWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex === -1) return currentWidgets;

        const widget = currentWidgets[widgetIndex];
        const targetX = finalGhostPosition.x;
        const targetY = finalGhostPosition.y;

        // AD-BLOCK SOLIDIFICATION: Check if drop would collide with ad
        // Widgets cannot be dropped on top of the ad
        if (ad) {
          const adRight = ad.x + ad.w;
          const adBottom = ad.y + ad.h;
          const widgetRight = targetX + widget.w;
          const widgetBottom = targetY + widget.h;
          const collidesWithAd = targetX < adRight && widgetRight > ad.x && targetY < adBottom && widgetBottom > ad.y;
          if (collidesWithAd) {
            // Block the drop - cannot drop onto ad space
            return currentWidgets;
          }
        }

        // Check for collisions at the target position
        const collidingWidgets = findCollidingWidgets(targetX, targetY, widget.w, widget.h, widgetId, currentWidgets);

        if (collidingWidgets.length === 0) {
          // No collision - move directly to target
          const updatedWidgets = [...currentWidgets];
          updatedWidgets[widgetIndex] = { ...widget, x: targetX, y: targetY };
          return updatedWidgets;
        }

        // Push logic: Move the dragged widget to target, push colliding widgets to next slots
        let updatedWidgets = [...currentWidgets];
        
        // First, move the dragged widget to the target position
        updatedWidgets[widgetIndex] = { ...widget, x: targetX, y: targetY };

        // Then, push each colliding widget to the next available slot
        for (const collidingWidget of collidingWidgets) {
          const newSlot = findNextAvailableSlot(collidingWidget, updatedWidgets, [collidingWidget.id]);
          
          if (newSlot === null) {
            // No room to push - block the move entirely (keep original positions)
            return currentWidgets;
          }

          // Move the colliding widget to the new slot
          updatedWidgets = updatedWidgets.map(w =>
            w.id === collidingWidget.id ? { ...w, x: newSlot.x, y: newSlot.y } : w
          );
        }

        return updatedWidgets;
      });
    }
  }, [addVideoWidget, addWidget, setWidgets, findCollidingWidgets, findNextAvailableSlot, ad]);

  const handleChannelClick = useCallback(async (channel: TrendingChannel) => {
    // Capture active widget BEFORE clearing
    const currentActiveWidgetId = activeWidgetIdRef.current;
    
    // Close sidebar immediately for responsive feel
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
    setUrlInputValue('');
    
    // For YouTube channels: FORCE EMBED - render immediately if videoId exists
    if (channel.platform === 'youtube' && channel.channelId) {
      // STATIC HANDLE MAPPING: Check if this is a major 24/7 channel with permanent ID
      const staticVideoId = STATIC_LIVE_IDS[channel.channelId];
      
      // FORCE EMBED: Use videoId immediately if available (static, or from channel data)
      const immediateVideoId = staticVideoId || channel.videoId || null;
      
      if (immediateVideoId) {
        const source = staticVideoId ? 'STATIC' : 'SAVED';
        console.log(`[ChannelClick] FORCE EMBED (${source}): @${channel.channelId} -> ${immediateVideoId} (rendering immediately)`);
        
        // Render embed immediately - no API call needed
        const widgetData: Partial<Widget> = {
          url: `https://www.youtube.com/watch?v=${immediateVideoId}`,
          isYouTube: true,
          videoId: immediateVideoId,
          youtubeChannelId: channel.channelId,
          channelHandle: channel.channelId,
          channelName: channel.name,
          isTwitch: false,
          twitchChannel: null,
          isKick: false,
          kickChannel: null,
          isLive: true, // Force LIVE when we have a videoId
          isOffline: false,
          apiError: false,
          error: null,
          embedBlocked: false,
          lastRefresh: Date.now(),
        };
        
        if (currentActiveWidgetId) {
          setWidgets(prev => prev.map(w => 
            w.id === currentActiveWidgetId ? {
              ...w, type: 'video', ...widgetData, isPaused: false, isMuted: true, volume: 0,
            } : w
          ));
        } else {
          addWidget('video', 3, 2, widgetData);
        }
        
        // BACKGROUND-ONLY STATUS: Run API check in background to update badge color only
        // This never blocks render or shows offline overlay
        if (!staticVideoId) {
          searchChannelLiveStream(channel.channelId, false).then(result => {
            if (result.liveVideoId && result.liveVideoId !== immediateVideoId) {
              console.log(`[Background] New live ID found: ${result.liveVideoId} (updating badge only)`);
              // Only update badge state, not blocking render
              setWidgets(prev => prev.map(w => 
                w.channelHandle === channel.channelId ? { ...w, isLive: true } : w
              ));
            }
          }).catch(err => console.warn('[Background] Status check failed (non-blocking):', err));
        }
        return;
      }
      
      // FALLBACK: No saved videoId - must call API to find one
      console.log(`[ChannelClick] No saved videoId, searching for @${channel.channelId}`);
      
      try {
        // Use cached API call (will use localStorage cache if fresh, otherwise fetch)
        const result = await searchChannelLiveStream(channel.channelId, false);
        
        // LATEST-VIDEO FALLBACK: Use liveVideoId if live, otherwise fall back to latestVideoId
        // This ensures user sees actual content instead of "Video Unavailable"
        const videoId = result.liveVideoId || result.latestVideoId || null;
        const isLive = !!result.liveVideoId; // Only LIVE if liveVideoId exists
        const isPlayingLatestVideo = !result.liveVideoId && !!result.latestVideoId; // Playing fallback latest video
        
        // If we have ANY videoId (live or latest), we have content to show
        const hasVideoId = !!videoId;
        const isOffline = !hasVideoId; // Only offline if no videoId at all
        
        console.log(`[ChannelClick] @${channel.channelId}: liveVideoId=${result.liveVideoId}, latestVideoId=${result.latestVideoId}, using=${videoId}, isLive=${isLive}, isPlayingLatestVideo=${isPlayingLatestVideo}`);
        
        // Build the widget data with channelHandle for future "Check Again"
        const widgetData: Partial<Widget> = {
          url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
          isYouTube: true,
          videoId: videoId,
          youtubeChannelId: result.channelId || channel.channelId,
          channelHandle: channel.channelId, // Store for "Check Again" searches
          channelName: channel.name,
          isTwitch: false,
          twitchChannel: null,
          isKick: false,
          kickChannel: null,
          isLive: isLive, // Only true if liveVideoId exists
          isPlayingLatestVideo: isPlayingLatestVideo, // True when using latestVideoId fallback
          isOffline: isOffline, // Only offline if no videoId at all
          apiError: false, // No secondary checks - videoId is the source of truth
          error: null,
          embedBlocked: false,
          lastRefresh: Date.now(),
        };
        
        if (currentActiveWidgetId) {
          // Update existing widget
          setWidgets(prev => prev.map(w => 
            w.id === currentActiveWidgetId ? {
              ...w,
              type: 'video',
              ...widgetData,
              isPaused: false,
              isMuted: true,
              volume: 0,
            } : w
          ));
        } else {
          // Add new widget
          addWidget('video', 3, 2, widgetData);
        }
        return;
      } catch (error) {
        console.error('[ChannelClick] Error searching for live stream:', error);
        // Fall through to use static URL
      }
    }
    
    // For non-YouTube (Twitch/Kick) or if YouTube search failed, use handleSubmitUrl
    if (currentActiveWidgetId) {
      activeWidgetIdRef.current = currentActiveWidgetId;
    }
    handleSubmitUrl(channel.url);
  }, [handleSubmitUrl, addWidget, setWidgets]);

  // Dashboard-only mode flag - set to false to allow sidebar with filtered content
  const dashboardOnlyMode = false;
  
  const handleOpenSidebar = useCallback((widgetId?: string) => {
    // Blocked in dashboard-only mode
    if (dashboardOnlyMode) return;
    
    const id = widgetId || null;
    activeWidgetIdRef.current = id;
    setActiveWidgetId(id);
    setSidebarOpen(true);
  }, []);

  const handleOpenSidebarToContent = useCallback(() => {
    // Blocked in dashboard-only mode
    if (dashboardOnlyMode) return;
    
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
    setSidebarOpen(true);
  }, []);

  const handleTemplateClick = useCallback((template: WidgetTemplate) => {
    addWidget(template.widgetType, template.w || 3, template.h || 2);
    setSidebarOpen(false);
  }, [addWidget]);

  const handleImageUpload = useCallback((imageUrl: string) => {
    const currentActiveWidgetId = activeWidgetIdRef.current;

    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w => 
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'image',
          imageUrl,
          url: undefined,
          isYouTube: false,
          videoId: null,
          isTwitch: false,
          twitchChannel: null
        } : w
      ));
    } else {
      addWidget('image', 3, 2, { imageUrl });
    }
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
  }, [addWidget]);

  return (
    <TooltipProvider>
      {/* Static Background - High-contrast light mode */}
      <StaticBackground />
      
      {/* Login Modal */}
      <LoginModal 
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        triggerReason={loginTriggerReason}
      />
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
          {/* WidgetSidebar - Hidden in dashboard-only mode */}
          {!dashboardOnlyMode && (
            <WidgetSidebar 
              isOpen={sidebarOpen} 
              onClose={() => {
                setSidebarOpen(false);
                activeWidgetIdRef.current = null;
                setActiveWidgetId(null);
                setUrlInputValue('');
              }}
              onChannelClick={handleChannelClick}
              onTemplateClick={handleTemplateClick}
              urlValue={urlInputValue}
              onUrlChange={setUrlInputValue}
              onUrlSubmit={handleSubmitUrl}
              activeWidgetId={activeWidgetId}
              onImageUpload={handleImageUpload}
              isAuthenticated={isAuthenticated}
              openLoginModal={openLoginModal}
            />
          )}
          <Switch>
            <Route path="/">
              {() => (
                <MasterControlDashboard 
                  widgets={widgets}
                  setWidgets={setWidgets}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                  sidebarOpen={sidebarOpen && !isFullscreen}
                  activeId={activeId}
                  handleOpenSidebar={handleOpenSidebar}
                  onInlineUrlSubmit={handleInlineUrlSubmit}
                  handleOpenSidebarToContent={handleOpenSidebarToContent}
                  addWidget={addWidget}
                  isFullscreen={isFullscreen}
                  setIsFullscreen={setIsFullscreen}
                  ghostPosition={ghostPosition}
                  gridContainerRef={gridContainerRef}
                  isGridFull={isGridFull}
                  user={user}
                  onLogout={logout}
                  isAuthenticated={isAuthenticated}
                  openLoginModal={openLoginModal}
                  isPremium={isPremium}
                  ad={ad}
                  skipAd={skipAd}
                  triggerAd={triggerAd}
                  isAdActive={isAdActive}
                  onOpenPricingModal={openPricingModal}
                />
              )}
            </Route>
            <Route path="/admin" component={Admin} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route component={NotFound} />
          </Switch>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div 
              className="dashboard-slot bg-slate-900/80 backdrop-blur-sm border border-cyan-400 shadow-2xl shadow-cyan-500/40 pointer-events-none"
              style={{
                width: '12rem',
                height: '8rem',
                opacity: 0.9
              }}
            >
              <div className="flex items-center justify-center h-full">
                <span className="text-cyan-400 font-bold text-[1.2rem]">
                  {String(activeId).includes('channel-') 
                    ? 'Channel'
                    : String(activeId).includes('template-')
                      ? 'Widget'
                      : 'Widget'
                  }
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <Toaster />
      <PricingModal 
        isOpen={pricingModalOpen} 
        onClose={() => setPricingModalOpen(false)} 
      />
    </TooltipProvider>
  );
}

// Main App component - Provides QueryClientProvider wrapper
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MobileGuard>
        <AppContent />
      </MobileGuard>
    </QueryClientProvider>
  );
}

export default App;