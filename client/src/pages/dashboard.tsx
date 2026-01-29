import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, AlertCircle, X, ExternalLink, ChevronDown, Pause, Play, Edit3, Lock, RefreshCw, GripVertical, FileText, Square, Image as ImageIcon, Trash2, Settings } from 'lucide-react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Widget, WidgetType } from '@/App';

interface MasterControlDashboardProps {
  widgets: Widget[];
  setWidgets: Dispatch<SetStateAction<Widget[]>>;
  gridCols: number;
  setGridCols: Dispatch<SetStateAction<number>>;
  isEditMode: boolean;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;
  sidebarOpen: boolean;
  activeId: UniqueIdentifier | null;
  handleOpenSidebar: (widgetId?: string) => void;
  addWidget: (type: WidgetType, spanCols?: number, spanRows?: number, extraData?: Partial<Widget>) => string;
}

interface ResizeState {
  widgetId: string;
  startX: number;
  startY: number;
  startCols: number;
  startRows: number;
}

const MasterControlDashboard = ({
  widgets,
  setWidgets,
  gridCols,
  setGridCols,
  isEditMode,
  setIsEditMode,
  sidebarOpen,
  activeId,
  handleOpenSidebar,
  addWidget
}: MasterControlDashboardProps) => {
  const [masterMute, setMasterMute] = useState(true);
  const [showGridDropdown, setShowGridDropdown] = useState(false);
  const [showLegalPopup, setShowLegalPopup] = useState(false);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowGridDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const gridRows = 4;
  const minCellHeight = 120;

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const cellWidth = gridRect.width / gridCols;
      const cellHeight = Math.max(minCellHeight, gridRect.height / gridRows);

      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      const colChange = Math.round(deltaX / cellWidth);
      const rowChange = Math.round(deltaY / cellHeight);

      const newCols = Math.max(1, Math.min(gridCols, resizing.startCols + colChange));
      const newRows = Math.max(1, Math.min(gridRows, resizing.startRows + rowChange));

      setWidgets(prev => prev.map(w => 
        w.id === resizing.widgetId ? { ...w, spanCols: newCols, spanRows: newRows } : w
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
  }, [resizing, gridCols, setWidgets]);

  const getYouTubeEmbedUrl = (videoId: string): string => {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&modestbranding=1&rel=0&enablejsapi=1&origin=${window.location.origin}`;
  };

  const getTwitchEmbedUrl = (channel: string): string => {
    const parentDomain = window.location.hostname;
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
    localStorage.setItem('bentoWidgets', JSON.stringify(widgets));
    localStorage.setItem('bentoGridCols', gridCols.toString());
    
    const saveButton = document.getElementById('save-button');
    if (saveButton) {
      saveButton.classList.add('ring-2', 'ring-cyan-400', 'scale-110');
      setTimeout(() => {
        saveButton.classList.remove('ring-2', 'ring-cyan-400', 'scale-110');
      }, 300);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, widgetId: string, currentCols: number, currentRows: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      widgetId,
      startX: e.clientX,
      startY: e.clientY,
      startCols: currentCols,
      startRows: currentRows
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
            <span className="text-[1rem] text-slate-400 bg-slate-800/50 px-[0.8rem] py-[0.3rem] rounded-full">
              {widgets.length} widgets
            </span>
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
                data-testid="button-grid-cols"
              >
                {gridCols} Columns
                <ChevronDown className={`w-[1.2rem] h-[1.2rem] transition-transform ${showGridDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showGridDropdown && (
                <div className="absolute top-full mt-[0.4rem] right-0 bg-slate-800 border border-slate-600 shadow-xl z-50 min-w-[12rem]" style={{ borderRadius: 'var(--inner-radius)' }} data-testid="dropdown-grid-options">
                  {[2, 3, 4, 5, 6].map((cols) => (
                    <button
                      key={cols}
                      onClick={() => { setGridCols(cols); setShowGridDropdown(false); }}
                      className={`w-full px-[1.2rem] py-[0.8rem] text-left text-[1.2rem] hover:bg-slate-700 transition-colors first:rounded-t-[var(--inner-radius)] last:rounded-b-[var(--inner-radius)] flex items-center justify-between ${
                        gridCols === cols ? 'bg-purple-600/50 text-cyan-400' : 'text-slate-300'
                      }`}
                      data-testid={`grid-option-${cols}`}
                    >
                      {cols} Columns
                      {gridCols === cols && <span className="text-cyan-400">✓</span>}
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
        ref={gridRef}
        className="relative z-10 flex-1 grid gap-[1rem]"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridAutoRows: '1fr',
          gridAutoFlow: 'dense'
        }}
        data-testid="widget-grid"
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className={`dashboard-slot relative bg-slate-900/50 backdrop-blur-sm border group transition-all duration-300 shadow-xl overflow-hidden ${
              isEditMode
                ? 'border-purple-500/70 ring-1 ring-purple-400/30 animate-jiggle'
                : 'border-slate-700/50 hover:border-cyan-500/50'
            }`}
            style={{
              gridColumn: `span ${Math.min(widget.spanCols, gridCols)}`,
              gridRow: `span ${widget.spanRows}`
            }}
            data-testid={`widget-${widget.id}`}
          >
            {isEditMode && (
              <div 
                className="absolute inset-0 z-30 bg-transparent cursor-move"
                style={{ pointerEvents: 'auto' }}
                data-testid={`widget-overlay-${widget.id}`}
              />
            )}

            <div className="absolute top-[0.6rem] left-[0.6rem] z-20 flex items-center gap-[0.4rem]">
              <span className="bg-slate-800/90 backdrop-blur-sm px-[0.5rem] py-[0.2rem] slot-button text-[0.8rem] font-bold text-cyan-400 border border-cyan-500/30">
                {widget.spanCols}x{widget.spanRows}
              </span>
              {widget.type !== 'video' && (
                <span className="bg-slate-800/90 backdrop-blur-sm px-[0.5rem] py-[0.2rem] slot-button text-[0.8rem] font-medium text-purple-400 border border-purple-500/30 capitalize">
                  {widget.type}
                </span>
              )}
            </div>

            {widget.type === 'video' && widget.url && (
              <div className="absolute top-[0.6rem] right-[0.6rem] z-20 flex gap-[0.3rem]">
                {(widget.isYouTube || widget.isTwitch) && (
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
                )}
                
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
                  onClick={() => handleRefreshWidget(widget.id)}
                  className="p-[0.5rem] slot-button transition-all duration-300 backdrop-blur-sm bg-cyan-600/90 hover:bg-cyan-500"
                  title="Refresh stream"
                  data-testid={`button-refresh-${widget.id}`}
                >
                  <RefreshCw className="w-[1rem] h-[1rem]" />
                </button>
              </div>
            )}

            {isEditMode && (
              <div className="absolute top-[0.6rem] right-[0.6rem] z-40 flex gap-[0.3rem]">
                <button
                  onClick={() => handleOpenSidebar(widget.id)}
                  className="p-[0.5rem] bg-cyan-600/90 hover:bg-cyan-500 slot-button transition-all duration-300 backdrop-blur-sm"
                  title="Edit widget content"
                  data-testid={`button-edit-${widget.id}`}
                >
                  <Settings className="w-[1rem] h-[1rem]" />
                </button>
                <button
                  onClick={() => handleRemoveWidget(widget.id)}
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
                onMouseDown={(e) => handleResizeStart(e, widget.id, widget.spanCols, widget.spanRows)}
                className="absolute bottom-0 right-0 w-[2.4rem] h-[2.4rem] cursor-se-resize z-50 flex items-center justify-center bg-purple-600/80 hover:bg-purple-500 transition-colors"
                style={{ 
                  borderTopLeftRadius: 'var(--inner-radius)',
                  pointerEvents: 'auto'
                }}
                title="Drag to resize"
                data-testid={`resize-handle-${widget.id}`}
              >
                <GripVertical className="w-[1.2rem] h-[1.2rem] text-white rotate-[-45deg]" />
              </div>
            )}
          </div>
        ))}

        {isEditMode && (
          <button
            onClick={() => handleOpenSidebar()}
            className="dashboard-slot flex items-center justify-center bg-slate-900/30 backdrop-blur-sm border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 hover:bg-slate-800/30 transition-all duration-300 cursor-pointer group min-h-[12rem]"
            data-testid="button-add-widget"
          >
            <div className="flex flex-col items-center gap-[0.8rem] text-cyan-400/60 group-hover:text-cyan-400 transition-colors">
              <Plus className="w-[3rem] h-[3rem]" />
              <span className="text-[1.2rem] font-semibold">Add Widget</span>
            </div>
          </button>
        )}

        {widgets.length === 0 && !isEditMode && (
          <div className="col-span-full flex flex-col items-center justify-center h-[40vh] text-slate-400">
            <Power className="w-[4rem] h-[4rem] mb-[1.5rem] text-cyan-400/40" />
            <h2 className="text-[1.8rem] font-bold mb-[0.8rem]">No Widgets Yet</h2>
            <p className="text-[1.2rem] mb-[1.5rem]">Click "Edit Layout" to add widgets to your dashboard</p>
            <button
              onClick={() => setIsEditMode(true)}
              className="px-[1.6rem] py-[0.8rem] bg-purple-600 hover:bg-purple-500 slot-button font-semibold text-[1.2rem] transition-all"
              data-testid="button-start-editing"
            >
              Start Editing
            </button>
          </div>
        )}
      </div>

      <div className="relative z-30 mt-[1rem] flex-shrink-0 pt-[1rem] border-t border-slate-700/50">
        <div className="flex items-center justify-between text-[1rem] text-slate-500">
          <div className="flex items-center gap-[0.6rem]">
            <span>© 2024 Master Control Dashboard</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setShowLegalPopup(true)}
              className="hover:text-cyan-400 transition-colors underline"
              data-testid="button-legal"
            >
              Legal
            </button>
          </div>
          <div className="flex items-center gap-[0.6rem]">
            <div className="w-[0.6rem] h-[0.6rem] rounded-full bg-emerald-400 animate-pulse"></div>
            <span>System Online</span>
          </div>
        </div>
      </div>

      {showLegalPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowLegalPopup(false)}>
          <div className="bg-slate-900 border border-slate-700 p-[2rem] max-w-[48rem] mx-[1.6rem]" style={{ borderRadius: 'var(--outer-radius)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-[1.2rem]">
              <h3 className="text-[1.6rem] font-bold text-cyan-400">Legal Disclaimer</h3>
              <button onClick={() => setShowLegalPopup(false)} className="p-[0.4rem] hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-[1.6rem] h-[1.6rem] text-slate-400" />
              </button>
            </div>
            <div className="text-[1.2rem] text-slate-300 space-y-[1rem]">
              <p>This dashboard is provided for educational and personal use only. The embedded content is sourced from third-party platforms and remains the property of their respective owners.</p>
              <p>Some websites may restrict embedding due to their security policies. In such cases, use the "Open in new tab" feature to view the content directly.</p>
              <p>By using this dashboard, you acknowledge that you are responsible for complying with the terms of service of any embedded content providers.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterControlDashboard;
