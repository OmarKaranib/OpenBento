# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a highly customizable, bento-style Mission Control interface designed for monitoring and managing diverse information streams. It features a dynamic 12-column grid with drag-to-resize widgets, offering integrations for YouTube, Twitch, and Kick video streams with custom TV-style controls. The dashboard ensures persistent storage of user-defined layouts and widget content (videos, notes, images, spacers, clocks, tickers, weather, dictionary, QR portal), providing a responsive and personalized workspace that fits various screen sizes.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard is built on a 12-column magnetic grid system.

**UI/UX Decisions:**
- **Typography:** Uses Inter font with `font-weight: 700` for headers and `font-weight: 500` for buttons.
- **Geometry:** Features a 12px border-radius, 16px gap, and 20px internal padding.
- **Color Droplet:** Per-widget custom background color selection.
- **Hover Effects:** Widgets scale up (`scale: 1.02`) with enhanced shadow on hover.
- **Global Background Engine:** Supports preset dark/neutral colors, custom image uploads, or image URLs.
- **Widget Transparency:** Default widgets are semi-transparent; custom-colored widgets are opaque.
- **Menu Bar Refinements:** Simplified labels, "Edit" button toggles to "Save" to lock layout, and includes Dark/Light theme toggle.
- **True Light Mode:** High contrast with light gray backgrounds and dark text.
- **Channel Library Logos:** Stores official channel profile images with platform-specific and generic fallbacks.
- **Guest Access Model:** Allows view and edit access without login, with optional login for cross-device syncing.
- **Library Auth Lock:** Guest users cannot save channels to their personal library.
- **Viral Ad Mechanic (Free Users Only):** Non-premium users encounter a single expanding viral ad block that pushes widgets aside.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports various widget types including Video, Note, Spacer, Image, Clock, Crisis Ticker, Markets Ticker, Weather, Dictionary, QR Portal, World Clocks, Countdown, GitHub Pulse, RSS Headlines, Habit Tracker, Quick Launch, Big Text Marquee, Network Light, and Photo Loop.
- **Edit Layout Mode:** Toggles between locked and editable states for drag-to-resize, settings, and deletion.
- **Fullscreen Mode:** Utilizes the browser's Fullscreen API.
- **TV Mode:** Iframes use `pointer-events: none` with video controls managed via `postMessage` API.
- **Drag-to-Resize:** Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** A slide-out sidebar providing tabbed widget templates and preset live stream channels.
- **Content Swapping:** Allows updating existing widget content directly from the sidebar.
- **Responsive Scaling:** Uses `rem` units for consistent scaling across devices.
- **Persistence:** Widget layouts and content are saved to `localStorage`.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls. Includes "True Live Filter" via YouTube Data API v3, dynamic channel resolution, and "Latest-Video Fallback" when a channel is not live.
- **Dynamic Library Sorting & Hourly Validation:** Live streams are pinned to the top of the library.
- **Smart Tiered localStorage Cache:** Caches YouTube API responses with tiered TTLs.
- **Multi-View Replication Architecture:** Decouples API from rendering, forcing embeds if `videoId` exists.
- **Note Widget:** Markdown-aware notes with a View/Edit toggle, supporting headings, bold/italic text, inline code, links, lists, code blocks, rules, and GitHub-style task lists.
- **Image Widget:** Displays images and supports local file uploads.
- **Default News Streams:** Automatically loads 6 pre-defined news streams if `localStorage` is empty.
- **Blocked Channels Feature:** Users can hide and manage blocked channels.
- **Master Volume Sync:** A global toggle to mute/unmute all video widgets.
- **Authentication & Paywall System:** Leverages Supabase Auth for Email/Password and Google OAuth, with a `profiles` table for user data including `is_premium` status.
- **Stripe Pro Subscription:** Integrated Stripe for recurring subscriptions, enforcing a 6-block limit for free users.
- **Admin Dashboard:** An `/admin` route with client-side and server-side authorization, featuring user management, premium toggle, channel management (CRUD with soft-delete), channel auto-import, and system statistics.
- **Feedback System:** `feedback` table for user submissions, supporting messages, types, and optional screenshots. Public POST `/api/feedback` and admin-only GET `/api/admin/feedback`.
- **Supabase Auth Hardening:** Client initialized with `autoRefreshToken: true` and `persistSession: true` to prevent session timeouts.
- **QR Portal Widget v2:** Five-mode QR generator (URL/WiFi/vCard/Email/Geo) with proper URI builders, optional logo overlay (upload or URL) using error-correction level H, foreground/background colors that track the widget color droplet by default with manual overrides, copy-as-PNG via canvas raster (with download fallback when the Async Clipboard API can't carry image/png), and a debounced 5-entry history strip with one-click recall and clear.
- **GitHub Pulse Widget:** Owner-required + repo-optional input. With a repo, shows star count, open PR count, last commit (sha + message + relative time), and latest release tag (backed by `/api/github/repo/:owner/:repo`). With just an owner, switches to profile mode and shows the avatar, name, bio, public repos / followers / following counts, and top 5 repos by stars (backed by `/api/github/user/:owner`). Both routes use a 5-minute in-memory cache, honor `GITHUB_TOKEN` for higher rate limits, and serve stale cache on upstream errors. Auto-refetches every 5 minutes.
- **RSS Headlines Widget:** Paste any RSS or Atom feed URL to render a scrolling list of headlines with link-out, relative timestamps, and graceful empty / bad-feed states. Backed by `/api/rss?url=` (12-minute cache, http(s)-only validation, dynamic `rss-parser` import).
- **Dictionary Widget v2:** Search-first input that overrides the daily-seeded "Word of the Day" rotation (stable across reloads, rotates at midnight UTC). Surfaces phonetic spelling, audio playback (when `phonetics[].audio` exists), part of speech, definition, clickable synonym chips, and etymology. Star button + favorites dropdown persist up to 30 favorited words per widget via the `dictionaryFavorites` field.
- **First-Time Onboarding:** An `OnboardingFlow` component guides new guest users through initial setup, offering starter packs and coachmarks.
- **Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core`, `lucide-react`, `qrcode.react`.
- **Markets Ticker Widget:** Displays market data for crypto and stocks with sparklines, price, and 24h change. Allows adding, removing, and reordering symbols.
- **Crisis Ticker Upgrades (v2):** Per-widget filtering by source and category, deep-linking to articles, and a "BREAKING" indicator.
- **Time Widgets:**
    - **`world_clocks` widget:** A responsive grid displaying local times for selected cities.
    - **`countdown` widget:** Shows a live countdown to a target moment with customizable label and emoji.
    - **Clock Widget upgrades:** Includes a Pomodoro 25/5 preset, stopwatch laps, per-widget analog face toggle, and smooth seconds via `requestAnimationFrame`.
- **Productivity & Personal Widgets (Task #18):**
    - **Habit Tracker (`habit_tracker`):** Editable list of habits with a 30-day rolling check-grid; per-habit streak counter; local-day keys; auto-trims old entries to keep payload small.
    - **Quick Launch (`quick_launch`):** Up to 16 user-defined link tiles with auto-fetched favicons (`google.com/s2/favicons`), tile-grid columns of 2/3/4, normalized URL handling, and middle-click safe `target="_blank"` opens.
    - **Big Text Marquee (`big_text_marquee`):** Static or scrolling display text with bisect-fit font sizing in static mode and CSS-keyframe horizontal scroll in marquee mode; configurable speed, foreground, and background colors.
    - **Network Light (`network_light`):** Polls a user-supplied URL through `/api/ping` on a configurable interval (10s / 30s / 60s / 5m) and renders a traffic-light dot (green / amber / red) with last-checked relative time.
    - **Photo Loop (`photo_loop`):** Local-upload photo carousel (up to 20 images, 800KB each, stored as data URLs) with cover/contain fit, fade transitions, dot indicators, prev/next + pause controls, and intervals of 0/3/5/10/30 seconds.
    - All five Task #18 widgets follow the Task #10 Clock/WorldClocks/Countdown pattern for **light/dark theme awareness**: the per-widget colour droplet (`widget.customColor`) drives the outer background, then `isLightBg(bgColor)` flips text, accent, border, cell, and inert-surface colours so the widget reads cleanly on any chosen background (deep-dark default, pastel, white, neon, etc.). Photo Loop defaults to `#000` for photo presentation but honours customColor overrides; Big Text Marquee already had user-controlled `marqueeBgColor` and now derives a contrast-flipped fg/border when the bg is light.

**Server Endpoints:**
- `GET /api/github/repo/:owner/:repo` — Aggregated GitHub repo stats (5-minute in-memory cache).
- `GET /api/github/user/:owner` — GitHub user/org profile + top repos by stars (5-minute in-memory cache, stale-on-error).
- `GET /api/rss?url=` — Server-side RSS/Atom proxy with 12-minute cache and http(s)-only URL validation.
- `GET /api/ping?url=` — Lightweight uptime probe (HEAD with 5s timeout, no cache, manual redirects, http(s)-only) used by the Network Light widget.

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.
- **Supabase:** Backend for authentication and PostgreSQL database.
- **Stripe:** For managing recurring subscriptions.
- **OpenWeatherMap API:** Provides live weather data for the WeatherWidget.
- **NewsAPI.org:** Supplies live breaking news headlines for the CrisisTickerWidget.
- **CoinGecko:** Used for cryptocurrency market data in the Markets Ticker.
- **Yahoo Finance:** Used for stock market data in the Markets Ticker.
- **qrcode.react:** For client-side QR code generation.
- **rss-parser:** Server-side parsing of RSS/Atom feeds for the RSS Headlines widget.
- **GitHub REST API v3:** Repository, commit, search (PRs), and release endpoints powering the GitHub Pulse widget.
- **dictionaryapi.dev:** Free dictionary API used by the Dictionary widget for definitions, phonetics, audio, synonyms, and etymology.
- **Resend:** For sending feedback emails.
- **ws:** Server-side WebSocket library for the Cast Hub real-time channel.

**Cast to TV (Task #23):**
- **TV side:** `openbento.tv/cast` opens a fullscreen pairing screen with a 6-digit code that rotates every 60s. Once paired, the room id is stored in the TV's `localStorage` (`openBentoCastRoomId`) so subsequent reloads skip pairing entirely. A long-press of the "Hold to forget" hot-zone (revealed by hovering the top of the screen) unpairs locally and on the server.
- **Laptop side:** A "Cast" button in the menu bar (next to Dark/Light) opens a popover for pairing by code, listing all paired TVs (online/offline dot, last-pushed timestamp, rename, unpair, push, push-to-all). Paired-TV list persists in `localStorage` (`openBentoCastTVs`).
- **Push model:** Manual only — the laptop builds a `CastSnapshot` ({ widgets, isDarkMode, masterMute, pushedAt }) and POSTs it to the server, which broadcasts to every TV WebSocket in the room and stores `last_snapshot` in the `cast_rooms` DB table so a refreshed/reconnecting TV gets an instant replay.
- **Multi-TV:** A laptop can pair any number of TVs; "Push to all" fans out the snapshot in parallel. Each TV is its own room with its own room id.
- **Free tier:** No auth, no premium gate. The room id itself is the secret. No video relay — TVs fetch YouTube/Twitch/Kick embeds directly with `pointer-events: none`.
- **Server endpoints (server/services/cast-hub.ts):**
  - `POST /api/cast/codes` — TV creates a fresh room + 60s in-memory pairing code.
  - `POST /api/cast/pair { code }` — laptop consumes a code, returns `{ roomId, label }`.
  - `POST /api/cast/rooms/:id/push { snapshot }` — broadcasts + stores last snapshot (zod-validated, 4MB cap).
  - `PATCH /api/cast/rooms/:id { label }` — rename a TV (broadcasts to all peers).
  - `GET /api/cast/rooms/:id` — fetch label + last-pushed timestamp.
  - `DELETE /api/cast/rooms/:id` — unpair; closes WS and broadcasts `{type:'closed'}`.
  - `WS /ws/cast?roomId=…&role=tv|laptop` — single hub mounted via `httpServer.upgrade` and namespaced under `/ws/cast` so it doesn't collide with Vite's HMR socket.
- **Schema:** `cast_rooms` (id uuid, label, last_snapshot jsonb, last_pushed_at, created_at) declared in `shared/models/cast.ts`. Pairing codes are kept in-memory only (60s TTL) so a server restart drops pending codes but every paired room survives.
- **Abuse protection:** `/api/cast/codes` is rate-limited per-IP to 10 calls/60s window. Any room created by `/api/cast/codes` whose code expires before being paired is auto-deleted from the DB by a 30-second sweeper, so spamming pair-code creation can't bloat storage.