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
  useSensor, 
  useSensors, 
  PointerSensor,
  rectIntersection,
  UniqueIdentifier,
  CollisionDetection
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

const customCollisionDetection: CollisionDetection = (args) => {
  const collisions = rectIntersection(args);
  
  if (!collisions.length) return collisions;
  
  const activeData = args.active?.data?.current;
  const isFromSidebar = activeData?.type === 'channel' || activeData?.type === 'block';
  
  if (isFromSidebar) {
    return collisions;
  }
  
  const filteredCollisions = collisions.filter((collision) => {
    const { data } = collision;
    if (!data?.droppableContainer?.rect?.current) return false;
    
    const activeRect = args.collisionRect;
    const targetRect = data.droppableContainer.rect.current;
    
    const intersectionWidth = Math.max(0, 
      Math.min(activeRect.right, targetRect.right) - Math.max(activeRect.left, targetRect.left)
    );
    const intersectionHeight = Math.max(0,
      Math.min(activeRect.bottom, targetRect.bottom) - Math.max(activeRect.top, targetRect.top)
    );
    const intersectionArea = intersectionWidth * intersectionHeight;
    const targetArea = targetRect.width * targetRect.height;
    const overlapRatio = targetArea > 0 ? intersectionArea / targetArea : 0;
    
    return overlapRatio >= 0.5;
  });
  
  return filteredCollisions.length > 0 ? filteredCollisions : [];
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
        tolerance: 5,
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
    const extractVideoId = (url: string): string | null => {
      const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[7].length === 11) ? match[7] : null;
    };
    
    const videoId = extractVideoId(channel.url);
    
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
        <DndContext 
          sensors={sensors} 
          collisionDetection={customCollisionDetection}
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
        </DndContext>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
