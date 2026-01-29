import { useState, useCallback, useRef, useEffect } from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import MasterControlDashboard from "@/pages/dashboard";
import { WidgetSidebar, TrendingChannel, WidgetTemplate } from '@/components/widget-sidebar';
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent,
  DragOverlay,
  useSensor, 
  useSensors, 
  PointerSensor,
  UniqueIdentifier,
  closestCenter
} from '@dnd-kit/core';

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

  const activeWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeWidgetIdRef.current = activeWidgetId;
  }, [activeWidgetId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
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
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active } = event;
    setActiveId(null);

    const activeData = active.data.current;

    if (activeData?.type === 'channel') {
      const channel = activeData.channel as TrendingChannel;
      addVideoWidget(channel, 3, 2);
      setSidebarOpen(false);
    } else if (activeData?.type === 'widget-template') {
      const template = activeData.template as WidgetTemplate;
      addWidget(template.widgetType, template.w || 3, template.h || 2);
      setSidebarOpen(false);
    }
  }, [addVideoWidget, addWidget]);

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
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <WidgetSidebar 
            isOpen={sidebarOpen} 
            onClose={() => {
              setSidebarOpen(false);
              activeWidgetIdRef.current = null;
              setActiveWidgetId(null);
              setUrlInputValue('');
            }}
            onChannelClick={handleChannelClick}
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
                  sidebarOpen={sidebarOpen}
                  activeId={activeId}
                  handleOpenSidebar={handleOpenSidebar}
                  addWidget={addWidget}
                />
              )}
            </Route>
            <Route component={NotFound} />
          </Switch>
          
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
