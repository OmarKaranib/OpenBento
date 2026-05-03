// CustomWidget — host runtime for third-party / user-authored widgets.
//
// Mounts a sandboxed iframe (`sandbox="allow-scripts"` only — no
// allow-same-origin, no top navigation, no forms) pointing at a user-supplied
// URL. The iframe talks to the host via a Zod-validated postMessage protocol
// (see shared/widget-sdk-protocol.ts) and the in-iframe SDK at
// /sdk/widget-sdk.v1.js.
//
// Per-instance state is namespaced on `widget.customWidgetState`, so two
// custom widgets on the same dashboard cannot read each other's data —
// each one only ever receives the state slice this host hands it.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, RefreshCw, Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import type { Widget } from './shared';
import {
  isAllowedCustomWidgetUrl,
  routeIframeMessage,
  PROTOCOL_VERSION,
  type HostMessage,
  type ThemeBundle,
} from '@shared/widget-sdk-protocol';

export interface CustomWidgetProps {
  widget: Widget;
  isDarkMode?: boolean;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

function buildThemeBundle(widget: Widget, isDarkMode: boolean | undefined): ThemeBundle {
  return {
    dark: !!isDarkMode,
    accent: '#22d3ee',
    customColor: widget.customColor ?? null,
    bg: widget.customColor ?? null,
  };
}

export function CustomWidget({ widget, isDarkMode, onUpdate }: CustomWidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Bumping iframeKey forces a full remount of the iframe (e.g. on Reload).
  const [iframeKey, setIframeKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Always-fresh ref to the widget so the postMessage handler closure
  // sees the latest state without re-binding the listener every patch.
  const widgetRef = useRef(widget);
  useEffect(() => { widgetRef.current = widget; }, [widget]);

  const isDarkRef = useRef<boolean | undefined>(isDarkMode);
  useEffect(() => { isDarkRef.current = isDarkMode; }, [isDarkMode]);

  const url     = widget.customWidgetUrl ?? '';
  const trusted = widget.customWidgetTrusted === true;
  const valid   = isAllowedCustomWidgetUrl(url);

  const post = useCallback((msg: HostMessage) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(msg, '*');
  }, []);

  // ─── postMessage listener — strictly source-checked + Zod-validated ───
  useEffect(() => {
    if (!trusted || !valid) return;

    const handler = (e: MessageEvent) => {
      routeIframeMessage(
        { source: e.source, data: e.data },
        {
          iframeWindow: iframeRef.current?.contentWindow,
          getState: () => (widgetRef.current.customWidgetState ?? {}) as Record<string, unknown>,
          getTheme: () => buildThemeBundle(widgetRef.current, isDarkRef.current),
          setState: (next) => {
            widgetRef.current = { ...widgetRef.current, customWidgetState: next };
            onUpdate?.(widgetRef.current.id, { customWidgetState: next });
          },
          setVersion: (v) => {
            if (v === widgetRef.current.customWidgetVersion) return;
            widgetRef.current = { ...widgetRef.current, customWidgetVersion: v };
            onUpdate?.(widgetRef.current.id, { customWidgetVersion: v });
          },
          post,
          onRefreshRequest: () => setIframeKey((k) => k + 1),
        },
      );
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [trusted, valid, onUpdate, post]);

  // ─── Theme broadcast on dashboard theme / colour change ────────────────
  useEffect(() => {
    if (!trusted || !valid) return;
    post({
      v: PROTOCOL_VERSION,
      id: 'theme-' + Date.now(),
      type: 'theme',
      payload: buildThemeBundle(widget, isDarkMode),
    });
  }, [isDarkMode, widget.customColor, trusted, valid, post, widget]);

  // ─── Resize broadcast on widget grid-size change ───────────────────────
  useEffect(() => {
    if (!trusted || !valid) return;
    post({
      v: PROTOCOL_VERSION,
      id: 'resize-' + Date.now(),
      type: 'resize',
      payload: { w: widget.w, h: widget.h },
    });
  }, [widget.w, widget.h, trusted, valid, post]);

  // ─── Render: empty / blocked / trust-prompt / live iframe ──────────────
  if (!url) {
    return (
      <Shell>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>No widget URL set.</p>
      </Shell>
    );
  }
  if (!valid) {
    return (
      <Shell>
        <ShieldAlert size={20} color="#f87171" />
        <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginTop: 6 }}>Blocked URL</p>
        <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, wordBreak: 'break-all' }}>{url}</p>
      </Shell>
    );
  }
  if (!trusted) {
    return (
      <Shell>
        <ShieldAlert size={22} color="#fbbf24" />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 8 }}>
          Run this third-party widget?
        </p>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, wordBreak: 'break-all', maxWidth: 260 }}>
          {url}
        </p>
        <p style={{ fontSize: 10, color: '#64748b', marginTop: 8, maxWidth: 260, lineHeight: 1.4 }}>
          The widget runs in a sandboxed iframe with no access to your dashboard data
          beyond what the SDK exposes. Only run widgets from sources you trust.
        </p>
        <button
          onClick={() => onUpdate?.(widget.id, { customWidgetTrusted: true })}
          style={{
            marginTop: 12, background: '#0891b2', color: '#fff',
            border: 'none', padding: '8px 18px', borderRadius: 6,
            cursor: 'pointer', fontWeight: 700, fontSize: 12,
          }}
          data-testid={`button-trust-custom-widget-${widget.id}`}
        >
          Run widget
        </button>
      </Shell>
    );
  }

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%',
        borderRadius: 6, overflow: 'hidden', background: widget.customColor ?? '#0f172a',
      }}
      data-testid={`custom-widget-${widget.id}`}
    >
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={url}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: 'transparent' }}
        title={`OpenBento custom widget ${widget.id}`}
        data-testid={`iframe-custom-widget-${widget.id}`}
      />

      {/* Floating settings handle — top-right, fades in on hover. */}
      <button
        onClick={() => setShowSettings(s => !s)}
        title="Custom widget settings"
        style={{
          position: 'absolute', top: 6, right: 6,
          width: 22, height: 22, borderRadius: 4,
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#cbd5e1', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
        data-testid={`button-custom-widget-settings-${widget.id}`}
      >
        <SettingsIcon size={12} />
      </button>

      {showSettings && (
        <div
          style={{
            position: 'absolute', top: 32, right: 6, width: 220,
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, padding: 10, fontSize: 11, color: '#cbd5e1',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#e2e8f0' }}>Custom widget</div>
          <div style={{ marginBottom: 6, wordBreak: 'break-all', color: '#94a3b8' }}>{url}</div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#64748b' }}>Version: </span>
            <span>{widget.customWidgetVersion || 'unknown'}</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#64748b' }}>Permissions: </span>
            <span>state, theme</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setIframeKey(k => k + 1); setShowSettings(false); }}
              style={pillBtn}
              data-testid={`button-custom-widget-reload-${widget.id}`}
            ><RefreshCw size={10} style={{ marginRight: 4 }} />Reload</button>
            <button
              onClick={() => onUpdate?.(widget.id, { customWidgetTrusted: false })}
              style={pillBtn}
              data-testid={`button-custom-widget-untrust-${widget.id}`}
            >Untrust</button>
            <a
              href={url} target="_blank" rel="noopener noreferrer"
              style={{ ...pillBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              data-testid={`link-custom-widget-open-${widget.id}`}
            ><ExternalLink size={10} style={{ marginRight: 4 }} />Open</a>
          </div>
        </div>
      )}
    </div>
  );
}

const pillBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
  padding: '4px 8px', fontSize: 10, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center',
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: '100%', height: '100%', background: '#0f172a',
      borderRadius: 6, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 16, boxSizing: 'border-box',
      border: '1px dashed #334155', textAlign: 'center',
    }}
  >
    {children}
  </div>
);
