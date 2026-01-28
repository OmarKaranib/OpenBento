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

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- localStorage for persistence
- YouTube IFrame API for video control (postMessage)

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard component
- `client/src/App.tsx` - App router
- `client/src/index.css` - Theme colors (slate/cyan/purple)
- `tailwind.config.ts` - Tailwind configuration with scan animation

## Recent Changes
- Fixed z-index hierarchy: decorative bg z-0, grid z-10, header z-30, dropdown z-50
- Added individual Pause/Play buttons for YouTube videos using IFrame API
- Enhanced Mute controls to use YouTube postMessage commands (mute/unMute)
- Improved embed blocked fallback: "Embedding Restricted" with explanation about Twitter/Discord
- Added "Open in Official Widget Mode" button for blocked sites
- YouTube URLs auto-convert to embed format with enablejsapi=1 parameter

## Responsive Widget Scaling (Apple HIG Standard)
- Global scaling: html { font-size: 62.5% } makes 1rem = 10px
- All dimensions defined in rem units for consistent scaling
- CSS Variables for concentric geometry (Squircle Rule):
  - --outer-radius: 2rem (slot borders)
  - --inner-radius: calc(--outer-radius - 0.8rem) (inner elements)
  - --button-radius: calc(--outer-radius - 1rem) (buttons)
- Breakpoints:
  - Desktop (>768px): 4-column grid
  - Mobile (<=768px): 2-column grid with smaller radii
- CSS classes: dashboard-grid, dashboard-slot, slot-button, slot-inner-element
