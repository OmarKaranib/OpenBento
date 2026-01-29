# Master Control Dashboard

## Overview
A magnetic bento-style Mission Control Dashboard following OpenBento architecture standards. Features a 12-column grid layout with `grid-auto-flow: dense` for automatic gap-filling, dynamic widget system with drag-to-resize functionality, YouTube/Twitch integration with custom TV-style controls, and localStorage persistence.

## OpenBento Architecture

### Widget Structure
```typescript
interface Widget {
  id: string;       // Unique identifier
  type: WidgetType; // 'video' | 'note' | 'spacer' | 'image'
  x: number;        // Grid column position (reserved for future drag positioning)
  y: number;        // Grid row position (reserved for future drag positioning)
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

### 12-Column Magnetic Grid
```css
display: grid;
grid-template-columns: repeat(12, 1fr);
grid-auto-rows: 1fr;
grid-auto-flow: dense;
gap: 1rem;
```

## Features
- **12-Column Grid**: OpenBento standard magnetic layout with dense packing
- **Blueprint Background**: Professional dashed grid pattern visible behind widgets
- **Fullscreen Mode**: Toggle sidebar visibility with PanelLeftClose/PanelLeftOpen button
- **20-Row Canvas**: Large "infinite canvas" feel with minimum 1600px height
- **Glassmorphism Widgets**: backdrop-filter: blur(10px) with semi-transparent borders
- **Dynamic Widget System**: Unlimited widgets with add/remove functionality
- **Widget Types**: Video, Note, Spacer, Image - each with unique functionality
- **Drag-to-Resize**: Bottom-right resize handles in Edit Mode update w and h
- **YouTube/Twitch Integration**: Auto-detects URLs and generates proper embeds
- **TV-style Controls**: Mute, Refresh buttons per video widget (no Pause)
- **Master Mute**: Control all video audio simultaneously
- **Content Swapping**: Selecting a widget then adding content updates that widget
- **localStorage Persistence**: Saves widgets with 'openBentoWidgets' key

## Widget Types
1. **Video Widget**: YouTube, Twitch, or any embeddable URL
   - Custom TV-style controls: Mute/Unmute, Refresh
   - Delete button in Edit Mode
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
- **Locked mode (default)**: Widgets display content normally
- **Edit mode**:
  - Widgets jiggle (iOS-style animation)
  - Resize handles appear on bottom-right corner
  - Settings and Delete buttons appear on top-right
  - "Add Widget" button appears at end of grid
  - Pointer-events: none on all iframes for drag interaction

## TV Mode
- All iframes have `pointer-events: none` so they don't block drag interactions
- Video controls (Mute, Refresh) work via postMessage API for YouTube
- Edit Mode overlay enables resize and content editing

## Drag-to-Resize (OpenBento Style)
- Resize handle on bottom-right of every widget in Edit Mode
- Dragging the handle updates w and h values in real-time
- Mouse tracking calculates cell changes based on grid dimensions
- Widgets snap to grid cell sizes (1-12 columns, 1-6 rows)

## Widget Sidebar
- Slide-out sidebar from left side
- **Tabbed Interface**: Widgets tab and Streams tab
- **Widgets Tab**: Draggable widget templates with size presets
  - Video (3x2, 6x3)
  - Note (3x2, 4x1)
  - Spacer (2x1)
  - Image (3x2, 4x3)
- **Streams Tab**: Preset live stream channels
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
- **Blueprint Background**: CSS-based dashed grid pattern using repeating-linear-gradient
- **Fullscreen Toggle**: PanelLeftClose icon button in header to hide sidebar
- **20-Row Canvas**: gridRows = 20, minCellHeight = 80px for large canvas feel
- **Glassmorphism**: .dashboard-slot has backdrop-blur, semi-transparent bg, thin cyan border

## Responsive Widget Scaling (Apple HIG Standard)
- Global scaling: html { font-size: 62.5% } makes 1rem = 10px
- All dimensions defined in rem units for consistent scaling
- CSS Variables for concentric geometry:
  - --outer-radius: 2rem (widget borders)
  - --inner-radius: calc(--outer-radius - 0.8rem) (inner elements)
  - --button-radius: calc(--outer-radius - 1rem) (buttons)
