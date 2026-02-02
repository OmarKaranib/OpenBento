import { useEffect, useRef, useMemo, useCallback, memo } from 'react';

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
  isMuted: boolean;
  isPaused: boolean;
  volume: number;
  isSeekMode: boolean;
  refreshKey?: number;
  onReady?: () => void;
  onError?: () => void;
  onMutedChange?: (muted: boolean) => void;
  onPausedChange?: (paused: boolean) => void;
}

function YouTubePlayerInner({
  widgetId,
  videoId,
  channelId,
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
  
  // Use refs to track current state without causing re-renders
  const isMutedRef = useRef(isMuted);
  const isPausedRef = useRef(isPaused);
  const volumeRef = useRef(volume);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPausedChangeRef = useRef(onPausedChange);
  
  // Keep refs in sync with props
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
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

  // Hardcoded origin for handshake - computed once
  const origin = useMemo(() => window.location.origin, []);

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
    
    // Cleanup existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.log('[YouTube] Player cleanup error:', e);
      }
      playerRef.current = null;
    }

    // Standard 2026 YouTube IFrame API handshake parameters - hardcoded strings
    // rel: 0 = no related videos, iv_load_policy: 3 = hide video annotations
    const playerVars: Record<string, string | number> = {
      autoplay: 1,
      mute: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      enablejsapi: 1,
      origin: origin,
      widget_referrer: window.location.href,
      playsinline: 1,
    };

    try {
      // If we have a channelId but no videoId, use channel live stream format
      const effectiveVideoId = stableVideoId || (stableChannelId ? `live_stream?channel=${stableChannelId}` : undefined);
      
      console.log('[YouTube] Initializing player for widget:', widgetId, 'videoId:', effectiveVideoId);
      
      playerRef.current = new window.YT.Player(playerId, {
        videoId: stableVideoId || undefined,
        host: 'https://www.youtube-nocookie.com',
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
            console.log('[YouTube] Player error:', event.data, 'for widget:', widgetId);
            // Trigger re-fetch for various video errors:
            // 100 = Video not found
            // 101/150 = Video not allowed for embedded playback
            // 2 = Invalid video ID
            // 5 = HTML5 player error
            if ([2, 5, 100, 101, 150].includes(event.data)) {
              console.log('[YouTube] Triggering onError callback for re-fetch');
              onErrorRef.current?.();
            }
          },
        },
      });
    } catch (e) {
      console.error('[YouTube] Failed to initialize player:', e);
      onErrorRef.current?.();
    }
  }, [playerId, stableVideoId, stableChannelId, widgetId, origin, setupMediaSession]); // Only re-init when video/widget/channel changes

  // Initialize player only when videoId changes
  useEffect(() => {
    // Reset initialization flag when video changes
    isInitializedRef.current = false;
    
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
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log('[YouTube] Cleanup error:', e);
        }
        playerRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [stableVideoId, initializePlayer]); // Only reinitialize when videoId changes

  // Handle refreshKey changes - force reinitialize when manual refresh is triggered
  useEffect(() => {
    if (refreshKey !== lastRefreshKeyRef.current) {
      console.log(`[YouTube] RefreshKey changed from ${lastRefreshKeyRef.current} to ${refreshKey} - reinitializing player`);
      lastRefreshKeyRef.current = refreshKey;
      
      // Destroy and reinitialize
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log('[YouTube] Refresh cleanup error:', e);
        }
        playerRef.current = null;
        isInitializedRef.current = false;
      }
      
      // Reinitialize after a short delay
      setTimeout(() => {
        initializePlayer();
      }, 100);
    }
  }, [refreshKey, initializePlayer]);

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

  // For channel-based live streams (no videoId, but has channelId), use direct iframe
  if (!stableVideoId && stableChannelId) {
    const channelLiveUrl = `https://www.youtube-nocookie.com/embed/live_stream?channel=${stableChannelId}&autoplay=1&mute=1&origin=${encodeURIComponent(origin)}&enablejsapi=1`;
    console.log('[YouTube] Using channel live stream iframe for:', stableChannelId);
    
    return (
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
      >
        <iframe
          src={channelLiveUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
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
export const YouTubePlayer = memo(YouTubePlayerInner, (prevProps, nextProps) => {
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
