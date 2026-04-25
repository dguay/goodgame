# CLAUDE.md — GameLog Project

> This file is read automatically by Claude Code at the start of every session.
> It contains project-wide conventions, architecture decisions, and rules that must be followed at all times.

---

## Project Overview

**GameLog** is a Goodreads-style gaming backlog tracker.
- **Platforms:** Android (Play Store — Internal App Sharing) + Web (Vercel)
- **Stack:** Expo (expo-router) · Supabase · Vercel · RAWG.io API
- **Auth:** Google OAuth via Supabase Auth
- **Language:** TypeScript (strict mode)

---

## Folder Structure

```
/mobile                       → Expo app (Android + Web)
  /app                        → expo-router pages (file-based routing)
    (auth)/                   → unauthenticated routes
    (tabs)/                   → main tab screens
    game/[id].tsx             → game detail
    _layout.tsx               → root layout + auth guard
  /components                 → reusable UI components
  /hooks                      → custom React hooks
  /lib                        → clients (supabase.ts, rawg.ts), helpers
  /stores                     → Zustand stores
  /types                      → shared TypeScript interfaces/types
  /assets                     → fonts, images, icons
  /constants                  → colors, spacing, typography tokens
  package.json                → mobile app dependencies
  app.json                    → Expo config
  tsconfig.json               → TypeScript config

/supabase                     → Supabase backend
  /migrations                 → SQL migration files (one per change)
  config.toml                 → Supabase CLI config

package.json                  → root scripts (proxies to mobile/ + supabase commands)
```

---

## Mandatory Rules

### General
- **TypeScript strict mode** is always on. No `any` types. No `// @ts-ignore`.
- All async functions must handle errors explicitly — no silent failures.
- Use `Platform.OS` checks when behavior must differ between `web` and `native`.
- Never use inline styles on web-facing components; use `StyleSheet.create` or design tokens.

### Routing
- Always use `expo-router` conventions. Never manually configure `react-navigation`.
- Use typed routes: `router.push('/game/123')` not string literals where possible.
- Auth guard lives in `app/_layout.tsx` — redirect unauthenticated users to `/(auth)/login`.

### Data Fetching
- All Supabase interactions go through typed hooks in `/hooks/` — never raw `.from()` calls in components.
- All RAWG API calls go through `/lib/rawg.ts` typed client — never raw `fetch` in components.
- Use **React Query** (`@tanstack/react-query`) for all server state.
- Configure: `staleTime: 5 * 60 * 1000`, `cacheTime: 30 * 60 * 1000` for game data.
- Use optimistic updates for library mutations (add/update/remove).

### Supabase
- Every table has Row Level Security (RLS) enabled. Never disable it.
- Always generate and commit updated TypeScript types after schema changes:
  ```bash
  supabase gen types typescript --project-id <id> > mobile/types/supabase.ts
  ```
  Or from root: `pnpm run db:types`
- Schema changes go in `/supabase/migrations/` as timestamped `.sql` files.

### State Management
- **Zustand** for global client state (auth session, UI preferences).
- **React Query** for server/async state (games, library entries).
- Do not put server data into Zustand stores.

### Environment Variables
- Prefix all Expo public env vars with `EXPO_PUBLIC_`.
- Never hardcode keys. Required vars:
  ```
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_RAWG_API_KEY
  ```
- On native, use `expo-secure-store` for token storage. On web, Supabase handles localStorage.

---

## RAWG Attribution (REQUIRED BY TOS)

Every screen/page **must** render this footer:

```tsx
// components/RawgFooter.tsx
<Text>
  Game data provided by{' '}
  <Link href="http://rawg.io/">RAWG</Link>
</Text>
```

This is a legal requirement from RAWG's free tier. Do not omit it from any screen.

---

## Design System

Design tokens live in `/constants/`. Always use tokens — never magic numbers.

```ts
// constants/colors.ts — dark theme
export const Colors = {
  background:    '#0D0D0F',
  surface:       '#1A1A1F',
  surfaceRaised: '#242429',
  border:        '#2E2E36',
  primary:       '#7C6AF7',   // purple accent
  primaryLight:  '#A89BF9',
  success:       '#4ADE80',
  warning:       '#FACC15',
  error:         '#F87171',
  textPrimary:   '#F0EFF5',
  textSecondary: '#9896A8',
  textMuted:     '#5E5C6E',
}

// constants/spacing.ts
export const Spacing = { xs:4, sm:8, md:16, lg:24, xl:32, xxl:48 }

// constants/typography.ts
export const FontSize = { xs:11, sm:13, md:15, lg:18, xl:22, xxl:28, xxxl:36 }
```

---

## Library Entry Statuses

```ts
export type LibraryStatus =
  | 'want_to_play'
  | 'playing'
  | 'done'
  | 'did_not_finish'

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  want_to_play:    'Want to Play',
  playing:         'Playing',
  done:            'Done',
  did_not_finish:  'Did Not Finish',
}

export const STATUS_COLORS: Record<LibraryStatus, string> = {
  want_to_play:    '#7C6AF7',  // primary
  playing:         '#4ADE80',  // success/green
  done:            '#FACC15',  // gold
  did_not_finish:  '#9896A8',  // muted gray
}
```

---

## Database Schema (reference)

```sql
profiles (
  id uuid PRIMARY KEY,          -- matches auth.users.id
  username text UNIQUE,
  display_name text,
  avatar_url text,
  created_at timestamptz
)

library_entries (
  id uuid PRIMARY KEY,
  user_id uuid → profiles.id,
  rawg_game_id integer,
  game_title text,              -- denormalized
  game_cover_url text,          -- denormalized
  status LibraryStatus,
  personal_rating numeric(3,1), -- 0.0–10.0
  personal_playtime_minutes integer,
  personal_notes text,
  started_at date,
  finished_at date,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(user_id, rawg_game_id)
)
```

---

## RAWG API

Base URL: `https://api.rawg.io/api`  
All requests: append `?key=${EXPO_PUBLIC_RAWG_API_KEY}`

Key endpoints used:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/games` | Search + browse games |
| GET | `/games/{id}` | Full game detail |
| GET | `/games/{id}/game-series` | Related games |
| GET | `/games/{id}/suggested` | Similar games |

---

## Component Conventions

```tsx
// Every component file structure:
import { ... } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors, Spacing } from '@/constants'

interface Props {
  // always define explicit Props interface
}

export function ComponentName({ prop }: Props) {
  return <View style={styles.container} />
}

const styles = StyleSheet.create({
  container: { ... }
})
```

- Use named exports for components (not default exports), except for `app/` route files.
- Route files (`app/**/*.tsx`) must use default exports (expo-router requirement).
- Use `@/` path alias for all internal imports.

---

## Commands Reference

```bash
# Start dev server
npx expo start

# Start web only
npx expo start --web

# Type check
npx tsc --noEmit

# Lint
npx eslint . --ext .ts,.tsx

# Generate Supabase types
supabase gen types typescript --project-id <PROJECT_ID> > types/supabase.ts

# EAS Android build
eas build --platform android --profile production

# Export web for Vercel
npx expo export --platform web
```

---

## Current Phase Tracking

See `PHASES.md` for the full implementation plan.
Update the status of each phase as work progresses.
