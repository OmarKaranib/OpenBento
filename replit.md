# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a highly customizable, bento-style Mission Control interface designed for monitoring and managing diverse information streams. It features a dynamic 12-column grid with drag-to-resize widgets, offering integrations for YouTube, Twitch, and Kick video streams with custom TV-style controls. The dashboard ensures persistent storage of user-defined layouts and widget content (videos, notes, images, spacers, clocks, tickers, weather, dictionary, QR portal), providing a responsive and personalized workspace that fits various screen sizes.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard is built on a 12-column magnetic grid system.

**UI/UX Decisions:**
- **Typography:** Uses Inter font with `font-weight: 700` for headers and `font-weight: 500` for buttons.
- **Geometry:** Features a 12px border-radius, 16px gap, and 20px internal padding.
- **Color Droplet:** Per-widget custom background color selection.
- **Hover Effects:** Widgets scale up (`scale: 1.02`) with enhanced shadow on hover.
- **Global Background Engine:** Supports preset dark/neutral colors, custom image uploads, or image URLs.
- **Widget Transparency:** Default widgets are semi-transparent; custom-colored widgets are opaque.
- **Menu Bar Refinements:** Simplified labels, "Edit" button toggles to "Save" to lock layout, and includes Dark/Light theme toggle.
- **True Light Mode:** High contrast with light gray backgrounds and dark text.
- **Channel Library Logos:** Stores official channel profile images with platform-specific and generic fallbacks.
- **Guest Access Model:** Allows view and edit access without login, with optional login for cross-device syncing.
- **Library Auth Lock:** Guest users cannot save channels to their personal library.
- **Viral Ad Mechanic (Free Users Only):** Non-premium users encounter a single expanding viral ad block that pushes widgets aside.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports various widget types including Video, Note, Spacer, Image, Clock, Crisis Ticker, Markets Ticker, Weather, Dictionary, QR Portal, World Clocks, and Countdown.
- **Edit Layout Mode:** Toggles between locked and editable states for drag-to-resize, settings, and deletion.
- **Fullscreen Mode:** Utilizes the browser's Fullscreen API.
- **TV Mode:** Iframes use `pointer-events: none` with video controls managed via `postMessage` API.
- **Drag-to-Resize:** Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** A slide-out sidebar providing tabbed widget templates and preset live stream channels.
- **Content Swapping:** Allows updating existing widget content directly from the sidebar.
- **Responsive Scaling:** Uses `rem` units for consistent scaling across devices.
- **Persistence:** Widget layouts and content are saved to `localStorage`.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls. Includes "True Live Filter" via YouTube Data API v3, dynamic channel resolution, and "Latest-Video Fallback" when a channel is not live.
- **Dynamic Library Sorting & Hourly Validation:** Live streams are pinned to the top of the library.
- **Smart Tiered localStorage Cache:** Caches YouTube API responses with tiered TTLs.
- **Multi-View Replication Architecture:** Decouples API from rendering, forcing embeds if `videoId` exists.
- **Note Widget:** Markdown-aware notes with a View/Edit toggle, supporting headings, bold/italic text, inline code, links, lists, code blocks, rules, and GitHub-style task lists.
- **Image Widget:** Displays images and supports local file uploads.
- **Default News Streams:** Automatically loads 6 pre-defined news streams if `localStorage` is empty.
- **Blocked Channels Feature:** Users can hide and manage blocked channels.
- **Master Volume Sync:** A global toggle to mute/unmute all video widgets.
- **Authentication & Paywall System:** Leverages Supabase Auth for Email/Password and Google OAuth, with a `profiles` table for user data including `is_premium` status.
- **Stripe Pro Subscription:** Integrated Stripe for recurring subscriptions, enforcing a 6-block limit for free users.
- **Admin Dashboard:** An `/admin` route with client-side and server-side authorization, featuring user management, premium toggle, channel management (CRUD with soft-delete), channel auto-import, and system statistics.
- **Feedback System:** `feedback` table for user submissions, supporting messages, types, and optional screenshots. Public POST `/api/feedback` and admin-only GET `/api/admin/feedback`.
- **Supabase Auth Hardening:** Client initialized with `autoRefreshToken: true` and `persistSession: true` to prevent session timeouts.
- **QR Portal Widget:** Generates QR codes client-side for given links, featuring a glassmorphism design.
- **First-Time Onboarding:** An `OnboardingFlow` component guides new guest users through initial setup, offering starter packs and coachmarks.
- **Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core`, `lucide-react`, `qrcode.react`.
- **Markets Ticker Widget:** Displays market data for crypto and stocks with sparklines, price, and 24h change. Allows adding, removing, and reordering symbols.
- **Crisis Ticker Upgrades (v2):** Per-widget filtering by source and category, deep-linking to articles, and a "BREAKING" indicator.
- **Time Widgets:**
    - **`world_clocks` widget:** A responsive grid displaying local times for selected cities.
    - **`countdown` widget:** Shows a live countdown to a target moment with customizable label and emoji.
    - **Clock Widget upgrades:** Includes a Pomodoro 25/5 preset, stopwatch laps, per-widget analog face toggle, and smooth seconds via `requestAnimationFrame`.

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.
- **Supabase:** Backend for authentication and PostgreSQL database.
- **Stripe:** For managing recurring subscriptions.
- **OpenWeatherMap API:** Provides live weather data for the WeatherWidget.
- **NewsAPI.org:** Supplies live breaking news headlines for the CrisisTickerWidget.
- **CoinGecko:** Used for cryptocurrency market data in the Markets Ticker.
- **Yahoo Finance:** Used for stock market data in the Markets Ticker.
- **qrcode.react:** For client-side QR code generation.
- **Resend:** For sending feedback emails.