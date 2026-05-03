// Widget SDK postMessage protocol — Zod-validated message envelopes
// shared between the host (client/src/widgets/custom-widget.tsx) and the
// in-iframe SDK (client/public/sdk/widget-sdk.v1.js).
//
// Wire format (all messages):
//   { v: 1, id: string, type: '<verb>', payload?: ... }
//
// The `id` correlates a host response with the originating client request.
// Unknown messages are silently dropped by the host. The protocol is strictly
// versioned via the `v` field — a future v=2 must ship as a new SDK file.

import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

const idSchema = z.string().min(1).max(128);

// Branded helpers — generic over the literal so discriminated-union narrowing
// in `applyClientMessage` actually works (z.literal('foo') must infer to 'foo',
// not `string`).
const env = <L extends string, T extends z.ZodTypeAny>(typeLiteral: L, payload: T) =>
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    id: idSchema,
    type: z.literal(typeLiteral),
    payload,
  });

const envNoPayload = <L extends string>(typeLiteral: L) =>
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    id: idSchema,
    type: z.literal(typeLiteral),
    payload: z.undefined().optional(),
  });

// ─── iframe → host ────────────────────────────────────────────────────────
export const ReadyMessage = env('ready', z.object({
  name: z.string().max(64).optional(),
  version: z.string().max(32).optional(),
}));
export const GetStateMessage = envNoPayload('getState');
export const SetStateMessage = env('setState', z.record(z.string(), z.unknown()));
export const RefreshClientMessage = envNoPayload('refresh');

