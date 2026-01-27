# Master Control Dashboard

## Overview
A 16-slot Mission Control Dashboard for monitoring multiple video sources and streams. Features YouTube integration, flexible grid density dropdown, master mute controls, smart fallback for blocked embeds, legal footer/disclosure, and localStorage persistence.

## Features
- 16 video/stream monitoring slots
- Grid Density dropdown: 2 (1x2), 4 (2x2), 6 (2x3), 9 (3x3), 12 (3x4), 16 (4x4) slots
- Single-screen enforcement: All slots visible without scrolling using grid-template-rows
- YouTube video integration via embed URLs (auto-converts standard links)
- Master mute control for all slots
- Individual slot mute/unmute controls
- Add/remove video sources dynamically
- Smart fallback: "Open in New Window" button for sites that block iframes
- Legal footer with copyright and Legal button for disclaimer popup
- Save layout to localStorage (includes grid density preference)
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
- Replaced view toggle with Grid Density dropdown menu
- Added 6 layout options: 2, 4, 6, 9, 12, 16 slots
- Implemented single-screen enforcement with CSS grid-template-rows
- Updated embed blocked message: "This site restricts embedding. [Open in New Window]"
- Added legal footer: "© 2026 Master Control. Independent tool for content aggregation."
- Added Legal button with disclaimer popup
