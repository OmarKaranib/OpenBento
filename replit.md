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
- **Guest Access Model:** Full view, edit, and save access without login. Optional login via Email/Password or Google OAuth for cross-device syncing.

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
- **Note Widget:** Editable text area.
- **Spacer Widget:** Empty placeholder.
- **Image Widget:** Displays images, supporting local file uploads.
- **Default News Streams:** Automatically loads 6 pre-defined news streams (Sky News, ABC News, NASA, Reuters, Al Jazeera, France 24) in a 2x3 grid if `localStorage` is empty.
- **Blocked Channels Feature:** Allows users to hide channels from library views. Blocked channels are moved to a dedicated "Blocked" tab and can be unblocked. Persistence via `localStorage`.
- **Master Volume Sync:** A global "MUTED/LIVE" toggle in the menu bar mutes/unmutes all video widgets. Individual widget controls remain.
- **Authentication & Paywall System:** Leverages Supabase Auth for Email/Password and Google OAuth. The dashboard is public-first, with login being optional for cross-device synchronization.
- **Profiles Table (Paywall Foundation):** A `profiles` table stores user-specific data linked to Supabase auth.users by ID. Includes `is_premium` boolean field for future paywall implementation.
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