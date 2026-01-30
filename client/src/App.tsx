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
  isTwitch?: boolean;
  twitchChannel?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  error?: string | null;
  embedBlocked?: boolean;
  noteContent?: string;
  imageUrl?: string;
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
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const extractTwitchChannel = (url: string): string | null => {
    const twitchRegex = /(?:twitch\.tv\/)([a-zA-Z0-9_]+)/;
    const match = url.match(twitchRegex);
    return match ? match[1] : null;
  };

  const addWidget = useCallback((type: WidgetType, w = 3, h = 2, extraData?: Partial<Widget>) => {
    const newWidget: Widget = {
      id: generateWidgetId(),
      type,
      x: 0,
      y: 0,
      w: Math.min(w, GRID_COLS),
      h,
      isMuted: true,
      isPaused: false,
      ...extraData
    };
    setWidgets(prev => [...prev, newWidget]);
    return newWidget.id;
  }, []);

  const addVideoWidget = useCallback((channel: TrendingChannel, w = 3, h = 2) => {
    const videoId = extractYouTubeId(channel.url);
    const twitchChannel = extractTwitchChannel(channel.url);

    addWidget('video', w, h, {
      url: channel.url,
      isYouTube: !!videoId,
      videoId,
      isTwitch: !!twitchChannel,
      twitchChannel
    });
  }, [addWidget]);

  const handleSubmitUrl = useCallback((url: string) => {
    if (!url.trim()) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const youtubeId = extractYouTubeId(finalUrl);
    const twitchChannel = extractTwitchChannel(finalUrl);
    const currentActiveWidgetId = activeWidgetIdRef.current;

    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w => 
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'video',
          url: finalUrl,
          isYouTube: !!youtubeId,
          videoId: youtubeId,
          isTwitch: !!twitchChannel,
          twitchChannel,
          error: null,
          embedBlocked: false,
          isPaused: false,
          isMuted: true
        } : w
      ));
    } else {
      addWidget('video', 3, 2, {
        url: finalUrl,
        isYouTube: !!youtubeId,
        videoId: youtubeId,
        isTwitch: !!twitchChannel,
        twitchChannel
      });
    }

    setUrlInputValue('');
    setSidebarOpen(false);
    activeWidgetIdRef.current = null;
    setActiveWidgetId(null);
  }, [addWidget]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
    
    // Get the widget being dragged to determine ghost size
    const activeData = event.active.data.current;
    
    if (activeData?.type === 'channel' || activeData?.type === 'widget-template') {
      // Sidebar items use default 3x2 or template size
      const template = activeData.template as WidgetTemplate | undefined;
      setGhostPosition({ x: 0, y: 0, w: template?.w || 3, h: template?.h || 2 });
    } else if (activeData?.type === 'sortable-widget') {
      // Sortable widget being dragged - get widget from data
      const widget = activeData.widget as Widget;
      setGhostPosition({ x: 0, y: 0, w: widget.w, h: widget.h });
    } else {
      // Fallback: try to find widget by ID
      const widget = widgets.find(w => w.id === event.active.id);
      if (widget) {
        setGhostPosition({ x: 0, y: 0, w: widget.w, h: widget.h });
      } else {
        // Default ghost size
        setGhostPosition({ x: 0, y: 0, w: 3, h: 2 });
      }
    }
  }, [widgets]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!gridContainerRef.current) return;
    
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
    
    setGhostPosition(prev => prev ? { ...prev, x: gridX, y: gridY } : null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setGhostPosition(null);

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

    // Handle widget reordering (sortable)
    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  }, [addVideoWidget, addWidget, setWidgets]);

  const handleChannelClick = useCallback((channel: TrendingChannel) => {
    const videoId = extractYouTubeId(channel.url);
    const twitchChannel = extractTwitchChannel(channel.url);
    const currentActiveWidgetId = activeWidgetIdRef.current;

    if (currentActiveWidgetId) {
      setWidgets(prev => prev.map(w => 
        w.id === currentActiveWidgetId ? {
          ...w,
          type: 'video',
          url: channel.url,
          isYouTube: !!videoId,
          videoId,
          isTwitch: !!twitchChannel,
          twitchChannel,
          error: null,
          embedBlocked: false,
          isPaused: false,
          isMuted: true
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
