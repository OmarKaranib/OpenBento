# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a highly customizable, bento-style Mission Control interface designed for monitoring and managing various streams and information. It features a 12-column grid, a dynamic drag-to-resize widget system, and integrates YouTube, Twitch, and Kick video streams with custom TV-style controls. The dashboard supports persistent storage of layouts and widget content (videos, notes, images, spacers) and provides a responsive, fit-to-screen layout. It aims to offer users a personalized and dynamic workspace.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard is built on a 12-column magnetic grid with `grid-auto-flow: dense` and `gap: 1.6rem`. A visual ghost placeholder layer guides widget placement.

**UI/UX Decisions:**
- **Typography:** Inter font, `font-weight: 700` for headers, `font-weight: 500` for buttons.
- **Geometry:** 12px border-radius on all blocks, 16px gap, 20px internal padding.
- **Color Droplet:** Per-widget custom background color picker, stored in `customColor` field.
- **Hover Effects:** Blocks scale up (`scale: 1.02`) with enhanced shadow on hover, `0.3s ease-in-out` transitions.
- **Global Background Engine:** Allows users to set preset dark/neutral colors, upload custom images (dataURL), or use image URLs as a global background. Persistence is managed via `localStorage`.
- **Widget Transparency:** Default widgets have semi-transparent backgrounds (`rgba(15, 23, 42, 0.15)`) to reveal the global background. Custom-colored widgets are opaque.
- **Menu Bar Refinements:** Simplified labels ("Add Block" → "Block", "Edit Layout" → "Edit"), "Edit" button toggles to "Save" to lock layout and persist. Includes a Dark/Light theme toggle.
- **True Light Mode:** High contrast with light gray backgrounds and dark text, using soft shadows for depth. CSS overrides ensure token consistency.
- **Channel Library Logos:** Stores official channel profile images, with platform-specific fallbacks (Google favicon API for YouTube, Twitch, Kick) and a generic favicon lookup. A final fallback provides a colored circle with the first letter of the channel name.
- **Stream Library Mode:** A `dashboardOnlyMode` flag allows filtering the sidebar to only show "News / Stream Library" when adding blocks, hiding builder tools.
- **Menu Button Color Persistence:** Consistent styling for menu buttons across themes, with specific handling for high-contrast elements like the "LIVE" badge.
- **Guest Access Model:** View and edit access without login. Optional login via Email/Password or Google OAuth for cross-device syncing.
- **Library Auth Lock:** Guest users (not logged in) cannot save channels to their personal library. Clicking save shows a "Sign Up Required" modal prompting authentication.
- **Viral Ad Mechanic (Free Users Only):** Non-premium users experience a single viral ad block that spawns and expands on the dashboard:
  - **Single Ad Limit:** Only one ad instance (including its viral expansions) can exist at any given time. `isAdActive` flag tracks this.
  - **Trigger Logic:** Ad only spawns when user clicks "Start Building" or "Add Block" buttons. No passive spawning during viewing.
  - **Spawn Logic:** Ads spawn only on outer perimeter grid positions (edges), never center.
  - **Expansion Logic:** Every 5 seconds, the ad attempts to expand into adjacent empty cells. If a widget occupies the target cell, the system pushes it aside (shrink or move).
  - **No Overlap Rule:** Ad follows same collision logic as streams - occupies its own grid cells and pushes other blocks aside rather than overlapping.
  - **Widget Protection:** Widgets are never deleted, only shrunk or moved. If no safe move exists, expansion is skipped for that position.
  - **Skip Button:** Each ad shows a 5-second countdown, after which a "Skip Ad" button appears to dismiss the ad.
  - **Pro Immunity:** Premium users never see ads - all spawning is blocked and existing ads are cleared on premium status change.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports Video, Note, Spacer, and Image widget types.
