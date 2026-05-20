# CLAUDE.md — Goodgame Project

> This file is read automatically by Claude Code at the start of every session.
> It contains project-wide conventions, architecture decisions, and rules that must be followed at all times.

---

# Engineering Principles

Follow SOLID, KISS, and DRY as practical design constraints, not as slogans.

## SOLID
- Keep modules and functions focused on one clear responsibility.
- Prefer dependency injection or explicit parameters over hidden global coupling.
- Extend behavior through small composable units before modifying large shared code paths.
- Avoid inheritance-heavy designs unless the codebase already uses them clearly.
- Keep interfaces narrow and role-specific.

## KISS
- Prefer the simplest implementation that satisfies the current requirements.
- Do not introduce frameworks, abstractions, patterns, or config layers unless they remove real complexity.
- Optimize for readable, boring code over clever code.
- If a solution needs explanation, consider whether the design can be simplified.

## DRY
- Remove meaningful duplication in logic, business rules, validation, and data mapping.
- Do not abstract purely coincidental duplication.
- Prefer shared helpers only when the repeated behavior is stable and clearly the same concept.
- Keep tests readable even if that means some setup duplication.

## Before Editing
When making changes:
1. Inspect nearby code and follow existing conventions.
2. Identify the smallest safe change.
3. Avoid broad refactors unless requested or necessary.
4. Preserve public behavior unless the task explicitly changes it.
5. Add or update tests when behavior changes.

## Review Checklist
Before finishing, verify:
- The change has one clear purpose.
- No unnecessary abstraction was added.
- Repeated logic was consolidated where appropriate.
- Names make responsibilities obvious.
- Error handling is explicit and understandable.
- Tests or manual verification cover the changed behavior.

When reviewing or modifying code, call out violations of SOLID, KISS, or DRY only when they create concrete maintainability, correctness, or extensibility risk. Explain the risk and suggest a smaller, clearer alternative.

---

## Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

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

Look at `DESIGN.md`

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
