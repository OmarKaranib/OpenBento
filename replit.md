# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a magnetic, bento-style Mission Control interface featuring a 12-column grid, dynamic widget system with drag-to-resize functionality, and YouTube/Twitch/Kick video integration. It features a 12-column grid, a dynamic widget system with drag-to-resize functionality, and integrates YouTube and Twitch with custom TV-style controls. The dashboard aims to provide a highly customizable and persistent workspace for monitoring and managing various streams and information, akin to a personalized mission control. Key capabilities include displaying video streams, notes, images, and spacers, all within a responsive, fit-to-screen layout with localStorage persistence.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard employs a 12-column magnetic grid with `grid-auto-flow: dense` to optimize widget placement and `gap: 1.6rem` (16px). A ghost placeholder layer of 72 cells (12x6) with dashed cyan borders provides a visual snapping guide for widgets. Blocks use solid background colors for better visibility.

**Bento.me Visual Overhaul:**
- **Typography:** Inter font (Google Fonts), font-weight 700 for headers, font-weight 500 for buttons/controls
- **Geometry:** 12px (1.2rem) border-radius on all blocks, 16px gap between blocks, 20px internal padding
- **Color Droplet:** Per-widget custom background color picker (visible in Edit Mode only), stored in widget's customColor field
- **Hover Effects:** Blocks scale up (scale: 1.02) with enhanced shadow on hover, 0.3s ease-in-out transitions
- **Persistence:** Custom colors saved with widget data

**Global Background Engine:**
- **BG Button:** Opens background customization popup in header
- **Color Picker:** 15 preset dark/neutral colors for site background
- **Image Uploader:** Upload custom background image (stored as dataURL in localStorage)
- **URL Input:** Paste image URL and press Enter to set as background
- **CSS:** Background uses background-size: cover, background-position: center, background-attachment: fixed
- **Persistence:** Background color saved to 'openBentoBgColor', image saved to 'openBentoBgImage' in localStorage
- **Architecture:** GlobalCanvasBackground component at App.tsx root level with fixed positioning (z-index: -9999), synced via 'globalBgUpdated' events

**Global Canvas Widget Transparency:**
- **Default Widgets:** Semi-transparent background rgba(15, 23, 42, 0.15) to show global background through blocks
- **Default Border:** Lighter version of background color using color-mix() CSS function
- **Custom Colors:** Solid (fully opaque) backgrounds with 50% lighter border for visual pop
- **Color Droplet Button:** Relocated to right side of widget controls (circular 4rem button matching Settings/Delete)

**Menu Bar Refinements (2026-02-01):**
- **Label Cleanup:** "Add Block" → "Block", "Edit Layout" → "Edit", "Refresh All" → "Refresh"
- **Edit-to-Save Toggle:** Edit button transforms to "Save" when clicked; clicking Save locks layout, saves to localStorage, and reverts to Edit
- **Dedicated Save Button:** Removed (integrated into Edit toggle)
- **Theme Toggle:** Dark/Light mode button added to menu bar with Moon/Sun icons
- **Content Purge:** All Music/Lofi/Radio content removed from sidebar, self-healing script, and data files

