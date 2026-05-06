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

Create `mobile/.env.local` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_RAWG_API_KEY=your_rawg_api_key
```

> Get your RAWG API key at https://rawg.io/apidocs (free tier).

### 3. Run the app

All scripts are run from the **repo root**:

```bash
pnpm run web        # Open in browser at http://localhost:8081
pnpm run android    # Launch on Android emulator or device
```

For Android, Scan QR code from Expo Go app 

---

## Local development (isolated from production)

Running `pnpm run db:start` spins up a full Supabase stack in Docker on your machine.
Your local database is completely separate from the production project — no risk of touching prod data.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — must be **running** before `db:start`
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`

### 1. Start the local stack

```bash
pnpm run db:start
```

First run pulls ~1 GB of Docker images. Subsequent starts are fast (~10 s).

The command prints credentials when ready:

```
API URL:    http://127.0.0.1:54221
anon key:   eyJ...
```

### 2. Point the app at the local stack

Update `mobile/.env.local` with the local credentials:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54221
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from output above>
EXPO_PUBLIC_RAWG_API_KEY=your_rawg_api_key
```

Restore the production values when you want to run against prod again.

### 3. Google OAuth for local testing

Export your Google OAuth credentials before starting, then restart the stack:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="your_web_client_id"
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="your_web_client_secret"
pnpm run db:start
```

Also add this URI to your Google Cloud Console project under **Authorized redirect URIs**:

```
http://127.0.0.1:54221/auth/v1/callback
```

### 4. Local Studio

Open [http://127.0.0.1:54323](http://127.0.0.1:54323) for a full Supabase dashboard pointing at your local DB.

### 5. Stop the stack

```bash
pnpm run db:stop
```

---

## Android setup

### Emulator

1. Open Android Studio → **Device Manager** → **+** → **Create Virtual Device**
2. Select a phone (e.g. Pixel 8) → download system image (API 34) → **Finish**
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
| `pnpm run db:start` | Start local Supabase stack (requires Docker) |
| `pnpm run db:stop` | Stop local Supabase stack |
| `pnpm run db:reset` | Reset local DB and re-run all migrations |
| `pnpm run db:push` | Push migrations to production Supabase |
| `pnpm run db:types` | Regenerate types from production schema |
| `pnpm run db:types:local` | Regenerate types from local schema |

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
