// /dev/widgets — developer-facing documentation for the OpenBento Widget SDK.
//
// Plain-React, no shadcn dependency. Renders a single scrollable page with
// the SDK contract, message protocol, sandboxing rules, and a copyable
// example. Linked to from the "Custom Widget" sidebar entry.

import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

const code = (s: string) => (
  <pre
    style={{
      background: '#0f172a', color: '#e2e8f0',
      padding: 14, borderRadius: 8, overflow: 'auto',
      fontSize: 12, lineHeight: 1.55,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      border: '1px solid #1e293b',
    }}
  >{s}</pre>
);

export default function DevWidgetsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: '40px 20px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <Link
          href="/"
          data-testid="link-back-home"
          style={{ color: '#22d3ee', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, textDecoration: 'none' }}
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Widget SDK</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>
          Build sandboxed third-party widgets that mount inside the OpenBento dashboard
          and talk to the host via a tiny postMessage protocol. The SDK is dependency-free
          (~3&nbsp;KB) and served from <code style={{ color: '#22d3ee' }}>/sdk/widget-sdk.v1.js</code>.
        </p>

        <h2 style={h2}>1. Sandboxing model</h2>
        <p style={p}>
          Custom widgets run inside an iframe with the strict
          <code style={cInline}>sandbox="allow-scripts"</code> attribute and nothing else.
          That means: no <em>same-origin</em> access, no form submission, no top-level
          navigation, no popups. The iframe sees a fresh, unique origin and cannot read
          cookies, <code style={cInline}>localStorage</code>, or any DOM outside itself.
        </p>
        <p style={p}>
          The host validates every incoming postMessage against a Zod schema and ignores
          anything malformed. State is namespaced per widget instance —
          <strong> two custom widgets on the same dashboard cannot read each other's data</strong>.
        </p>

        <h2 style={h2}>2. Loading the SDK</h2>
        {code(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>My Widget</title>
  <script src="https://your-openbento-host/sdk/widget-sdk.v1.js"></script>
</head>
<body>
  <h1 id="hello">Hello</h1>
  <script>
    OpenBento.ready({ name: 'My Widget', version: '1.0.0' });
  </script>
</body>
</html>`)}

        <h2 style={h2}>3. SDK API</h2>
        <p style={p}>
          The SDK exposes a single global, <code style={cInline}>window.OpenBento</code>:
        </p>
        {code(`OpenBento.ready(meta?: { name?: string; version?: string }): void
OpenBento.getState<T>(): Promise<T>
OpenBento.setState<T>(patch: T): Promise<T>   // shallow merge, returns new state
OpenBento.onResize((ev: { w: number; h: number }) => void): void
OpenBento.onTheme((theme: ThemeBundle) => void): void
OpenBento.onRefresh((): void): void            // host asked us to repaint
OpenBento.requestRefresh(): void               // ask host to remount us`)}
        <p style={p}>
          <strong>Always call <code style={cInline}>ready()</code> first</strong> — the host
          uses it as the trigger to send the initial theme bundle. Until then no
          push messages will arrive.
        </p>

        <h2 style={h2}>4. Wire protocol</h2>
        <p style={p}>
          Every message — both directions — is an envelope of the form:
        </p>
        {code(`{ v: 1, id: string, type: string, payload?: unknown }`)}
        <p style={p}>
          <code style={cInline}>id</code> correlates a host response with the originating
          client request. The version is strict — a future v=2 will ship as a new SDK
          file at <code style={cInline}>/sdk/widget-sdk.v2.js</code>. Unknown or
          malformed messages are silently dropped.
        </p>

        <table style={{ width: '100%', fontSize: 13, marginBottom: 24, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              <th style={th}>Direction</th><th style={th}>type</th><th style={th}>payload</th>
            </tr>
          </thead>
          <tbody>
            <Row dir="iframe → host" type="ready"     payload="{ name?, version? }" />
            <Row dir="iframe → host" type="getState"  payload="—" />
            <Row dir="iframe → host" type="setState"  payload="Record<string, unknown>" />
            <Row dir="iframe → host" type="refresh"   payload="—" />
            <Row dir="host → iframe" type="state"     payload="Record<string, unknown>" />
            <Row dir="host → iframe" type="ack"       payload="Record<string, unknown> (next state)" />
            <Row dir="host → iframe" type="error"     payload="{ message: string }" />
            <Row dir="host → iframe" type="resize"    payload="{ w: number; h: number }" />
            <Row dir="host → iframe" type="theme"     payload="{ dark, accent, customColor, bg }" />
          </tbody>
        </table>

        <h2 style={h2}>5. Theme bundle</h2>
        {code(`interface ThemeBundle {
  dark: boolean;            // true when the dashboard is in dark mode
  accent: string;           // e.g. '#22d3ee'
  customColor: string | null; // per-widget tint (or null)
  bg: string | null;        // suggested background (matches customColor)
}`)}

        <h2 style={h2}>6. Permissions (v1)</h2>
        <p style={p}>
          v1 widgets are granted <strong>state</strong> and <strong>theme</strong>
          permissions only. They cannot call OpenBento APIs, access user data, or
          read other widgets' state. Network calls from inside the iframe are
          allowed but go through the iframe's own origin — they cannot impersonate
          the user against OpenBento.
        </p>

        <h2 style={h2}>7. Trust banner</h2>
        <p style={p}>
          When a user adds a custom widget, the dashboard shows a one-time
          confirmation banner ("Run this third-party widget?") before mounting
          the iframe. The trust decision is persisted on the widget — the user
          can untrust it later from the per-widget settings popover (gear icon).
        </p>

        <h2 style={h2}>8. Sample widget</h2>
        <p style={p}>
          A minimal Pomodoro timer is shipped at
          <code style={cInline}>/examples/widgets/pomodoro/index.html</code>
          and exposed in the Block Library's Custom Widget add modal as a
          one-click sample. It demonstrates ready / getState / setState
          round-trip and theme bridging in ~150 lines of HTML+JS.
        </p>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12, color: '#e2e8f0' };
const p:  React.CSSProperties = { color: '#cbd5e1', fontSize: 14, lineHeight: 1.65, marginBottom: 14 };
const cInline: React.CSSProperties = { background: '#0f172a', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#22d3ee', margin: '0 2px' };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #1e293b' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #1e293b', color: '#cbd5e1', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 };

const Row: React.FC<{ dir: string; type: string; payload: string }> = ({ dir, type, payload }) => (
  <tr>
    <td style={td}>{dir}</td>
    <td style={{ ...td, color: '#22d3ee' }}>{type}</td>
    <td style={td}>{payload}</td>
  </tr>
);
