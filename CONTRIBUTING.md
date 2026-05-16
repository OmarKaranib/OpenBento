# Contributing to OpenBento

Thanks for helping improve OpenBento. This project is a free, ad-supported
bento dashboard for live streams, widgets, notes, utilities, and multi-page
workspaces. Contributions should preserve the local-first guest experience and
avoid introducing premium or paywall behavior.

## Local Setup

Prerequisites:

- Node.js
- npm
- Access to a PostgreSQL database if you need to exercise persisted server
  features
- Third-party API keys only for integrations you need to test locally

Install dependencies:

```bash
npm install
```

Create local environment files as needed:

```text
.env
client/.env
```

Do not commit environment files or secret values.

Start the development server:

```bash
npm run dev
```

The local app runs at:

```text
http://localhost:5000
```

## Branch Naming

Use short, descriptive branch names.

Preferred patterns:

```text
feature/<short-description>
fix/<short-description>
docs/<short-description>
chore/<short-description>
```

Examples:

```text
feature/widget-library-search
fix/weather-empty-state
docs/readme-polish
```

## Pull Request Process

1. Keep the PR focused on one problem or feature.
2. Describe the user-visible change and the files or areas touched.
3. Include screenshots or a short recording for UI changes.
4. Call out any environment variables, API keys, or setup needed to test.
5. Note whether the change affects persistence, cloud sync, auth, server routes,
   database schema, or custom widget sandboxing.
6. Run the required checks before requesting review.

Required before opening a PR:

```bash
npm run check
npm run build
```

There is no configured test runner yet, so TypeScript checking and production
build validation are the baseline.

## Code Style Expectations

- Follow existing patterns before adding new abstractions.
- Prefer focused changes over broad rewrites.
- Keep widget state JSON-serializable and backward compatible.
- Keep UI responsive inside small grid cells and fullscreen/cast contexts.
- Use existing UI primitives, Tailwind conventions, and lucide icons where
  appropriate.
- Do not introduce premium tiers, payments, locked widgets, or paywall logic.
- Do not expose server-only secrets to browser code.
- Avoid unrelated formatting churn.

## Widget Changes

Most widgets live in `client/src/widgets/`. When adding or changing a widget,
check these files:

- `client/src/widgets/shared.tsx`
- `client/src/widgets/registry.tsx`
- `client/src/components/widget-sidebar.tsx`
- `client/src/dashboard/dashboard-shell.tsx`
- `client/src/pages/dashboard.tsx`

The video widget is special and more fragile because it uses iframe refs,
platform-specific player controls, live-status checks, and healing behavior.
Keep video changes narrow and test them manually.

## Backend and Database Changes

Backend routes are centralized in `server/routes.ts`, with storage operations in
`server/storage.ts` and Drizzle models in `shared/models/`.

Use caution with backend changes:

- Validate inputs.
- Keep server-only secrets server-side.
- Add caching or dedupe for external APIs where appropriate.
- Preserve auth boundaries.
- Use `npm run db:push` for Drizzle schema updates when schema changes are
  intentionally part of the work.

Avoid backend, auth, or database changes in frontend-only PRs.

## Security and Secrets

Never commit:

- `.env` files
- API keys
- Database URLs
- Supabase service role keys
- Private tokens
- Credentials or session data

If a change touches custom widgets, preserve iframe sandboxing and SDK message
validation.