- **Edit Layout Mode:** Toggles between locked and editable states. Enables drag-to-resize, settings, and delete options. Widgets "jiggle" in edit mode, and an overlay prevents iframe interaction during dragging.
- **Fullscreen Mode:** Uses browser Fullscreen API, expanding the grid to 100vw.
- **TV Mode:** Iframes set to `pointer-events: none` with video controls via `postMessage` API.
- **Drag-to-Resize:** Widgets snap to a 12x6 grid. Includes collision prevention.
- **Widget Sidebar ("Block Library"):** Slide-out sidebar with tabbed widget templates and preset live stream channels. Supports URL input and image uploads.
- **Content Swapping:** Update existing widget content from the sidebar.
- **Responsive Scaling:** Uses `rem` units for consistent scaling.
- **Persistence:** Widget layouts and content are saved to `localStorage` under 'openBentoWidgets'.
- **Video Widget:** Integrates YouTube, Twitch, and Kick. Features custom TV-style controls (Mute/Unmute, Play/Pause, Refresh, Delete, Seek). Auto-detects IDs and channels. Live streams (YouTube `isLive: true`, all Twitch/Kick) refresh every 10 minutes to check for new video IDs. Non-live videos do not auto-refresh.
- **True Live Filter:** YouTube streams are verified using YouTube API to check if they're actually live:
  - Backend endpoints: `/api/youtube/video-live/:videoId` and `/api/youtube/channel-live/:channelId` use YouTube Data API v3 to check `liveBroadcastContent` field
  - Proactive checking: 2 seconds after widgets load, their live status is verified via API
  - Periodic revalidation: Every 5 minutes, offline widgets are rechecked to detect if they've gone live again (automatic recovery)
  - Offline badge: Non-live streams display a prominent "OFFLINE" badge in top-left corner
  - Pulse cache: Background system tracks isLive status for cached channels
- **Dynamic Channel Resolution:** YouTube channels now use Search API to get current live video IDs:
  - When adding a channel from the library, `searchChannelLiveStream()` is called to find the current live stream
  - Channel handles are stored in `channelHandle` field for future searches
  - "Check Again" button re-triggers YouTube Search API to find NEW live video IDs when channels go live
  - Consistent state updates: isLive/isOffline/error/embedBlocked are always set together
- **Dynamic Library Sorting & Hourly Validation:**
  - Live streams (isLive === true) are pinned to top of library list
  - Offline streams (isLive === false) are moved to bottom of library list
  - Unknown status channels appear in the middle
  - Hourly revalidation (every 60 minutes) triggers YouTube eventType=live search with forceRefresh=true
  - Automatic promotion: offline streams that return live immediately jump to top
- **Smart Tiered localStorage Cache:**
  - YouTube API responses cached in localStorage with smart tiered TTLs
  - Cache key: `openbento_live_status_cache`, version key: `openbento_cache_version`
  - CURRENT_CACHE_VERSION = '2.4.0' - increment to force cache flush on load (quota optimization)
  - QUOTA OPTIMIZATION: Manual "Check Again" uses videos.list (1 unit) when videoId exists
  - All auto-refresh intervals DISABLED to save quota - only manual clicks trigger API calls
  - ONLINE_CACHE_TTL_MS = 30 minutes (for LIVE streams - stable, no need to re-check often)
  - OFFLINE_CACHE_TTL_MS = 5 minutes (for offline streams - faster re-check to detect going live)
  - API_ERROR_CACHE_TTL_MS = 2 minutes (for API errors - retry soon)
  - `checkChannelLiveStatus(channelId, forceRefresh)` - returns apiError flag, forceRefresh bypasses cache
  - `searchChannelLiveStream(channelHandle, forceRefresh)` - same caching pattern with apiError tracking
  - "Check Again" button uses forceRefresh=true to bypass cache for fresh data
  - On API errors (403, etc.), caches with apiError=true to distinguish from genuine offline
- **TRUST THE VIDEOID:**
  - If YouTube API returns a liveVideoId, the stream is considered LIVE - no further validation required
  - Client-side logic: `isLive = hasVideoId ? true : (data.isLive ?? false)`
  - This is the single source of truth for live status - videoId presence = LIVE
- **FALSE OFFLINE FIX:**
  - Stream is considered LIVE unless `liveBroadcastContent` is explicitly 'none'
  - liveBroadcastContent values: 'live' (currently live), 'upcoming' (scheduled), 'none' (not live)
  - Both 'live' and 'upcoming' are treated as ONLINE, only 'none' is treated as OFFLINE
- **Corporate Footer:** Professional footer displayed on dashboard and legal pages:
  - Copyright: "© 2026 ANCU LABS FZC LLC. All rights reserved."
  - Links to /terms and /privacy placeholder pages
