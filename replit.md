# Master Control Dashboard

## Overview
A magnetic bento-style Mission Control Dashboard following OpenBento architecture standards. Features a 12-column grid layout with `grid-auto-flow: dense` for automatic gap-filling, dynamic widget system with drag-to-resize functionality, YouTube/Twitch integration with custom TV-style controls, and localStorage persistence.

## OpenBento Architecture

### Widget Structure
```typescript
interface Widget {
  id: string;       // Unique identifier
  type: WidgetType; // 'video' | 'note' | 'spacer' | 'image'
  x: number;        // Grid column position (0-11)
  y: number;        // Grid row position (0-5)
  w: number;        // Width in columns (1-12)
  h: number;        // Height in rows (1-6)
  // Type-specific fields
  url?: string;
  isYouTube?: boolean;
  videoId?: string | null;
  isTwitch?: boolean;
  twitchChannel?: string | null;
  isMuted: boolean;
  isPaused: boolean;
  noteContent?: string;
  imageUrl?: string;
}
```

### 12-Column Magnetic Grid (6 Rows Fit-to-Screen)
```css
display: grid;
grid-template-columns: repeat(12, 1fr);
grid-template-rows: repeat(6, 1fr);
grid-auto-flow: dense;
gap: 1rem;
```

### Ghost Placeholder Layer
- 72 background "ghost" cells (12×6) with dashed cyan borders
- border-radius: 1.2rem matching OpenBento style
- Widgets snap 1:1 to these placeholder cells

## Features
- **12-Column Grid**: OpenBento standard magnetic layout with dense packing
- **Ghost Placeholder Layer**: 72 dashed-border ghost cells (12×6) as visible background
- **Fullscreen Mode**: Toggle sidebar with width:0 transition and grid expands to 100vw
- **Fit-to-Screen**: Exactly 6 rows fit viewport height with overflow hidden - no scrolling
- **Glassmorphism Widgets**: backdrop-filter: blur(10px) with semi-transparent borders
- **Dynamic Widget System**: Unlimited widgets with add/remove functionality
- **Widget Types**: Video, Note, Spacer, Image - each with unique functionality
- **Drag-to-Resize**: Bottom-right resize handles in Edit Mode update w and h
- **YouTube/Twitch Integration**: Auto-detects URLs and generates proper embeds
- **TV-style Controls**: Mute, Pause, Refresh, Delete buttons per video widget (hover-only)
- **Master Mute**: Control all video audio simultaneously
- **Hover-Only Controls**: Video controls hidden by default, appear on widget hover
- **Content Swapping**: Selecting a widget then adding content updates that widget
- **localStorage Persistence**: Saves widgets with 'openBentoWidgets' key

## Widget Types
1. **Video Widget**: YouTube, Twitch, or any embeddable URL
   - Custom TV-style controls: Seek/Controls, Mute/Unmute, Pause/Play, Refresh, Delete
   - **Seek Mode**: Sliders icon button toggles iframe pointer-events for video seeking
     - When active: iframe has pointer-events: auto, "Done" button appears at bottom
     - Click "Done" to lock controls back to pointer-events: none
   - Controls appear on hover (opacity-0 → opacity-100 transition)
   - Auto-detection of YouTube video IDs and Twitch channels
   - Twitch parent parameter: `window.location.host.split(':')[0]`
2. **Note Widget**: Editable text area for notes
   - Yellow accent color
   - Content persisted with layout
3. **Spacer Widget**: Empty placeholder for layout spacing
   - Slate color
4. **Image Widget**: Display images with file upload
   - Purple accent color
   - Uses URL.createObjectURL for local file uploads

## Edit Layout Mode
- **Edit Layout button** toggles between locked and edit modes
- **Locked mode (default)**: Widgets display content normally, size labels hidden
- **Edit mode**:
  - Widgets jiggle (iOS-style animation)
  - Size labels (e.g., "3x2") visible in top-left corner
  - Resize handles appear on bottom-right corner (purple, cursor-se-resize)
  - Settings and Delete buttons appear on top-right
  - Transparent overlay (z-index: 9999) prevents iframe interference
  - Pointer-events: none on all iframes for drag interaction

