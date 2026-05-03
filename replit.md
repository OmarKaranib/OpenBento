# OpenBento Dashboard

## Overview
The OpenBento Dashboard is a highly customizable, bento-style Mission Control interface for monitoring and managing diverse information streams. It features a dynamic 12-column grid with drag-to-resize widgets and integrations for various content, including YouTube, Twitch, and Kick video streams with custom TV-style controls. The dashboard ensures persistent storage of user-defined layouts and widget content, providing a responsive and personalized workspace. The project aims to offer a completely free, ad-supported experience with optional cloud sync for layout persistence across devices.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture
The dashboard is built on a 12-column magnetic grid system, designed for high customizability and responsiveness.

**UI/UX Decisions:**
- **Theming:** Utilizes Inter font, specific border-radius, gap, and padding. Features per-widget custom background color selection, hover effects, and a global background engine supporting presets, custom images, and URLs. Widgets are semi-transparent by default or opaque if custom-colored. Includes a toggle for a high-contrast True Light Mode.
- **Navigation:** Simplified menu bar with "Edit/Save" toggle, a Dark/Light theme toggle, and a "Themes" button that opens the Themes Marketplace modal.
- **Access Model:** Supports guest access for view and edit without login, with optional login for cross-device syncing of layouts and libraries.
- **Donation Model:** A single expanding "Buy Me a Coffee" donation block appears for all users on a 10-day cooldown.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports a wide array of widget types including Video, Note, Spacer, Image, Clock, Crisis Ticker, Markets Ticker, Weather, Dictionary, QR Portal, World Clocks, Countdown, GitHub Pulse, RSS Headlines, Habit Tracker, Quick Launch, Big Text Marquee, Network Light, Photo Loop, Focus Soundscape, Water Tracker, Mood Check-in, Standup Roller, Sketch Pad, and Air Quality.
- **Layout Management:** Features an "Edit Layout Mode" for drag-to-resize, settings, and deletion, and a "Fullscreen Mode". Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** A slide-out sidebar provides tabbed widget templates and preset live stream channels.
- **Persistence:** Widget layouts and content are saved to `localStorage` for guest users. Optional Supabase Auth (Email/Password, Google OAuth) for cross-device persistence via cloud sync.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls, "True Live Filter", dynamic channel resolution, and "Latest-Video Fallback".
- **QR Portal Widget:** Five-mode QR generator with optional logo overlay, customizable colors, and copy-as-PNG functionality.
- **GitHub Pulse Widget:** Displays GitHub repository statistics or user profiles.
- **RSS Headlines Widget:** Renders scrolling headlines from any RSS or Atom feed URL via a server-side proxy.
- **Dictionary Widget:** Provides definitions, phonetics, audio, synonyms, and etymology.
- **Onboarding:** An `OnboardingFlow` guides new guest users with starter packs and coachmarks.
- **Environmental & Knowledge Packs:** Includes features like Lava Lamp animations, Sun & Sky Position tracking, Earth at Night globe, ISS Live Tracker, "On This Day" events, Random Quote generator, Daily Wordle game, and Trivia questions.
- **Cast to TV Feature:** Allows casting the dashboard to browser-equipped TVs. Supports guest pairing and persistent "BENTO-XXXX" rooms for signed-in users, enabling multi-TV control and scheduled layout rotations.
- **Multi-Page Dashboards:** Users can split their workspace into multiple named pages, each with its own widgets, layout, optional background, and theme override. Pages persist to `localStorage` and optionally sync via Supabase.
- **Mobile Companion (Expo):** A self-contained Expo + TypeScript app for read-only mirroring of the signed-in user's default dashboard page on a phone, including remote casting without a laptop.
- **Custom Widgets (sandboxed iframe SDK):** Third-party or user-authored widgets can be installed at runtime by URL within a sandboxed iframe, communicating via `postMessage` with a Zod-validated protocol.
- **Themes Marketplace:** A "Themes" button in the top menu opens a modal with Built-in and My Themes tabs. Built-in themes offer curated full-look identities that can be previewed and applied. Users can save their current settings as personal themes.
- **Command Palette (⌘K):** A Spotlight-style modal opened from a "Commands" header button or the ⌘K / Ctrl+K shortcut. Three sections — Add widget, Pages, and Actions — with fuzzy search, arrow/Enter/Esc keyboard nav, and a recents row capped at 5 entries persisted to `localStorage`. Selecting an "Add widget" command auto-enters Edit Mode. The shortcut is route-scoped to the dashboard and bypassed while typing in inputs/contenteditables.

**Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core` for drag-and-drop, `lucide-react` for icons, `localStorage` for persistence, and `qrcode.react` for QR generation.

**Server Endpoints:**
- Aggregated GitHub stats (`GET /api/github/repo/:owner/:repo`, `GET /api/github/user/:owner`).
- Server-side RSS/Atom proxy (`GET /api/rss?url=`).
- Lightweight uptime probe (`GET /api/ping?url=`).
- Wikipedia "On This Day" events feed proxy (`GET /api/onthisday`).
- Zenquotes.io random quote proxy (`GET /api/quote`).
- Open Trivia DB proxy (`GET /api/trivia?difficulty=...`).
- Server-proxied ISS position and pass estimator (`GET /api/iss`, `GET /api/iss/pass?lat=&lon=`).
- Open-Meteo Air Quality proxy (`GET /api/air-quality?lat=&lon=&pollen=1` or `?city=`).
- Wordle daily answer (`GET /api/wordle/today`).
- Cast to TV API endpoints for pairing, pushing snapshots, renaming, fetching, and unpairing cast rooms, and a WebSocket for real-time communication.
- Cloud-sync of the user's dashboard (`GET/PATCH /api/dashboard`), including themes and pages.

## External Dependencies
- **YouTube IFrame API:** For YouTube video control.
- **Twitch Embeds:** For integrating Twitch streams.
- **Kick.com Embeds:** For integrating Kick streams.
- **@dnd-kit/core:** Drag-and-drop functionalities.
- **lucide-react:** Icon library.
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