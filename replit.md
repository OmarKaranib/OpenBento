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

## Technical Implementation Details
- Grid Layout: `grid-template-rows: repeat(auto-fill, minmax(0, 1fr))` with `height: 100vh; overflow: hidden`
- Z-Index: Dropdown and Add Source modal use `z-[100]` to prevent being blocked by slots
- YouTube Auto-Converter: `extractYouTubeId()` function detects standard YouTube URLs and converts to `/embed/` format
- Independent Controls: Each slot has Mute and Pause buttons using YouTube IFrame API postMessage
