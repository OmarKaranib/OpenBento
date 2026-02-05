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
- **Color Droplet:** Per-widget custom background color picker.
- **Hover Effects:** Blocks scale up (`scale: 1.02`) with enhanced shadow on hover.
- **Global Background Engine:** Users can set preset dark/neutral colors, upload custom images, or use image URLs as a global background.
- **Widget Transparency:** Default widgets have semi-transparent backgrounds to reveal the global background; custom-colored widgets are opaque.
- **Menu Bar Refinements:** Simplified labels, "Edit" button toggles to "Save" to lock layout and persist. Includes a Dark/Light theme toggle.
- **True Light Mode:** High contrast with light gray backgrounds and dark text.
- **Channel Library Logos:** Stores official channel profile images with platform-specific and generic fallbacks.
- **Stream Library Mode:** A `dashboardOnlyMode` flag filters the sidebar to show only "News / Stream Library" when adding blocks.
- **Menu Button Color Persistence:** Consistent styling for menu buttons across themes.
- **Guest Access Model:** View and edit access without login; optional login via Email/Password or Google OAuth for cross-device syncing.
- **Library Auth Lock:** Guest users cannot save channels to their personal library; prompts authentication.
- **Viral Ad Mechanic (Free Users Only):** Non-premium users experience a single viral ad block that spawns and expands on the dashboard. Ads spawn on the perimeter, expand into adjacent empty cells every 5 seconds, pushing widgets aside. A "Skip Ad" button dismisses the ad. Premium users are exempt.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports Video, Note, Spacer, and Image widget types.
- **Edit Layout Mode:** Toggles between locked and editable states, enabling drag-to-resize, settings, and delete options.
- **Fullscreen Mode:** Uses browser Fullscreen API.
- **TV Mode:** Iframes set to `pointer-events: none` with video controls via `postMessage` API.
- **Drag-to-Resize:** Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** Slide-out sidebar with tabbed widget templates and preset live stream channels.
- **Content Swapping:** Update existing widget content from the sidebar.
- **Responsive Scaling:** Uses `rem` units for consistent scaling.
- **Persistence:** Widget layouts and content are saved to `localStorage`.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls. Live streams refresh periodically to check for new video IDs.
- **True Live Filter:** YouTube streams are verified using YouTube Data API v3 to check `liveBroadcastContent`. Proactive and periodic revalidation for live status.
- **Dynamic Channel Resolution:** YouTube channels use Search API to get current live video IDs, with a "Check Again" button to re-trigger searches.
- **Dynamic Library Sorting & Hourly Validation:** Live streams are pinned to the top of the library list, followed by unknown status, then offline streams. Hourly revalidation occurs.
- **Smart Tiered localStorage Cache:** YouTube API responses are cached in `localStorage` with tiered TTLs for online, offline, and API error states.
- **ARCHITECTURE PIVOT: Multi-View Replication:** Decouples API from rendering, forcing embeds if `videoId` exists. Live status checks only update badge color.
- **TRUST THE VIDEOID:** If YouTube API returns a `liveVideoId`, the stream is considered LIVE. `liveBroadcastContent` values 'live' and 'upcoming' are treated as ONLINE.
- **Corporate Footer:** Professional footer with copyright and links to terms and privacy pages.
- **Note Widget:** Editable text area.
- **Spacer Widget:** Empty placeholder.
- **Image Widget:** Displays images, supporting local file uploads.
- **Default News Streams:** Automatically loads 6 pre-defined news streams if `localStorage` is empty.
- **Blocked Channels Feature:** Allows users to hide and manage blocked channels.
- **Master Volume Sync:** A global toggle mutes/unmutes all video widgets.
- **Authentication & Paywall System:** Leverages Supabase Auth for Email/Password and Google OAuth.
- **Profiles Table (Paywall Foundation):** A `profiles` table stores user-specific data including `is_premium` status.
- **Stripe Pro Subscription:** Integrated Stripe for recurring subscriptions. Includes pricing modal, promo code support, server-side price ID validation, and webhook handling. Enforces a 6-block limit for free users, with gated "Save Layout" functionality.
- **Admin Dashboard:** `/admin` route with client-side and server-side authorization. Features user list, premium toggle, channel manager (CRUD), channel auto-import, and system statistics.
- **Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core`, `lucide-react`.

## Production Repairs
- **YouTube Player Origin Fix:** Uses `origin: window.location.origin` in playerVars for dynamic domain handshake (works in dev + production)
- **Dashboard Badge Migration:** LIVE badges removed from dashboard widgets, kept only in ChannelLibrary/Sidebar
- **No-Cookie Toggle:** Switched from youtube-nocookie.com to youtube.com (standard player has fewer restriction issues)
- **Error 101/150 Loop Prevention:** Embed restriction errors (101, 150) do NOT trigger self-healing re-fetch - only recoverable errors [2, 5, 100]

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.
- **Supabase:** Backend for authentication and PostgreSQL database.
- **Stripe:** For managing recurring subscriptions.