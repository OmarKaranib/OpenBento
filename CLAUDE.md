# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (Express + Vite on port 5000)
npm run build      # Build production bundle (client → dist/public, server → dist/index.cjs)
npm run start      # Run production server
npm run check      # TypeScript type checking (no emit)
npm run db:push    # Push Drizzle schema changes to PostgreSQL
```

No test runner is configured.

## Architecture

**Monorepo** with three top-level directories sharing TypeScript paths (`@/` → `client/src/`, `@shared/` → `shared/`):

- `client/` — React 18 + Vite SPA
- `server/` — Express 5 API server (same port 5000 serves both API and static files)
- `shared/` — Drizzle ORM schemas and TypeScript types shared across client and server

### Database

Drizzle ORM with PostgreSQL. Schema files live in `shared/models/`:
- `auth.ts` — sessions, users, profiles tables
- `streams.ts` — dashboards, widgets, channels, feedback, streamStatusCache, healingLog

`shared/schema.ts` re-exports all models as a barrel. Use `npm run db:push` (not migrations) to apply schema changes.

### Authentication — Dual Path

Two auth systems coexist:
1. **Replit OIDC** (`server/replit_integrations/auth/`) — Passport.js + OpenID Connect, session stored in PostgreSQL via `connect-pg-simple`, 7-day TTL, httpOnly cookie
2. **Supabase** (`client/src/lib/supabase.ts`) — Email/password + Google OAuth on the client side with PKCE flow; `use-auth.ts` includes 3-attempt exponential backoff retry logic

### Widget System

The dashboard (`client/src/App.tsx`) renders a **12-column bento grid** using `@dnd-kit` for drag-and-drop and resize. Widget types: `video`, `note`, `spacer`, `image`. Layout is persisted to localStorage (primary) and optionally synced to the server via `POST /api/dashboard`.

### Live Stream Pipeline

1. Widget sidebar searches YouTube via `/api/youtube/search-live/:channelHandle`
2. Returns `{ liveVideoId, latestVideoId, channelId }` — `latestVideoId` is the fallback when offline
3. Live status checks hit `/api/youtube/channel-live/:channelId` (YouTube Data API v3 `liveBroadcastContent` field)
4. Results are cached in localStorage with tiered TTLs: 30 min (online), 5 min (offline), 2 min (API error)
5. Stream healing (`POST /api/stream/heal`) re-searches for a live video and logs to `healingLog`

Twitch and Kick channels use their respective embed iframes directly (no API needed).

### Premium / Paywall

`profiles.isPremium` boolean controls access. Free tier is limited to 6 widgets; `ad-block.tsx` is rendered for free users. Stripe webhooks (`server/webhookHandlers.ts`) flip `isPremium = true` on subscription activation. Coupon codes: `BENTO2FREE`, `FREE2BENTO`.

### API Routes

All defined in `server/routes.ts`. Key groups:
- `/api/stream-status`, `/api/stream/heal`, `/api/youtube/*` — stream/media
- `/api/dashboard`, `/api/library` — user dashboard and channel library
- `/api/admin/*` — admin-only (gated by `ADMIN_EMAIL` env var)
- `/api/stripe/webhook` — Stripe event handling
- `/api/weather`, `/api/news`, `/api/zoom/signature` — third-party widget data
- `/api/feedback` — public, no auth required

### Client Routing

Uses **Wouter** (not React Router). Routes defined in `client/src/App.tsx`:
- `/` — main dashboard
- `/admin` — admin panel
- `/auth/reset-password`, `/terms`, `/privacy`, `/feedback`

### Environment Variables

Required at runtime (see `.replit` for Replit-managed secrets):
- `DATABASE_URL` — PostgreSQL connection string
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `YOUTUBE_API_KEY`
- `OPENWEATHER_API_KEY`, `NEWS_API_KEY`
- `RESEND_API_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client-side)
- `ADMIN_EMAIL` — comma-separated list for admin access
