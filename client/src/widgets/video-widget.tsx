// Extracted verbatim from pages/dashboard.tsx during widget modularization.
// The body is identical to the former `case 'video':` arm of the inline
// switch in MasterControlDashboard; every closure-bound dependency is now
// passed in explicitly so the file stands alone.
//
// Rendered from pages/dashboard.tsx (see <VideoWidget … />). The widget
// registry returns `false` for `type === 'video'` because the dashboard
// owns the iframe refs / seek-mode state / inline URL input state that
// this component needs.
import React from 'react';
import { Plus } from 'lucide-react';
import { YouTubePlayer } from '@/components/youtube-player';
import type { Widget } from './shared';

export interface VideoWidgetProps {
  widget: Widget;
  isSeekMode: boolean;
  iframeRefs: React.MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  inlineInputWidgetId: string | null;
  inlineInputValue: string;
  setInlineInputWidgetId: (id: string | null) => void;
  setInlineInputValue: (v: string) => void;
  setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>;
  handleVideoError: (widget: Widget, errorCode?: number) => void | Promise<void>;
  getYouTubeEmbedUrl: (videoId: string) => string;
  getTwitchEmbedUrl: (channel: string) => string;
  getKickEmbedUrl: (channel: string) => string;
  onInlineUrlSubmit: (widgetId: string, url: string) => void;
  OfflinePlaceholder: React.ComponentType<{ widget: Widget }>;
}

