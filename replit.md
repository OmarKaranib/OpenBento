# Master Control Dashboard

## Overview
A 12-slot Mission Control Dashboard for monitoring multiple video sources and streams. Features YouTube integration, master mute controls, and localStorage persistence.

## Features
- 12 video/stream monitoring slots in a responsive grid
- YouTube video integration via IFrame API
- Master mute control for all slots
- Individual slot mute/unmute controls
- Add/remove video sources dynamically
- Save layout to localStorage
- Dark theme with cyan/purple accent colors
- Animated scan line effect

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- localStorage for persistence
- YouTube IFrame API for video embedding

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard component
- `client/src/App.tsx` - App router
- `client/src/index.css` - Theme colors (slate/cyan/purple)
- `tailwind.config.ts` - Tailwind configuration with scan animation
