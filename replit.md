# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a highly customizable, bento-style Mission Control interface for monitoring and managing various information streams. It features a 12-column grid, dynamic drag-to-resize widgets, and integrates YouTube, Twitch, and Kick video streams with custom TV-style controls. The dashboard supports persistent storage of layouts and widget content (videos, notes, images, spacers) and provides a responsive, fit-to-screen layout, aiming to offer users a personalized and dynamic workspace.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard is built on a 12-column magnetic grid.

**UI/UX Decisions:**
- **Typography:** Inter font, `font-weight: 700` for headers, `font-weight: 500` for buttons.
- **Geometry:** 12px border-radius, 16px gap, 20px internal padding.
- **Color Droplet:** Per-widget custom background color picker.
- **Hover Effects:** Blocks scale up (`scale: 1.02`) with enhanced shadow on hover.
- **Global Background Engine:** Users can set preset dark/neutral colors, upload custom images, or use image URLs.
- **Widget Transparency:** Default widgets are semi-transparent; custom-colored widgets are opaque.
- **Menu Bar Refinements:** Simplified labels, "Edit" button toggles to "Save" to lock layout. Includes Dark/Light theme toggle.
- **True Light Mode:** High contrast with light gray backgrounds and dark text.
- **Channel Library Logos:** Stores official channel profile images with platform-specific and generic fallbacks.
- **Guest Access Model:** View and edit access without login; optional login for cross-device syncing.
- **Library Auth Lock:** Guest users cannot save channels to their personal library.
- **Viral Ad Mechanic (Free Users Only):** Non-premium users experience a single viral ad block that expands on the dashboard, pushing widgets aside.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports Video, Note, Spacer, and Image widget types.
- **Edit Layout Mode:** Toggles between locked and editable states for drag-to-resize, settings, and delete.
- **Fullscreen Mode:** Uses browser Fullscreen API.
- **TV Mode:** Iframes set to `pointer-events: none` with video controls via `postMessage` API.
- **Drag-to-Resize:** Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** Slide-out sidebar with tabbed widget templates and preset live stream channels.
- **Content Swapping:** Update existing widget content from the sidebar.
- **Responsive Scaling:** Uses `rem` units for consistent scaling.
- **Persistence:** Widget layouts and content are saved to `localStorage`.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls.
- **True Live Filter:** YouTube streams are verified using YouTube Data API v3 to check `liveBroadcastContent`.
- **Dynamic Channel Resolution:** YouTube channels use Search API to get current live video IDs.
- **Dynamic Library Sorting & Hourly Validation:** Live streams pinned to top of library, followed by unknown, then offline streams.
- **Smart Tiered localStorage Cache:** YouTube API responses are cached with tiered TTLs.
- **ARCHITECTURE PIVOT: Multi-View Replication:** Decouples API from rendering, forcing embeds if `videoId` exists.
- **TRUST THE VIDEOID:** If YouTube API returns `liveVideoId`, stream is considered LIVE.
- **Latest-Video Fallback:** When YouTube channel is not live, system fetches most recent video from uploads playlist.
- **Corporate Footer:** Professional footer with copyright and legal links.
- **Note Widget:** Editable text area.
- **Spacer Widget:** Empty placeholder.
- **Image Widget:** Displays images, supporting local file uploads.
- **Default News Streams:** Automatically loads 6 pre-defined news streams if `localStorage` is empty.
- **Blocked Channels Feature:** Allows users to hide and manage blocked channels.
- **Master Volume Sync:** A global toggle mutes/unmutes all video widgets.
- **Authentication & Paywall System:** Leverages Supabase Auth for Email/Password and Google OAuth.
- **Profiles Table (Paywall Foundation):** A `profiles` table stores user-specific data including `is_premium` status.
- **Stripe Pro Subscription:** Integrated Stripe for recurring subscriptions. Enforces 6-block limit for free users.
- **Admin Dashboard:** `/admin` route with client-side and server-side authorization. Features user list, premium toggle, channel manager (CRUD with soft-delete), channel auto-import, and system statistics.
- **Soft Delete (Hide/Show):** Channels use `isVisible` boolean column.
- **Channel ID Sanitization:** Admin "Add Channel" form only accepts alphanumeric + dashes. Pasting a URL auto-extracts the channel slug. Backend PATCH/DELETE routes reject IDs containing slashes.
- **Feedback System:** `feedback` table (id, user_email, message, type, screenshot, created_at). POST `/api/feedback` is public (no auth required), accepts both `type/message` and `category/description` field formats plus optional `screenshot` (base64 data URL, .png/.jpg only, 5MB client limit). Saves to DB and sends email via Resend. GET `/api/admin/feedback` is admin-only. Feedback section in Admin Dashboard displays messages with bug/idea type badges and screenshot thumbnails (click to open full size). Standalone `feedback-modal.tsx` component with file upload UI for in-app modal feedback. Express JSON body limit set to 10mb for base64 payloads.
- **Supabase Auth Hardening:** Client initialized with `autoRefreshToken: true` and `persistSession: true` to prevent session timeouts. Auth hook includes exponential retry (up to 3 attempts) for session fetch failures and safe cleanup on unmount to prevent 504 errors.
- **Logo:** All logos use `/t.png` (stored in `client/public/t.png`).
- **Promo:** Dual coupon strategy in pricing modal. Monthly: `BENTO2FREE` (2 Months Free on Monthly). Yearly: `FREE2BENTO` ($16 off first Yearly purchase). Stripe checkout has `allow_promotion_codes: true`.
- **Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core`, `lucide-react`.

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.
- **Supabase:** Backend for authentication and PostgreSQL database.
- **Stripe:** For managing recurring subscriptions.