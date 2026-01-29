# Master Control Dashboard

## Overview
A magnetic bento-style Mission Control Dashboard for monitoring multiple video sources and streams. Features a dynamic widget system with drag-to-resize functionality, YouTube/Twitch integration, flexible grid columns, master mute controls, and localStorage persistence.

## Features
- **Dynamic Widget System**: Unlimited widgets (no fixed slots) with add/remove functionality
- **Widget Types**: Video, Note, Spacer, Image - each with unique functionality
- **Magnetic Grid Layout**: CSS grid with `grid-auto-flow: dense` for automatic packing
- **Drag-to-Resize (OpenBento style)**: Bottom-right resize handles in Edit Mode
- **YouTube/Twitch Integration**: Auto-detects URLs and generates proper embeds
- **TV-style Playback Controls**: Mute, Pause, Refresh buttons per widget
- **Master Mute**: Control all video audio simultaneously
- **Column Density Dropdown**: 2-6 column options
- **localStorage Persistence**: Saves widgets and grid settings
- **Dark Sci-Fi Theme**: Cyan/purple accent colors with animated glow effects

## Widget Types
1. **Video Widget**: YouTube, Twitch, or any embeddable URL
   - Mute/Unmute, Pause/Play, Refresh controls
   - Auto-detection of YouTube video IDs and Twitch channels
2. **Note Widget**: Editable text area for notes
   - Yellow accent color
   - Content persisted with layout
3. **Spacer Widget**: Empty placeholder for layout spacing
   - Slate color
4. **Image Widget**: Display images (placeholder for now)
   - Purple accent color

## Edit Layout Mode
- **Edit Layout button** toggles between locked and edit modes
- **Locked mode (default)**: Widgets display content normally
- **Edit mode**:
  - Widgets jiggle (iOS-style animation)
  - Resize handles appear on bottom-right corner
  - Delete buttons appear on top-right
  - "Add Widget" button appears at end of grid
  - Pointer-events blocked on iframes for resize interaction

## Drag-to-Resize (OpenBento Style)
- Resize handle on bottom-right of every widget in Edit Mode
- Dragging the handle updates spanCols and spanRows in real-time
- Mouse tracking calculates cell changes based on grid dimensions
- Widgets snap to grid cell sizes (1-6 columns, 1-4 rows)

## Widget Sidebar
- Slide-out sidebar from left side
- **Tabbed Interface**: Widgets tab and Streams tab
- **Widgets Tab**: Draggable widget templates with size presets
  - Video (1x1, 2x2)
  - Note (1x1, 2x1)
  - Spacer (1x1)
  - Image (1x1, 2x2)
- **Streams Tab**: Preset live stream channels
  - Lofi Girl, NASA Live, CNA News, DW News, France 24, Al Jazeera
  - Search/filter functionality
- **URL Input**: Add video widgets by URL (YouTube/Twitch auto-detected)

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- @dnd-kit/core for drag-and-drop
- localStorage for persistence
- YouTube IFrame API for video control (postMessage)

## Project Structure
- `client/src/App.tsx` - DndContext wrapper, Widget state management, URL extraction
- `client/src/pages/dashboard.tsx` - Dashboard UI, widget rendering, resize logic
- `client/src/components/widget-sidebar.tsx` - Sidebar with widget templates and streams
- `client/src/index.css` - Theme colors, CSS variables, jiggle animation

## Architecture
- **Widget Interface**: id, type, spanCols, spanRows, plus type-specific fields
- **Dynamic List**: widgets[] array with add/remove operations
- **State in App.tsx**: widgets, gridCols, isEditMode, sidebarOpen
- **Magnetic Grid**: grid-auto-flow: dense ensures widgets pack efficiently
- **Resize State**: Tracks widgetId, startX/Y, startCols/Rows during resize
- **DndContext**: Handles channel and widget-template drag types

## CSS Grid Configuration
```css
display: grid;
grid-template-columns: repeat(${gridCols}, 1fr);
grid-auto-rows: 1fr;
grid-auto-flow: dense;
gap: 1rem;
```

## Recent Changes
- **Architecture Rebuild**: Switched from fixed 16-slot array to dynamic widgets list
- **OpenBento Resize**: Added drag-to-resize handles with mouse tracking
- **Widget Types**: Added Note, Spacer, Image widget types
- **Magnetic Layout**: Implemented grid-auto-flow: dense
- **Column Selector**: Replaced grid density with simple column count (2-6)
- **Widget Templates**: New sidebar tab with draggable widget type templates
- **Twitch Support**: Auto-detection of twitch.tv URLs
- **Reliable Streams**: Lofi Girl, NASA Live, CNA News, DW News, France 24, Al Jazeera

## Responsive Widget Scaling (Apple HIG Standard)
- Global scaling: html { font-size: 62.5% } makes 1rem = 10px
- All dimensions defined in rem units for consistent scaling
- CSS Variables for concentric geometry:
  - --outer-radius: 2rem (widget borders)
  - --inner-radius: calc(--outer-radius - 0.8rem) (inner elements)
  - --button-radius: calc(--outer-radius - 1rem) (buttons)
