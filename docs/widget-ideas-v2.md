# Next 10 Widget Ideas — Ranked & Scoped

Coordination notes:
- Already shipped (skip): RSS Headlines, GitHub Pulse (Public Display & Dev Widgets v1)
- Already shipped (skip): Markets Ticker, Crisis Ticker upgrades, World Clocks, Countdown
- Out of scope here: Spotify Now Playing (requires OAuth + connector that does not yet exist as a Replit integration), Today's iCal Calendar (large parser surface, deferred to a follow-up), Focus Mix (needs licensed ambient audio — deferred)

## Ranked candidates

| # | Widget | Status | Effort | Storage |
|---|--------|--------|--------|---------|
| 1 | **Habit Tracker** — daily checkboxes + 7-day streak strip | SHIP | S | ~1 KB / 30 days |
| 2 | **Quick-Launch Grid** — 2×2/3×3/4×4 grid of named URL tiles | SHIP | S | ~0.5 KB |
| 3 | **Big-Text Marquee** — "ON AIR" / scrolling banner | SHIP | S | ~0.2 KB |
| 4 | **Network / Uptime Light** — ping URL, green/red dot + latency | SHIP | M (needs server route) | ~0.2 KB |
| 5 | **Photo Loop** — rotating gallery from URL paste or upload | SHIP | M | ~5 KB w/ data URLs |
| 6 | Today's Calendar (ICS feed) | DEFER — non-trivial parser surface, needs server proxy similar to RSS | M | ~2 KB |
| 7 | Focus Mix (rain / coffee / forest ambient) | DEFER — requires licensed audio assets | S | ~0.1 KB |
| 8 | Spotify Now Playing | DEFER — requires Spotify OAuth integration | M | ~0.2 KB |
| 9 | Mood / Vibe daily log | LATER | S | ~1 KB |
| 10 | Reading-list bookmarks (with tags) | LATER — overlaps with Quick-Launch | S | ~2 KB |

## Top 5 we ship now

1. **habit_tracker** — Tracks up to 8 named habits. Today's checkbox row + 7-day streak strip per habit. Stores compact `{ id, name, days: ['YYYY-MM-DD', …] }[]`, auto-trimmed to a rolling 30-day window. Settings overlay: add / rename / remove habits.
2. **quick_launch** — Configurable 2×2 / 3×3 / 4×4 grid of tiles. Each tile holds `{ id, label, url }`. Clicking a tile opens the URL in a new tab. Settings overlay: edit grid size, add / remove / reorder tiles. Auto-favicon resolved from URL via `google.com/s2/favicons`.
3. **big_text_marquee** — One large headline. Modes: static (centered, fits-to-width via bisect) or scrolling (right-to-left, configurable speed). Foreground + background colors track the widget color droplet by default and auto-flip contrast when the background is light. Use case: "ON AIR", studio lobby messaging, classroom timers.
4. **network_light** — Pings a configurable URL on a configurable interval (10 s / 30 s / 60 s / 5 min). Shows a traffic-light dot (grey idle / amber pinging / green ok / red down), last latency in ms, and HTTP status. Backed by a new `/api/ping?url=` route that mirrors the SSRF-hardened RSS proxy (http(s) only, public-IP DNS check, redirect-hop validation, timeout).
5. **photo_loop** — Rotating image gallery. Accepts pasted image URLs or uploaded files (data: URLs, capped at ~800 KB each, 20 max). Auto-advances on a configurable 0 (manual) / 3 s / 5 s / 10 s / 30 s interval with prev / next / pause controls. Settings overlay: add by URL, upload, remove, set interval, fit (cover / contain).

## Patterns followed

- Each widget is a `React.FC<{ widget; onUpdate? }>` declared in `client/src/App.tsx` ahead of `WidgetRenderer`.
- `useRef<HTMLDivElement>` + `ResizeObserver` for responsive sizing.
- Settings overlay reachable from a hover-only cog (matches GitHub Pulse / RSS Headlines patterns).
- Theme awareness via `widget.customColor` + `isLightBg` helper.
- Every interactive element gets a `data-testid` with widget id suffix.
- Persisted via the existing widgets `localStorage` blob — each widget's per-type fields go on the `Widget` interface as optional.
- New starter-pack tiles added where they meaningfully fit; no new pack required.

## Server work

- `GET /api/ping?url=` — Reuses the SSRF guard / public-IP DNS validator pattern from `/api/rss`. 5 s timeout, returns `{ ok, status, latencyMs, fetchedAt }`. No caching (the whole point is freshness).
