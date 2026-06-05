// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause as PauseIcon, Play as PlayIcon, Plus as PlusIcon, Settings as SettingsIcon, Trash2, Upload, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, normalizeUrl, qrIconBtnStyle, qrInputStyle } from './shared';

interface PhotoLoopProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

export const PhotoLoopWidget: React.FC<PhotoLoopProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { /* nothing layout-dependent */ });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const photos = widget.photoUrls ?? [];
  const intervalSec = widget.photoIntervalSec ?? 5;
  const fit = widget.photoFit ?? 'cover';
  const bgColor   = widget.customColor ?? '#000';
  const light     = isLightBg(bgColor);
  const accent    = light ? '#7c3aed' : '#c084fc';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';

  useEffect(() => {
    if (paused) return;
    if (photos.length <= 1 || intervalSec <= 0) return;
    const id = setInterval(() => setIdx(i => (i + 1) % photos.length), intervalSec * 1000);
    return () => clearInterval(id);
  }, [photos.length, intervalSec, paused]);

  // Reset idx if we deleted past the end.
  useEffect(() => {
    if (idx >= photos.length) setIdx(0);
  }, [photos.length, idx]);

  const setPhotos = (next: string[]) => {
    onUpdate?.(widget.id, { photoUrls: next });
  };

  const addUrl = () => {
    const u = normalizeUrl(draftUrl);
    if (!u) return;
    if (photos.length >= 20) return;
    setPhotos([...photos, u]);
    setDraftUrl('');
  };
  const removeAt = (i: number) => setPhotos(photos.filter((_, j) => j !== i));

  const handleUpload = (file: File) => {
    if (file.size > 800_000) {
      alert('Image too large — pick something under ~800 KB or paste a URL.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        if (photos.length >= 20) return;
        setPhotos([...photos, result]);
      }
    };
    reader.readAsDataURL(file);
  };

  const current = photos[idx] ?? null;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 0, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`,
        position: 'relative',
      }}
      data-testid={`photo-loop-widget-${widget.id}`}
    >
      {/*
        Two sibling button groups at top-right:

        1. widget-hover-cog (hover-only): prev/pause/next + Gear.
           Rendered only when settings is CLOSED. All four buttons
           vanish together on hover-out.
        2. Always-visible X: rendered only when settings is OPEN.
           Sits at z-index 6 so it clears the overlay (z-index 4)
           and is never hidden by hover CSS.
      */}
      {!showSettings && (
        <div
          className="widget-hover-cog"
          style={{
            position: 'absolute', top: 8, right: 8,
            transition: 'opacity 0.15s', zIndex: 5,
            display: 'flex', gap: 4,
          }}
        >
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
                style={qrIconBtnStyle()}
                title="Previous"
                data-testid={`photo-loop-prev-${widget.id}`}
              >
                <ChevronLeft size={11} />
              </button>
              <button
                onClick={() => setPaused(p => !p)}
                style={{
                  ...qrIconBtnStyle(),
                  color: paused ? accent : '#cbd5e1',
                  borderColor: paused ? accent : 'rgba(255,255,255,0.1)',
                }}
                title={paused ? 'Resume slideshow' : 'Pause slideshow'}
                data-testid={`photo-loop-${paused ? 'play' : 'pause'}-${widget.id}`}
              >
                {paused ? <PlayIcon size={11} /> : <PauseIcon size={11} />}
              </button>
              <button
                onClick={() => setIdx(i => (i + 1) % photos.length)}
                style={qrIconBtnStyle()}
                title="Next"
                data-testid={`photo-loop-next-${widget.id}`}
              >
                <ChevronRight size={11} />
              </button>
            </>
          )}
          <button
            onClick={() => setShowSettings(true)}
            style={qrIconBtnStyle()}
            title="Photo settings"
            data-testid={`photo-loop-settings-toggle-${widget.id}`}
          >
            <SettingsIcon size={11} />
          </button>
        </div>
      )}
      {showSettings && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 6 }}>
          <button
            onClick={() => setShowSettings(false)}
            style={qrIconBtnStyle()}
            title="Close settings"
            data-testid={`photo-loop-settings-toggle-${widget.id}`}
          >
            <XIcon size={11} />
          </button>
        </div>
      )}

      {/* Settings overlay — no X button inside; toggle button above handles close */}
      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
            borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`photo-loop-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
              Photo Loop
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              value={draftUrl}
              onChange={e => setDraftUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addUrl(); }}
              placeholder="Paste image URL…"
              style={qrInputStyle(11)}
              data-testid={`photo-loop-input-url-${widget.id}`}
            />
            <button
              onClick={addUrl}
              disabled={!draftUrl.trim() || photos.length >= 20}
              style={{
                ...qrIconBtnStyle(),
                opacity: !draftUrl.trim() || photos.length >= 20 ? 0.4 : 1,
              }}
              data-testid={`photo-loop-add-${widget.id}`}
            >
              <PlusIcon size={11} />
            </button>
          </div>
          <label
            style={{
              ...qrIconBtnStyle(),
              cursor: photos.length >= 20 ? 'not-allowed' : 'pointer',
              opacity: photos.length >= 20 ? 0.4 : 1,
              justifyContent: 'flex-start', gap: 6, padding: '6px 8px',
              fontFamily: MONO, fontSize: 11,
            }}
            data-testid={`photo-loop-upload-label-${widget.id}`}
          >
            <Upload size={11} />
            Upload from device (≤800 KB)
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={photos.length >= 20}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = '';
              }}
              data-testid={`photo-loop-upload-${widget.id}`}
            />
          </label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([0, 3, 5, 10, 30] as const).map(s => (
              <button
                key={s}
                onClick={() => onUpdate?.(widget.id, { photoIntervalSec: s })}
                style={{
                  ...qrIconBtnStyle(),
                  background: intervalSec === s ? `${accent}33` : 'rgba(255,255,255,0.04)',
                  borderColor: intervalSec === s ? accent : 'rgba(255,255,255,0.1)',
                  color: intervalSec === s ? accent : '#cbd5e1',
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  padding: '4px 6px',
                }}
                data-testid={`photo-loop-interval-${s}-${widget.id}`}
              >
                {s === 0 ? 'MANUAL' : `${s}s`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['cover', 'contain'] as const).map(f => (
              <button
                key={f}
                onClick={() => onUpdate?.(widget.id, { photoFit: f })}
                style={{
                  ...qrIconBtnStyle(),
                  flex: 1,
                  background: fit === f ? `${accent}33` : 'rgba(255,255,255,0.04)',
                  borderColor: fit === f ? accent : 'rgba(255,255,255,0.1)',
                  color: fit === f ? accent : '#cbd5e1',
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  padding: '4px 6px',
                }}
                data-testid={`photo-loop-fit-${f}-${widget.id}`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {photos.map((p, i) => (
              <div key={i} style={{
                display: 'flex', gap: 4, alignItems: 'center',
                padding: 4, borderRadius: 4,
                background: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(71,85,105,0.3)',
              }}>
                <img src={p} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }} />
                <span style={{
                  flex: 1, color: '#cbd5e1', fontFamily: MONO, fontSize: 9,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.startsWith('data:') ? `Upload #${i + 1}` : p}
                </span>
                <button
                  onClick={() => removeAt(i)}
                  style={{ ...qrIconBtnStyle(), padding: 4 }}
                  data-testid={`photo-loop-remove-${i}-${widget.id}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showSettings && photos.length === 0 && (
        <button
          onClick={() => setShowSettings(true)}
          style={{
            margin: 'auto', padding: '8px 12px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.2)',
            color: '#cbd5e1', fontFamily: MONO, fontSize: 11, cursor: 'pointer',
          }}
          data-testid={`photo-loop-empty-cta-${widget.id}`}
        >
          + Add photos
        </button>
      )}
      {!showSettings && current && (
        <>
          <img
            key={`${idx}-${current.slice(0, 32)}`}
            src={current}
            alt=""
            style={{
              width: '100%', height: '100%',
              objectFit: fit,
              animation: 'obb-photo-fade 0.6s ease-in',
            }}
            data-testid={`photo-loop-image-${widget.id}`}
          />
          <style>{`
            @keyframes obb-photo-fade {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
          `}</style>
          {photos.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 6, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', gap: 4,
              pointerEvents: 'none',
            }}>
              {photos.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: i === idx ? accent : 'rgba(255,255,255,0.3)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};