# GameLog

A Goodreads-style gaming backlog tracker for Android and Web.

**Stack:** Expo (expo-router) · Supabase · Vercel · RAWG.io API

---

## Repository structure

```
/mobile/            → Expo app (Android + Web)
  /app              → expo-router screens
  /components       → UI components
  /hooks            → React hooks
  /lib              → Supabase + RAWG clients
  /stores           → Zustand stores
  /types            → TypeScript types
  /constants        → Design tokens
  package.json      → app dependencies

/supabase/          → Backend
  /migrations       → SQL migration files
  config.toml       → Supabase CLI config

package.json        → Root scripts (run all commands from here)
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Android Studio](https://developer.android.com/studio) (for Android development)

### 1. Install dependencies

```bash
cd mobile && pnpm install
```

### 2. Environment variables

Create `mobile/.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_RAWG_API_KEY=your_rawg_api_key
```

### 3. Run the app

All scripts below are run from the **repo root**:

```bash
pnpm run web        # Open in browser at http://localhost:8081
pnpm run android    # Launch on Android emulator or device
```

---

## Android setup

### Emulator

1. Open Android Studio → **Device Manager** → **+** → **Create Virtual Device**
2. Select a phone (e.g. Pixel 8) → download a system image (API 34) → **Finish**
3. Click **▶** to start the emulator, then run `pnpm run android`

### Physical device

1. **Settings → About Phone** → tap **Build Number** 7 times
2. **Settings → Developer Options** → enable **USB Debugging**
3. Connect via USB, accept the prompt, then run `pnpm run android`

---

## All root scripts

| Script | Description |
|---|---|
| `pnpm run web` | Start dev server for web |
| `pnpm run android` | Start dev server for Android |
| `pnpm run build:web` | Export web build for Vercel |
| `pnpm run typecheck` | Run TypeScript type check |
| `pnpm run lint` | Run ESLint |
| `pnpm run db:push` | Push migrations to Supabase |
| `pnpm run db:types` | Regenerate `mobile/types/supabase.ts` from schema |

---

## Supabase

### First-time CLI setup

```bash
supabase login
supabase link --project-ref <project-ref>
```

The project ref is the subdomain of your Supabase URL:
`https://<project-ref>.supabase.co`

### Schema changes

1. Create a new migration file:
   ```bash
   supabase migration new <name>
   # → supabase/migrations/<timestamp>_<name>.sql
   ```
2. Write your SQL, then push:
   ```bash
   pnpm run db:push
   ```
3. Regenerate types:
   ```bash
   pnpm run db:types
   ```

---

## Implementation progress

See [PHASES.md](PHASES.md) for the full feature roadmap and current status.
