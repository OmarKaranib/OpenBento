import { useEffect, useRef, useCallback } from 'react';

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
  const playerIdRef = useRef(`yt-player-${widgetId}`);

  const initializePlayer = useCallback(() => {
    if (!containerRef.current || !window.YT?.Player) return;
    
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.log('[YouTube] Player cleanup error:', e);
      }
    }

    const containerId = playerIdRef.current;
    
    // Standard 2026 YouTube IFrame API handshake parameters
    const playerVars: Record<string, string | number> = {
      autoplay: 1,
      mute: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin,
      widget_referrer: window.location.href,
      playsinline: 1,
    };

    try {
      playerRef.current = new window.YT.Player(containerId, {
        videoId: videoId || undefined,
        host: 'https://www.youtube-nocookie.com',
        playerVars,
        events: {
          onReady: (event) => {
            console.log('[YouTube] Player ready for widget:', widgetId);
            
            // Set referrerPolicy on the generated iframe
            const playerElement = document.getElementById(containerId);
            if (playerElement) {
              const iframe = playerElement.tagName === 'IFRAME' ? playerElement as HTMLIFrameElement : playerElement.querySelector('iframe');
              if (iframe) {
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                console.log('[YouTube] Set referrerPolicy on iframe');
              }
            }
            
            // Delay player control calls to ensure API is fully ready
            setTimeout(() => {
              try {
                if (playerRef.current && typeof playerRef.current.mute === 'function') {
                  if (isMuted) {
                    playerRef.current.mute();
                  } else {
                    playerRef.current.unMute();
                  }
                  if (!isPaused && typeof playerRef.current.playVideo === 'function') {
                    playerRef.current.playVideo();
                  }
                }
              } catch (e) {
                console.log('[YouTube] Player control error on ready:', e);
              }
            }, 100);
            
            onReady?.();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              onPausedChange?.(false);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              onPausedChange?.(true);
            }
          },
          onError: (event) => {
            // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=restricted
            console.log('[YouTube] Player error:', event.data, 'for widget:', widgetId);
            // Only mark offline for critical errors (not found)
            if (event.data === 100) {
              onError?.();
            }
            // Error 150/101 = restricted, but player might still work - don't mark offline
          },
        },
      });
    } catch (e) {
      console.error('[YouTube] Failed to initialize player:', e);
      onError?.();
    }
  }, [videoId, widgetId, isMuted, isPaused, onReady, onError, onPausedChange]);

  useEffect(() => {
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
      }
    };
  }, [initializePlayer]);

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.mute === 'function') {
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

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
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
      <div id={playerIdRef.current} className="w-full h-full" />
    </div>
  );
}
