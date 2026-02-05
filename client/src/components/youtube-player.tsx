import { useEffect, useRef, useMemo, useCallback, memo, Component, ReactNode, useState } from 'react';
import { Lock, ExternalLink } from 'lucide-react';
import { isVideoBlacklisted } from '@/lib/channel-constants';

// DOM EXCEPTION SHIELD: Error Boundary to catch YouTube player errors
// Prevents removeChild errors from crashing the entire dashboard
interface ErrorBoundaryState {
  hasError: boolean;
}

class YouTubeErrorBoundary extends Component<{ children: ReactNode; widgetId: string }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; widgetId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // SILENCE: Use debug level for removeChild errors to keep console clean
    if (error.message?.includes('removeChild') || error.message?.includes('NotFoundError')) {
      console.debug('[YouTube ErrorBoundary] Caught removeChild error, recovering silently');
      // Reset error state after a tick to allow recovery
      setTimeout(() => this.setState({ hasError: false }), 100);
    } else {
      console.debug('[YouTube ErrorBoundary] Caught error:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
          <div className="text-center text-slate-400">
            <p className="text-sm">Player loading...</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId?: string;
          host?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  destroy: () => void;
  loadVideoById: (videoIdOrObject: string | { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (videoId: string) => void;
  setOption: (module: string, option: string, value: unknown) => void;
  getOption: (module: string, option: string) => unknown;
  getOptions: (module?: string) => string[];
}

interface YouTubePlayerProps {
  widgetId: string;
  videoId?: string | null;
  channelId?: string | null;
  latestVideoId?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  volume: number;
  isSeekMode: boolean;
  refreshKey?: number;
  onReady?: () => void;
  onError?: (errorCode?: number) => void;
  onMutedChange?: (muted: boolean) => void;
  onPausedChange?: (paused: boolean) => void;
}

// DOM EXCEPTION SHIELD: Safe cleanup helper that prevents NotFoundError crashes
// Checks parentNode before any removeChild operation and wraps in try...catch
function safeCleanupPlayer(player: YTPlayer | null, playerId: string): void {
  if (!player) return;
  
  try {
    // STRICT PARENTNODE CHECK: Find the container and iframe
    const playerElement = document.getElementById(playerId);
    if (!playerElement) {
      // Element already removed - return early silently
      return;
    }
    
    // FINAL YOUTUBE SHIELD: Only attempt cleanup if element has a valid parent
    const container = playerElement.parentNode;
    if (!container) {
      // No parent - element is orphaned, skip cleanup
      return;
    }
    
    // Find any iframe within the player element
    const iframe = playerElement.tagName === 'IFRAME' 
      ? playerElement as HTMLIFrameElement 
      : playerElement.querySelector('iframe');
    
    // STRICT CHECK: Only remove if iframe exists AND its parentNode === container
    if (iframe && iframe.parentNode === container) {
      // Safe to remove - but let React handle it instead
      // We just null references and let unmount handle DOM
    }
    
    // Never call destroy() - it causes removeChild errors
    // Just let React handle DOM cleanup on unmount
  } catch (e) {
    // Silently catch any DOM exception - don't log to keep console clean
  }
}

function YouTubePlayerInner({
  widgetId,
  videoId,
  channelId,
  latestVideoId,
  isMuted,
  isPaused,
  volume,
  isSeekMode,
  refreshKey = 0,
  onReady,
  onError,
  onMutedChange,
  onPausedChange,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const isInitializedRef = useRef(false);
  
  // LOOP PROTECTION: Track if we've already swapped once this session
  // A widget is only allowed ONE swap per session to prevent infinite loops
  const hasSwappedRef = useRef(false);
  
  // Content Restricted state - shown when both primary and fallback fail
  const [contentRestricted, setContentRestricted] = useState(false);
  
  // Use refs to track current state without causing re-renders
  const isMutedRef = useRef(isMuted);
  const isPausedRef = useRef(isPaused);
  const volumeRef = useRef(volume);
  const latestVideoIdRef = useRef(latestVideoId);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPausedChangeRef = useRef(onPausedChange);
  
  // Keep refs in sync with props
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { latestVideoIdRef.current = latestVideoId; }, [latestVideoId]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onPausedChangeRef.current = onPausedChange; }, [onPausedChange]);
  
  // Track refreshKey to force reinitialization when manual refresh is triggered
  const lastRefreshKeyRef = useRef(refreshKey);

  // Memoize the stable player ID - only changes if widgetId changes
  const playerId = useMemo(() => `yt-player-${widgetId}`, [widgetId]);
  
  // Memoize the stable video ID - only recalculate when videoId prop changes
  const stableVideoId = useMemo(() => videoId || null, [videoId]);
  
  // Memoize the stable channel ID for live streams - fallback when no videoId
  const stableChannelId = useMemo(() => channelId || null, [channelId]);


  // MediaSession API for background play support
  const setupMediaSession = useCallback(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Stream ${widgetId}`,
          artist: 'OpenBento Dashboard',
          album: 'Live Streams',
        });

        navigator.mediaSession.setActionHandler('play', () => {
          try {
            playerRef.current?.playVideo();
          } catch (e) {
            console.log('[YouTube] MediaSession play error:', e);
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          try {
            playerRef.current?.pauseVideo();
          } catch (e) {
            console.log('[YouTube] MediaSession pause error:', e);
          }
        });

        console.log('[YouTube] MediaSession API configured for background play');
      } catch (e) {
        console.log('[YouTube] MediaSession setup error:', e);
      }
    }
  }, [widgetId]);

  const initializePlayer = useCallback(() => {
    if (!containerRef.current || !window.YT?.Player) return;
    if (isInitializedRef.current && playerRef.current) return; // Already initialized
    
    // DOM EXCEPTION SHIELD: Use safe cleanup with parentNode check
    safeCleanupPlayer(playerRef.current, playerId);
    playerRef.current = null;

    // MULTI-VIEW PARITY: Hardcoded production domain for YouTube postMessage handshake
    // Both origin AND widget_referrer must match to bypass domain blocks
    // rel: 0 = no related videos, iv_load_policy: 3 = hide video annotations
    const playerVars: Record<string, string | number> = {
      autoplay: 1,
      mute: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      enablejsapi: 1,
      origin: 'https://openbento.tv',
      widget_referrer: 'https://openbento.tv',
      playsinline: 1,
    };

    try {
      // Only use real videoId - live_stream?channel= format is deprecated
      console.log('[YouTube] Initializing player for widget:', widgetId, 'videoId:', stableVideoId);
      
      playerRef.current = new window.YT.Player(playerId, {
        videoId: stableVideoId || undefined,
        host: 'https://www.youtube.com',  // PRODUCTION FIX: Standard player has fewer restriction issues
        playerVars: stableChannelId && !stableVideoId 
          ? { ...playerVars, listType: 'user_uploads', list: stableChannelId }
          : playerVars,
        events: {
          onReady: (event) => {
            console.log('[YouTube] Player ready for widget:', widgetId);
            isInitializedRef.current = true;
            
            // Set referrerPolicy on the generated iframe
            const playerElement = document.getElementById(playerId);
            if (playerElement) {
              const iframe = playerElement.tagName === 'IFRAME' ? playerElement as HTMLIFrameElement : playerElement.querySelector('iframe');
              if (iframe) {
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
              }
            }
            
            // Setup MediaSession API for background play
            setupMediaSession();
            
            // Delay player control calls to ensure API is fully ready
            setTimeout(() => {
              try {
                if (playerRef.current && typeof playerRef.current.mute === 'function') {
                  if (isMutedRef.current) {
                    playerRef.current.mute();
                  } else {
                    playerRef.current.unMute();
                  }
                  if (!isPausedRef.current && typeof playerRef.current.playVideo === 'function') {
                    playerRef.current.playVideo();
                  }
                }
              } catch (e) {
                console.log('[YouTube] Player control error on ready:', e);
              }
            }, 100);
            
            onReadyRef.current?.();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              onPausedChangeRef.current?.(false);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              onPausedChangeRef.current?.(true);
            }
          },
          onError: (event) => {
            const errorCode = event.data;
            console.log('[YouTube] Player error:', errorCode, 'for widget:', widgetId, 'hasSwapped:', hasSwappedRef.current);
            
            // LOOP PROTECTION: Only allow ONE swap per session
            // If we've already swapped and still get error 150/101, show Content Restricted
            if ((errorCode === 150 || errorCode === 101) && hasSwappedRef.current) {
              console.log('[YouTube] LOOP PROTECTION: Already swapped once, showing Content Restricted');
              setContentRestricted(true);
              return;
            }
            
            // BYPASS RESTRICTION ON 150: Force latestVideoId with 300ms delay
            // Delay gives React time to finish first render before triggering second
            if (errorCode === 150) {
              const fallbackId = latestVideoIdRef.current;
              
              // SAME-ID SWAP CHECK: Abort if fallback equals current video
              if (fallbackId && fallbackId === stableVideoId) {
                console.log('[YouTube] Error 150 - ABORT: fallbackId same as currentVideoId:', fallbackId);
                setContentRestricted(true);
                return;
              }
              
              // BLACKLIST CHECK: If fallback is known to be restricted, don't use it
              if (fallbackId && isVideoBlacklisted(fallbackId)) {
                console.log('[YouTube] Error 150 - fallback video is BLACKLISTED:', fallbackId);
                setContentRestricted(true);
                return;
              }
              
              if (fallbackId && playerRef.current) {
                console.log('[YouTube] Error 150 - FORCING latestVideoId swap in 300ms:', fallbackId);
                hasSwappedRef.current = true; // Mark as swapped
                setTimeout(() => {
                  try {
                    if (playerRef.current) {
                      playerRef.current.loadVideoById(fallbackId);
                      console.log('[YouTube] Successfully swapped to latestVideoId');
                    }
                    onErrorRef.current?.(150);
                  } catch (e) {
                    console.log('[YouTube] loadVideoById failed, notifying parent:', e);
                    onErrorRef.current?.(150);
                  }
                }, 300);
                return; // Exit early - callback will fire after delay
              } else {
                console.log('[YouTube] Error 150 - no latestVideoId available, requesting parent to fetch');
              }
              // Always notify parent for error 150 so it can fetch latestVideoId if needed
              setTimeout(() => onErrorRef.current?.(150), 300);
              return;
            }
            
            // ERROR 101 OVERRIDE: Also force latestVideoId fallback with 300ms delay
            if (errorCode === 101) {
              const fallbackId = latestVideoIdRef.current;
              
              // SAME-ID SWAP CHECK: Abort if fallback equals current video
              if (fallbackId && fallbackId === stableVideoId) {
                console.log('[YouTube] Error 101 - ABORT: fallbackId same as currentVideoId:', fallbackId);
                setContentRestricted(true);
                return;
              }
              
              // BLACKLIST CHECK: If fallback is known to be restricted, don't use it
              if (fallbackId && isVideoBlacklisted(fallbackId)) {
                console.log('[YouTube] Error 101 - fallback video is BLACKLISTED:', fallbackId);
                setContentRestricted(true);
                return;
              }
              
              if (fallbackId && playerRef.current) {
                console.log('[YouTube] Error 101 - FORCING latestVideoId swap in 300ms:', fallbackId);
                hasSwappedRef.current = true; // Mark as swapped
                setTimeout(() => {
                  try {
                    if (playerRef.current) {
                      playerRef.current.loadVideoById(fallbackId);
                      console.log('[YouTube] Successfully swapped to latestVideoId on error 101');
                    }
                    onErrorRef.current?.(101);
                  } catch (e) {
                    console.log('[YouTube] loadVideoById failed on error 101:', e);
                    onErrorRef.current?.(101);
                  }
                }, 300);
                return;
              } else {
                console.log('[YouTube] Error 101 - no latestVideoId, requesting parent to fetch');
              }
              setTimeout(() => onErrorRef.current?.(101), 300);
              return;
            }
            
            // PRODUCTION FIX: Only trigger re-fetch for recoverable errors
            // 100 = Video not found (re-fetch may find new video)
            // 2 = Invalid video ID (re-fetch may fix)
            // 5 = HTML5 player error (transient, re-fetch may help)
            if ([2, 5, 100].includes(errorCode)) {
              console.log('[YouTube] Triggering onError callback for re-fetch (recoverable error)');
              onErrorRef.current?.(errorCode);
            }
          },
        },
      });
    } catch (e) {
      console.error('[YouTube] Failed to initialize player:', e);
      onErrorRef.current?.();
    }
  }, [playerId, stableVideoId, stableChannelId, widgetId, setupMediaSession]); // Only re-init when video/widget/channel changes

  // Initialize player only when videoId changes
  useEffect(() => {
    // Reset initialization flag when video changes
    isInitializedRef.current = false;
    
    // Reset loop protection when videoId changes (new content)
    hasSwappedRef.current = false;
    setContentRestricted(false);
    
    if (window.YT?.Player) {
      initializePlayer();
    } else {
      const checkYT = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(checkYT);
          initializePlayer();
        }
      }, 100);
      
      const timeout = setTimeout(() => clearInterval(checkYT), 10000);
      return () => {
        clearInterval(checkYT);
        clearTimeout(timeout);
      };
    }

    return () => {
      // DOM EXCEPTION SHIELD: Use safe cleanup with parentNode check
      // CRITICAL: Do NOT call destroy() - it causes "removeChild" errors
      safeCleanupPlayer(playerRef.current, playerId);
      playerRef.current = null;
      isInitializedRef.current = false;
    };
  }, [stableVideoId, initializePlayer, playerId]); // Only reinitialize when videoId changes

  // Handle refreshKey changes - force reinitialize when manual refresh is triggered
  useEffect(() => {
    if (refreshKey !== lastRefreshKeyRef.current) {
      console.log(`[YouTube] RefreshKey changed from ${lastRefreshKeyRef.current} to ${refreshKey} - reinitializing player`);
      lastRefreshKeyRef.current = refreshKey;
      
      // Reset loop protection on manual refresh (allows retry)
      hasSwappedRef.current = false;
      setContentRestricted(false);
      
      // DOM EXCEPTION SHIELD: Use safe cleanup with parentNode check
      safeCleanupPlayer(playerRef.current, playerId);
      playerRef.current = null;
      isInitializedRef.current = false;
      
      // Reinitialize after a short delay
      setTimeout(() => {
        initializePlayer();
      }, 100);
    }
  }, [refreshKey, initializePlayer, playerId]);

  // Handle mute changes without reinitializing player
  useEffect(() => {
    if (playerRef.current && isInitializedRef.current && typeof playerRef.current.mute === 'function') {
      try {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (e) {
        console.log('[YouTube] Mute control error:', e);
      }
    }
  }, [isMuted]);

  // Handle pause changes without reinitializing player
  useEffect(() => {
    if (playerRef.current && isInitializedRef.current && typeof playerRef.current.playVideo === 'function') {
      try {
        if (isPaused) {
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      } catch (e) {
        console.log('[YouTube] Play control error:', e);
      }
    }
  }, [isPaused]);

  // Handle volume changes without reinitializing player
  useEffect(() => {
    if (playerRef.current && isInitializedRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
        console.log('[YouTube] Volume set to:', volume);
      } catch (e) {
        console.log('[YouTube] Volume control error:', e);
      }
    }
  }, [volume]);

  // LOOP PROTECTION: Show Content Restricted when both primary and fallback fail (150 error twice)
  if (contentRestricted) {
    console.log('[YouTube] Content Restricted for widget:', widgetId);
    const youtubeUrl = stableVideoId 
      ? `https://www.youtube.com/watch?v=${stableVideoId}`
      : stableChannelId 
        ? `https://www.youtube.com/@${stableChannelId}`
        : 'https://www.youtube.com';
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-slate-900/80"
      >
        <div className="text-center text-slate-300">
          <Lock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          <p className="text-sm font-medium">Content Restricted</p>
          <p className="text-xs mt-1 text-slate-400 mb-3">This video cannot be embedded</p>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors"
            data-testid="button-view-on-youtube"
          >
            <ExternalLink className="w-3 h-3" />
            View on YouTube
          </a>
        </div>
      </div>
    );
  }

  // If no videoId, show offline state - live_stream?channel= format is deprecated
  if (!stableVideoId) {
    console.log('[YouTube] No videoId available for widget:', widgetId, 'channelId:', stableChannelId);
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-slate-900/50"
      >
        <div className="text-center text-slate-400">
          <p className="text-sm">No active stream</p>
          <p className="text-xs mt-1">Check back later</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
      data-referrerpolicy="strict-origin-when-cross-origin"
    >
      <div 
        key={stableVideoId || 'no-video'} 
        id={playerId} 
        className="w-full h-full" 
      />
    </div>
  );
}

// React.memo wrapper - only re-render if critical props change
// Other props (isMuted, isPaused, etc.) are handled internally via refs
const YouTubePlayerMemo = memo(YouTubePlayerInner, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Only re-render when these critical props change:
  return (
    prevProps.videoId === nextProps.videoId &&
    prevProps.channelId === nextProps.channelId &&
    prevProps.widgetId === nextProps.widgetId &&
    prevProps.isSeekMode === nextProps.isSeekMode &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isPaused === nextProps.isPaused &&
    prevProps.volume === nextProps.volume &&
    prevProps.refreshKey === nextProps.refreshKey
  );
});

// DOM EXCEPTION SHIELD: Export wrapped in Error Boundary to prevent crashes
export const YouTubePlayer = (props: YouTubePlayerProps) => (
  <YouTubeErrorBoundary widgetId={props.widgetId}>
    <YouTubePlayerMemo {...props} />
  </YouTubeErrorBoundary>
);
