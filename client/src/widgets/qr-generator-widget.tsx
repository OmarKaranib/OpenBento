// Auto-extracted from App.tsx during widget modularization.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, History as HistoryIcon, Link2, Mail, MapPin, QrCode, RefreshCw, Settings as SettingsIcon, Trash2, Upload, User as UserIcon, Wifi, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { Widget } from './shared';

const MONO_QR = "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace";

type QRMode = NonNullable<Widget['qrMode']>;
type QRHistoryEntry = NonNullable<Widget['qrHistory']>[number];

const QR_MODES: { value: QRMode; label: string; Icon: typeof Wifi }[] = [
  { value: 'url',   label: 'Link',  Icon: Link2 },
  { value: 'wifi',  label: 'WiFi',  Icon: Wifi },
  { value: 'vcard', label: 'Card',  Icon: UserIcon },
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'geo',   label: 'Geo',   Icon: MapPin },
];

// WiFi QR strings escape the five reserved characters: \ ; , " :
function escapeWifiField(s: string): string {
  return s.replace(/([\\;,":])/g, '\\$1');
}

// Returns { value, label } for the current mode. value is the encoded QR
// payload (empty when the mode's required fields aren't filled in yet);
// label is a short human-readable summary used in history + footer.
function buildQRPayload(widget: Widget): { value: string; label: string } {
  const mode: QRMode = widget.qrMode ?? 'url';
  const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  switch (mode) {
    case 'url': {
      const v = (widget.qrUrlValue || '').trim();
      return { value: v.slice(0, 2953), label: v ? trunc(v, 40) : '' };
    }
    case 'wifi': {
      const ssid = (widget.qrWifiSsid || '').trim();
      if (!ssid) return { value: '', label: '' };
      const sec = widget.qrWifiSecurity || 'WPA';
      const pwd = widget.qrWifiPassword || '';
      const hidden = widget.qrWifiHidden ? 'H:true;' : '';
      const secPart = sec === 'nopass' ? 'nopass' : sec;
      const pwdPart = sec === 'nopass' ? '' : `P:${escapeWifiField(pwd)};`;
      return {
        value: `WIFI:T:${secPart};S:${escapeWifiField(ssid)};${pwdPart}${hidden};`,
        label: `WiFi \u2022 ${trunc(ssid, 32)}`,
      };
    }
    case 'vcard': {
      const name  = (widget.qrVcardName  || '').trim();
      const phone = (widget.qrVcardPhone || '').trim();
      const email = (widget.qrVcardEmail || '').trim();
      const org   = (widget.qrVcardOrg   || '').trim();
      if (!name && !phone && !email) return { value: '', label: '' };
      const parts = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        name  ? `FN:${name}`              : null,
        org   ? `ORG:${org}`              : null,
        phone ? `TEL;TYPE=CELL:${phone}`  : null,
        email ? `EMAIL;TYPE=INTERNET:${email}` : null,
        'END:VCARD',
      ].filter(Boolean) as string[];
      return { value: parts.join('\n'), label: trunc(name || email || phone, 40) };
    }
    case 'email': {
      const to   = (widget.qrEmailTo      || '').trim();
      const subj = (widget.qrEmailSubject || '').trim();
      const body = (widget.qrEmailBody    || '').trim();
      if (!to) return { value: '', label: '' };
      const params: string[] = [];
      if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      const q = params.length ? `?${params.join('&')}` : '';
      return { value: `mailto:${to}${q}`, label: `\u2709 ${trunc(to, 36)}` };
    }
    case 'geo': {
      const lat = parseFloat((widget.qrGeoLat || '').trim());
      const lon = parseFloat((widget.qrGeoLon || '').trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { value: '', label: '' };
      const lab = (widget.qrGeoLabel || '').trim();
      const value = lab
        ? `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(lab)})`
        : `geo:${lat},${lon}`;
      return { value, label: lab || `${lat.toFixed(3)}, ${lon.toFixed(3)}` };
    }
  }
}

// Rasterize the QR <svg> to a PNG and copy it to the clipboard. Falls
// back to a download anchor when the Async Clipboard API can't handle
// image/png (older Safari, locked-down browsers).
async function copyQRToClipboard(svg: SVGSVGElement, bgColor: string): Promise<'copied' | 'downloaded' | 'failed'> {
  try {
    const xml = new XMLSerializer().serializeToString(svg);
    const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = svgUrl;
    });
    const target = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = target; canvas.height = target;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'failed';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, target, target);
    ctx.drawImage(img, 0, 0, target, target);
    // Best-effort clipboard write — feature-detect ClipboardItem on
    // window without `any` so older browsers fall through cleanly.
    const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), 'image/png'));
    if (!blob) return 'failed';
    const ClipboardItemCtor = (
      globalThis as { ClipboardItem?: typeof ClipboardItem }
    ).ClipboardItem;
    if (ClipboardItemCtor && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
        return 'copied';
      } catch {
        // fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qrcode.png';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 250);
    return 'downloaded';
  } catch (err) {
    console.warn('[QR] copy/download failed:', err);
    return 'failed';
  }
}

