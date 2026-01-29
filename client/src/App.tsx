import { useState, useCallback } from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import MasterControlDashboard from "@/pages/dashboard";
import { WidgetSidebar, TrendingChannel, LayoutBlock } from '@/components/widget-sidebar';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useSensor, 
  useSensors, 
  PointerSensor,
  UniqueIdentifier,
  closestCenter
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';

type GridDensity = 2 | 4 | 6 | 9 | 12 | 16;

interface Slot {
  id: number;
  url: string;
  isActive: boolean;
  isMuted: boolean;
  isPaused: boolean;
  error: string | null;
  isYouTube: boolean;
  videoId: string | null;
  embedBlocked: boolean;
  spanCols: number;
  spanRows: number;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const [slots, setSlots] = useState<Slot[]>(() => {
    const saved = localStorage.getItem('controlDashboard');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length < 16) {
        const additional = Array(16 - parsed.length).fill(null).map((_, i) => ({
          id: parsed.length + i,
          url: '',
          isActive: false,
          isMuted: true,
          isPaused: false,
          error: null,
          isYouTube: false,
          videoId: null,
          embedBlocked: false,
          spanCols: 1,
          spanRows: 1
        }));
        return [...parsed.map((s: Slot) => ({ 
          ...s, 
          embedBlocked: s.embedBlocked ?? false,
          isPaused: s.isPaused ?? false,
          spanCols: s.spanCols ?? 1,
          spanRows: s.spanRows ?? 1
        })), ...additional];
      }
      return parsed.map((s: Slot) => ({ 
        ...s, 
        embedBlocked: s.embedBlocked ?? false,
        isPaused: s.isPaused ?? false,
        spanCols: s.spanCols ?? 1,
        spanRows: s.spanRows ?? 1
      }));
    }
    return Array(16).fill(null).map((_, i) => ({
      id: i,
      url: '',
      isActive: false,
      isMuted: true,
      isPaused: false,
      error: null,
      isYouTube: false,
      videoId: null,
      embedBlocked: false,
      spanCols: 1,
      spanRows: 1
    }));
  });

  const [gridDensity, setGridDensity] = useState<GridDensity>(() => {
    const saved = localStorage.getItem('controlDashboardGridDensity');
    return saved ? (parseInt(saved) as GridDensity) : 16;
  });

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const addChannelToSlot = useCallback((channel: TrendingChannel, slotIndex: number, spanCols = 1, spanRows = 1) => {
    const videoId = extractYouTubeId(channel.url);

    setSlots(prev => prev.map((slot, i) => 
      i === slotIndex ? {
        ...slot,
        url: channel.url,
        isActive: true,
        isYouTube: true,
        videoId: videoId,
        error: null,
        embedBlocked: false,
        isPaused: false,
        isMuted: true,
        spanCols,
        spanRows
      } : slot
    ));
  }, []);

  const handleSubmitUrl = useCallback((url: string) => {
    if (!url.trim() || activeSlotIndex === null) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const youtubeId = extractYouTubeId(finalUrl);

    setSlots(prev => prev.map((slot, i) => 
      i === activeSlotIndex ? {
        ...slot,
        url: finalUrl,
        isActive: true,
        isYouTube: !!youtubeId,
        videoId: youtubeId,
        error: null,
        embedBlocked: false,
        isPaused: false,
        isMuted: true
      } : slot
    ));

    setUrlInputValue('');
    setSidebarOpen(false);
    setActiveSlotIndex(null);
  }, [activeSlotIndex]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.type === 'slot') {
      const activeIndex = activeData.index as number;
      const overMatch = over.id.toString().match(/^slot-(\d+)$/);
      if (!overMatch) return;

      const overIndex = parseInt(overMatch[1], 10);

      if (activeIndex !== overIndex) {
        setSlots(prev => {
          const newSlots = arrayMove(prev, activeIndex, overIndex);
          return newSlots.map((slot, i) => ({ ...slot, id: i }));
        });
      }
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.type === 'channel') {
      const slotMatch = over.id.toString().match(/^slot-(\d+)$/);
      if (!slotMatch) return;

      const slotIndex = parseInt(slotMatch[1], 10);
      const channel = activeData.channel as TrendingChannel;
      addChannelToSlot(channel, slotIndex);
      setSidebarOpen(false);
    } else if (activeData?.type === 'block') {
      const slotMatch = over.id.toString().match(/^slot-(\d+)$/);
      if (!slotMatch) return;

      const slotIndex = parseInt(slotMatch[1], 10);
      const block = activeData.block as LayoutBlock;

      setSlots(prev => prev.map((slot, i) => 
        i === slotIndex ? {
          ...slot,
          spanCols: block.spanCols,
          spanRows: block.spanRows
        } : slot
      ));
      setSidebarOpen(false);
    }
  }, [addChannelToSlot]);

  const handleChannelClick = useCallback((channel: TrendingChannel) => {
    const firstEmptyIndex = slots.findIndex(s => !s.isActive);
    if (firstEmptyIndex !== -1) {
      addChannelToSlot(channel, firstEmptyIndex);
      setSidebarOpen(false);
    }
  }, [slots, addChannelToSlot]);

  const handleOpenSidebar = useCallback((index: number) => {
    setActiveSlotIndex(index);
    setSidebarOpen(true);
  }, []);

  const visibleSlots = slots.slice(0, gridDensity);
  const slotIds = visibleSlots.map((_, index) => `slot-${index}`);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* DndContext wrapping EVERYTHING ensures the sidebar can talk to the grid */}
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} // CHANGE: Added closestCenter for better stability
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={slotIds} strategy={rectSortingStrategy}>
            <WidgetSidebar 
              isOpen={sidebarOpen} 
              onClose={() => {
                setSidebarOpen(false);
                setActiveSlotIndex(null);
                setUrlInputValue('');
              }}
              onChannelClick={handleChannelClick}
              urlValue={urlInputValue}
              onUrlChange={setUrlInputValue}
              onUrlSubmit={handleSubmitUrl}
              activeSlotIndex={activeSlotIndex}
            />
            <Switch>
              <Route path="/">
                {() => (
                  <MasterControlDashboard 
                    slots={slots}
                    setSlots={setSlots}
                    gridDensity={gridDensity}
                    setGridDensity={setGridDensity}
                    isEditMode={isEditMode}
                    setIsEditMode={setIsEditMode}
                    sidebarOpen={sidebarOpen}
                    activeId={activeId}
                    handleOpenSidebar={handleOpenSidebar}
                  />
                )}
              </Route>
              <Route component={NotFound} />
            </Switch>
          </SortableContext>
          
          {/* Ghost preview when dragging */}
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
                    {String(activeId).startsWith('slot-') 
                      ? `Slot ${parseInt(String(activeId).replace('slot-', '')) + 1}`
                      : String(activeId).includes('block-')
                        ? 'Layout Block'
                        : 'Channel'
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