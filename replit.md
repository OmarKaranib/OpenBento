# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a highly customizable, bento-style Mission Control interface for monitoring and managing diverse information streams. It features a dynamic 12-column grid with drag-to-resize widgets and integrations for various content, including YouTube, Twitch, and Kick video streams with custom TV-style controls. The dashboard ensures persistent storage of user-defined layouts and widget content (videos, notes, images, spacers, clocks, tickers, weather, dictionary, QR portal, etc.), providing a responsive and personalized workspace. The project aims to offer a completely free, ad-supported experience with optional cloud sync for layout persistence across devices.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard is built on a 12-column magnetic grid system, designed for high customizability and responsiveness.

**UI/UX Decisions:**
- **Theming:** Utilizes Inter font, 12px border-radius, 16px gap, and 20px internal padding. Features per-widget custom background color selection, hover effects with scaling and shadow, a global background engine supporting presets, custom images, and URLs. Widgets are semi-transparent by default, or opaque if custom-colored. Includes a toggle for a high-contrast True Light Mode.
- **Navigation:** Simplified menu bar with "Edit/Save" toggle for layout lock and a Dark/Light theme toggle.
- **Access Model:** Supports guest access for view and edit without login, with optional login for cross-device syncing of layouts and libraries. Guest users cannot save channels to their personal library.
- **Donation Model:** A single expanding "Buy Me a Coffee" donation block appears for all users on a 10-day cooldown; there are no premium tiers or paywalls.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports a wide array of widget types including Video, Note, Spacer, Image, Clock, Crisis Ticker, Markets Ticker, Weather, Dictionary, QR Portal, World Clocks, Countdown, GitHub Pulse, RSS Headlines, Habit Tracker, Quick Launch, Big Text Marquee, Network Light, and Photo Loop.
- **Layout Management:** Features an "Edit Layout Mode" for drag-to-resize, settings, and deletion, and a "Fullscreen Mode" using the browser's Fullscreen API. Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** A slide-out sidebar provides tabbed widget templates and preset live stream channels, allowing content swapping within existing widgets.
- **Persistence:** Widget layouts and content are saved to `localStorage` for guest users.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls, "True Live Filter" via YouTube Data API v3, dynamic channel resolution, and "Latest-Video Fallback". Features dynamic library sorting and hourly validation for live streams, and a tiered `localStorage` cache for API responses.
- **Note Widget:** Markdown-aware notes with View/Edit toggle supporting various formatting options.
- **Image Widget:** Displays images and supports local file uploads.
- **Authentication:** Optional Supabase Auth (Email/Password, Google OAuth) for cross-device persistence of widget layouts and saved channel libraries via cloud sync, with no paywall or premium features. Layout changes are debounced and pushed to a Supabase database.
- **Admin Dashboard:** An `/admin` route with client-side and server-side authorization for user and channel management, and system statistics.
- **QR Portal Widget v2:** Five-mode QR generator with optional logo overlay, customizable colors, and copy-as-PNG functionality.
- **GitHub Pulse Widget:** Displays GitHub repository statistics or user profiles, leveraging cached API responses and auto-refetching.
- **RSS Headlines Widget:** Renders scrolling headlines from any RSS or Atom feed URL via a server-side proxy.
- **Dictionary Widget v2:** Provides definitions, phonetics, audio, synonyms, and etymology, with a search function and favoriting capabilities.
- **Onboarding:** An `OnboardingFlow` guides new guest users with starter packs and coachmarks.
- **Cast to TV Feature:** Allows users to cast their dashboard layout to a separate TV interface via a pairing code, using a push model for updates and WebSocket communication.
- **Theming for Productivity Widgets:** Productivity and personal widgets (Habit Tracker, Quick Launch, Big Text Marquee, Network Light, Photo Loop) dynamically adjust text, accent, border, and surface colors based on the widget's background color to ensure readability.

**Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core` for drag-and-drop, `lucide-react` for icons, `localStorage` for persistence, and `qrcode.react` for QR generation.

**Server Endpoints:**
- `GET /api/github/repo/:owner/:repo` and `GET /api/github/user/:owner`: Aggregated GitHub stats with in-memory caching.
- `GET /api/rss?url=`: Server-side RSS/Atom proxy with caching and URL validation.
- `GET /api/ping?url=`: Lightweight uptime probe for Network Light widget.
- Cast to TV API endpoints for pairing, pushing snapshots, renaming, fetching, and unpairing cast rooms, and a WebSocket for real-time communication.

## Quality Gates
A `check` workflow gates the codebase against a clean baseline:
- `npx tsc --noEmit` — must report **zero** TypeScript errors. Anything new fails the gate.
- `npx tsx --test tests/server/markets.test.ts tests/client/markets-symbols.test.ts` — markets ticker server + symbol-resolution unit tests.
- `node --test tests/client/use-cloud-sync.test.mjs` — cross-device dashboard cloud-sync hook unit tests.

Run all three locally with the `check` workflow (or copy the command above). A red `check` workflow blocks the task from being marked complete.

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
- **localStorage:** Browser API for client-side data persistence.
- **Supabase:** Backend for authentication and PostgreSQL database.
- **OpenWeatherMap API:** Provides live weather data.
- **NewsAPI.org:** Supplies live breaking news headlines.
- **CoinGecko:** For cryptocurrency market data.
- **Yahoo Finance:** For stock market data.
- **qrcode.react:** For client-side QR code generation.
- **rss-parser:** Server-side parsing of RSS/Atom feeds.
- **GitHub REST API v3:** For GitHub Pulse widget data.
- **dictionaryapi.dev:** Free dictionary API.
- **Resend:** For sending feedback emails.
- **ws:** Server-side WebSocket library for Cast Hub.