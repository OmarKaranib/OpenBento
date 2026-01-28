import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, AlertCircle, X, ExternalLink, ChevronDown, Scale, Pause, Play, GripVertical, Edit3, Lock } from 'lucide-react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverEvent,
  DragStartEvent,
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor,
  rectIntersection,
  UniqueIdentifier,
  CollisionDetection,
  Collision
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WidgetSidebar, TrendingChannel, LAYOUT_BLOCKS, LayoutBlock } from '@/components/widget-sidebar';

type GridDensity = 2 | 4 | 6 | 9 | 12 | 16;

interface GridOption {
  value: GridDensity;
  label: string;
  cols: number;
  rows: number;
}

const GRID_OPTIONS: GridOption[] = [
  { value: 2, label: '2 Slots (1x2)', cols: 2, rows: 1 },
  { value: 4, label: '4 Slots (2x2)', cols: 2, rows: 2 },
  { value: 6, label: '6 Slots (2x3)', cols: 3, rows: 2 },
  { value: 9, label: '9 Slots (3x3)', cols: 3, rows: 3 },
  { value: 12, label: '12 Slots (3x4)', cols: 4, rows: 3 },
  { value: 16, label: '16 Slots (4x4)', cols: 4, rows: 4 },
];

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

interface SortableSlotProps {
  slot: Slot;
  index: number;
  children: React.ReactNode;
  isDraggingThis: boolean;
  gridCols: number;
  isEditMode: boolean;
}

const customCollisionDetection: CollisionDetection = (args) => {
  const collisions = rectIntersection(args);
  
  if (!collisions.length) return collisions;
  
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

function SortableSlot({ slot, index, children, isDraggingThis, gridCols, isEditMode }: SortableSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ 
    id: `slot-${index}`,
    data: { type: 'slot', slot, index }
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'transform 0.3s ease, box-shadow 0.3s ease',
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
    gridColumn: slot.spanCols > 1 ? `span ${Math.min(slot.spanCols, gridCols)}` : undefined,
    gridRow: slot.spanRows > 1 ? `span ${slot.spanRows}` : undefined,
  };

  const filteredAttributes = {
    ...attributes,
    'aria-disabled': undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...filteredAttributes}
      className="relative"
      data-testid={`slot-container-${index}`}
    >
      <div 
        className={`dashboard-slot h-full w-full relative bg-slate-900/50 backdrop-blur-sm border group transition-all duration-300 shadow-xl ${
          isDragging 
            ? 'scale-105 shadow-2xl shadow-cyan-500/30 border-cyan-400 z-50' 
            : isOver 
              ? 'border-cyan-400/70 ring-2 ring-cyan-400/50'
              : isEditMode
                ? 'border-purple-500/70 ring-1 ring-purple-400/30'
                : 'border-slate-700/50 hover:border-cyan-500/50'
        } ${isEditMode && !isDragging ? 'animate-jiggle' : ''}`}
      >
        {isEditMode && (
          <div 
            {...listeners}
            className="absolute inset-0 cursor-grab active:cursor-grabbing z-40 bg-transparent"
            data-testid={`drag-overlay-${index}`}
          />
        )}
        {children}
      </div>
    </div>
  );
}

const MasterControlDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
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
  
  const [masterMute, setMasterMute] = useState(true);
  const [gridDensity, setGridDensity] = useState<GridDensity>(() => {
    const saved = localStorage.getItem('controlDashboardGridDensity');
    return saved ? (parseInt(saved) as GridDensity) : 16;
  });
  const [showGridDropdown, setShowGridDropdown] = useState(false);
  const [showLegalPopup, setShowLegalPopup] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const iframeLoadTimers = useRef<Record<number, NodeJS.Timeout | null>>({});
  const iframeRefs = useRef<Record<number, HTMLIFrameElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowGridDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const getYouTubeEmbedUrl = (videoId: string): string => {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&modestbranding=1&rel=0&enablejsapi=1&origin=${window.location.origin}`;
  };

  const sendYouTubeCommand = useCallback((index: number, command: string, value?: number | boolean) => {
    const iframe = iframeRefs.current[index];
    if (iframe && iframe.contentWindow) {
      const message = {
        event: 'command',
        func: command,
        args: value !== undefined ? [value] : []
      };
      iframe.contentWindow.postMessage(JSON.stringify(message), '*');
    }
  }, []);

  const getCurrentGridOption = (): GridOption => {
    return GRID_OPTIONS.find(opt => opt.value === gridDensity) || GRID_OPTIONS[5];
  };

  const visibleSlots = slots.slice(0, gridDensity);
  const slotIds = visibleSlots.map((_, index) => `slot-${index}`);

  const handleSubmitUrl = (url: string) => {
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
  };

  const handleRemoveSlot = (index: number) => {
    if (iframeLoadTimers.current[index]) {
      clearTimeout(iframeLoadTimers.current[index]!);
      delete iframeLoadTimers.current[index];
    }
    delete iframeRefs.current[index];

    setSlots(prev => {
      const updated = prev.map((slot, i) => 
        i === index ? {
          ...slot,
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
        } : slot
      );
      return compactSlots(updated, gridDensity);
    });
  };

  const toggleSlotMute = (index: number) => {
    const slot = slots[index];
    const newMuted = !slot.isMuted;
    
    if (slot.isYouTube) {
      sendYouTubeCommand(index, newMuted ? 'mute' : 'unMute');
    }
    
    setSlots(prev => prev.map((s, i) => 
      i === index ? { ...s, isMuted: newMuted } : s
    ));
  };

  const toggleSlotPause = (index: number) => {
    const slot = slots[index];
    const newPaused = !slot.isPaused;
    
    if (slot.isYouTube) {
      sendYouTubeCommand(index, newPaused ? 'pauseVideo' : 'playVideo');
    }
    
    setSlots(prev => prev.map((s, i) => 
      i === index ? { ...s, isPaused: newPaused } : s
    ));
  };

  const handleMasterMute = () => {
    const newMasterMute = !masterMute;
    setMasterMute(newMasterMute);
    
    slots.forEach((slot, index) => {
      if (slot.isActive && slot.isYouTube) {
        sendYouTubeCommand(index, newMasterMute ? 'mute' : 'unMute');
      }
    });
    
    setSlots(prev => prev.map(s => 
      s.isActive ? { ...s, isMuted: newMasterMute } : s
    ));
  };

  const handleSaveLayout = () => {
    localStorage.setItem('controlDashboard', JSON.stringify(slots));
    localStorage.setItem('controlDashboardGridDensity', gridDensity.toString());
    
    const button = document.getElementById('save-button');
    if (button) {
      button.classList.add('scale-95', 'bg-cyan-600');
      setTimeout(() => {
        button.classList.remove('scale-95', 'bg-cyan-600');
      }, 200);
    }
  };

  const handleIframeError = (index: number) => {
    setSlots(prev => prev.map((slot, i) => 
      i === index ? {
        ...slot,
        error: 'This site restricts embedding.',
        embedBlocked: true
      } : slot
    ));
  };

  const startIframeBlockDetection = (index: number) => {
    if (iframeLoadTimers.current[index]) {
      clearTimeout(iframeLoadTimers.current[index]!);
    }
    iframeLoadTimers.current[index] = setTimeout(() => {
      setSlots(prev => prev.map((slot, i) => 
        i === index && slot.isActive && !slot.isYouTube && !slot.embedBlocked ? {
          ...slot,
          embedBlocked: true
        } : slot
      ));
    }, 5000);
  };

  const compactSlots = useCallback((slotsToCompact: Slot[], targetDensity: GridDensity): Slot[] => {
    const activeSlots = slotsToCompact.filter(s => s.isActive);
    const inactiveSlots = slotsToCompact.filter(s => !s.isActive);
    
    const reordered: Slot[] = [];
    for (let i = 0; i < 16; i++) {
      if (i < activeSlots.length) {
        reordered.push({ ...activeSlots[i], id: i });
      } else {
        const inactiveIndex = i - activeSlots.length;
        if (inactiveIndex < inactiveSlots.length) {
          reordered.push({ ...inactiveSlots[inactiveIndex], id: i });
        } else {
          reordered.push({
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
          });
        }
      }
    }
    return reordered;
  }, []);

  const handleGridSelect = (value: GridDensity) => {
    setSlots(prev => compactSlots(prev, value));
    setGridDensity(value);
    setShowGridDropdown(false);
  };

  const addChannelToSlot = useCallback((channel: TrendingChannel, slotIndex: number, spanCols: number = 1, spanRows: number = 1) => {
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

  const handleOpenSidebar = (index: number) => {
    setActiveSlotIndex(index);
    setSidebarOpen(true);
  };

  const gridOption = getCurrentGridOption();

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-mono flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:pl-[32rem]' : ''}`} style={{ padding: '1.6rem' }}>
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
        
        <div className="fixed inset-0 opacity-30 pointer-events-none z-0">
        <div className="absolute top-[8rem] left-[8rem] w-[38rem] h-[38rem] bg-cyan-500 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[8rem] right-[8rem] w-[38rem] h-[38rem] bg-purple-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-30 mb-[1rem] flex-shrink-0" style={{ height: 'var(--header-height)' }}>
        <div className="flex items-center justify-between mb-[0.8rem] flex-wrap gap-[0.8rem]">
          <div className="flex items-center gap-[1.2rem]">
            <div className="relative">
              <Power className="w-[2rem] h-[2rem] text-cyan-400 animate-pulse" data-testid="icon-power" />
              <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50 pointer-events-none"></div>
            </div>
            <h1 className="text-[2rem] font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent" data-testid="text-title">
              MASTER CONTROL
            </h1>
          </div>
          
          <div className="flex gap-[0.8rem] items-center">
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
            
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowGridDropdown(!showGridDropdown)}
                className="px-[1.2rem] py-[0.6rem] bg-purple-700 hover:bg-purple-600 slot-button font-semibold flex items-center gap-[0.8rem] transition-all duration-300 shadow-lg shadow-purple-900/50 text-[1.2rem]"
                data-testid="button-grid-density"
              >
                Grid Density
                <ChevronDown className={`w-[1.2rem] h-[1.2rem] transition-transform ${showGridDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showGridDropdown && (
                <div className="absolute top-full mt-[0.4rem] right-0 bg-slate-800 border border-slate-600 shadow-xl z-50 min-w-[16rem]" style={{ borderRadius: 'var(--inner-radius)' }} data-testid="dropdown-grid-options">
                  {GRID_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleGridSelect(option.value)}
                      className={`w-full px-[1.2rem] py-[0.8rem] text-left text-[1.2rem] hover:bg-slate-700 transition-colors first:rounded-t-[var(--inner-radius)] last:rounded-b-[var(--inner-radius)] flex items-center justify-between ${
                        gridDensity === option.value ? 'bg-purple-600/50 text-cyan-400' : 'text-slate-300'
                      }`}
                      data-testid={`grid-option-${option.value}`}
                    >
                      {option.label}
                      {gridDensity === option.value && <span className="text-cyan-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
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

      <SortableContext items={slotIds} strategy={rectSortingStrategy}>
        <div 
          className="dashboard-grid relative z-10"
          style={{
            '--grid-cols': `repeat(${gridOption.cols}, 1fr)`,
            '--grid-rows': `repeat(${gridOption.rows}, 1fr)`
          } as React.CSSProperties}
        >
          {visibleSlots.map((slot, index) => (
            <SortableSlot
              key={`slot-${index}`}
              slot={slot}
              index={index}
              isDraggingThis={activeId === `slot-${index}`}
              gridCols={gridOption.cols}
              isEditMode={isEditMode}
            >
              <div className="absolute top-[0.8rem] left-[0.8rem] z-20 bg-slate-800/90 backdrop-blur-sm px-[0.6rem] py-[0.3rem] slot-button text-[0.9rem] font-bold text-cyan-400 border border-cyan-500/30" data-testid={`text-slot-number-${index}`}>
                {index + 1}
                {(slot.spanCols > 1 || slot.spanRows > 1) && (
                  <span className="ml-[0.4rem] text-purple-400 text-[0.8rem]">
                    {slot.spanCols}x{slot.spanRows}
                  </span>
                )}
              </div>

              {slot.isActive && (
                <div className="absolute top-[0.8rem] right-[0.8rem] z-20 flex gap-[0.4rem]">
                  {slot.isYouTube && (
                    <button
                      onClick={() => toggleSlotPause(index)}
                      className={`p-[0.6rem] slot-button transition-all duration-300 backdrop-blur-sm ${
                        slot.isPaused 
                          ? 'bg-yellow-600/90 hover:bg-yellow-500' 
                          : 'bg-blue-600/90 hover:bg-blue-500'
                      }`}
                      title={slot.isPaused ? 'Play' : 'Pause'}
                      data-testid={`button-pause-${index}`}
                    >
                      {slot.isPaused ? <Play className="w-[1.2rem] h-[1.2rem]" /> : <Pause className="w-[1.2rem] h-[1.2rem]" />}
                    </button>
                  )}
                  
                  <button
                    onClick={() => toggleSlotMute(index)}
                    className={`p-[0.6rem] slot-button transition-all duration-300 backdrop-blur-sm ${
                      slot.isMuted 
                        ? 'bg-red-600/90 hover:bg-red-500' 
                        : 'bg-emerald-600/90 hover:bg-emerald-500'
                    }`}
                    title={slot.isMuted ? 'Unmute' : 'Mute'}
                    data-testid={`button-mute-${index}`}
                  >
                    {slot.isMuted ? <VolumeX className="w-[1.2rem] h-[1.2rem]" /> : <Volume2 className="w-[1.2rem] h-[1.2rem]" />}
                  </button>
                  
                  {!slot.isYouTube && slot.url && (
                    <a
                      href={slot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-[0.6rem] slot-button transition-all duration-300 backdrop-blur-sm bg-blue-600/90 hover:bg-blue-500"
                      title="Open in new tab"
                      data-testid={`button-link-${index}`}
                    >
                      <ExternalLink className="w-[1.2rem] h-[1.2rem]" />
                    </a>
                  )}
                  
                  <button
                    onClick={() => handleRemoveSlot(index)}
                    className="p-[0.6rem] bg-slate-800/90 hover:bg-slate-700 slot-button transition-all duration-300 backdrop-blur-sm"
                    title="Remove"
                    data-testid={`button-remove-${index}`}
                  >
                    <X className="w-[1.2rem] h-[1.2rem] text-red-400" />
                  </button>
                </div>
              )}

              <div className="w-full h-full flex items-center justify-center">
                {!slot.isActive && (
                  <button
                    onClick={() => handleOpenSidebar(index)}
                    className="absolute inset-0 flex items-center justify-center hover:bg-slate-800/30 transition-all duration-300 group/btn cursor-pointer"
                    data-testid={`button-add-source-${index}`}
                  >
                    <Plus className="w-[4rem] h-[4rem] text-cyan-400/60 group-hover/btn:text-cyan-400 group-hover/btn:scale-110 transition-all duration-300" />
                  </button>
                )}

                {slot.isActive && !slot.error && (
                  <div className="w-full h-full relative">
                    {isEditMode && (
                      <div 
                        className="absolute inset-0 z-30 bg-transparent" 
                        style={{ pointerEvents: 'auto' }}
                        data-testid={`iframe-overlay-${index}`}
                      />
                    )}
                    {slot.isYouTube && slot.videoId ? (
                      <iframe
                        ref={(el) => { iframeRefs.current[index] = el; }}
                        src={getYouTubeEmbedUrl(slot.videoId)}
                        className="w-full h-full"
                        style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}
                        title={`YouTube - Slot ${index + 1}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <>
                        <iframe
                          src={slot.url}
                          className="w-full h-full"
                          style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}
                          title={`Slot ${index + 1}`}
                          allow="autoplay; encrypted-media"
                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                          onError={() => handleIframeError(index)}
                          onLoad={() => startIframeBlockDetection(index)}
                        />
                        {slot.embedBlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
                            <div className="text-center p-[2rem] max-w-[28rem]">
                              <AlertCircle className="w-[3.2rem] h-[3.2rem] text-orange-400 mx-auto mb-[1rem]" />
                              <p className="text-[1.4rem] font-semibold text-slate-200 mb-[0.6rem]">Embedding Restricted</p>
                              <p className="text-[1.1rem] text-slate-400 mb-[1.5rem]">
                                Sites like Twitter, Discord, and others require their official embed codes. Standard iframes are blocked for security.
                              </p>
                              <a
                                href={slot.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-[1.6rem] py-[1rem] bg-orange-600 hover:bg-orange-500 slot-button font-semibold transition-colors text-[1.3rem] inline-flex items-center gap-[0.8rem]"
                                data-testid={`button-open-widget-${index}`}
                              >
                                <ExternalLink className="w-[1.6rem] h-[1.6rem]" />
                                Open in Official Widget Mode
                              </a>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {slot.error && (
                  <div className="absolute inset-0 flex items-center justify-center p-[1.6rem] bg-slate-900/95 backdrop-blur-sm">
                    <div className="max-w-[28rem] text-center">
                      <AlertCircle className="w-[2.4rem] h-[2.4rem] text-yellow-400 mx-auto mb-[0.6rem]" />
                      <p className="text-[1.1rem] text-slate-300 mb-[1rem]" data-testid={`text-error-${index}`}>{slot.error}</p>
                      <div className="flex gap-[0.6rem] justify-center">
                        {slot.url && (
                          <a
                            href={slot.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-[1rem] py-[0.6rem] bg-blue-600 hover:bg-blue-500 slot-button font-semibold transition-colors text-[1.1rem] flex items-center gap-[0.4rem]"
                            data-testid={`button-open-link-${index}`}
                          >
                            <ExternalLink className="w-[1.2rem] h-[1.2rem]" />
                            Open in New Window
                          </a>
                        )}
                        <button
                          onClick={() => handleRemoveSlot(index)}
                          className="px-[1rem] py-[0.6rem] bg-slate-700 hover:bg-slate-600 slot-button font-semibold transition-colors text-[1.1rem]"
                          data-testid={`button-clear-slot-${index}`}
                        >
                          CLEAR
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan"></div>
              </div>
            </SortableSlot>
          ))}
        </div>
      </SortableContext>

      <div className="relative z-10 mt-[0.8rem] flex-shrink-0 flex items-center justify-between text-[1rem] text-slate-500 border-t border-slate-800 pt-[0.8rem]" style={{ height: 'var(--footer-height)' }}>
        <p data-testid="text-footer-copyright">© 2026 Master Control. Independent tool for content aggregation.</p>
        <div className="flex items-center gap-[1.2rem]">
          <span data-testid="text-status">Active: {slots.filter(s => s.isActive).length}/16</span>
          <button
            onClick={() => setShowLegalPopup(true)}
            className="px-[0.8rem] py-[0.4rem] bg-slate-800 hover:bg-slate-700 slot-button text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-[0.4rem]"
            data-testid="button-legal"
          >
            <Scale className="w-[1.2rem] h-[1.2rem]" />
            Legal
          </button>
        </div>
      </div>

      {showLegalPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="modal-legal">
          <div className="bg-slate-900 border border-slate-700 p-[2.4rem] max-w-[44rem] mx-[1.6rem] shadow-2xl" style={{ borderRadius: 'var(--outer-radius)' }}>
            <div className="flex items-center justify-between mb-[1.6rem]">
              <h2 className="text-[1.8rem] font-bold text-cyan-400 flex items-center gap-[0.8rem]">
                <Scale className="w-[2rem] h-[2rem]" />
                Legal Disclaimer
              </h2>
              <button
                onClick={() => setShowLegalPopup(false)}
                className="p-[0.6rem] hover:bg-slate-800 slot-button transition-colors"
                data-testid="button-close-legal"
              >
                <X className="w-[2rem] h-[2rem] text-slate-400" />
              </button>
            </div>
            <p className="text-[1.4rem] text-slate-300 leading-relaxed" data-testid="text-legal-content">
              This application is a productivity tool for aggregating public web content. It is not affiliated with or endorsed by the third-party services displayed. Users are responsible for complying with the Terms of Service of all embedded sites.
            </p>
            <button
              onClick={() => setShowLegalPopup(false)}
              className="mt-[1.6rem] w-full py-[1rem] bg-cyan-700 hover:bg-cyan-600 slot-button font-semibold text-[1.4rem] transition-colors"
              data-testid="button-acknowledge-legal"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
      </div>
    </DndContext>
  );
};

export default MasterControlDashboard;