**True Light Mode (2026-02-01):**
- **High Contrast:** Light gray background (#f8f9fa), dark text (#1a1a1a for primary, #374151 for secondary)
- **Soft Shadows:** Dashboard slots use box-shadows instead of borders for depth
- **Token Overrides:** html.light class overrides all Tailwind CSS tokens (background, foreground, card, sidebar, etc.)
- **Text Visibility:** Slate text classes force dark colors in light mode via CSS overrides

**Channel Library Logos (2026-02-01):**
- **Logo URLs:** CHANNEL_LOGOS map stores official channel profile images
- **Platform-Specific Fallbacks:**
  - YouTube: `https://www.google.com/s2/favicons?domain=youtube.com&sz=128&url={channelUrl}`
  - Twitch: Google favicon API with channel URL
  - Kick: Google favicon API with channel URL
- **Generic Fallback:** Domain extraction from channel.url for favicon lookup
- **Final Failsafe:** Colored circle with first letter of channel name (category-colored: blue-news, purple-science, green-gaming, amber-finance, cyan-default)
- **Error Handling:** logoError state triggers colored circle fallback on image load failure

**Stream Library Mode (2026-02-01):**
- **dashboardOnlyMode flag:** Set to `false` in App.tsx to allow Block sidebar access
- **Block Button:** Menu bar button (no leading "+"), opens filtered sidebar showing News/Stream Library only
- **Sidebar Filtering:** Library tab hidden, only "News / Stream Library" tab visible
- **Builder Tools Hidden:** Note, Photo, Spacer, Video templates remain commented out
- **Purpose:** Allows adding streams from library while hiding all builder/template tools

**Menu Button Color Persistence (2026-02-01):**
- **menu-btn class:** Applied to +Block, Refresh, Edit/Save, BG, and Theme Toggle buttons
- **indicator-btn class:** Applied to MUTED/LIVE button for high-contrast dark text in light mode
- **CSS targeting:** Uses `.menu-btn` class directly instead of substring matching
- **Light mode:** `:not(.menu-btn)` excludes menu buttons from white background override
- **Text colors:** White text with text-shadow for colored buttons; amber and indicator buttons get dark text for contrast
- **LIVE Badge Lockdown:** `.live-badge` class preserves vibrant red in light mode for channel LIVE indicators

**Default News Streams (2026-02-02):**
- **Auto-Load:** When localStorage is empty, 6 default news streams load automatically
- **Default Channels:** Sky News Live, ABC News Live, NASA Live, Reuters Live, Al Jazeera, France 24
- **Grid Layout:** 2x3 arrangement (3 streams top row, 3 bottom row), each 4 columns × 3 rows
- **Widget Format:** Uses url, videoId, channelName, isYouTube, isLive properties for proper healing/refresh
- **Embed URLs:** Uses youtube-nocookie.com with autoplay=1, mute=1, and proper origin/parent parameters

**Guest Access Model (2026-02-02):**
- **Full Access:** All users can view, edit, and save dashboard without login
- **Edit/Save:** No login restrictions - Edit and Save buttons work for all users
- **Optional Login:** Login button available for users who want to sync across devices
- **Login Button:** Small, non-prominent slate-600 button on far right of menu bar
- **Login Modal:** Non-blocking popup with close (X) button, supports Email/Password and Google OAuth

**Blocked Channels Feature (2026-02-02):**
- **Block Button:** Trash icon (Trash2) on each channel card in stream library
- **Block Action:** Click trash to hide channel from main library views (All, News, Gaming categories)
- **Blocked Category:** Red "Blocked" tab button shows list of all blocked channels
- **Logo Persistence:** BlockedChannel interface stores all channel data (url, iconType, platform, channelId) to preserve logo display
- **Unblock Action:** Click trash again in Blocked view to restore channel to main library
- **Persistence:** Blocked channels saved to localStorage key 'openBentoBlockedChannels'
- **Count Badge:** Red badge shows number of blocked channels on the Blocked button
- **Event Sync:** 'blockedChannelsUpdated' custom event syncs state across components

**Supabase Backend (2026-02-02):**
- **Authentication:** Supabase Auth with Email/Password and Google OAuth
- **Database:** PostgreSQL for user dashboards and layouts
- **Credentials:** VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables
- **Client Library:** @supabase/supabase-js in client/src/lib/supabase.ts

**Authentication & Paywall System (2026-02-01):**
- **Supabase Auth Integration:** Uses Supabase authentication for Email/Password and Google OAuth
- **Public-First Model:** Full dashboard access without login
- **Login Button:** Small slate-600 button, visible when not logged in
- **User Avatar/Logout:** Shows user avatar + name when logged in, clicks to logout

**Core Features:**
- **Dynamic Widget System:** Supports Video, Note, Spacer, and Image widget types, each with unique functionalities. Widgets are added, removed, and content swapped dynamically.
- **Edit Layout Mode:** Toggles between locked and editable states, enabling widget resizing via bottom-right handles, and access to settings/delete options. Widgets jiggle in edit mode, and an overlay prevents iframe interaction during drag operations.
- **Fullscreen Mode:** Utilizes the browser's Fullscreen API, expanding the grid to 100vw and providing a hover-triggered header and an exit button.
- **TV Mode:** Iframes are set to `pointer-events: none` to facilitate drag interactions, with video controls managed via postMessage API.
- **Drag-to-Resize:** Widgets snap to grid cell sizes (1-12 columns, 1-6 rows) with real-time updates during dragging. Collision prevention logic moves or blocks resizing if no room is available.
- **Widget Sidebar ("Block Library"):** A slide-out sidebar positioned below the header, offering tabbed access to widget templates (Video, Note, Spacer, Photo) and preset live stream channels (NASA Live, Lofi Girl, Sky News, Kick.com, Twitch trending channels). It also includes URL input for video widgets and image upload functionality.
- **Content Swapping:** Allows updating the content of an existing widget by selecting it and then choosing a stream or entering a URL from the sidebar.
- **Responsive Scaling:** Uses `html { font-size: 62.5% }` and `rem` units for all dimensions to ensure consistent scaling across different screen sizes, adhering to Apple HIG standards.
- **Persistence:** Widget layouts and content are saved to `localStorage` using the key 'openBentoWidgets'.

**Widget Specifics:**
- **Video Widget:** Integrates YouTube, Twitch, and other embeddable URLs. Features custom TV-style controls (Mute/Unmute, Pause/Play, Refresh, Delete, Seek Mode) that appear on hover. Auto-detects YouTube video IDs and Twitch channels, using `window.location.hostname` for Twitch parent parameters. Supports permanent YouTube channel embeds for live streams. **Conditional Refresh Logic:** Live streams (`isLive: true`) refresh every 10 minutes (600,000ms) to check for new videoIds; normal videos (`isLive: false`) have no automatic refresh and stay on current videoId until user manually changes. The `isLive` flag is determined once when the video is added based on `liveBroadcastContent` detection from YouTube page scraping. Twitch and Kick are always treated as live. Manual URL submissions are treated as normal videos (no auto-refresh).
- **Note Widget:** Editable text area with yellow accent.
- **Spacer Widget:** Empty placeholder for layout with slate accent.
- **Image Widget:** Displays images, supporting local file uploads via `URL.createObjectURL` with a purple accent.

**Technical Implementations:**
- **Tech Stack:** React with TypeScript, Tailwind CSS for styling, `@dnd-kit/core` for drag-and-drop, `lucide-react` for icons.
- **Project Structure:**
    - `client/src/App.tsx`: DndContext wrapper, Widget state management, URL extraction.
    - `client/src/pages/dashboard.tsx`: Dashboard UI, widget rendering, resize logic.
    - `client/src/components/widget-sidebar.tsx`: Sidebar with widget templates and streams.
    - `client/src/index.css`: Theme colors, CSS variables, jiggle animation.

## External Dependencies
- **YouTube IFrame API:** For controlling YouTube video embeds (postMessage API).
- **Twitch Embeds:** For integrating Twitch streams, using `window.location.hostname` for parent parameters.
- **Kick.com Embeds:** For integrating Kick streams, using `player.kick.com` and parent parameters for SAMEORIGIN bypass.
- **@dnd-kit/core:** Drag-and-drop library.
- **@dnd-kit/sortable:** Sortable features for drag-and-drop.
- **@dnd-kit/utilities:** Utility functions for transforms in drag-and-drop.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.

## SEO & AI Discoverability (2026-02-01)
- **Meta Tags:** Comprehensive primary meta tags including title, description, keywords, author, robots directives
- **Open Graph:** Full Open Graph protocol tags for Facebook/social media sharing with og:image support
- **Twitter Cards:** Twitter-specific meta tags for enhanced tweet previews (summary_large_image)
- **Structured Data:** JSON-LD schema.org markup for WebApplication type with features, pricing, and ratings
- **AI Crawler Support:** 
  - robots.txt explicitly allows GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended
  - llms.txt file provides structured information for AI assistants
- **SEO Files:**
  - `/robots.txt` - Crawler directives and sitemap reference
  - `/sitemap.xml` - XML sitemap for search engine indexing
  - `/llms.txt` - AI/LLM-specific information file
- **Theme Colors:** Mobile browser theme color (#0f172a) for consistent branding
- **Canonical URL:** Prevents duplicate content issues with proper canonical link