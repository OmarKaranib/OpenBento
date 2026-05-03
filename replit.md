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
- **Theming:** Utilizes Inter font, specific border-radius, gap, and padding. Features per-widget custom background color selection, hover effects, and a global background engine supporting presets, custom images, and URLs. Widgets are semi-transparent by default or opaque if custom-colored. Includes a toggle for a high-contrast True Light Mode.
- **Navigation:** Simplified menu bar with "Edit/Save" toggle, a Dark/Light theme toggle, and a "Themes" button that opens the Themes Marketplace modal.
- **Access Model:** Supports guest access for view and edit without login, with optional login for cross-device syncing of layouts and libraries.
- **Donation Model:** A single expanding "Buy Me a Coffee" donation block appears for all users on a 10-day cooldown.

**Technical Implementations & Feature Specifications:**
- **Dynamic Widget System:** Supports a wide array of widget types including Video, Note, Spacer, Image, Clock, Crisis Ticker, Markets Ticker, Weather, Dictionary, QR Portal, World Clocks, Countdown, GitHub Pulse, RSS Headlines, Habit Tracker, Quick Launch, Big Text Marquee, Network Light, Photo Loop, Focus Soundscape, Water Tracker, Mood Check-in, Standup Roller, and Sketch Pad.
- **Layout Management:** Features an "Edit Layout Mode" for drag-to-resize, settings, and deletion, and a "Fullscreen Mode". Widgets snap to a 12x6 grid with collision prevention.
- **Widget Sidebar ("Block Library"):** A slide-out sidebar provides tabbed widget templates and preset live stream channels.
- **Persistence:** Widget layouts and content are saved to `localStorage` for guest users.
- **Video Widget:** Integrates YouTube, Twitch, and Kick with custom TV-style controls, "True Live Filter", dynamic channel resolution, and "Latest-Video Fallback".
- **Note Widget:** Markdown-aware notes with View/Edit toggle.
- **Image Widget:** Displays images and supports local file uploads.
- **Authentication:** Optional Supabase Auth (Email/Password, Google OAuth) for cross-device persistence via cloud sync.
- **Admin Dashboard:** An `/admin` route with client-side and server-side authorization for management.
- **QR Portal Widget v2:** Five-mode QR generator with optional logo overlay, customizable colors, and copy-as-PNG functionality.
- **GitHub Pulse Widget:** Displays GitHub repository statistics or user profiles.
- **RSS Headlines Widget:** Renders scrolling headlines from any RSS or Atom feed URL via a server-side proxy.
- **Dictionary Widget v2:** Provides definitions, phonetics, audio, synonyms, and etymology.
- **Onboarding:** An `OnboardingFlow` guides new guest users with starter packs and coachmarks.
- **Sky & Ambient Pack:** Includes Lava Lamp animations, Sun & Sky Position tracking (sunrise/sunset, moon phase), Earth at Night globe, and an ISS Live Tracker with pass estimations.
- **Knowledge & Play Pack:** Features On This Day events from Wikipedia, Random Quote generator, Daily Wordle game, and Trivia questions.
- **Cast to TV Feature:** Allows casting the dashboard to browser-equipped TVs. Supports guest pairing and persistent "BENTO-XXXX" rooms for signed-in users, enabling multi-TV control and scheduled layout rotations.
- **Theming for Productivity Widgets:** Productivity and personal widgets dynamically adjust colors for readability.
- **Wellness & Focus Pack:** Includes Focus Soundscape (ambient loops), Water Tracker, Mood Check-in, and Standup Roller (randomized speaking order).
- **Sketch Pad Widget:** Freehand drawing canvas with HTML5 pointer events (mouse/touch/stylus). Uses midpoint-quadratic-Bezier smoothing for fluid strokes, decimates redundant move events for performance, and renders at device-pixel resolution (×DPR, capped at 3) for crisp lines. Floating auto-hide toolbar (3 s) offers a colour palette + custom picker, S/M/L brush sizes, eraser, 20-step undo, clear, and PNG download. Drawings persist as a debounced PNG data URL on the widget (500 ms after last pointer-up) and are rescaled with a "contain" fit when the widget is resized so strokes are never cropped or distorted.
- **Air Quality Widget:** Surfaces US AQI (EPA 6-band scale), dominant pollutant, a short EPA-aligned health blurb, and optional pollen levels for the user's location via Open-Meteo (no API key). Reuses the shared geolocation cache populated by Weather/Sun & Sky, exposes a settings popover (gear icon) with city search and pollen toggle, auto-refreshes every 30 min and on tab focus, and persists the last payload to `localStorage` so reloads/offline starts render a "stale"-badged value before the next fetch lands.
- **Multi-Page Dashboards:** Users can split their workspace into multiple named pages (e.g. *Home*, *Work*, *Stream*) that each carry their own widgets, layout, optional background, and optional theme override. State is modelled as `{pages: DashboardPage[], activePageId}` in `shared/dashboard-pages.ts` (a pure, framework-free module shared by client, server, and tests). On first load the legacy `openBentoWidgets` array is migrated into a single "Home" page via `migrateLegacyWidgets`, then persisted to `localStorage` keys `openBentoPages` + `openBentoActivePageId`. The active page's widgets are also mirrored back to the legacy `openBentoWidgets` key so any code paths still reading the old shape (cast push, server back-compat) keep working during the rollout. The page collection round-trips through cloud sync via the existing `PATCH /api/dashboard` (new optional `pages jsonb default []` and `active_page_id varchar` columns on `dashboards`); guests stay on `localStorage` only. A scrollable **PageTabsStrip** sits between the menu bar and the canvas — it's hidden until a 2nd page exists (only the **+** button shows for single-page users), and each tab supports rename (double-click), set default (★), duplicate, and delete (with a confirm). Deleting the default re-promotes the next remaining page; the very last page is undeletable. The cast popover gains a "Page to push" dropdown when the user has 2+ pages so they can broadcast a non-active page to a TV. Deep-linking is supported via `?page=<id>` on first navigation. The full operations set (`addPage`/`renamePage`/`duplicatePage`/`deletePage`/`setDefaultPage`/`setActivePage`/`updateActivePageWidgets`/`sanitizePages`) is unit-tested in `tests/client/dashboard-pages.test.ts`.
- **Themes Marketplace:** A "Themes" button in the top menu opens a modal with **Built-in** and **My Themes** tabs. The Built-in tab ships eight curated full-look identities (Midnight Ocean, Sunrise, Cyberpunk, Paper Light, Forest, Mono Slate, Lava Lounge, Vaporwave). Each card renders an SVG mock thumbnail; hovering a card previews the look on the live dashboard for **2 seconds** then auto-reverts, and clicking **Apply** atomically swaps the background, accent color, font stack, default widget tint, and dark/light mode in one step. **Save current look** captures the running settings as a personal Theme (name + slugged id + timestamp) which lands in **My Themes** and can be renamed or deleted. Personal themes persist to `localStorage` (`openBentoPersonalThemes`, `openBentoActiveThemeId`) and, for signed-in users, sync to Supabase via debounced `PATCH /api/dashboard` against the new `personal_themes` jsonb / `active_theme_id` columns on the `dashboards` table. The `Theme` type, the eight built-ins, and the pure `themeToCssVars` apply-reducer all live in `shared/themes.ts` so future server-driven theme bundles and the cast hub share the same shape. Onboarding now ends with a 4th coachmark pointing at the Themes button.