export function VideoWidget({
  widget,
  isSeekMode,
  iframeRefs,
  inlineInputWidgetId,
  inlineInputValue,
  setInlineInputWidgetId,
  setInlineInputValue,
  setWidgets,
  handleVideoError,
  getYouTubeEmbedUrl,
  getTwitchEmbedUrl,
  getKickEmbedUrl,
  onInlineUrlSubmit,
  OfflinePlaceholder,
}: VideoWidgetProps): React.ReactElement | null {
  // ARCHITECTURE PIVOT: Force Embed - If videoId exists, render immediately
  // Only show OfflinePlaceholder for YouTube if NO videoId exists
  // For Twitch/Kick, show offline if their respective channels are missing
  const shouldShowOffline = widget.isOffline && (
    (widget.isYouTube && !widget.videoId) ||
    (widget.isTwitch && !widget.twitchChannel) ||
    (widget.isKick && !widget.kickChannel) ||
    (!widget.isYouTube && !widget.isTwitch && !widget.isKick)
  );

  if (shouldShowOffline) {
    return <OfflinePlaceholder widget={widget} />;
  }

  // YouTube IFrame API with MediaSession for background play, rel=0, iv_load_policy=3
  // Key is ONLY widget.id for stability - refreshKey prop handles manual refresh
  if (widget.isYouTube && (widget.videoId || widget.youtubeChannelId)) {
    // PURE IFRAME FALLBACK: Use standard HTML iframe if IFrame API throws postMessage errors
    if (widget.usePureIframe && widget.videoId) {
      const pureIframeSrc = getYouTubeEmbedUrl(widget.videoId);
      return (
        <iframe
          key={`${widget.id}-${widget.videoId}`}
          ref={(el) => { iframeRefs.current[widget.id] = el; }}
          src={pureIframeSrc}
          className="w-full h-full"
          style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
          title={`YouTube Pure - ${widget.id}`}
          allow="autoplay; encrypted-media; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      );
    }
    return (
      <YouTubePlayer
        key={`${widget.id}-${widget.videoId || ''}`}
        widgetId={widget.id}
        videoId={widget.videoId}
        channelId={widget.youtubeChannelId}
        latestVideoId={widget.latestVideoId}
        isManualOverride={widget.isManualOverride}
        isMuted={widget.isMuted}
        isPaused={widget.isPaused}
        volume={widget.volume}
        isSeekMode={isSeekMode}
        refreshKey={widget.lastRefresh || 0}
        onReady={() => {
          console.log(`[YouTube] Player ready: ${widget.id}`);
        }}
        onError={(errorCode) => handleVideoError(widget, errorCode)}
        onMutedChange={(muted) => {
          setWidgets(prev => prev.map(w =>
            w.id === widget.id ? { ...w, isMuted: muted } : w
          ));
        }}
        onPausedChange={(paused) => {
          setWidgets(prev => prev.map(w =>
            w.id === widget.id ? { ...w, isPaused: paused } : w
          ));
        }}
      />
    );
  } else if (widget.isTwitch && widget.twitchChannel) {
    // Stable key with refresh in src parameter for controlled refresh
    const twitchSrc = `${getTwitchEmbedUrl(widget.twitchChannel)}${widget.lastRefresh ? `&_r=${widget.lastRefresh}` : ''}`;
    return (
      <iframe
        key={widget.id}
        ref={(el) => { iframeRefs.current[widget.id] = el; }}
        src={twitchSrc}
        className="w-full h-full"
        style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
        title={`Twitch - ${widget.id}`}
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        onError={() => handleVideoError(widget)}
      />
    );
  } else if (widget.isKick && widget.kickChannel) {
    // Stable key with refresh in src parameter for controlled refresh
    const kickSrc = `${getKickEmbedUrl(widget.kickChannel)}${widget.lastRefresh ? `&_r=${widget.lastRefresh}` : ''}`;
    return (
      <iframe
        key={widget.id}
        ref={(el) => { iframeRefs.current[widget.id] = el; }}
        src={kickSrc}
        className="w-full h-full"
        style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
        title={`Kick - ${widget.id}`}
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        onError={() => handleVideoError(widget)}
      />
    );
  } else if (widget.url) {
    return (
      <iframe
        key={`${widget.id}-${widget.lastRefresh || 0}`}
        src={widget.url}
        className="w-full h-full"
        style={{ pointerEvents: isSeekMode ? 'auto' : 'none' }}
        title={widget.id}
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    );
  }
  // Show inline URL input when this widget is selected for inline editing
  if (inlineInputWidgetId === widget.id) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-[1.5rem] gap-[1rem]">
        <div className="text-cyan-400 text-[1.2rem] font-semibold">Paste Video URL</div>
        <input
          type="text"
          value={inlineInputValue}
          onChange={(e) => setInlineInputValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && inlineInputValue.trim()) {
              onInlineUrlSubmit(widget.id, inlineInputValue.trim());
              setInlineInputWidgetId(null);
              setInlineInputValue('');
            } else if (e.key === 'Escape') {
              setInlineInputWidgetId(null);
              setInlineInputValue('');
            }
          }}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full max-w-[28rem] px-[1rem] py-[0.8rem] bg-slate-800 border border-cyan-500/50 rounded-lg focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all text-[1.2rem] text-white placeholder:text-slate-500"
          autoFocus
          data-testid={`input-inline-url-${widget.id}`}
        />
        <div className="flex gap-[0.8rem]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (inlineInputValue.trim()) {
                onInlineUrlSubmit(widget.id, inlineInputValue.trim());
                setInlineInputWidgetId(null);
                setInlineInputValue('');
              }
            }}
            className="px-[1.2rem] py-[0.6rem] bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors text-[1.1rem]"
            data-testid={`button-submit-url-${widget.id}`}
          >
            Add
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInlineInputWidgetId(null);
              setInlineInputValue('');
            }}
            className="px-[1.2rem] py-[0.6rem] bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors text-[1.1rem]"
            data-testid={`button-cancel-url-${widget.id}`}
          >
            Cancel
          </button>
        </div>
        <div className="text-slate-500 text-[1rem]">Supports YouTube, Twitch, Kick</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setInlineInputWidgetId(widget.id);
          setInlineInputValue('');
        }}
        className="flex flex-col items-center gap-2 text-cyan-400/60 hover:text-cyan-400 transition-colors"
        data-testid={`button-add-video-${widget.id}`}
      >
        <Plus className="w-[3rem] h-[3rem]" />
        <span className="text-[1.1rem]">Add Video</span>
      </button>
    </div>
  );
}
