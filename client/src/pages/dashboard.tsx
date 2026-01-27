import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, AlertCircle, X, ExternalLink, ChevronDown, Scale, Pause, Play } from 'lucide-react';

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

const MasterControlDashboard = () => {
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

  const getCorsProxyUrl = (url: string): string => {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
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

    setSlots(prev => prev.map((slot, i) => 
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
    ));
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

  const handleGridSelect = (value: GridDensity) => {
    setGridDensity(value);
    setShowGridDropdown(false);
  };

  const gridOption = getCurrentGridOption();

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 font-mono flex flex-col">
      <div className="fixed inset-0 opacity-30 pointer-events-none z-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-30 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Power className="w-5 h-5 text-cyan-400 animate-pulse" data-testid="icon-power" />
              <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50 pointer-events-none"></div>
            </div>
            <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent" data-testid="text-title">
              MASTER CONTROL
            </h1>
          </div>
          
          <div className="flex gap-2 items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowGridDropdown(!showGridDropdown)}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg shadow-purple-900/50 text-xs"
                data-testid="button-grid-density"
              >
                Grid Density
                <ChevronDown className={`w-3 h-3 transition-transform ${showGridDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showGridDropdown && (
                <div className="absolute top-full mt-1 right-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-[9999] min-w-[160px]" data-testid="dropdown-grid-options">
                  {GRID_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleGridSelect(option.value)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
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
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-300 transform hover:scale-105 text-xs ${
                masterMute 
                  ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/50' 
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/50'
              }`}
              data-testid="button-master-mute"
            >
              {masterMute ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {masterMute ? 'MUTED' : 'LIVE'}
            </button>
            
            <button
              id="save-button"
              onClick={handleSaveLayout}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-900/50 text-xs"
              data-testid="button-save-layout"
            >
              <Save className="w-3.5 h-3.5" />
              SAVE
            </button>
          </div>
        </div>
        
        <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full"></div>
      </div>

      <div 
        className="relative z-10 grid gap-1.5 overflow-hidden"
        style={{
          height: 'calc(100vh - 64px)',
          gridTemplateColumns: `repeat(${gridOption.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(4, 1fr)`
        }}
      >
        {visibleSlots.map((slot, index) => (
          <div
            key={slot.id}
            className="relative bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700/50 overflow-hidden group hover:border-cyan-500/50 transition-all duration-300 shadow-xl"
            data-testid={`slot-container-${index}`}
          >
            <div className="absolute top-1 left-1 z-20 bg-slate-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-cyan-400 border border-cyan-500/30" data-testid={`text-slot-number-${index}`}>
              {index + 1}
            </div>

            {slot.isActive && (
              <div className="absolute top-1 right-1 z-20 flex gap-0.5">
                {slot.isYouTube && (
                  <button
                    onClick={() => toggleSlotPause(index)}
                    className={`p-1 rounded transition-all duration-300 backdrop-blur-sm ${
                      slot.isPaused 
                        ? 'bg-yellow-600/90 hover:bg-yellow-500' 
                        : 'bg-blue-600/90 hover:bg-blue-500'
                    }`}
                    title={slot.isPaused ? 'Play' : 'Pause'}
                    data-testid={`button-pause-${index}`}
                  >
                    {slot.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  </button>
                )}
                
                <button
                  onClick={() => toggleSlotMute(index)}
                  className={`p-1 rounded transition-all duration-300 backdrop-blur-sm ${
                    slot.isMuted 
                      ? 'bg-red-600/90 hover:bg-red-500' 
                      : 'bg-emerald-600/90 hover:bg-emerald-500'
                  }`}
                  title={slot.isMuted ? 'Unmute' : 'Mute'}
                  data-testid={`button-mute-${index}`}
                >
                  {slot.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                
                {!slot.isYouTube && slot.url && (
                  <a
                    href={slot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded transition-all duration-300 backdrop-blur-sm bg-blue-600/90 hover:bg-blue-500"
                    title="Open in new tab"
                    data-testid={`button-link-${index}`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                
                <button
                  onClick={() => handleRemoveSlot(index)}
                  className="p-1 bg-slate-800/90 hover:bg-slate-700 rounded transition-all duration-300 backdrop-blur-sm"
                  title="Remove"
                  data-testid={`button-remove-${index}`}
                >
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            )}

            <div className="w-full h-full flex items-center justify-center">
              {!slot.isActive && inputIndex !== index && (
                <button
                  onClick={() => handleAddUrl(index)}
                  className="flex flex-col items-center gap-0.5 p-1 hover:bg-slate-800/50 rounded-lg transition-all duration-300 group/btn"
                  data-testid={`button-add-source-${index}`}
                >
                  <Plus className="w-6 h-6 text-cyan-400 group-hover/btn:scale-110 transition-transform" />
                  <span className="text-[10px] text-slate-400 group-hover/btn:text-cyan-400 transition-colors">
                    ADD
                  </span>
                </button>
              )}

              {inputIndex === index && (
                <div className="absolute inset-0 flex items-center justify-center p-2 bg-slate-900/95 backdrop-blur-sm z-[9999]">
                  <div className="w-full max-w-xs">
                    <label className="block text-[10px] font-semibold mb-1 text-cyan-400">
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
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded focus:border-cyan-500 focus:outline-none transition-colors text-[10px]"
                      autoFocus
                      data-testid={`input-url-${index}`}
                    />
                    <div className="flex gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSubmitUrl(index);
                        }}
                        className="flex-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold transition-colors text-[10px]"
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
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded font-semibold transition-colors text-[10px]"
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
                        src={getCorsProxyUrl(slot.url)}
                        className="w-full h-full"
                        title={`Slot ${index + 1}`}
                        allow="autoplay; encrypted-media"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        onError={() => handleIframeError(index)}
                        onLoad={() => startIframeBlockDetection(index)}
                      />
                      {slot.embedBlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
                          <div className="text-center p-4 max-w-xs">
                            <AlertCircle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-200 mb-1">Embedding Restricted</p>
                            <p className="text-[10px] text-slate-400 mb-3">
                              Sites like Twitter, Discord, and others require their official embed codes. Standard iframes are blocked for security.
                            </p>
                            <a
                              href={slot.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-semibold transition-colors text-sm inline-flex items-center gap-2"
                              data-testid={`button-open-widget-${index}`}
                            >
                              <ExternalLink className="w-4 h-4" />
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
                <div className="absolute inset-0 flex items-center justify-center p-2 bg-slate-900/95 backdrop-blur-sm">
                  <div className="max-w-xs text-center">
                    <AlertCircle className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-300 mb-2" data-testid={`text-error-${index}`}>{slot.error}</p>
                    <div className="flex gap-1 justify-center">
                      {slot.url && (
                        <a
                          href={slot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded font-semibold transition-colors text-[10px] flex items-center gap-1"
                          data-testid={`button-open-link-${index}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open in New Window
                        </a>
                      )}
                      <button
                        onClick={() => handleRemoveSlot(index)}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded font-semibold transition-colors text-[10px]"
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
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-2 flex-shrink-0 flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-800 pt-2">
        <p data-testid="text-footer-copyright">© 2026 Master Control. Independent tool for content aggregation.</p>
        <div className="flex items-center gap-3">
          <span data-testid="text-status">Active: {slots.filter(s => s.isActive).length}/16</span>
          <button
            onClick={() => setShowLegalPopup(true)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
            data-testid="button-legal"
          >
            <Scale className="w-3 h-3" />
            Legal
          </button>
        </div>
      </div>

      {showLegalPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="modal-legal">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Legal Disclaimer
              </h2>
              <button
                onClick={() => setShowLegalPopup(false)}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
                data-testid="button-close-legal"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed" data-testid="text-legal-content">
              This application is a productivity tool for aggregating public web content. It is not affiliated with or endorsed by the third-party services displayed. Users are responsible for complying with the Terms of Service of all embedded sites.
            </p>
            <button
              onClick={() => setShowLegalPopup(false)}
              className="mt-4 w-full py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg font-semibold text-sm transition-colors"
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
