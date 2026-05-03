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
// v1 policy: only http(s) URLs or same-origin absolute paths (e.g. our own
// /examples/widgets/<sample>). Explicitly blocks javascript:, data:, file:,
// blob:, vbscript:, and protocol-relative `//host/...` URLs.
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const DENY_PREFIXES = [
  'javascript:', 'data:', 'file:', 'blob:', 'vbscript:', 'about:',
];

export function isAllowedCustomWidgetUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  for (const bad of DENY_PREFIXES) if (lower.startsWith(bad)) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return true; // same-origin absolute path
  try {
    const u = new URL(trimmed);
    return ALLOWED_PROTOCOLS.includes(u.protocol);
  } catch {
    return false;
  }
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
