# Goodgame

Goodgame is a Goodreads-style gaming backlog tracker for Android and web. It helps players search for games, save them to a personal library, track playing status, rate completed games, and decide what to play next.

![Expo](https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=111111)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_Auth_Edge_Functions-3FCF8E?style=for-the-badge&logo=supabase&logoColor=111111)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-server_state-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)

## Product

Goodgame is built around a personal game library:

- Search RAWG game data and inspect details before adding a game.
- Add games to a library with status, rating, playtime, platform, and notes.
- Browse and sort the backlog by status, release date, rating, and custom order.
- View recommendations, trending game news, ARPG calendar events, and PC feature metadata.
- Authenticate with Google through Supabase Auth on Android and web.

The product direction is documented in [PRODUCT.md](PRODUCT.md), and the visual system is documented in [DESIGN.md](DESIGN.md).

## Architecture

```text
mobile/
  app/          Expo Router routes for auth, tabs, details, and news screens
  components/   Reusable React Native UI and product components
  hooks/        React Query hooks for Supabase, RAWG, Steam, news, and profile data
  lib/          Typed clients and focused domain helpers
  stores/       Zustand client-only state
  types/        Shared TypeScript and generated Supabase types

supabase/
  migrations/   Postgres schema, RLS policies, cron jobs, and RPC changes
  functions/    Edge Functions for Steam lookup and gaming-news ingestion
```

The app uses React Query for server state and Zustand only for client state. Supabase access is routed through typed hooks, while RAWG calls go through the typed RAWG client in `mobile/lib/rawg.ts`. Database migrations keep Row Level Security enabled and generated Supabase types checked into the mobile app.

## Tech Stack

- Expo 54, React Native 0.81, Expo Router
- TypeScript strict mode
- Supabase Postgres, Auth, RLS, Edge Functions, Cron, and Vault
- TanStack Query for server state
- Zustand for lightweight client state
- RAWG API for game metadata
- PCGamingWiki and Steam lookup integrations for PC feature metadata
- EAS Build and Google Play Internal App Sharing for Android distribution

## Setup

Install dependencies from the repository root:

```bash
pnpm install
pnpm --dir mobile install
```

Create `mobile/.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_RAWG_API_KEY=your-rawg-api-key
```

For Android builds with Google sign-in, keep `mobile/google-services.json` local. It is intentionally ignored and should not be committed.

## Development

Run the app:

```bash
pnpm run web
pnpm run android
```

Run checks:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
```

Run a local Supabase stack:

```bash
pnpm run db:start
pnpm run db:reset
pnpm run db:stop
```

Generate Supabase types:

```bash
pnpm run db:types:local
pnpm run db:types
```

## Deployment Status

- Android: configured for EAS production builds and Google Play Internal App Sharing. See [docs/android-internal-sharing.md](docs/android-internal-sharing.md).
- Web: Expo web export exists for development, but the public Vercel frontend is intentionally disabled while this repository is prepared for public review.
- Supabase: migrations, RLS policies, and Edge Functions are tracked in the repository; production deployment remains an explicit manual step.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm run web` | Start Expo web development server |
| `pnpm run android` | Start Expo for Android emulator or device |
| `pnpm run start:dev:tunnel` | Start Metro for a development build through a tunnel |
| `pnpm run dev:android:build:local` | Build the Android development APK locally |
| `pnpm run build:android` | Start an EAS Android production build |
| `pnpm run build:web` | Export the Expo web build |
| `pnpm run typecheck` | Run TypeScript with `--noEmit` |
| `pnpm run lint` | Run ESLint |
| `pnpm run test` | Run TypeScript test build and Node tests |
| `pnpm run db:start` | Start the local Supabase stack |
| `pnpm run db:reset` | Reset local database and apply migrations |
| `pnpm run db:types:local` | Generate Supabase types from local schema |
| `pnpm run db:types` | Generate Supabase types from production schema |
