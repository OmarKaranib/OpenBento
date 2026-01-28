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

## Widget Sidebar with Drag-and-Drop
- Slide-out sidebar from left side when clicking ADD button
- **Tabbed Interface**: Content tab (channels/search) and Layout tab (widget sizes)
- Search bar to filter channels (Content tab)
- Trending Channels section with 10 preset live streams
- **Layout Blocks section** with draggable widget size templates:
  - Single (1x1): Standard single slot
  - Wide (2x1): Spans 2 columns, 1 row
  - Large (2x2): Spans 2 columns, 2 rows
- Drag-and-drop integration using @dnd-kit/core and @dnd-kit/sortable
- Click channel to add to first available empty slot
- Vertical compaction algorithm reflows active slots when grid density changes

## Live Reordering (iOS Home Screen Style)
- **rectSortingStrategy** for iOS-like "running away" behavior
- Slots shift smoothly to make room during drag operations
- Active slot scales to 1.05x with cyan drop shadow while dragging
- Other slots animate with 0.3s ease transition when reordering
- Empty slots can be dragged to reorder

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
- `tailwind.config.ts` - Tailwind configuration with scan animation

## Recent Changes
- Added tabbed interface to sidebar (Content/Layout tabs)
- Implemented CSS grid spanning for multi-slot widgets
- Integrated rectSortingStrategy for iOS-like live reordering
- Added visual feedback: 1.05x scale with shadow during drag, 0.3s ease transitions
- Maintained 1fr grid units for full-screen persistence
- Layout blocks now show visual previews of their grid configuration

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