// Relative luminance per WCAG 2.x; used to pick a contrast-safe QR
// foreground when the background tracks the widget color-droplet.
function hexLuminance(hex: string): number {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return 1;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

interface QRGeneratorWidgetProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

export const QRGeneratorWidget: React.FC<QRGeneratorWidgetProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'downloaded' | 'failed'>('idle');
  const { toast } = useToast();

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setSize(Math.min(r.width, r.height));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const mode: QRMode = widget.qrMode ?? 'url';
  const patch = useCallback((p: Partial<Widget>) => {
    if (onUpdate) onUpdate(widget.id, p);
  }, [onUpdate, widget.id]);

  const { value: qrValue, label: qrLabel } = useMemo(() => buildQRPayload(widget), [widget]);

  // Color theme: BOTH foreground and background track the widget
  // color-droplet by default. Background takes the droplet's tint;
  // foreground is auto-picked for WCAG-safe contrast against it.
  // Per-widget manual overrides (qrFgColor / qrBgColor) win when set.
  // Falls back to the classic dark-on-white when no droplet is set.
  const dropletBg = widget.customColor ?? null;
  const bgColor   = widget.qrBgColor || dropletBg || '#ffffff';
  const fgColor   = widget.qrFgColor
    || (dropletBg ? (hexLuminance(bgColor) > 0.5 ? '#0f172a' : '#ffffff') : '#0f172a');

  // Push current value into history (debounced + dedup) whenever the
  // payload changes and is non-empty.
  const lastSavedRef = useRef<string>('');
  useEffect(() => {
    if (!qrValue || !onUpdate) return;
    if (lastSavedRef.current === qrValue) return;
    const t = setTimeout(() => {
      if (lastSavedRef.current === qrValue) return;
      lastSavedRef.current = qrValue;
      const prev = widget.qrHistory || [];
      // Drop any prior entry with the same value so it moves to the top.
      const filtered = prev.filter(h => h.value !== qrValue);
      // Snapshot every mode-specific field so restore reconstructs the
      // full form, not just the primary value.
      const fields: Partial<Widget> = (() => {
        switch (mode) {
          case 'url':   return { qrUrlValue: widget.qrUrlValue };
          case 'wifi':  return {
            qrWifiSsid: widget.qrWifiSsid, qrWifiPassword: widget.qrWifiPassword,
            qrWifiSecurity: widget.qrWifiSecurity, qrWifiHidden: widget.qrWifiHidden,
          };
          case 'vcard': return {
            qrVcardName: widget.qrVcardName, qrVcardPhone: widget.qrVcardPhone,
            qrVcardEmail: widget.qrVcardEmail, qrVcardOrg: widget.qrVcardOrg,
          };
          case 'email': return {
            qrEmailTo: widget.qrEmailTo, qrEmailSubject: widget.qrEmailSubject,
            qrEmailBody: widget.qrEmailBody,
          };
          case 'geo':   return {
            qrGeoLat: widget.qrGeoLat, qrGeoLon: widget.qrGeoLon, qrGeoLabel: widget.qrGeoLabel,
          };
        }
      })();
      const next: QRHistoryEntry[] = [
        { mode, value: qrValue, label: qrLabel || qrValue.slice(0, 32), ts: Date.now(), fields },
        ...filtered,
      ].slice(0, 5);
      patch({ qrHistory: next });
    }, 1500);
    return () => clearTimeout(t);
  }, [qrValue, qrLabel, mode, patch, widget, onUpdate]);

  const compact = size < 260;
  const qrSize = Math.max(110, Math.min(260, size * 0.45));
  const tabFs  = compact ? 9.5 : 11;
  const fieldFs = compact ? 11 : 12;

  const handleCopy = async () => {
    const svg = svgWrapperRef.current?.querySelector('svg');
    if (!svg) {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 1600);
      toast({ title: 'Copy failed', description: 'No QR code to copy.', variant: 'destructive' });
      return;
    }
    const result = await copyQRToClipboard(svg as SVGSVGElement, bgColor);
    setCopyState(result);
    setTimeout(() => setCopyState('idle'), 1800);
    if (result === 'copied') {
      toast({ title: 'Copied!', description: 'QR code copied to clipboard as PNG.' });
    } else if (result === 'downloaded') {
      toast({ title: 'Downloaded', description: 'Clipboard unavailable — saved as PNG instead.' });
    } else {
      toast({ title: 'Copy failed', description: 'Could not copy or download the QR code.', variant: 'destructive' });
    }
  };

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) patch({ qrLogoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const restoreFromHistory = (h: QRHistoryEntry) => {
    // Prefer the structured snapshot when present (newer entries).
    if (h.fields) {
      patch({ qrMode: h.mode, ...h.fields });
      return;
    }
    // Legacy entries: best-effort parse of the encoded value.
    const fields: Partial<Widget> = { qrMode: h.mode };
    if (h.mode === 'url')   fields.qrUrlValue   = h.value;
    if (h.mode === 'email') {
      const m = h.value.match(/^mailto:([^?]+)(?:\?(.*))?$/);
      if (m) {
        fields.qrEmailTo = decodeURIComponent(m[1]);
        if (m[2]) {
          const params = new URLSearchParams(m[2]);
          const subj = params.get('subject'); if (subj) fields.qrEmailSubject = subj;
          const body = params.get('body');    if (body) fields.qrEmailBody    = body;
        }
      }
    }
    if (h.mode === 'wifi') {
      const unesc = (s: string) => s.replace(/\\(.)/g, '$1');
      const ssidM = h.value.match(/S:((?:[^;\\]|\\.)+);/);
      const pwdM  = h.value.match(/P:((?:[^;\\]|\\.)*);/);
      const secM  = h.value.match(/T:([^;]+);/);
      if (ssidM) fields.qrWifiSsid     = unesc(ssidM[1]);
      if (pwdM)  fields.qrWifiPassword = unesc(pwdM[1]);
      if (secM)  fields.qrWifiSecurity = (secM[1] === 'nopass' ? 'nopass' : (secM[1] === 'WEP' ? 'WEP' : 'WPA'));
    }
    if (h.mode === 'geo') {
      const m = h.value.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\?q=[^()]*\(([^)]+)\))?$/);
      if (m) {
        fields.qrGeoLat = m[1];
        fields.qrGeoLon = m[2];
        if (m[3]) fields.qrGeoLabel = decodeURIComponent(m[3]);
      }
    }
    if (h.mode === 'vcard') {
      const fn   = h.value.match(/\nFN:([^\n]+)/);
      const tel  = h.value.match(/\nTEL[^:]*:([^\n]+)/);
      const eml  = h.value.match(/\nEMAIL[^:]*:([^\n]+)/);
      const org  = h.value.match(/\nORG:([^\n]+)/);
      if (fn)  fields.qrVcardName  = fn[1].trim();
      if (tel) fields.qrVcardPhone = tel[1].trim();
      if (eml) fields.qrVcardEmail = eml[1].trim();
      if (org) fields.qrVcardOrg   = org[1].trim();
    }
    patch(fields);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        position: 'relative', overflow: 'hidden',
        padding: compact ? 8 : 12,
        boxSizing: 'border-box',
      }}
      data-testid={`qr-generator-widget-${widget.id}`}
    >
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexShrink: 0 }}>
        {QR_MODES.map(({ value, label, Icon }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              onClick={() => patch({ qrMode: value })}
              title={label}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 4,
                padding: '5px 4px',
                background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(129,140,248,0.55)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                color: active ? '#c7d2fe' : '#94a3b8',
                fontFamily: MONO_QR, fontSize: tabFs, fontWeight: 600,
                cursor: 'pointer', minWidth: 0, lineHeight: 1,
              }}
              data-testid={`qr-mode-${value}-${widget.id}`}
            >
              <Icon size={compact ? 11 : 12} />
              {!compact && <span>{label}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setShowSettings(s => !s)}
          title="Settings"
          style={{
            padding: '5px 6px',
            background: showSettings ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${showSettings ? 'rgba(129,140,248,0.55)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6, color: '#cbd5e1', cursor: 'pointer',
          }}
          data-testid={`qr-settings-toggle-${widget.id}`}
        >
          <SettingsIcon size={compact ? 11 : 12} />
        </button>
      </div>

      {/* Body: form fields + QR */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        gap: 8, overflow: 'hidden',
      }}>
        {/* Mode-specific form */}
        {!showSettings && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            flexShrink: 0,
          }} onKeyDown={e => e.stopPropagation()}>
            {mode === 'url' && (
              <input
                type="text"
                value={widget.qrUrlValue || ''}
                onChange={e => patch({ qrUrlValue: e.target.value })}
                placeholder="https://..."
                maxLength={2953}
                style={qrInputStyle(fieldFs)}
                data-testid={`qr-input-url-${widget.id}`}
              />
            )}
            {mode === 'wifi' && (
              <>
                <input
                  type="text"
                  value={widget.qrWifiSsid || ''}
                  onChange={e => patch({ qrWifiSsid: e.target.value })}
                  placeholder="Network name (SSID)"
                  style={qrInputStyle(fieldFs)}
                  data-testid={`qr-input-ssid-${widget.id}`}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={widget.qrWifiPassword || ''}
                    onChange={e => patch({ qrWifiPassword: e.target.value })}
                    placeholder="Password"
                    style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                    data-testid={`qr-input-pwd-${widget.id}`}
                  />
                  <select
                    value={widget.qrWifiSecurity || 'WPA'}
                    onChange={e => patch({ qrWifiSecurity: e.target.value as 'WPA' | 'WEP' | 'nopass' })}
                    style={{ ...qrInputStyle(fieldFs), width: 78, padding: '6px 4px' }}
                  >
                    <option value="WPA">WPA</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None</option>
                  </select>
                </div>
              </>
            )}
            {mode === 'vcard' && (
              <>
                <input
                  type="text"
                  value={widget.qrVcardName || ''}
                  onChange={e => patch({ qrVcardName: e.target.value })}
                  placeholder="Full name"
                  style={qrInputStyle(fieldFs)}
                  data-testid={`qr-input-vname-${widget.id}`}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={widget.qrVcardPhone || ''}
                    onChange={e => patch({ qrVcardPhone: e.target.value })}
                    placeholder="Phone"
                    style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                  />
                  <input
                    type="text"
                    value={widget.qrVcardEmail || ''}
                    onChange={e => patch({ qrVcardEmail: e.target.value })}
                    placeholder="Email"
                    style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                  />
                </div>
                <input
                  type="text"
                  value={widget.qrVcardOrg || ''}
                  onChange={e => patch({ qrVcardOrg: e.target.value })}
                  placeholder="Company (optional)"
                  style={qrInputStyle(fieldFs)}
                />
              </>
            )}
            {mode === 'email' && (
              <>
                <input
                  type="text"
                  value={widget.qrEmailTo || ''}
                  onChange={e => patch({ qrEmailTo: e.target.value })}
                  placeholder="recipient@example.com"
                  style={qrInputStyle(fieldFs)}
                  data-testid={`qr-input-email-to-${widget.id}`}
                />
                <input
                  type="text"
                  value={widget.qrEmailSubject || ''}
                  onChange={e => patch({ qrEmailSubject: e.target.value })}
                  placeholder="Subject (optional)"
                  style={qrInputStyle(fieldFs)}
                />
              </>
            )}
            {mode === 'geo' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={widget.qrGeoLat || ''}
                  onChange={e => patch({ qrGeoLat: e.target.value })}
                  placeholder="Lat"
                  style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                  data-testid={`qr-input-lat-${widget.id}`}
                />
                <input
                  type="text"
                  value={widget.qrGeoLon || ''}
                  onChange={e => patch({ qrGeoLon: e.target.value })}
                  placeholder="Lon"
                  style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                  data-testid={`qr-input-lon-${widget.id}`}
                />
                <input
                  type="text"
                  value={widget.qrGeoLabel || ''}
                  onChange={e => patch({ qrGeoLabel: e.target.value })}
                  placeholder="Label"
                  style={{ ...qrInputStyle(fieldFs), flex: 1.2 }}
                />
              </div>
            )}
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: 10, borderRadius: 8,
            background: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(255,255,255,0.08)',
            maxHeight: '60%', overflowY: 'auto',
          }} onKeyDown={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={qrLabelStyle()}>Logo URL</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={widget.qrLogoUrl || ''}
                onChange={e => patch({ qrLogoUrl: e.target.value })}
                placeholder="https://...png"
                style={{ ...qrInputStyle(fieldFs), flex: 1 }}
                data-testid={`qr-logo-url-${widget.id}`}
              />
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(129,140,248,0.4)',
                  color: '#c7d2fe', fontFamily: MONO_QR, fontSize: fieldFs - 1,
                }}
                title="Upload logo"
              >
                <Upload size={11} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
              {widget.qrLogoUrl && (
                <button
                  onClick={() => patch({ qrLogoUrl: '' })}
                  style={qrIconBtnStyle()}
                  title="Remove logo"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={qrLabelStyle()}>Foreground</span>
                <input
                  type="color"
                  value={fgColor.startsWith('#') ? fgColor : '#0f172a'}
                  onChange={e => patch({ qrFgColor: e.target.value })}
                  style={qrColorPickerStyle()}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={qrLabelStyle()}>Background</span>
                <input
                  type="color"
                  value={bgColor.startsWith('#') ? bgColor : '#ffffff'}
                  onChange={e => patch({ qrBgColor: e.target.value })}
                  style={qrColorPickerStyle()}
                />
              </div>
              <button
                onClick={() => patch({ qrFgColor: undefined, qrBgColor: undefined })}
                style={{ ...qrIconBtnStyle(), alignSelf: 'flex-end', marginBottom: 2 }}
                title="Reset colors"
              >
                <RefreshCw size={11} />
              </button>
            </div>

            {(widget.qrHistory || []).length > 0 && (
              <button
                onClick={() => patch({ qrHistory: [] })}
                style={{
                  ...qrIconBtnStyle(), alignSelf: 'flex-start',
                  padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: MONO_QR, fontSize: fieldFs - 1, color: '#fda4af',
                  borderColor: 'rgba(244,63,94,0.4)',
                }}
                data-testid={`qr-clear-history-${widget.id}`}
              >
                <Trash2 size={11} /> Clear history
              </button>
            )}
          </div>
        )}

        {/* QR + label */}
        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 6,
        }}>
          <div
            ref={svgWrapperRef}
            style={{
              background: bgColor,
              borderRadius: 8,
              padding: Math.max(4, size * 0.015),
              boxShadow: '0 0 0 1px rgba(99,102,241,0.25), 0 4px 24px rgba(0,0,0,0.4)',
              opacity: qrValue ? 1 : 0.35,
            }}
          >
            {qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={qrSize}
                // Logo embedded → must use level H so the QR survives
                // the cut-out region. Otherwise level Q is plenty.
                level={widget.qrLogoUrl ? 'H' : 'Q'}
                fgColor={fgColor}
                bgColor={bgColor}
                includeMargin={false}
                imageSettings={widget.qrLogoUrl ? {
                  src: widget.qrLogoUrl,
                  height: Math.round(qrSize * 0.22),
                  width:  Math.round(qrSize * 0.22),
                  excavate: true,
                } : undefined}
              />
            ) : (
              <div style={{
                width: qrSize, height: qrSize,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8,
              }}>
                <QrCode size={qrSize * 0.35} color="#94a3b8" strokeWidth={1.4} />
                <span style={{
                  fontFamily: MONO_QR, fontSize: 10, color: '#475569',
                  letterSpacing: '0.04em', textAlign: 'center', padding: '0 8px',
                }}>
                  Fill in fields to generate
                </span>
              </div>
            )}
          </div>
          {qrLabel && (
            <span style={{
              fontFamily: MONO_QR, fontSize: 10, color: '#cbd5e1',
              textAlign: 'center', maxWidth: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {qrLabel}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Copy + history strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 8, flexShrink: 0,
      }}>
        <button
          onClick={handleCopy}
          disabled={!qrValue}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 6,
            background: qrValue ? 'rgba(99,102,241,0.25)' : 'rgba(71,85,105,0.25)',
            border: `1px solid ${qrValue ? 'rgba(129,140,248,0.5)' : 'rgba(71,85,105,0.4)'}`,
            color: qrValue ? '#c7d2fe' : '#64748b',
            fontFamily: MONO_QR, fontSize: 10.5, fontWeight: 600,
            cursor: qrValue ? 'pointer' : 'not-allowed',
          }}
          data-testid={`qr-copy-${widget.id}`}
        >
          {copyState === 'copied'     ? <><Check size={11} /> Copied</> :
           copyState === 'downloaded' ? <><Check size={11} /> Saved</>  :
           copyState === 'failed'     ? <><X     size={11} /> Failed</> :
                                        <><Copy  size={11} /> Copy PNG</>}
        </button>
        <div style={{
          flex: 1, display: 'flex', gap: 4, alignItems: 'center',
          overflowX: 'auto', minWidth: 0,
        }}>
          <HistoryIcon size={11} color="#475569" style={{ flexShrink: 0 }} />
          {(widget.qrHistory || []).map((h, i) => (
            <button
              key={`${h.ts}-${i}`}
              onClick={() => restoreFromHistory(h)}
              title={`${h.mode}: ${h.label}`}
              style={{
                flexShrink: 0,
                padding: '3px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', cursor: 'pointer',
                fontFamily: MONO_QR, fontSize: 9, lineHeight: 1.2,
                maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              data-testid={`qr-history-${i}-${widget.id}`}
            >
              {h.label || h.value.slice(0, 16)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Small style helpers reused inside the QR widget — declared after the
// component so they're hoisted via JS function declarations.
function qrInputStyle(fontSize: number): React.CSSProperties {
  return {
    padding: '6px 8px',
    background: 'rgba(15,23,42,0.55)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: MONO_QR, fontSize, fontWeight: 500,
    outline: 'none', minWidth: 0, width: '100%',
    boxSizing: 'border-box',
  };
}
function qrLabelStyle(): React.CSSProperties {
  return {
    fontFamily: MONO_QR, fontSize: 9, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
    display: 'block', marginBottom: 4,
  };
}
function qrColorPickerStyle(): React.CSSProperties {
  return {
    width: '100%', height: 26, padding: 0, border: 'none',
    borderRadius: 4, background: 'transparent', cursor: 'pointer',
  };
}
function qrIconBtnStyle(): React.CSSProperties {
  return {
    padding: '6px 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#cbd5e1',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  GitHubPulseWidget — repo stats (stars, open PRs, last commit, latest release)
//  Backed by /api/github/repo/:owner/:repo (5 min cache).
// ─────────────────────────────────────────────────────────────────────────────

