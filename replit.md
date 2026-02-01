# Master Control Dashboard

## Overview
The Master Control Dashboard is a magnetic, bento-style Mission Control interface built upon OpenBento architecture standards. It features a 12-column grid, a dynamic widget system with drag-to-resize functionality, and integrates YouTube and Twitch with custom TV-style controls. The dashboard aims to provide a highly customizable and persistent workspace for monitoring and managing various streams and information, akin to a personalized mission control. Key capabilities include displaying video streams, notes, images, and spacers, all within a responsive, fit-to-screen layout with localStorage persistence.

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
- **CSS:** Background uses background-size: cover, background-position: center, background-attachment: fixed
- **Persistence:** Background color saved to 'openBentoBgColor', image saved to 'openBentoBgImage' in localStorage

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