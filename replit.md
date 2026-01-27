# Master Control Dashboard

## Overview
A 16-slot Mission Control Dashboard for monitoring multiple video sources and streams. Features YouTube integration, master mute controls, view mode toggle, smart fallback for blocked embeds, and localStorage persistence.

## Features
- 16 video/stream monitoring slots (upgraded from 12)
- View mode toggle: 1, 4, 9, or 16 slots visible at once
- YouTube video integration via embed URLs (auto-converts standard links)
- Master mute control for all slots
- Individual slot mute/unmute controls
- Add/remove video sources dynamically
- Smart fallback: "Launch External" button for sites that block iframes (e.g., Discord)
- Save layout to localStorage (includes view mode preference)
- Dark theme with cyan/purple accent colors
- Animated scan line effect

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- localStorage for persistence
- YouTube embed URLs for video embedding

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard component
- `client/src/App.tsx` - App router
- `client/src/index.css` - Theme colors (slate/cyan/purple)
- `tailwind.config.ts` - Tailwind configuration with scan animation

## Recent Changes
- Increased max slots from 12 to 16
- Added view mode toggle (1/4/9/16 slots)
- YouTube links now auto-convert to embed format to prevent "Refused to connect"
- Added smart fallback with 5-second timeout to detect blocked iframes
- "Launch External" button appears for blocked embeds (orange colored)