## Fullscreen Mode
- **Fullscreen button**: Maximize2 icon toggles fullscreen state using browser Fullscreen API
- **Browser API Integration**: Uses document.requestFullscreen() to enter and document.exitFullscreen() to exit
- **ESC Key Support**: Pressing Escape key exits fullscreen (but does not enter it)
- **Exit Fullscreen X Button**: X icon appears at top center when entering fullscreen
  - Click X to dismiss button (stays in fullscreen for immersive mode)
  - Hover 15px zone at top center to reveal X button again
  - Click revealed button to exit fullscreen using browser API
- **Hover-triggered header**: Header slides up (translateY: -100%) when fullscreen is active
- **Edge-to-edge layout**: Canvas expands to full screen height, padding removed
- **All controls preserved**: Add Block, Refresh All, Edit Layout, Mute, Save buttons remain accessible

## Header Controls
- **"Add Block" button**: Always visible in header, opens sidebar to Streams tab
- **"Refresh All" button**: Re-renders all active iframes to clear hung streams
- **"EDIT LAYOUT / LOCK" button**: Toggles edit mode
- **"MUTED" button**: Master mute for all video widgets
- **"SAVE" button**: Manual save to localStorage

## TV Mode
- All iframes have `pointer-events: none` so they don't block drag interactions
- Video controls (Mute, Refresh) work via postMessage API for YouTube
- Edit Mode overlay enables resize and content editing

## Drag-to-Resize (OpenBento Style)
- Resize handle on bottom-right of every widget in Edit Mode
- Dragging the handle updates w and h values in real-time
- Mouse tracking calculates cell changes based on grid dimensions
- Widgets snap to grid cell sizes (1-12 columns, 1-6 rows)

## Widget Sidebar ("Block Library")
- Slide-out sidebar from left side, positioned **below the header** to avoid overlap
- **Sidebar z-index**: 100 (below header z-index: 10001)
- **Close Button**: X button in top-right of sidebar for manual dismissal
- **Tabbed Interface**: Library tab and Streams tab
- **Library Tab**: 4 unique block templates (one of each type)
  - Video (3x2)
  - Note (3x2)
  - Spacer (2x1)
  - Photo (3x2)
  - Templates are draggable OR clickable to add
- **Streams Tab**: Preset live stream channels (default when opened)
  - NASA Live, Lofi Girl, Sky News
  - Search/filter functionality
- **URL Input**: Add video widgets by URL (YouTube/Twitch auto-detected)
- **Image Upload**: Native file picker using URL.createObjectURL

## Content Swapping
- Click Settings (gear) button on a widget in Edit Mode
- Sidebar opens with that widget selected (shows "UPDATE WIDGET URL")
- Clicking a stream or entering a URL updates that widget
- No duplicate widgets created - existing widget content is swapped

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- @dnd-kit/core for drag-and-drop
- @dnd-kit/sortable (available)
- @dnd-kit/utilities for transforms
- lucide-react for icons
- localStorage for persistence
- YouTube IFrame API for video control (postMessage)

## Project Structure
- `client/src/App.tsx` - DndContext wrapper, Widget state management, URL extraction
- `client/src/pages/dashboard.tsx` - Dashboard UI, widget rendering, resize logic
- `client/src/components/widget-sidebar.tsx` - Sidebar with widget templates and streams
- `client/src/index.css` - Theme colors, CSS variables, jiggle animation