- **Note Widget:** Editable text area.
- **Spacer Widget:** Empty placeholder.
- **Image Widget:** Displays images, supporting local file uploads.
- **Default News Streams:** Automatically loads 6 pre-defined news streams (Sky News, ABC News, NASA, Reuters, Al Jazeera, France 24) in a 2x3 grid if `localStorage` is empty.
- **Blocked Channels Feature:** Allows users to hide channels from library views. Blocked channels are moved to a dedicated "Blocked" tab and can be unblocked. Persistence via `localStorage`.
- **Master Volume Sync:** A global "MUTED/LIVE" toggle in the menu bar mutes/unmutes all video widgets. Individual widget controls remain.
- **Authentication & Paywall System:** Leverages Supabase Auth for Email/Password and Google OAuth. The dashboard is public-first, with login being optional for cross-device synchronization.
- **Profiles Table (Paywall Foundation):** A `profiles` table stores user-specific data linked to Supabase auth.users by ID. Includes `is_premium` boolean field for future paywall implementation.
- **Stripe Pro Subscription:** Integrated Stripe for recurring subscriptions via the Replit Stripe connector.
  - **Pricing Modal:** Crown button in header opens side-by-side comparison modal (Replit-style) with Free vs Pro columns. Free: $0/forever, Up to 6 streams, Ads included, ❌ Save Layout, ❌ Early Access. Pro: $8/mo or $80/year, Unlimited streams, No ads, ✅ Save Layout, ✅ Early Access.
  - **Promo Codes:** `allow_promotion_codes: true` enabled for Stripe checkout sessions.
  - **Security:** Server-side price ID allowlist validation prevents tampering - only valid price IDs are accepted.
  - **Stripe Price IDs:** Monthly: `price_1SwkV2PKTwXMfvTHKCHfRDud`, Yearly: `price_1SwkV3PKTwXMfvTH085lq6tA`
  - **Webhook Handling:** Stripe webhooks configured via Replit managed webhook setup for subscription sync.
  - **Free vs Pro Enforcement:** Strict feature gating enforced on frontend and backend:
    - **6-Block Limit:** FREE_BLOCK_LIMIT = 6, free users blocked from adding 7th widget. Add Block button shows "Limit" with Lock icon at capacity, clicks auto-trigger pricing modal.
    - **Edit Mode Unlocked:** Free users can enter Edit mode freely - drag, resize, and move their 6 blocks around.
    - **Save Layout Gated:** When free user clicks Save, shows toast notification ("Layout editing is temporary for Free users. Upgrade to Pro to save your custom dashboard forever!") and triggers pricing modal. Layout changes are not persisted. Lock icon appears next to Save text for free users.
    - **Backend Validation:** POST/PATCH /api/dashboard returns 403 for non-premium users attempting to save.
    - **Pro Unlock:** Premium users have unlimited blocks, full Save Layout functionality, hidden Pro crown button (already unlocked).
    - **Premium Status:** Fetched via /api/user/premium-status endpoint using usePremium hook, passed as prop to dashboard.
- **Admin Dashboard:** `/admin` route with client-side and server-side authorization for a single admin (`legionofoogabooga@gmail.com`). Features:
  - **User List:** Fetches all registered users from Supabase Admin API using SERVICE_ROLE_KEY. Displays email, auth provider (Google/Email), admin badge, premium badge, verification status, and last sign-in date.
  - **Premium Toggle:** Crown button next to each user allows admin to manually toggle premium status via `PATCH /api/admin/users/:id/premium`. Implements manual paywall control.
  - **Channel Manager:** Full CRUD operations for channels stored in PostgreSQL `channels` table.
  - **Channel Auto-Import:** On startup, channels from `links.json` are automatically imported to the database if not already present (94 channels).
  - **System Stats:** Live counts from database - total channels, live channels, YouTube/other platform breakdown.
  - **Auth:** Admin page uses Replit Auth (`/api/auth/user`) via `useReplitAuth` hook to match server-side session validation, while regular users use Supabase Auth. This dual-auth architecture is intentional.

**Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core`, `lucide-react`.

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.
- **Supabase:** Backend for authentication (Email/Password, Google OAuth) and PostgreSQL database for user dashboards/layouts.