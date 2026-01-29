import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, AlertCircle, X, ExternalLink, ChevronDown, Scale, Pause, Play, Edit3, Lock } from 'lucide-react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

export interface Slot {
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
  onResetSlot?: (index: number) => void;
}

function SortableSlot({ slot, index, children, isDraggingThis, gridCols, isEditMode, onResetSlot }: SortableSlotProps) {
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

  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onResetSlot?.(index);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...filteredAttributes}
      className="relative"
      data-testid={`slot-container-${index}`}
    >
      {/* IFRAME SHIELD: Direct child of useSortable ref, position absolute inset-0 */}
      {isEditMode && (
        <div 
          {...listeners}
          style={{ 
            position: 'absolute', 
            inset: 0,
            zIndex: 9998,
            pointerEvents: 'auto',
            cursor: 'grab'
          }}
          data-testid={`drag-overlay-${index}`}
        />
      )}
      {/* Reset Slot Button - only in Edit Mode when slot has spanning */}
      {isEditMode && (slot.spanCols > 1 || slot.spanRows > 1) && (
        <button
          onClick={handleResetClick}
          style={{
            position: 'absolute',
            top: '0.8rem',
            right: '0.8rem',
            zIndex: 10000,
            pointerEvents: 'auto'
          }}
          className="p-[0.5rem] bg-red-600/90 hover:bg-red-500 rounded-md transition-all duration-200 shadow-lg"
          title="Reset slot size to 1x1"
          data-testid={`button-reset-slot-${index}`}
        >
          <X className="w-[1.2rem] h-[1.2rem] text-white" />
        </button>
      )}
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
        {children}
      </div>
    </div>
  );
}

interface MasterControlDashboardProps {
  slots: Slot[];
  setSlots: Dispatch<SetStateAction<Slot[]>>;
  gridDensity: GridDensity;
  setGridDensity: Dispatch<SetStateAction<GridDensity>>;
  isEditMode: boolean;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;
  sidebarOpen: boolean;
  activeId: UniqueIdentifier | null;
  handleOpenSidebar: (index: number) => void;
}

const MasterControlDashboard = ({
  slots,
  setSlots,
  gridDensity,
  setGridDensity,
  isEditMode,
  setIsEditMode,
  sidebarOpen,
  activeId,
  handleOpenSidebar
}: MasterControlDashboardProps) => {
  const [masterMute, setMasterMute] = useState(true);
  const [showGridDropdown, setShowGridDropdown] = useState(false);
  const [showLegalPopup, setShowLegalPopup] = useState(false);
  const iframeLoadTimers = useRef<Record<number, NodeJS.Timeout | null>>({});
  const iframeRefs = useRef<Record<number, HTMLIFrameElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleResetSlot = (index: number) => {
    setSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, spanCols: 1, spanRows: 1 } : slot
    ));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowGridDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleRemoveSlot = (index: number) => {
    if (iframeLoadTimers.current[index]) {
      clearTimeout(iframeLoadTimers.current[index]!);
      iframeLoadTimers.current[index] = null;
    }
    
    setSlots(prev => prev.map((slot, i) => 
      i === index ? {
        ...slot,
        url: '',
        isActive: false,
        isYouTube: false,
        videoId: null,
        error: null,
        embedBlocked: false,
        isPaused: false,
        spanCols: 1,
        spanRows: 1
      } : slot
    ));
  };

  const handleIframeError = (index: number) => {
    setSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, error: 'Failed to load this source. The site may block embedding.' } : slot
    ));
  };

  const startIframeBlockDetection = (index: number) => {
    if (iframeLoadTimers.current[index]) {
      clearTimeout(iframeLoadTimers.current[index]!);
    }
    
    iframeLoadTimers.current[index] = setTimeout(() => {
      const iframe = document.querySelector(`iframe[title="Slot ${index + 1}"]`) as HTMLIFrameElement;
      if (iframe) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc || doc.body.innerHTML === '') {
            setSlots(prev => prev.map((slot, i) => 
              i === index ? { ...slot, embedBlocked: true } : slot
            ));
          }
        } catch (e) {
          setSlots(prev => prev.map((slot, i) => 
            i === index ? { ...slot, embedBlocked: true } : slot
          ));
        }
      }
    }, 3000);
  };

  const toggleSlotMute = (index: number) => {
    setSlots(prev => prev.map((slot, i) => {
      if (i === index) {
        const newMuted = !slot.isMuted;
        if (slot.isYouTube) {
          sendYouTubeCommand(index, newMuted ? 'mute' : 'unMute');
        }
        return { ...slot, isMuted: newMuted };
      }
      return slot;
    }));
  };

  const toggleSlotPause = (index: number) => {
    setSlots(prev => prev.map((slot, i) => {
      if (i === index) {
        const newPaused = !slot.isPaused;
        if (slot.isYouTube) {
          sendYouTubeCommand(index, newPaused ? 'pauseVideo' : 'playVideo');
        }
        return { ...slot, isPaused: newPaused };
      }
      return slot;
    }));
  };

  const handleMasterMute = () => {
    const newMute = !masterMute;
    setMasterMute(newMute);
    
    setSlots(prev => prev.map((slot, index) => {
      if (slot.isActive && slot.isYouTube) {
        sendYouTubeCommand(index, newMute ? 'mute' : 'unMute');
      }
      return { ...slot, isMuted: newMute };
    }));
  };

  const handleSaveLayout = () => {
    localStorage.setItem('controlDashboard', JSON.stringify(slots));
    localStorage.setItem('controlDashboardGridDensity', gridDensity.toString());
    
    const saveButton = document.getElementById('save-button');
    if (saveButton) {
      saveButton.classList.add('ring-2', 'ring-cyan-400', 'scale-110');
      setTimeout(() => {
        saveButton.classList.remove('ring-2', 'ring-cyan-400', 'scale-110');
      }, 300);
    }
  };

  const handleGridSelect = (density: GridDensity) => {
    setGridDensity(density);
    setShowGridDropdown(false);
  };

  const gridOption = getCurrentGridOption();

  return (
    <div className={`h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-mono flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:pl-[32rem]' : ''}`} style={{ padding: '1.6rem' }}>
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
            onResetSlot={handleResetSlot}
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
  );
};

export default MasterControlDashboard;