## Recent Changes
- **OpenBento Rebuild**: Complete architecture overhaul to 12-column grid
- **New Widget Structure**: {id, type, x, y, w, h, content} format
- **Twitch Fix**: Parent parameter uses `window.location.host.split(':')[0]`
- **TV Mode**: `pointer-events: none` on all iframes
- **Content Swap Logic**: Clicking streams/entering URLs updates existing widget when selected
- **Widget Edit Button**: Settings gear button on widgets in Edit Mode opens sidebar
- **Native File Upload**: "Upload from Computer" button for Image widgets
- **Verified Streams**: NASA Live, Lofi Girl, Sky News with direct YouTube embed URLs
- **Blueprint Background**: Aligned with 12-column grid using CSS variables (--grid-cols, --grid-gap)
- **Fullscreen Toggle**: PanelLeftClose icon button closes sidebar and expands grid to 100vw
- **Fit-to-Screen Layout**: overflow: hidden on canvas, h-full grid - no scrolling
- **Dimmed Grid Lines**: Blueprint lines at 0.04 opacity for subtle ruler appearance
- **Glassmorphism**: .dashboard-slot has backdrop-blur, semi-transparent bg, thin cyan border
- **Precision Dragging**: Uses rectIntersection collision detection for top-left border snapping
- **+ Block Button**: Renamed from "Add Widget", moved to header, always visible
- **Hover-Only Video Controls**: opacity-0 group-hover:opacity-100 on video control buttons
- **Pause Button**: Added pause/play functionality to video widget controls
- **Size Label Edit Mode**: Labels (e.g., "3x2") only visible in Edit Layout mode
- **Template Click**: Clicking sidebar templates directly adds widget and closes sidebar
- **Simplified Library**: 4 unique templates (Video, Note, Spacer, Photo) without size duplicates
- **Add Block Button**: Renamed from "+ Block" to "Add Block"
- **Refresh All Button**: New header button to re-render all active iframes
- **Edit Mode Overlay z-index**: Increased to 9999 to prevent iframe interference during drag
- **Hover-Triggered Fullscreen**: Header slides up and reveals on top 15px hover zone at center
- **Canvas Expansion**: Grid fills full screen when header is hidden in fullscreen mode
- **SortableWidget Component**: Uses useSortable hook with drag listeners on GripVertical handle only
- **Drag Reordering**: arrayMove in handleDragEnd for persistent widget reordering
- **GripVertical Drag Handle**: Top-left corner with cyan background, cursor-grab, touch-none class
- **Opacity-Based Exit Button**: Exit Fullscreen button uses opacity-0 → group-hover:opacity-100
- **High Z-Index Controls**: Grip handle and resize handle use z-index: 10000 above overlay
- **X Icon Exit Button**: Exit Fullscreen button now uses X icon, dismissible with click, revealed on hover
- **Widget Position Finding**: addWidget() uses findAvailablePosition() to auto-place widgets without overlap
- **No-Overlap Drop Rule**: handleDragEnd uses findNearestAvailable() spiral search for collision-free drops
- **Grid Position Styling**: Widgets use explicit gridColumn/gridRow based on x/y coordinates
- **useSortable Data**: SortableWidget includes { type: 'sortable-widget', widget } for drag identification
- **Sidebar Layout Fix**: Sidebar positioned below header using `top: calc(var(--header-height) + 1rem)` to prevent overlap
- **Sidebar Close Button**: X button in sidebar header for manual dismissal (data-testid="button-close-sidebar")
- **Fullscreen API Integration**: Toggle button uses document.requestFullscreen() / document.exitFullscreen()
- **ESC Key Exit**: Event listener on keydown exits fullscreen when Escape pressed (does not enter)
- **15px Hover Zone**: Reduced from 50px to 15px at top-center for revealing exit button
- **ghostPositionRef**: Added ref-based tracking for immediate ghost position access during drag
- **Seek Mode Feature**: New Sliders button in video controls toggles pointer-events for seeking
- **Done Button**: Appears at bottom center when seek mode active, click to lock controls
- **Fullscreen Recovery Fix**: ESC and Exit buttons now force header visible immediately
- **exitFullscreenAndRestoreHeader()**: Helper function ensures proper menu recovery on exit
- **Kick.com Integration**: player.kick.com embeds with parent parameter for SAMEORIGIN bypass
- **Trovo.live Integration**: player.trovo.live embeds with developer whitelist note
- **YouTube Live ID Watchdog**: 60-second auto-refresh cycle for error recovery
- **Layer Management**: Sidebar uses visibility/z-index instead of display:none for 24/7 connectivity
- **Platform Channels**: Added Kick (xQc, Adin Ross) and Trovo Gaming to trending streams

## Responsive Widget Scaling (Apple HIG Standard)
- Global scaling: html { font-size: 62.5% } makes 1rem = 10px
- All dimensions defined in rem units for consistent scaling
- CSS Variables for concentric geometry:
  - --outer-radius: 2rem (widget borders)
  - --inner-radius: calc(--outer-radius - 0.8rem) (inner elements)
  - --button-radius: calc(--outer-radius - 1rem) (buttons)
