# Goodgame Project

> This file is read automatically by Claude Code at the start of every session.
> It contains project-wide conventions, architecture decisions, and rules that must be followed at all times.

---

## Project Overview

**Goodgame** is a Goodreads-style gaming backlog tracker.
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

## Code Review Workflow
- Expect iterative review rounds; surface and fix edge cases proactively rather than waiting for reviewers to find them
- For features touching DB schemas, always consider: null vs empty-array semantics, backfill scripts, and migration ordering

## Project Conventions
- This is an Expo/React Native + Supabase project; ngrok is bundled via @expo/ngrok (do NOT suggest brew install)
- All pages using RAWG data MUST include the RawgFooter attribution component
- Mobile screens should include 'bottom' edge in SafeAreaView to avoid Android nav overlap

## Mandatory Rules

### General
- **TypeScript strict mode** is always on. No `any` types. No `// @ts-ignore`.
- All async functions must handle errors explicitly — no silent failures.
- Use `Platform.OS` checks when behavior must differ between `web` and `native`.
- Never use inline styles on web-facing components; use `StyleSheet.create` or design tokens.
- Do not start the Expo dev server automatically; the user will start it when needed.

### Routing
- Always use `expo-router` conventions. Never manually configure `react-navigation`.
- Use typed routes: `router.push('/game/123')` not string literals where possible.
- Auth guard lives in `app/_layout.tsx` — redirect unauthenticated users to `/(auth)/login`.

### Data Fetching
- All Supabase interactions go through typed hooks in `/hooks/` — never raw `.from()` calls in components.
- All RAWG API calls go through `/lib/rawg.ts` typed client — never raw `fetch` in components.
- Before writing or updating code that could increase RAWG API usage, explicitly warn the user and call out the expected new request pattern.
- Use **React Query** (`@tanstack/react-query`) for all server state.
- Configure RAWG query staleness by endpoint type in `/hooks/useRawg.ts`, using shared time constants from `/lib/time.ts`.
- Use optimistic updates for library mutations (add/update/remove).

### Supabase
- Every table has Row Level Security (RLS) enabled. Never disable it.
- Always generate and commit updated TypeScript types after schema changes:
  ```bash
  supabase gen types typescript --project-id <id> > mobile/types/supabase.ts
  ```
  Or from root: `pnpm run db:types`
- Schema changes go in `/supabase/migrations/` as timestamped `.sql` files.
- Never push migrations or deploy edge functions update without asking
- Cron-triggered Supabase edge functions must have `verify_jwt = false` in config.toml
- When writing shared modules used by multiple functions, ensure idempotency to avoid duplicate side effects (e.g., duplicate alert emails)

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

Every screen/page that uses RAWG data **must** render this footer:

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

Look at `DESIGN.md`

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
