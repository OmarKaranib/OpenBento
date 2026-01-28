import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, AlertCircle, X, ExternalLink, ChevronDown, Scale, Pause, Play } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
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
}

interface DroppableSlotProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function DroppableSlot({ id, children, className }: DroppableSlotProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-cyan-400 ring-opacity-70' : ''}`}
    >
      {children}
    </div>
  );
}

const MasterControlDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
          embedBlocked: false
        }));
        return [...parsed.map((s: Slot) => ({ 
          ...s, 
          embedBlocked: s.embedBlocked ?? false,
          isPaused: s.isPaused ?? false 
        })), ...additional];
      }
      return parsed.map((s: Slot) => ({ 
        ...s, 
        embedBlocked: s.embedBlocked ?? false,
        isPaused: s.isPaused ?? false 
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
      embedBlocked: false
    }));
  });
  
  const [masterMute, setMasterMute] = useState(true);
  const [gridDensity, setGridDensity] = useState<GridDensity>(() => {
    const saved = localStorage.getItem('controlDashboardGridDensity');
    return saved ? (parseInt(saved) as GridDensity) : 16;
  });
  const [showGridDropdown, setShowGridDropdown] = useState(false);
  const [showLegalPopup, setShowLegalPopup] = useState(false);
  const [inputIndex, setInputIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
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

  const handleAddUrl = (index: number) => {
    setInputIndex(index);
    setInputValue(slots[index].url || '');
  };

  const handleSubmitUrl = (index: number) => {
    if (!inputValue.trim()) return;

    let url = inputValue.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const youtubeId = extractYouTubeId(url);
    
    setSlots(prev => prev.map((slot, i) => 
      i === index ? {
        ...slot,
        url,
        isActive: true,
        isYouTube: !!youtubeId,
        videoId: youtubeId,
        error: null,
        embedBlocked: false,
        isPaused: false,
        isMuted: true
      } : slot
    ));

    setInputIndex(null);
    setInputValue('');
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
          embedBlocked: false
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
            embedBlocked: false
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

  const addChannelToSlot = useCallback((channel: TrendingChannel, slotIndex: number) => {
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
        isMuted: true
      } : slot
    ));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const slotMatch = over.id.toString().match(/^slot-(\d+)$/);
    if (!slotMatch) return;
    
    const slotIndex = parseInt(slotMatch[1], 10);
    const activeData = active.data.current;
    
    if (activeData?.type === 'channel') {
      const channel = activeData.channel as TrendingChannel;
      addChannelToSlot(channel, slotIndex);
      setSidebarOpen(false);
    } else if (activeData?.type === 'block') {
      const block = activeData.block as LayoutBlock;
      const newDensity = (block.cols * block.rows) as GridDensity;
      if ([2, 4, 6, 9, 12, 16].includes(newDensity)) {
        setSlots(prev => compactSlots(prev, newDensity));
        setGridDensity(newDensity);
      }
      setSidebarOpen(false);
    }
  }, [addChannelToSlot, compactSlots]);

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
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={`h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-mono flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:pl-[32rem]' : ''}`} style={{ padding: '1.6rem' }}>
        <WidgetSidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          onChannelClick={handleChannelClick}
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

      <div 
        className="dashboard-grid relative z-10"
        style={{
          '--grid-cols': `repeat(${gridOption.cols}, 1fr)`,
          '--grid-rows': `repeat(${gridOption.rows}, 1fr)`
        } as React.CSSProperties}
      >
        {visibleSlots.map((slot, index) => (
          <DroppableSlot
            key={slot.id}
            id={`slot-${index}`}
            className="dashboard-slot relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 group hover:border-cyan-500/50 transition-all duration-300 shadow-xl"
          >
            <div className="absolute top-[0.8rem] left-[0.8rem] z-20 bg-slate-800/90 backdrop-blur-sm px-[0.6rem] py-[0.3rem] slot-button text-[0.9rem] font-bold text-cyan-400 border border-cyan-500/30" data-testid={`text-slot-number-${index}`} data-slot-testid={`slot-container-${index}`}>
              {index + 1}
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
              {!slot.isActive && inputIndex !== index && (
                <div className="flex flex-col items-center gap-[0.8rem]">
                  <button
                    onClick={() => handleOpenSidebar(index)}
                    className="flex flex-col items-center gap-[0.4rem] p-[0.8rem] hover:bg-slate-800/50 slot-inner-element transition-all duration-300 group/btn"
                    data-testid={`button-add-source-${index}`}
                  >
                    <Plus className="w-[2.4rem] h-[2.4rem] text-cyan-400 group-hover/btn:scale-110 transition-transform" />
                    <span className="text-[1rem] text-slate-400 group-hover/btn:text-cyan-400 transition-colors">
                      ADD
                    </span>
                  </button>
                  <button
                    onClick={() => handleAddUrl(index)}
                    className="text-[0.9rem] text-slate-500 hover:text-cyan-400 transition-colors"
                    data-testid={`button-custom-url-${index}`}
                  >
                    or enter URL
                  </button>
                </div>
              )}

              {inputIndex === index && (
                <div className="absolute inset-0 flex items-center justify-center p-[1.6rem] bg-slate-900/95 backdrop-blur-sm z-30 slot-inner-element">
                  <div className="w-full max-w-[28rem]">
                    <label className="block text-[1rem] font-semibold mb-[0.6rem] text-cyan-400">
                      ENTER URL
                    </label>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmitUrl(index);
                        }
                      }}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-[1rem] py-[0.6rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem]"
                      autoFocus
                      data-testid={`input-url-${index}`}
                    />
                    <div className="flex gap-[0.6rem] mt-[1rem]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSubmitUrl(index);
                        }}
                        className="flex-1 px-[1.2rem] py-[0.6rem] bg-cyan-600 hover:bg-cyan-500 slot-button font-semibold transition-colors text-[1.1rem]"
                        data-testid={`button-load-${index}`}
                      >
                        LOAD
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setInputIndex(null);
                          setInputValue('');
                        }}
                        className="px-[1.2rem] py-[0.6rem] bg-slate-700 hover:bg-slate-600 slot-button font-semibold transition-colors text-[1.1rem]"
                        data-testid={`button-cancel-${index}`}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {slot.isActive && !slot.error && (
                <div className="w-full h-full relative">
                  {slot.isYouTube && slot.videoId ? (
                    <iframe
                      ref={(el) => { iframeRefs.current[index] = el; }}
                      src={getYouTubeEmbedUrl(slot.videoId)}
                      className="w-full h-full"
                      title={`YouTube - Slot ${index + 1}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <iframe
                        src={slot.url}
                        className="w-full h-full"
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
          </DroppableSlot>
        ))}
      </div>

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
