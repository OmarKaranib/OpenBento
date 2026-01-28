# Master Control Dashboard

## Overview
A 16-slot Mission Control Dashboard for monitoring multiple video sources and streams. Features YouTube integration with IFrame API controls, flexible grid density dropdown, master mute controls, smart fallback for blocked embeds, legal footer/disclosure, and localStorage persistence.

## Features
- 16 video/stream monitoring slots
- Grid Density dropdown: 2 (1x2), 4 (2x2), 6 (2x3), 9 (3x3), 12 (3x4), 16 (4x4) slots
- Single-screen enforcement: All slots visible without scrolling using grid-template-rows
- YouTube video integration via embed URLs (auto-converts standard links)
- YouTube IFrame API controls: individual Mute and Pause buttons per slot
- Master mute control for all slots
- Add/remove video sources dynamically
- Smart fallback: "Open in Official Widget Mode" button for sites that block iframes
- Legal footer with copyright and Legal button for disclaimer popup
- Save layout to localStorage (includes grid density preference)
- Dark theme with cyan/purple accent colors
- Animated scan line effect

## Widget Sidebar with Drag-and-Drop
- Slide-out sidebar from left side when clicking ADD button
- Search bar to filter channels
- Trending Channels section with preset live streams (Sky News, ABC, CNN, BBC, etc.)
- Layout Blocks section with 2x2, 2x4, 4x4 draggable presets
- Drag-and-drop integration using @dnd-kit/core
- Click channel to add to first available empty slot
- Vertical compaction algorithm reflows active slots when grid density changes

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities for drag-and-drop
- localStorage for persistence
- YouTube IFrame API for video control (postMessage)

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard component with DndContext
- `client/src/components/widget-sidebar.tsx` - Sidebar with channels and layout blocks
- `client/src/App.tsx` - App router
- `client/src/index.css` - Theme colors (slate/cyan/purple)
- `tailwind.config.ts` - Tailwind configuration with scan animation

## Recent Changes
- Added MultiView-Style Sidebar with drag-and-drop library (@dnd-kit)
- Created WidgetSidebar component with search, trending channels, and layout blocks
- Integrated DndContext for drag-and-drop from sidebar to grid slots
- Implemented vertical compaction algorithm for slot reflow
- Desktop: sidebar pushes grid over (32rem width)
- Mobile: sidebar covers full screen (100vw)
- Fixed z-index hierarchy: decorative bg z-0, grid z-10, header z-30, dropdown z-50, sidebar z-50

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
