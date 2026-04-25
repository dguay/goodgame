# GameLog

A Goodreads-style gaming backlog tracker for Android and Web.

**Stack:** Expo (expo-router) · Supabase · Vercel · RAWG.io API

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Android Studio](https://developer.android.com/studio) (for Android development)

### Install dependencies

```bash
pnpm install
```

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

---

## Running the app

### Web

```bash
pnpm run web
```

Opens at `http://localhost:8081` in your browser.

### Android (emulator)

**Step 1 — Create a virtual device in Android Studio**

1. Open Android Studio
2. Open **Device Manager** (`Tools → Device Manager` or the right sidebar icon)
3. Click **+** → **Create Virtual Device**
4. Select a phone profile (e.g. **Pixel 8**) and click **Next**
5. Download a system image (e.g. **API 34 / Android 14**) — click the download arrow next to it, then **Next**
6. Click **Finish**

**Step 2 — Start the emulator**

In Device Manager, click the **▶ play** button next to your new device. Wait for it to fully boot to the home screen.

**Step 3 — Run the app**

```bash
pnpm run android
```

### Android (physical device)

1. On your phone go to **Settings → About Phone** and tap **Build Number** 7 times
2. Go to **Settings → Developer Options** and enable **USB Debugging**
3. Connect your phone via USB and accept the debugging prompt
4. Run `pnpm run android`

---

## Other commands

```bash
# Type check
pnpm exec tsc --noEmit

# Lint
pnpm exec eslint . --ext .ts,.tsx

# Export web build for Vercel
pnpm run build:web
```

---

## Supabase

### First-time setup

```bash
# Log in to the Supabase CLI
supabase login

# Link this repo to the cloud project
supabase link --project-ref <project-ref>
```

The project ref is the subdomain in your Supabase project URL:
`https://<project-ref>.supabase.co`

### Apply migrations

```bash
# Push all pending migrations to the remote database
supabase db push
```

### Regenerate TypeScript types

Run this after any schema change to keep `types/supabase.ts` in sync:

```bash
supabase gen types typescript --project-id <project-ref> > types/supabase.ts
```

### Create a new migration

```bash
supabase migration new <migration_name>
# Creates supabase/migrations/<timestamp>_<migration_name>.sql
```

---

## Implementation progress

See [PHASES.md](PHASES.md) for the full feature roadmap and current status.
