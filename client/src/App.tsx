import { useState, useCallback, useRef, useEffect } from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import MasterControlDashboard from "@/pages/dashboard";
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
  isTwitch?: boolean;
  twitchChannel?: string | null;
  isKick?: boolean;
  kickChannel?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  error?: string | null;
  embedBlocked?: boolean;
  noteContent?: string;
  imageUrl?: string;
  lastRefresh?: number;
  isOffline?: boolean; // Track offline state
}

const GRID_COLS = 12;

function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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

  const [widgets, setWidgets] = useState<Widget[]>(() => {
    const saved = localStorage.getItem('openBentoWidgets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((w: Widget) => ({
          ...w,
          isMuted: w.isMuted ?? true,
          isPaused: w.isPaused ?? false,
          isOffline: w.isOffline ?? false,
          x: w.x ?? 0,
          y: w.y ?? 0,
          w: w.w ?? 3,
          h: w.h ?? 2
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const extractYouTubeId = (url: string): string | null => {
    // Don't extract ID from channel-based live stream URLs (they use channel= parameter)
    if (url.includes('live_stream?channel=') || url.includes('live_stream&channel=')) {
      return null;
    }
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  // Extract YouTube channel ID from permanent live stream URLs
  const extractYouTubeChannelId = (url: string): string | null => {
    const channelRegex = /youtube\.com\/embed\/live_stream\?channel=([a-zA-Z0-9_-]+)/;
    const channelRegex2 = /youtube\.com\/@([a-zA-Z0-9_-]+)/;
    const channelRegex3 = /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/;
    const channelRegex4 = /youtube\.com\/c\/([a-zA-Z0-9_-]+)/;

    const match = url.match(channelRegex) || url.match(channelRegex2) || url.match(channelRegex3) || url.match(channelRegex4);
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


  // Find first available position for a new widget
  const findAvailablePosition = useCallback((w: number, h: number, currentWidgets: Widget[]): { x: number; y: number } => {
    const GRID_ROWS = 6;

    // Try each position in the grid
    for (let y = 0; y <= GRID_ROWS - h; y++) {
      for (let x = 0; x <= GRID_COLS - w; x++) {
        let occupied = false;

        for (const widget of currentWidgets) {
          // Check if this position overlaps with existing widget
          const widgetRight = widget.x + widget.w;
          const widgetBottom = widget.y + widget.h;
          const newRight = x + w;
          const newBottom = y + h;

          if (x < widgetRight && newRight > widget.x && y < widgetBottom && newBottom > widget.y) {
            occupied = true;
            break;
          }
        }

        if (!occupied) {
          return { x, y };
        }
      }
    }

    // Fallback to 0,0 if no space found
    return { x: 0, y: 0 };
  }, []);

  const addWidget = useCallback((type: WidgetType, w = 3, h = 2, extraData?: Partial<Widget>) => {
    const widgetId = generateWidgetId();
    setWidgets(prev => {
      const position = findAvailablePosition(Math.min(w, GRID_COLS), h, prev);
      const newWidget: Widget = {
        id: widgetId,
        type,
        x: position.x,
        y: position.y,
        w: Math.min(w, GRID_COLS),
        h,
        isMuted: true,
        isPaused: false,
        isOffline: false,
        ...extraData
      };
      return [...prev, newWidget];
    });
    return widgetId;
  }, [findAvailablePosition]);

  const addVideoWidget = useCallback((channel: TrendingChannel, w = 3, h = 2) => {
    const videoId = extractYouTubeId(channel.url);
    const youtubeChannelId = extractYouTubeChannelId(channel.url);
    const twitchChannel = extractTwitchChannel(channel.url);
    const kickChannel = extractKickChannel(channel.url);

    addWidget('video', w, h, {
      url: channel.url,
      isYouTube: !!videoId || !!youtubeChannelId,
      videoId,
      youtubeChannelId,
      isTwitch: !!twitchChannel,
      twitchChannel,
      isKick: !!kickChannel,
      kickChannel,
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
          error: null,
          embedBlocked: false,
          isPaused: false,
          isMuted: true,
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
        error: null,
        embedBlocked: false,
        isPaused: false,
        isMuted: true,
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
  const findNextAvailableSlot = useCallback((widget: Widget, allWidgets: Widget[], excludeIds: string[]): { x: number; y: number } | null => {
    const GRID_ROWS = 6;
    for (let y = 0; y <= GRID_ROWS - widget.h; y++) {
      for (let x = 0; x <= GRID_COLS - widget.w; x++) {
        let collision = false;
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
        if (!collision) {
          return { x, y };
        }
      }
    }
    return null; // No available slot
  }, []);

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
  }, [addVideoWidget, addWidget, setWidgets, findCollidingWidgets, findNextAvailableSlot]);

  const handleChannelClick = useCallback((channel: TrendingChannel) => {
    const videoId = extractYouTubeId(channel.url);
    const youtubeChannelId = extractYouTubeChannelId(channel.url);
    const twitchChannel = extractTwitchChannel(channel.url);
    const currentActiveWidgetId = activeWidgetIdRef.current;

    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w => 
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'video',
          url: channel.url,
          isYouTube: !!videoId || !!youtubeChannelId,
          videoId,
          youtubeChannelId,
          isTwitch: !!twitchChannel,
          twitchChannel,
          error: null,
          embedBlocked: false,
          isPaused: false,
          isMuted: true,
          isOffline: false
        } : w
      ));
    } else {
      addVideoWidget(channel, 3, 2);
    }
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
  }, [addVideoWidget]);

  const handleOpenSidebar = useCallback((widgetId?: string) => {
    const id = widgetId || null;
    activeWidgetIdRef.current = id;
    setActiveWidgetId(id);
    setSidebarOpen(true);
  }, []);

  const handleOpenSidebarToContent = useCallback(() => {
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DndContext 
          sensors={sensors} 
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
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
            />
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
                  />
                )}
              </Route>
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;