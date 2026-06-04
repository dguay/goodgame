# Goodgame

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

## Android dev build using production Supabase

Use this when you want to run local code on a physical Android phone while the app talks to the hosted production database and Google auth returns to the local dev app.

The dev build installs as a separate app:

```bash
name: Goodgame Dev
android package: com.davidguay.goodgame.dev
auth redirect: goodgame-dev://auth/callback
```

It can coexist with the production Goodgame app.

### Setup

From the repo root:

```bash
pnpm run setup:phone
pnpm run dev:android:build:local
pnpm run start:dev:tunnel
```

Install the generated APK on your phone, open **Goodgame Dev**, and connect it to the tunnel Metro server. The local build requires Android Studio and uses Android Studio's bundled JDK automatically when `JAVA_HOME` is not already set.

For Google auth, add this redirect URL in Supabase Auth URL Configuration for the hosted production project:

```bash
goodgame-dev://auth/callback
```

Production database warning: changes made in the dev build are real production writes.

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

## Android production release

Check [LOCAL_ANDROID_APK_BUILD.md](LOCAL_ANDROID_APK_BUILD.md) for building production build locally without Expo

Use this checklist every time you want to publish a new Android production build through EAS and Play Console.

First-time EAS, Firebase, keystore, and OAuth setup is documented in [docs/android-internal-sharing.md](docs/android-internal-sharing.md). You only need to redo that setup if credentials, package name, Firebase project, or Google OAuth clients change.

### 1. Prepare the release

1. Confirm `mobile/google-services.json` exists locally.
2. Confirm EAS has the production `GOOGLE_SERVICES_JSON`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_RAWG_API_KEY` environment variables. Re-upload `GOOGLE_SERVICES_JSON` only if the Firebase file changed:
   ```bash
   cd mobile
   eas env:create --name GOOGLE_SERVICES_JSON --environment production --visibility secret --type file --value ./google-services.json
   ```
3. Restore production values in `mobile/.env.local`.
4. Run checks:
   ```bash
   pnpm run typecheck
   pnpm run lint
   ```
5. Update the Expo app version in `mobile/app.json` if this is a new user-facing release.
6. If Play Console rejected the previous upload with a reused version code, run `cd mobile && eas build:version:set`, choose Android, and enter the latest version code already accepted by Play Console.

### 2. Build the Android AAB

From the repo root:

```bash
pnpm run build:android
```

On Windows PowerShell, if script execution policy blocks `pnpm`, use:

```bash
pnpm.cmd run build:android
```

When EAS finishes, download the `.aab` from the EAS dashboard or the build link printed in the terminal.

### 3. Upload to Play Console

1. Open Google Play Console.
2. Select the Goodgame app.
3. Go to **Testing** -> **Internal testing** or **Internal app sharing**.
4. Upload the `.aab`.
5. Complete any Play Console release notes or review prompts.
6. Copy the tester/sharing link.

### 4. Verify on a physical Android device

- App installs from the Play Console link.
- Google sign-in works.
- Session persists after closing and reopening the app.
- Home, Search, Library, Profile, and Game Detail screens load.
- The app does not crash on first launch.

---

## All root scripts

| Script | Description |
|---|---|
| `pnpm run setup:phone` | Prepare Android dev build phone development using production Supabase |
| `pnpm run web` | Start dev server for web |
| `pnpm run start:dev:tunnel` | Start Metro for a development build through a tunnel |
| `pnpm run android` | Start dev server for Android |
| `pnpm run dev:android:build:local` | Build the Android development APK locally |
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