export const ClientMessageSchema = z.discriminatedUnion('type', [
  ReadyMessage,
  GetStateMessage,
  SetStateMessage,
  RefreshClientMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ─── host → iframe ────────────────────────────────────────────────────────
export const ThemeBundleSchema = z.object({
  dark: z.boolean(),
  accent: z.string(),
  customColor: z.string().nullable(),
  bg: z.string().nullable(),
});
export type ThemeBundle = z.infer<typeof ThemeBundleSchema>;

export const StateMessage  = env('state', z.record(z.string(), z.unknown()));
export const AckMessage    = env('ack',   z.record(z.string(), z.unknown()));
export const ErrorMessage  = env('error', z.object({ message: z.string() }));
export const ResizeMessage = env('resize', z.object({ w: z.number(), h: z.number() }));
export const ThemeMessage  = env('theme', ThemeBundleSchema);

export const HostMessageSchema = z.discriminatedUnion('type', [
  StateMessage, AckMessage, ErrorMessage, ResizeMessage, ThemeMessage,
]);
export type HostMessage = z.infer<typeof HostMessageSchema>;

// ─── URL allow / deny ─────────────────────────────────────────────────────
// The host evaluates every custom-widget URL against a *configurable*
// allow/deny pattern policy before mounting the iframe. The default policy
// (DEFAULT_CUSTOM_WIDGET_URL_POLICY) hard-codes the v1 contract:
//   • only http: and https: URLs
//   • plus same-origin absolute paths (e.g. our /examples/widgets/<id>)
//   • protocol-relative `//host/...` URLs are always blocked
//   • dangerous schemes (javascript:, data:, file:, blob:, vbscript:,
//     about:) are always blocked, even if you add them to allowedSchemes.
//
// Hosts can supply additional `allowPatterns` / `denyPatterns` (matched
// against the trimmed URL) to express things like "only widgets on our
// CDN" or "block this specific compromised vendor". `denyPatterns` are
// always evaluated first, so a deny match wins over any allow match.
const ALWAYS_DENY_SCHEMES = [
  'javascript:', 'data:', 'file:', 'blob:', 'vbscript:', 'about:',
];

export interface CustomWidgetUrlPolicy {
  /** URL schemes considered safe (e.g. ['http:', 'https:']). */
  allowedSchemes?: string[];
  /** When true, same-origin absolute paths beginning with `/` are allowed. */
  allowSameOriginPaths?: boolean;
  /** Extra regexes — a URL is allowed if it matches any one of these
   *  *in addition to* the scheme/path checks. */
  allowPatterns?: RegExp[];
  /** Extra regexes — a URL is rejected outright if it matches any of these,
   *  regardless of scheme. Evaluated before everything else. */
  denyPatterns?: RegExp[];
}

export const DEFAULT_CUSTOM_WIDGET_URL_POLICY: Required<CustomWidgetUrlPolicy> = {
  allowedSchemes: ['http:', 'https:'],
  allowSameOriginPaths: true,
  allowPatterns: [],
  denyPatterns: [],
};

export function isAllowedCustomWidgetUrl(
  raw: unknown,
  policy: CustomWidgetUrlPolicy = {},
): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  // 1. Hard-coded never-allow schemes (cannot be overridden).
  for (const bad of ALWAYS_DENY_SCHEMES) if (lower.startsWith(bad)) return false;

  // 2. Caller-supplied deny patterns win over any allow rule.
  const merged: Required<CustomWidgetUrlPolicy> = {
    ...DEFAULT_CUSTOM_WIDGET_URL_POLICY,
    ...policy,
  };
  for (const re of merged.denyPatterns) if (re.test(trimmed)) return false;

  // 3. Protocol-relative URLs (`//evil.com/...`) are always blocked.
  if (trimmed.startsWith('//')) return false;

  // 4. Same-origin absolute paths.
  if (trimmed.startsWith('/')) return merged.allowSameOriginPaths === true;

  // 5. Otherwise, must parse as a URL with an allowed scheme — or match
  //    one of the explicit allowPatterns (which can opt in to e.g.
  //    custom protocols if a host really wants to).
  try {
    const u = new URL(trimmed);
    if (merged.allowedSchemes.includes(u.protocol)) return true;
  } catch {
    /* fall through */
  }
  for (const re of merged.allowPatterns) if (re.test(trimmed)) return true;
  return false;
}

// ─── Built-in sample registry ─────────────────────────────────────────────
// Tiny curated list users can pick from in the "Custom Widget" add modal.
// New samples should ship as standalone HTML under
// client/public/examples/widgets/<id>/index.html so they're served from the
// same origin (and thus auto-trusted by the URL allow-list).
export interface SampleCustomWidget {
  id: string;
  name: string;
  url: string;
  description: string;
}

export const SAMPLE_CUSTOM_WIDGETS: ReadonlyArray<SampleCustomWidget> = [
  {
    id: 'pomodoro',
    name: 'Pomodoro Timer',
    url: '/examples/widgets/pomodoro/index.html',
    description:
      'A 25/5 focus timer that demonstrates setState / getState round-trip and theme bridging.',
  },
];

// ─── Pure host reducer ────────────────────────────────────────────────────
// Pulled out of custom-widget.tsx so it can be unit-tested without a DOM.
// Given the current per-instance state and an incoming validated message,
// returns the next state plus the host response (or null if no response).
export interface ApplyClientMessageResult {
  nextState: Record<string, unknown>;
  response: HostMessage | null;
}

// ─── Host iframe message router ───────────────────────────────────────────
// Pure helper that wraps the source-check + Zod validation + reducer call
// the host runtime performs on every incoming postMessage. Lifted out of
// custom-widget.tsx so it can be unit-tested without a DOM/JSDOM (the
// caller injects a fake event with `source` + `data` and assertion-friendly
// callbacks for state / version / post). Two router instances created with
// different `iframeWindow` references will *never* observe each other's
// state because the source-check on line 1 rejects non-matching events.
export interface HostMessageRouterContext {
  iframeWindow: unknown;                              // contentWindow ref to compare e.source against
  getState: () => Record<string, unknown>;
  getTheme: () => ThemeBundle;
  setState: (next: Record<string, unknown>) => void;
  setVersion: (version: string) => void;
  post: (msg: HostMessage) => void;
  onRefreshRequest: () => void;
}

export function routeIframeMessage(
  event: { source?: unknown; data?: unknown },
  ctx: HostMessageRouterContext,
): void {
  if (!ctx.iframeWindow || event.source !== ctx.iframeWindow) return;
  const parsed = ClientMessageSchema.safeParse(event.data);
  if (!parsed.success) return; // silently drop malformed messages

  const msg = parsed.data;
  const { nextState, response } = applyClientMessage(ctx.getState(), msg, ctx.getTheme());

  if (msg.type === 'setState') ctx.setState(nextState);
  if (msg.type === 'ready' && msg.payload && typeof msg.payload.version === 'string') {
    ctx.setVersion(msg.payload.version);
  }
  if (msg.type === 'refresh') ctx.onRefreshRequest();
  if (response) ctx.post(response);
}

export function applyClientMessage(
  state: Record<string, unknown>,
  msg: ClientMessage,
  theme: ThemeBundle,
): ApplyClientMessageResult {
  switch (msg.type) {
    case 'ready':
      return {
        nextState: state,
        response: { v: PROTOCOL_VERSION, id: msg.id, type: 'theme', payload: theme },
      };
    case 'getState':
      return {
        nextState: state,
        response: { v: PROTOCOL_VERSION, id: msg.id, type: 'state', payload: state },
      };
    case 'setState': {
      const next = { ...state, ...msg.payload };
      return {
        nextState: next,
        response: { v: PROTOCOL_VERSION, id: msg.id, type: 'ack', payload: next },
      };
    }
    case 'refresh':
      // The host treats a refresh request as "remount the iframe". Nothing
      // to send back — the iframe will be torn down and the new instance
      // will issue its own `ready`.
      return { nextState: state, response: null };
    default: {
      // Exhaustiveness guard — TS will complain here if a new verb is
      // added to ClientMessageSchema without handling it above.
      const _never: never = msg;
      return { nextState: state, response: null };
    }
  }
}
