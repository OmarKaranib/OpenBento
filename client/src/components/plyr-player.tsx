import { useEffect, useRef, useMemo, memo, useState } from 'react';

declare global {
  interface Window {
    Plyr: new (
      element: HTMLElement | string,
      options?: PlyrOptions
    ) => PlyrInstance;
  }
}

interface PlyrOptions {
  controls?: string[];
  youtube?: {
    noCookie?: boolean;
    rel?: number;
    showinfo?: number;
    iv_load_policy?: number;
    modestbranding?: number;
    playsinline?: number;
    autoplay?: number;
    origin?: string;
  };
  autoplay?: boolean;
  muted?: boolean;
  clickToPlay?: boolean;
  hideControls?: boolean;
  resetOnEnd?: boolean;
}

interface PlyrInstance {
  play: () => Promise<void>;
  pause: () => void;
  muted: boolean;
  volume: number;
  playing: boolean;
  paused: boolean;
  on: (event: string, callback: () => void) => void;
  destroy: () => void;
}

interface PlyrPlayerProps {
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

function PlyrPlayerInner({
  widgetId,
  videoId,
  isMuted,
  isPaused,
  isSeekMode,
  onReady,
  onPausedChange,
}: PlyrPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlyrInstance | null>(null);
  const [isPlyrReady, setIsPlyrReady] = useState(false);

  const isMutedRef = useRef(isMuted);
  const isPausedRef = useRef(isPaused);
  const onReadyRef = useRef(onReady);
  const onPausedChangeRef = useRef(onPausedChange);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onPausedChangeRef.current = onPausedChange; }, [onPausedChange]);

  const stableVideoId = useMemo(() => videoId || null, [videoId]);
  // ORIGIN LOCKDOWN: Hardcoded production domain for YouTube postMessage handshake
  const origin = 'https://openbento.tv';

  const setupMediaSession = (videoTitle: string) => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: videoTitle || 'Live Stream',
          artist: 'OpenBento Dashboard',
          album: 'Live Streams',
        });

        navigator.mediaSession.setActionHandler('play', () => {
          playerRef.current?.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          playerRef.current?.pause();
        });

        console.log('[Plyr] MediaSession API configured for background play');
      } catch (e) {
        console.log('[Plyr] MediaSession setup error:', e);
      }
    }
  };

  useEffect(() => {
    if (!stableVideoId) return;

    const initPlyr = () => {
      if (!containerRef.current || !window.Plyr) return false;
      
      const embedDiv = containerRef.current.querySelector('.plyr__video-embed');
      if (!embedDiv) return false;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log('[Plyr] Cleanup error:', e);
        }
        playerRef.current = null;
      }

      try {
        console.log('[Plyr] Initializing player for widget:', widgetId, 'videoId:', stableVideoId);

        playerRef.current = new window.Plyr(embedDiv as HTMLElement, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
          autoplay: true,
          muted: true,
          clickToPlay: false,
          hideControls: !isSeekMode,
          resetOnEnd: false,
          youtube: {
            noCookie: true,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            autoplay: 1,
            origin: origin,
          },
        });

        playerRef.current.on('ready', () => {
          console.log('[Plyr] Player ready for widget:', widgetId);
          setIsPlyrReady(true);
          setupMediaSession(`Stream ${widgetId}`);

          setTimeout(() => {
            try {
              if (playerRef.current) {
                playerRef.current.muted = isMutedRef.current;
                if (!isPausedRef.current && typeof playerRef.current.play === 'function') {
                  const playResult = playerRef.current.play();
                  if (playResult && typeof playResult.catch === 'function') {
                    playResult.catch(() => {});
                  }
                }
              }
            } catch (e) {
              console.log('[Plyr] Ready play error:', e);
            }
          }, 200);

          onReadyRef.current?.();
        });

        playerRef.current.on('playing', () => {
          onPausedChangeRef.current?.(false);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        });

        playerRef.current.on('pause', () => {
          onPausedChangeRef.current?.(true);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
        });

        return true;
      } catch (e) {
        console.error('[Plyr] Failed to initialize player:', e);
        return false;
      }
    };

    // Wait for both DOM and Plyr library
    let attempts = 0;
    const maxAttempts = 50;
    
    const tryInit = () => {
      attempts++;
      if (initPlyr()) {
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(tryInit, 100);
      } else {
        console.log('[Plyr] Max attempts reached, falling back to iframe');
        setIsPlyrReady(true); // Show iframe even without Plyr
        onReadyRef.current?.();
      }
    };

    // Start after a brief delay to ensure DOM is ready
    const startTimeout = setTimeout(tryInit, 150);

    return () => {
      clearTimeout(startTimeout);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log('[Plyr] Cleanup error:', e);
        }
        playerRef.current = null;
      }
      setIsPlyrReady(false);
    };
  }, [stableVideoId, widgetId, origin, isSeekMode]);

  useEffect(() => {
    if (playerRef.current && isPlyrReady) {
      try {
        playerRef.current.muted = isMuted;
      } catch (e) {
        console.log('[Plyr] Mute control error:', e);
      }
    }
  }, [isMuted, isPlyrReady]);

  useEffect(() => {
    if (playerRef.current && isPlyrReady) {
      try {
        if (isPaused) {
          playerRef.current.pause();
        } else if (typeof playerRef.current.play === 'function') {
          const playPromise = playerRef.current.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
          }
        }
      } catch (e) {
        console.log('[Plyr] Play control error:', e);
      }
    }
  }, [isPaused, isPlyrReady]);

  // PRODUCTION FIX: Standard YouTube embed with origin handshake (fewer restriction issues)
  const youtubeUrl = useMemo(() => {
    if (!stableVideoId) return '';
    return `https://www.youtube.com/embed/${stableVideoId}?origin=${encodeURIComponent(origin)}&enablejsapi=1&autoplay=1&mute=1&iv_load_policy=3&modestbranding=1&playsinline=1&showinfo=0&rel=0`;
  }, [stableVideoId, origin]);

  if (!stableVideoId) {
    return <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500">No video</div>;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full plyr-container"
      style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
    >
      <div 
        key={stableVideoId} 
        className="plyr__video-embed w-full h-full"
        data-plyr-provider="youtube"
        data-plyr-embed-id={stableVideoId}
      >
        <iframe
          src={youtubeUrl}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="w-full h-full"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
}

export const PlyrPlayer = memo(PlyrPlayerInner, (prevProps, nextProps) => {
  return (
    prevProps.videoId === nextProps.videoId &&
    prevProps.widgetId === nextProps.widgetId &&
    prevProps.isSeekMode === nextProps.isSeekMode &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isPaused === nextProps.isPaused
  );
});
