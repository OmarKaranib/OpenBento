# Master Control Dashboard

## Overview
A 16-slot Mission Control Dashboard for monitoring multiple video sources and streams. Features YouTube integration with IFrame API controls, flexible grid density dropdown, master mute controls, CORS proxy for external sites, smart fallback for blocked embeds, legal footer/disclosure, and localStorage persistence.

## Features
- 16 video/stream monitoring slots (4x4 default grid)
- Grid Density dropdown: 2 (1x2), 4 (2x2), 6 (2x3), 9 (3x3), 12 (3x4), 16 (4x4) slots
- Single-screen enforcement: All slots visible without scrolling (body overflow: hidden)
- YouTube video integration via embed URLs (auto-converts standard links)
- YouTube IFrame API controls: individual Mute and Pause buttons per slot
- CORS proxy for non-YouTube links to bypass connection blocks
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
- CORS proxy (corsproxy.io) for external content

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard component
- `client/src/App.tsx` - App router
- `client/src/index.css` - Theme colors (slate/cyan/purple), body overflow hidden
- `tailwind.config.ts` - Tailwind configuration with scan animation

## Recent Changes
- Fixed grid layout: height: calc(100vh - 64px) for proper screen fill
- Fixed row heights: grid-template-rows: repeat(4, 1fr) forces 4 equal rows at 25% each
- Updated z-index to 9999 for dropdown and Add Source modal
- Individual Play/Pause and Mute buttons on every slot using YouTube IFrame API

## Technical Implementation Details
- Grid Layout: `height: calc(100vh - 64px)` with `grid-template-rows: repeat(4, 1fr)`
- Z-Index: Dropdown and Add Source modal use `z-[9999]` to always stay on top
- YouTube Auto-Converter: `extractYouTubeId()` function detects standard YouTube URLs and converts to `/embed/` format
- CORS Proxy: `getCorsProxyUrl()` wraps non-YouTube URLs with `https://corsproxy.io/?{encodedUrl}`
- Independent Controls: Each slot has Mute and Pause buttons using YouTube IFrame API postMessage
