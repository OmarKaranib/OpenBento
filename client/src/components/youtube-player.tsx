import { useEffect, useRef, useMemo, useCallback } from 'react';

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
  destroy: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
}

interface YouTubePlayerProps {
  widgetId: string;
  videoId?: string | null;
  channelId?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  isSeekMode: boolean;
  onReady?: () => void;
  onError?: () => void;
  onMutedChange?: (muted: boolean) => void;
  onPausedChange?: (paused: boolean) => void;
}

export function YouTubePlayer({
  widgetId,
  videoId,
  channelId,
  isMuted,
  isPaused,
  isSeekMode,
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
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPausedChangeRef = useRef(onPausedChange);
  
  // Keep refs in sync with props
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onPausedChangeRef.current = onPausedChange; }, [onPausedChange]);

  // Memoize the stable player ID - only changes if widgetId changes
  const playerId = useMemo(() => `yt-player-${widgetId}`, [widgetId]);
  
  // Memoize the stable video ID - only recalculate when videoId prop changes
  const stableVideoId = useMemo(() => videoId || null, [videoId]);

  // Hardcoded origin for handshake - computed once
  const origin = useMemo(() => window.location.origin, []);

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
    const playerVars: Record<string, string | number> = {
      autoplay: 1,
      mute: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      origin: origin,
      widget_referrer: window.location.href,
      playsinline: 1,
    };

    try {
      console.log('[YouTube] Initializing player for widget:', widgetId, 'videoId:', stableVideoId);
      
      playerRef.current = new window.YT.Player(playerId, {
        videoId: stableVideoId || undefined,
        host: 'https://www.youtube-nocookie.com',
        playerVars,
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
            // Only mark offline for critical errors (not found)
            if (event.data === 100) {
              onErrorRef.current?.();
            }
          },
        },
      });
    } catch (e) {
      console.error('[YouTube] Failed to initialize player:', e);
      onErrorRef.current?.();
    }
  }, [playerId, stableVideoId, widgetId, origin]); // Only re-init when video/widget changes

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
