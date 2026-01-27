import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Plus, Save, Power, AlertCircle, X, ExternalLink } from 'lucide-react';

interface Slot {
  id: number;
  url: string;
  isActive: boolean;
  isMuted: boolean;
  error: string | null;
  isYouTube: boolean;
  videoId: string | null;
}

interface YTPlayer {
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: {
        videoId: string;
        playerVars: {
          autoplay: number;
          controls: number;
          modestbranding: number;
          rel: number;
        };
        events: {
          onReady: (event: { target: { mute: () => void; unMute: () => void } }) => void;
        };
      }) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

const MasterControlDashboard = () => {
  const [slots, setSlots] = useState<Slot[]>(() => {
    const saved = localStorage.getItem('controlDashboard');
    return saved ? JSON.parse(saved) : Array(12).fill(null).map((_, i) => ({
      id: i,
      url: '',
      isActive: false,
      isMuted: true,
      error: null,
      isYouTube: false,
      videoId: null
    }));
  });
  
  const [masterMute, setMasterMute] = useState(true);
  const [inputIndex, setInputIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const playerRefs = useRef<Record<number, YTPlayer | null>>({});

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube API Ready');
    };
  }, []);

  useEffect(() => {
    slots.forEach(slot => {
      if (slot.isActive && slot.isYouTube && slot.videoId && !playerRefs.current[slot.id]) {
        const videoId = slot.videoId;
        setTimeout(() => {
          if (window.YT && window.YT.Player && videoId) {
            try {
              playerRefs.current[slot.id] = new window.YT.Player(`youtube-player-${slot.id}`, {
                videoId: videoId,
                playerVars: {
                  autoplay: 1,
                  controls: 1,
                  modestbranding: 1,
                  rel: 0
                },
                events: {
                  onReady: (event) => {
                    if (slot.isMuted || masterMute) {
                      event.target.mute();
                    } else {
                      event.target.unMute();
                    }
                  }
                }
              });
            } catch (error) {
              console.error('YouTube player initialization error:', error);
            }
          }
        }, 100);
      }
    });
  }, [slots, masterMute]);

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

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
        error: null
      } : slot
    ));

    setInputIndex(null);
    setInputValue('');
  };

  const handleRemoveSlot = (index: number) => {
    if (playerRefs.current[index]) {
      try {
        playerRefs.current[index]?.destroy();
        delete playerRefs.current[index];
      } catch (error) {
        console.error('Error destroying player:', error);
      }
    }

    setSlots(prev => prev.map((slot, i) => 
      i === index ? {
        ...slot,
        url: '',
        isActive: false,
        isMuted: true,
        error: null,
        isYouTube: false,
        videoId: null
      } : slot
    ));
  };

  const toggleSlotMute = (index: number) => {
    const slot = slots[index];
    
    if (slot.isYouTube && playerRefs.current[index]) {
      try {
        const player = playerRefs.current[index];
        if (slot.isMuted) {
          player?.unMute();
        } else {
          player?.mute();
        }
      } catch (error) {
        console.error('Error toggling YouTube mute:', error);
      }
    }

    setSlots(prev => prev.map((s, i) => 
      i === index ? { ...s, isMuted: !s.isMuted } : s
    ));
  };

  const handleMasterMute = () => {
    const newMuteState = !masterMute;
    setMasterMute(newMuteState);

    slots.forEach((slot, index) => {
      if (slot.isActive && slot.isYouTube && playerRefs.current[index]) {
        try {
          const player = playerRefs.current[index];
          if (newMuteState) {
            player?.mute();
          } else {
            if (!slot.isMuted) {
              player?.unMute();
            }
          }
        } catch (error) {
          console.error('Error applying master mute:', error);
        }
      }
    });
  };

  const handleSaveLayout = () => {
    localStorage.setItem('controlDashboard', JSON.stringify(slots));
    
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
        error: 'This site cannot be embedded due to X-Frame-Options policy. Try a different URL or use a proxy service.'
      } : slot
    ));
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 font-mono flex flex-col">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 mb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Power className="w-6 h-6 text-cyan-400 animate-pulse" data-testid="icon-power" />
              <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50"></div>
            </div>
            <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent" data-testid="text-title">
              MASTER CONTROL
            </h1>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleMasterMute}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 transform hover:scale-105 text-sm ${
                masterMute 
                  ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/50' 
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/50'
              }`}
              data-testid="button-master-mute"
            >
              {masterMute ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {masterMute ? 'MUTED' : 'LIVE'}
            </button>
            
            <button
              id="save-button"
              onClick={handleSaveLayout}
              className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-900/50 text-sm"
              data-testid="button-save-layout"
            >
              <Save className="w-4 h-4" />
              SAVE
            </button>
          </div>
        </div>
        
        <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full"></div>
      </div>

      <div className="relative z-10 grid grid-cols-4 gap-2 flex-1 min-h-0">
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            className="relative bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700/50 overflow-hidden group hover:border-cyan-500/50 transition-all duration-300 shadow-xl"
            data-testid={`slot-container-${index}`}
          >
            <div className="absolute top-1 left-1 z-20 bg-slate-800/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-cyan-400 border border-cyan-500/30" data-testid={`text-slot-number-${index}`}>
              {index + 1}
            </div>

            {slot.isActive && (
              <div className="absolute top-1 right-1 z-20 flex gap-1">
                {!slot.isYouTube && slot.url && (
                  <a
                    href={slot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 bg-blue-600/90 hover:bg-blue-500 rounded transition-all duration-300 backdrop-blur-sm"
                    title="Open in new tab"
                    data-testid={`button-link-${index}`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
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
                  className="flex flex-col items-center gap-1 p-2 hover:bg-slate-800/50 rounded-lg transition-all duration-300 group/btn"
                  data-testid={`button-add-source-${index}`}
                >
                  <div className="relative">
                    <Plus className="w-8 h-8 text-cyan-400 group-hover/btn:scale-110 transition-transform" />
                    <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-0 group-hover/btn:opacity-50 transition-opacity"></div>
                  </div>
                  <span className="text-xs text-slate-400 group-hover/btn:text-cyan-400 transition-colors">
                    ADD
                  </span>
                </button>
              )}

              {inputIndex === index && (
                <div className="absolute inset-0 flex items-center justify-center p-3 bg-slate-900/95 backdrop-blur-sm z-30">
                  <div className="w-full max-w-xs">
                    <label className="block text-xs font-semibold mb-1 text-cyan-400">
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
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded focus:border-cyan-500 focus:outline-none transition-colors text-xs"
                      autoFocus
                      data-testid={`input-url-${index}`}
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSubmitUrl(index);
                        }}
                        className="flex-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold transition-colors text-xs"
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
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded font-semibold transition-colors text-xs"
                        data-testid={`button-cancel-${index}`}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {slot.isActive && !slot.error && (
                <div className="w-full h-full">
                  {slot.isYouTube ? (
                    <div id={`youtube-player-${slot.id}`} className="w-full h-full"></div>
                  ) : (
                    <iframe
                      src={slot.url}
                      className="w-full h-full"
                      title={`Slot ${index + 1}`}
                      allow="autoplay; encrypted-media"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      onError={() => handleIframeError(index)}
                    />
                  )}
                </div>
              )}

              {slot.error && (
                <div className="absolute inset-0 flex items-center justify-center p-3 bg-slate-900/95 backdrop-blur-sm">
                  <div className="max-w-xs text-center">
                    <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 mb-2" data-testid={`text-error-${index}`}>{slot.error}</p>
                    <div className="flex gap-1 justify-center">
                      {slot.url && (
                        <a
                          href={slot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded font-semibold transition-colors text-xs flex items-center gap-1"
                          data-testid={`button-open-link-${index}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          OPEN
                        </a>
                      )}
                      <button
                        onClick={() => handleRemoveSlot(index)}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded font-semibold transition-colors text-xs"
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

      <div className="relative z-10 mt-2 text-center text-[10px] text-slate-500 flex-shrink-0" data-testid="text-status">
        <p>OPERATIONAL | Active: {slots.filter(s => s.isActive).length}/12</p>
      </div>
    </div>
  );
};

export default MasterControlDashboard;
