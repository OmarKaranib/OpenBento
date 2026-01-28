# Master Control Dashboard

## Overview
A 16-slot Mission Control Dashboard for monitoring multiple video sources and streams. Features YouTube integration with IFrame API controls, flexible grid density dropdown, master mute controls, smart fallback for blocked embeds, legal footer/disclosure, and localStorage persistence.

## Features
- 16 video/stream monitoring slots with CSS grid spanning support
- Grid Density dropdown: 2 (1x2), 4 (2x2), 6 (2x3), 9 (3x3), 12 (3x4), 16 (4x4) slots
- Single-screen enforcement: All slots visible without scrolling using grid-template-rows with 1fr units
- YouTube video integration via embed URLs (auto-converts standard links)
- YouTube IFrame API controls: individual Mute and Pause buttons per slot
- Master mute control for all slots
- Add/remove video sources dynamically
- Smart fallback: "Open in Official Widget Mode" button for sites that block iframes
- Legal footer with copyright and Legal button for disclaimer popup
- Save layout to localStorage (includes grid density preference and slot spans)
- Dark theme with cyan/purple accent colors
- Animated scan line effect

## Edit Layout Mode (Interaction Lock)
- **Edit Layout button** in header toggles between locked and edit modes
- **Locked mode (default)**: Click large (+) ADD button to open sidebar and add sources
- **Edit mode**: Slots jiggle (iOS-style animation) and become draggable
- Purple border indicates edit mode is active
- Pointer-events: none overlay on iframes during edit mode for drag sensor compatibility
- Internal clicks disabled in edit mode to prevent accidental interactions

## Widget Sidebar with Drag-and-Drop
- Slide-out sidebar from left side when clicking slot's (+) ADD button
- **URL Input at top** below tabs - shows "ADD TO SLOT X" label
- **Tabbed Interface**: Content tab (channels/search) and Layout tab (widget sizes)
- Search bar to filter channels (Content tab)
- Trending Channels section with 10 preset live streams
- **Layout Blocks section** with draggable widget size templates:
  - Standard (2x2): Spans 2 columns, 2 rows
  - Wide (2x4): Spans 4 columns, 2 rows
  - Large (4x4): Spans 4 columns, 4 rows
- Drag-and-drop integration using @dnd-kit/core and @dnd-kit/sortable
- Click channel to add to first available empty slot
- Vertical compaction algorithm reflows active slots when grid density changes

## Precision Dragging
- Custom collision detection with 50%+ overlap threshold
- Requires significant overlap before slots push out of the way
- Prevents accidental jumping during drag operations
- Increased activation distance (15px) for drag initiation

## Live Reordering (iOS Home Screen Style)
- **rectSortingStrategy** for iOS-like "running away" behavior
- Slots shift smoothly to make room during drag operations
- Active slot scales to 1.05x with cyan drop shadow while dragging
- Other slots animate with 0.3s ease transition when reordering
- Jiggle animation applied to visible slot wrapper (doesn't conflict with dnd-kit transforms)

## CSS Grid Spanning
- Slots have spanCols and spanRows properties (default 1x1)
- Layout blocks set span values when dropped on slots
- Uses grid-column: span X and grid-row: span Y
- Grid maintains 1fr units for full-screen persistence

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities for drag-and-drop
- localStorage for persistence
- YouTube IFrame API for video control (postMessage)

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard with DndContext and SortableContext
- `client/src/components/widget-sidebar.tsx` - Tabbed sidebar with channels and layout blocks
- `client/src/App.tsx` - App router
- `client/src/index.css` - Theme colors (slate/cyan/purple), CSS variables
- `tailwind.config.ts` - Tailwind configuration with jiggle animation

## Recent Changes
- Slot UI overhaul: large centered (+) ADD button fills entire empty slot area
- Relocated URL input to sidebar top below Content/Layout tabs
- Added pointer-events: none overlay on iframes during Edit Mode
- Updated Spanning Guide to match 2x2, 2x4, 4x4 templates
- Added Edit Layout toggle button with lock/unlock logic
- Implemented iOS-like jiggle animation for edit mode
- Created custom collision detection with 50%+ overlap threshold
- Updated Layout tab with 2x2, 2x4, 4x4 templates
- Moved jiggle animation to inner wrapper to avoid dnd-kit transform conflicts
- Increased activation distance for precision dragging

## Responsive Widget Scaling (Apple HIG Standard)
- Global scaling: html { font-size: 62.5% } makes 1rem = 10px
- All dimensions defined in rem units for consistent scaling
- CSS Variables for concentric geometry (Squircle Rule):
  - --outer-radius: 2rem (slot borders)
  - --inner-radius: calc(--outer-radius - 0.8rem) (inner elements)
  - --button-radius: calc(--outer-radius - 1rem) (buttons)
- Breakpoints:
  - Desktop (>768px): 4-column grid, sidebar pushes content
  - Mobile (<=768px): 2-column grid, sidebar covers full screen
- CSS classes: dashboard-grid, dashboard-slot, slot-button, slot-inner-element