**Tech Stack:** React with TypeScript, Tailwind CSS, `@dnd-kit/core` for drag-and-drop, `lucide-react` for icons, `localStorage` for persistence, and `qrcode.react` for QR generation.

**Server Endpoints:**
- `GET /api/github/repo/:owner/:repo` and `GET /api/github/user/:owner`: Aggregated GitHub stats.
- `GET /api/rss?url=`: Server-side RSS/Atom proxy.
- `GET /api/ping?url=`: Lightweight uptime probe.
- `GET /api/onthisday`: Wikipedia "On This Day" events feed proxy.
- `GET /api/quote`: zenquotes.io random quote proxy.
- `GET /api/trivia?difficulty=...`: Open Trivia DB proxy.
- `GET /api/iss`: Server-proxied ISS position.
- `GET /api/iss/pass?lat=&lon=`: Next-overhead-pass estimator for ISS.
- `GET /api/air-quality?lat=&lon=&pollen=1`: Open-Meteo Air Quality proxy (no key, ~15 min TTL cache, 6 h stale-fallback, 7 s timeout). Returns US AQI, six pollutant concentrations, dominant pollutant, and (when `pollen=1`) the six European pollen series with the worst-case level pre-computed. Also accepts `?city=` (geocoded via Open-Meteo's free geocoder) when coords aren't supplied; the response then includes a `cityLabel` field.
- `GET /api/wordle/today`: Returns `{ date, answer }` for the current UTC day, deterministically seeded from the shared `@shared/wordle-pool` module so server and client offline-fallback never diverge.
- Cast to TV API endpoints for pairing, pushing snapshots, renaming, fetching, and unpairing cast rooms, and a WebSocket for real-time communication.
- `GET/PATCH /api/dashboard`: Cloud-sync of the user's dashboard. PATCH accepts `personalThemes` and `activeThemeId` alongside the existing widget payload so the Themes Marketplace round-trips through the same row.

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