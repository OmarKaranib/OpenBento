import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, X, ChevronDown, Edit3, Lock, RefreshCw, GripVertical, FileText, Square, Image as ImageIcon, Trash2, Settings, PanelLeftClose, PanelLeftOpen, Pause, Play, Maximize2, Minimize2, MoveDiagonal2 } from 'lucide-react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget, WidgetType } from '@/App';

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
    disabled: !isEditMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `span ${Math.min(widget.w, GRID_COLS)}`,
    gridRow: `span ${widget.h}`
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`dashboard-slot relative bg-slate-900/50 backdrop-blur-sm border group transition-all duration-300 shadow-xl overflow-hidden ${
        isEditMode
          ? 'border-purple-500/70 ring-1 ring-purple-400/30 animate-jiggle'
          : 'border-slate-700/50 hover:border-cyan-500/50'
      } ${isDragging ? 'z-50' : ''}`}
      data-testid={`widget-${widget.id}`}
      {...attributes}
    >
      {isEditMode && (
        <div 
          className="absolute inset-0 bg-transparent"
          style={{ pointerEvents: 'none', zIndex: 9998 }}
          data-testid={`widget-overlay-${widget.id}`}
        />
      )}

      {isEditMode && (
        <div className="absolute top-[0.6rem] left-[0.6rem] z-[10000] flex items-center gap-[0.4rem]">
          <div 
            className="p-[0.4rem] bg-cyan-600/90 hover:bg-cyan-500 slot-button cursor-grab active:cursor-grabbing transition-colors touch-none"
            title="Drag to move"
            style={{ pointerEvents: 'auto' }}
            data-testid={`grip-handle-${widget.id}`}
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
  handleOpenSidebarToContent: () => void;
  addWidget: (type: WidgetType, w?: number, h?: number, extraData?: Partial<Widget>) => string;
  isFullscreen: boolean;
  setIsFullscreen: Dispatch<SetStateAction<boolean>>;
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
  handleOpenSidebarToContent,
  addWidget,
  isFullscreen,
  setIsFullscreen
}: MasterControlDashboardProps) => {
  const [masterMute, setMasterMute] = useState(true);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  const minCellHeight = 80;

  // Hover detection for fullscreen mode - show header when mouse is in top 10px
  useEffect(() => {
    if (!isFullscreen) {
      setHeaderVisible(true);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 10) {
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

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const cellWidth = gridRect.width / GRID_COLS;
      const cellHeight = Math.max(minCellHeight, gridRect.height / GRID_ROWS);

      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      const colChange = Math.round(deltaX / cellWidth);
      const rowChange = Math.round(deltaY / cellHeight);

      const newW = Math.max(1, Math.min(GRID_COLS, resizing.startW + colChange));
      const newH = Math.max(1, Math.min(GRID_ROWS, resizing.startH + rowChange));

      setWidgets(prev => prev.map(w => 
        w.id === resizing.widgetId ? { ...w, w: newW, h: newH } : w
      ));
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

  const getYouTubeEmbedUrl = (videoId: string): string => {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&modestbranding=1&rel=0&enablejsapi=1&origin=${window.location.origin}`;
  };

  const getTwitchEmbedUrl = (channel: string): string => {
    const parentDomain = window.location.host.split(':')[0];
    return `https://player.twitch.tv/?channel=${channel}&parent=${parentDomain}&autoplay=true&muted=true`;
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
          return { ...w, url: '' };
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
          const twitchChannel = widget.twitchChannel;
          return prev.map(w => {
            if (w.id === widgetId) {
              if (w.isYouTube && videoId) {
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
        return { ...w, url: '' };
      }
      return w;
    }));

    setTimeout(() => {
      setWidgets(prev => prev.map(w => {
        if (w.type === 'video') {
          if (w.isYouTube && w.videoId) {
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

  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'video':
        if (widget.isYouTube && widget.videoId) {
          return (
            <iframe
              ref={(el) => { iframeRefs.current[widget.id] = el; }}
              src={getYouTubeEmbedUrl(widget.videoId)}
              className="w-full h-full"
              style={{ pointerEvents: 'none' }}
              title={`YouTube - ${widget.id}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          );
        } else if (widget.isTwitch && widget.twitchChannel) {
          return (
            <iframe
              ref={(el) => { iframeRefs.current[widget.id] = el; }}
              src={getTwitchEmbedUrl(widget.twitchChannel)}
              className="w-full h-full"
              style={{ pointerEvents: 'none' }}
              title={`Twitch - ${widget.id}`}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          );
        } else if (widget.url) {
          return (
            <iframe
              src={widget.url}
              className="w-full h-full"
              style={{ pointerEvents: 'none' }}
              title={widget.id}
              allow="autoplay; encrypted-media"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center">
            <button
              onClick={() => handleOpenSidebar(widget.id)}
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

      {/* 15px hover zone at top-center with opacity-based Exit Fullscreen button */}
      {isFullscreen && !headerVisible && (
        <div 
          className="fixed top-0 left-1/2 -translate-x-1/2 w-[20rem] h-[15px] z-[10001] group"
          onMouseEnter={() => setHeaderVisible(true)}
          data-testid="hover-zone-top"
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-[0.5rem] left-1/2 -translate-x-1/2 px-[1.2rem] py-[0.5rem] bg-slate-800/90 hover:bg-slate-700 backdrop-blur-md slot-button flex items-center gap-[0.5rem] text-[1rem] text-slate-300 hover:text-white shadow-lg border border-slate-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            title="Exit Fullscreen"
            data-testid="button-exit-fullscreen-floating"
          >
            <X className="w-[1.2rem] h-[1.2rem]" />
            <span>Exit Fullscreen</span>
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
              onClick={() => setIsFullscreen(!isFullscreen)}
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
            <button
              onClick={handleOpenSidebarToContent}
              className="px-[1.2rem] py-[0.6rem] bg-emerald-600 hover:bg-emerald-500 slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-900/50 text-[1.2rem]"
              data-testid="button-add-block"
            >
              <Plus className="w-[1.4rem] h-[1.4rem]" />
              Add Block
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
        <div 
          ref={gridRef}
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
            {widget.type === 'video' && (widget.url || widget.videoId || widget.twitchChannel) && !isEditMode && (
              <div className="absolute top-[0.6rem] right-[0.6rem] z-20 flex gap-[0.3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => toggleWidgetMute(widget.id)}
                  className={`p-[0.5rem] slot-button transition-all duration-300 backdrop-blur-sm ${
                    widget.isMuted 
                      ? 'bg-red-600/90 hover:bg-red-500' 
                      : 'bg-emerald-600/90 hover:bg-emerald-500'
                  }`}
                  title={widget.isMuted ? 'Unmute' : 'Mute'}
                  data-testid={`button-mute-${widget.id}`}
                >
                  {widget.isMuted ? <VolumeX className="w-[1rem] h-[1rem]" /> : <Volume2 className="w-[1rem] h-[1rem]" />}
                </button>
                
                <button
                  onClick={() => toggleWidgetPause(widget.id)}
                  className={`p-[0.5rem] slot-button transition-all duration-300 backdrop-blur-sm ${
                    widget.isPaused 
                      ? 'bg-yellow-600/90 hover:bg-yellow-500' 
                      : 'bg-blue-600/90 hover:bg-blue-500'
                  }`}
                  title={widget.isPaused ? 'Play' : 'Pause'}
                  data-testid={`button-pause-${widget.id}`}
                >
                  {widget.isPaused ? <Play className="w-[1rem] h-[1rem]" /> : <Pause className="w-[1rem] h-[1rem]" />}
                </button>
                
                <button
                  onClick={() => handleRefreshWidget(widget.id)}
                  className="p-[0.5rem] slot-button transition-all duration-300 backdrop-blur-sm bg-cyan-600/90 hover:bg-cyan-500"
                  title="Refresh stream"
                  data-testid={`button-refresh-${widget.id}`}
                >
                  <RefreshCw className="w-[1rem] h-[1rem]" />
                </button>
                
                <button
                  onClick={() => handleRemoveWidget(widget.id)}
                  className="p-[0.5rem] slot-button transition-all duration-300 backdrop-blur-sm bg-red-600/90 hover:bg-red-500"
                  title="Delete widget"
                  data-testid={`button-delete-${widget.id}`}
                >
                  <Trash2 className="w-[1rem] h-[1rem]" />
                </button>
              </div>
            )}

            {isEditMode && (
              <div 
                className="absolute top-[0.6rem] right-[0.6rem] z-40 flex gap-[0.3rem]"
                style={{ pointerEvents: 'auto' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleOpenSidebar(widget.id);
                  }}
                  className="p-[0.5rem] bg-cyan-600/90 hover:bg-cyan-500 slot-button transition-all duration-300 backdrop-blur-sm"
                  title="Edit widget content"
                  data-testid={`button-edit-${widget.id}`}
                >
                  <Settings className="w-[1rem] h-[1rem]" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemoveWidget(widget.id);
                  }}
                  className="p-[0.5rem] bg-red-600/90 hover:bg-red-500 slot-button transition-all duration-300 backdrop-blur-sm"
                  title="Remove widget"
                  data-testid={`button-remove-${widget.id}`}
                >
                  <Trash2 className="w-[1rem] h-[1rem]" />
                </button>
              </div>
            )}

            <div className="w-full h-full">
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
