# OpenBento Mobile Companion

A stripped-down Expo / React Native companion to the OpenBento web
dashboard. Read-only mirror of your default page in portrait, plus a
**Cast** tab to push to your paired BENTO-XXXX TVs and a **Settings**
tab to pick which page to mirror, the refresh cadence, theme, and to
sign out.

This is **not** wired into the main web workflow — it lives in `mobile/`
as a standalone Expo project and runs locally via Expo Go. It does not
edit the project's root `package.json`, install root dependencies, or
change any web build pipeline.

## What it does

- **Login** — Supabase email/password and Google OAuth, sessions
  persisted in Expo SecureStore.
- **Dashboard tab** — fetches the signed-in user's `dashboards` row via
  `GET /api/dashboard`, picks the default (or user-selected) page, and
  renders widgets vertically. Pull-to-refresh re-fetches.
- **Renderers** — first-class for: Clock, Weather, Markets Ticker, RSS
  Headlines, Note, Image, Quote, On This Day. Every other widget type
  shows a neutral placeholder card naming the widget — those interactive
  widgets stay on the web for v1.
- **Cast tab** — lists paired BENTO rooms (`GET /api/cast/rooms`) and
  pushes the currently-mirrored page (`POST /api/cast/rooms/:id/push`)
  using the same Bearer-token auth as the web popover.
- **Settings tab** — page selector, refresh interval (1/5/15/30 min),
  dark/light/auto, sign-out.
- **Foreground refresh loop** — fires on the chosen interval whenever
  the app is foregrounded.

## Out of scope (v1)

- Native push notifications.
- Editing layouts on mobile.
- Interactive widgets (Wordle, Trivia, Sketch Pad, video players).
- App Store / Play Store publishing — Expo Go is the v1 target.

## Run it locally

You need Node 18+ and the [Expo Go](https://expo.dev/client) app on your
phone (iOS or Android). Everything happens inside this folder; nothing
is installed at the project root.

```bash
cd mobile
npm install                # installs Expo + RN deps inside mobile/
EXPO_PUBLIC_SUPABASE_URL='https://YOUR-PROJECT.supabase.co' \
EXPO_PUBLIC_SUPABASE_ANON_KEY='YOUR-ANON-KEY' \
EXPO_PUBLIC_API_BASE_URL='https://YOUR-OPENBENTO-HOST' \
  npx expo start
```

Then scan the QR code with Expo Go (Android camera) or the Camera app
(iOS) and the app will load on your phone.

### Env vars

| Variable                          | Purpose                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`        | Same Supabase project URL as the web app.                                           |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Same Supabase anon key as the web app.                                              |
| `EXPO_PUBLIC_API_BASE_URL`        | Base URL of the deployed OpenBento server (e.g. `https://openbento.tv`). The mobile app calls `/api/dashboard`, `/api/cast/*`, `/api/quote`, `/api/onthisday`, `/api/markets`, `/api/rss` against this host. Leave empty only when you proxy through a local dev server. |

The Supabase URL + anon key are the same values the web app uses
(`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) — just re-exposed
under their `EXPO_PUBLIC_*` names so Expo's bundler picks them up at
build time.

### Google sign-in

The Google button uses `expo-web-browser` + `expo-auth-session` to open
Supabase's OAuth flow and redirect back via the registered
`openbento://auth-callback` deep link. You'll need to add that redirect
URL to your Supabase project's allowed redirect URLs (Auth → URL
Configuration) for it to complete the round-trip.

## Project layout

```
mobile/
├── App.tsx                 # tab navigator + gate (login vs app)
├── app.json                # Expo config (scheme: openbento)
├── babel.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── context/AppContext.tsx   # auth + settings + dashboard state + refresh loop
    ├── lib/
    │   ├── api.ts               # /api/dashboard + /api/cast/* wrappers
    │   ├── colors.ts            # brand tokens pulled from shared/themes.ts
    │   └── supabase.ts          # SecureStore-backed Supabase client
    ├── renderers/index.tsx      # widget renderer registry (incl. placeholder)
    ├── screens/
    │   ├── CastScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── LoginScreen.tsx
    │   └── SettingsScreen.tsx
    └── types.ts
```
