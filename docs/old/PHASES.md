# PHASES.md — Goodgame Implementation Plan

> **How to use this file:**
> At the start of each new Claude Code session, paste the relevant phase block as your prompt,
> along with this instruction: _"Read CLAUDE.md first, then implement the phase below."_
> Mark phases `[x]` as they are completed.

---

## Phase Status

- [x] Phase 1 — Project Scaffolding & Tooling
- [x] Phase 2 — Design System & Navigation Shell
- [x] Phase 3 — Supabase Setup & Database Schema
- [x] Phase 4 — Authentication (Google OAuth)
- [x] Phase 5 — RAWG API Integration
- [x] Phase 6 — Search Screen
- [x] Phase 7 — Library Management (Core Feature)
- [x] Phase 8 — Game Detail Page
- [x] Phase 9 — Dashboard / Home Screen
- [x] Phase 10 — Profile Screen
- [x] Phase 11 — Web Deployment (Vercel)
- [ ] Phase 12 — Android Build & Play Store
- [ ] Phase 13 — Polish, Performance & Error Handling

---

---

## Phase 1 — Project Scaffolding & Tooling

**Goal:** Running Expo project with correct structure, TypeScript, linting, and environment config.

### Tasks

1. Initialize Expo project using `expo-router` template:
   ```bash
   npx create-expo-app@latest goodgame --template tabs
   ```
2. Configure TypeScript strict mode in `tsconfig.json`:
   ```json
   { "compilerOptions": { "strict": true, "baseUrl": ".", "paths": { "@/*": ["./*"] } } }
   ```
3. Set up ESLint with `eslint-config-expo` + Prettier
4. Create the full folder structure (empty index files are fine):
   ```
   /app/(auth)/login.tsx
   /app/(tabs)/index.tsx
   /app/(tabs)/search.tsx
   /app/(tabs)/library.tsx
   /app/(tabs)/profile.tsx
   /app/game/[id].tsx
   /components/.gitkeep
   /hooks/.gitkeep
   /lib/.gitkeep
   /stores/.gitkeep
   /types/.gitkeep
   /assets/.gitkeep
   /constants/colors.ts
   /constants/spacing.ts
   /constants/typography.ts
   /supabase/migrations/.gitkeep
   ```
5. Install all dependencies:
   ```bash
   npx expo install expo-router expo-secure-store expo-font expo-image expo-haptics expo-web-browser expo-auth-session
   npm install @supabase/supabase-js @tanstack/react-query zustand
   npm install -D @types/react @types/react-native
   ```
6. Create `.env.local` with placeholder values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_RAWG_API_KEY=your_rawg_api_key
   ```
7. Add `.env.local` to `.gitignore`
8. Configure `app.json`:
   - Set `name` to `Goodgame`, `slug` to `goodgame`
   - Set `scheme` to `goodgame` (for deep links)
   - Set `android.package` to `com.yourname.goodgame`
   - Configure `web.bundler` to `metro`
9. Populate `/constants/colors.ts`, `/constants/spacing.ts`, `/constants/typography.ts` using the design tokens from `CLAUDE.md`
10. Create `/types/index.ts` with `LibraryStatus`, `STATUS_LABELS`, `STATUS_COLORS` from `CLAUDE.md`

### Verification Checklist
- [ ] `npx expo start` launches without errors on web
- [ ] `npx expo start` launches on Android emulator without errors
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx eslint . --ext .ts,.tsx` passes with zero errors
- [ ] All folders and placeholder files exist
- [ ] Constants files export correct tokens

---

---

## Phase 2 — Design System & Navigation Shell

**Goal:** Visual identity established, base components built, tab navigation working on both platforms.

### Tasks

1. Install and load custom fonts via `expo-font`:
   - Use `Syne` (display/headings) + `DM Sans` (body) from Google Fonts
   - Load in root `app/_layout.tsx` using `useFonts`
2. Build base components in `/components/ui/`:

   **`Text.tsx`** — wrapper with `variant` prop:
   ```ts
   type TextVariant = 'display' | 'heading' | 'subheading' | 'body' | 'caption' | 'label'
   ```

   **`Button.tsx`** — with `variant` prop: `primary | secondary | ghost | icon`

   **`Card.tsx`** — surface container with optional `elevated` prop

   **`SafeAreaWrapper.tsx`** — layout wrapper using `expo-router`'s safe area

   **`LoadingSpinner.tsx`** — centered activity indicator using brand colors

   **`SkeletonLoader.tsx`** — animated placeholder using `Animated.Value` pulse

   **`EmptyState.tsx`** — icon + heading + subtext + optional CTA button

   **`RawgFooter.tsx`** — RAWG attribution footer (required on every screen):
   ```tsx
   // Must link to http://rawg.io/
   // Text: "Game data provided by RAWG"
   ```

3. Build tab navigation in `app/(tabs)/_layout.tsx`:
   - 4 tabs: Home (house icon), Search (magnifier), Library (bookmark), Profile (person)
   - Use tab bar icons from `@expo/vector-icons/Ionicons`
   - Style tab bar with `Colors.surface` background, `Colors.primary` active tint
   - On web (width > 768px): render a side navigation instead of bottom tabs

4. Create stub screens for all tabs (just title + `<RawgFooter />` for now):
   - `app/(tabs)/index.tsx` → "Home"
   - `app/(tabs)/search.tsx` → "Search"
   - `app/(tabs)/library.tsx` → "Library"
   - `app/(tabs)/profile.tsx` → "Profile"

5. Create stub `app/(auth)/login.tsx` with just a "Login" heading

6. Set up root layout `app/_layout.tsx`:
   - Load fonts
   - Wrap app in `QueryClientProvider`
   - Placeholder auth guard (always show tabs for now — auth added in Phase 4)

### Verification Checklist
- [ ] All 4 tabs render and are navigable on Android
- [ ] All 4 tabs render and are navigable on web
- [ ] On web at width > 768px, side nav renders instead of bottom tabs
- [ ] `<RawgFooter />` renders at the bottom of every stub screen
- [ ] `<SkeletonLoader />` animation runs correctly
- [ ] `<Button />` all variants render with correct colors
- [ ] No TypeScript errors

---

---

## Phase 3 — Supabase Setup & Database Schema

**Goal:** Supabase project configured, schema applied, RLS enabled, TypeScript types generated.

### Tasks

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   supabase login
   supabase init
   ```

2. Create migration file `/supabase/migrations/001_initial_schema.sql`:
   ```sql
   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   -- Profiles table
   CREATE TABLE profiles (
     id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     username text UNIQUE,
     display_name text,
     avatar_url text,
     created_at timestamptz DEFAULT now() NOT NULL
   );
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
   CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

   -- Library entries table
   CREATE TABLE library_entries (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
     rawg_game_id integer NOT NULL,
     game_title text NOT NULL,
     game_cover_url text,
     status text NOT NULL CHECK (status IN ('want_to_play','playing','done','did_not_finish')),
     personal_rating numeric(3,1) CHECK (personal_rating >= 0 AND personal_rating <= 10),
     personal_playtime_minutes integer CHECK (personal_playtime_minutes >= 0),
     personal_notes text,
     started_at date,
     finished_at date,
     created_at timestamptz DEFAULT now() NOT NULL,
     updated_at timestamptz DEFAULT now() NOT NULL,
     UNIQUE(user_id, rawg_game_id)
   );
   ALTER TABLE library_entries ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can manage own library" ON library_entries
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);

   -- Auto-update updated_at trigger
   CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
   CREATE TRIGGER set_updated_at BEFORE UPDATE ON library_entries
     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

   -- Auto-create profile on signup trigger
   CREATE OR REPLACE FUNCTION handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO profiles (id, display_name, avatar_url)
     VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```

3. Apply migration to Supabase project:
   ```bash
   supabase db push
   ```

4. Generate TypeScript types:
   ```bash
   supabase gen types typescript --project-id <PROJECT_ID> > types/supabase.ts
   ```

5. Create `/lib/supabase.ts`:
   ```ts
   // Initialize Supabase client
   // Use expo-secure-store adapter on native
   // Use default localStorage adapter on web
   // Export typed `supabase` client
   ```

6. Create `/types/database.ts` with convenience re-exports:
   ```ts
   export type Profile = Database['public']['Tables']['profiles']['Row']
   export type LibraryEntry = Database['public']['Tables']['library_entries']['Row']
   export type LibraryEntryInsert = Database['public']['Tables']['library_entries']['Insert']
   export type LibraryEntryUpdate = Database['public']['Tables']['library_entries']['Update']
   ```

### Verification Checklist
- [ ] Both tables exist in Supabase dashboard
- [ ] RLS is enabled on both tables (visible in dashboard)
- [ ] Test in Supabase SQL editor: insert a row as user A, confirm user B cannot SELECT it
- [ ] `types/supabase.ts` is generated and has correct table shapes
- [ ] Supabase client initializes without errors in the app
- [ ] Auto-create profile trigger works (sign up a test user, check profiles table)

---

---

## Phase 4 — Authentication (Google OAuth)

**Goal:** Google OAuth login and logout working on Android and web, with session persistence.

### Tasks

1. Enable Google provider in Supabase dashboard → Authentication → Providers
2. Set up Google Cloud Console:
   - Create OAuth 2.0 Web Client ID
   - Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Create Android OAuth Client ID with package name + SHA-1
   - Add `goodgame://` as authorized redirect URI for native
3. Create `/stores/authStore.ts` (Zustand):
   ```ts
   interface AuthStore {
     user: User | null
     session: Session | null
     isLoading: boolean
     isAuthenticated: boolean
     setSession: (session: Session | null) => void
     signOut: () => Promise<void>
   }
   ```
4. Create `/lib/auth.ts`:
   ```ts
   export async function signInWithGoogle(): Promise<void>
   // Native: use expo-auth-session with makeRedirectUri({ scheme: 'goodgame' })
   // Web: use supabase.auth.signInWithOAuth({ provider: 'google' })
   export async function signOut(): Promise<void>
   ```
5. Build `app/(auth)/login.tsx`:
   - Goodgame logo/wordmark (text-based is fine for now)
   - Tagline: "Your gaming journey, tracked."
   - "Continue with Google" button (use Google brand colors)
   - `<RawgFooter />` at bottom
6. Add auth listener in `app/_layout.tsx`:
   - `supabase.auth.onAuthStateChange` → update Zustand store
   - Restore session on app start
   - Auth guard: if `!isAuthenticated` and route is not `/(auth)/*`, redirect to `/(auth)/login`
7. Add sign out to profile tab (stub for now — just a button that calls `signOut()`)
8. Make sure we can develop locally without interfering with data in production

### Verification Checklist
- [ ] Tapping "Continue with Google" opens Google OAuth on Android
- [ ] Tapping "Continue with Google" opens Google OAuth on web
- [ ] After login, user lands on the Home tab
- [ ] `profiles` table gets a new row automatically on first login
- [ ] `authStore.user` contains correct user data
- [ ] Closing and reopening app maintains session (no re-login required)
- [ ] Sign out clears session and redirects to login screen
- [ ] Unauthenticated deep links redirect to login

---

---

## Phase 5 — RAWG API Integration

**Goal:** Typed RAWG API client built, React Query hooks ready, used in a test screen.

### Tasks

1. Create `/types/rawg.ts` with full TypeScript interfaces:
   ```ts
   interface RawgGame {
     id: number
     name: string
     background_image: string | null
     released: string | null
     metacritic: number | null
     rating: number
     ratings_count: number
     genres: { id: number; name: string; slug: string }[]
     platforms: { platform: { id: number; name: string; slug: string } }[]
     short_screenshots: { id: number; image: string }[]
   }
   interface RawgGameDetail extends RawgGame {
     description_raw: string
     developers: { id: number; name: string }[]
     publishers: { id: number; name: string }[]
     website: string
     playtime: number  // RAWG's average playtime estimate
   }
   interface RawgPaginatedResponse<T> {
     count: number
     next: string | null
     previous: string | null
     results: T[]
   }
   ```

2. Create `/lib/rawg.ts` typed API client:
   ```ts
   const BASE = 'https://api.rawg.io/api'

   // All methods append ?key=EXPO_PUBLIC_RAWG_API_KEY automatically

   export async function searchGames(query: string, page = 1): Promise<RawgPaginatedResponse<RawgGame>>
   export async function getGameDetail(id: number): Promise<RawgGameDetail>
   export async function getGames(params: GetGamesParams): Promise<RawgPaginatedResponse<RawgGame>>
   export async function getNewReleases(): Promise<RawgPaginatedResponse<RawgGame>>
     // dates: last 30 days, ordering: -released
   export async function getTopRated(): Promise<RawgPaginatedResponse<RawgGame>>
   ```

3. Create React Query hooks in `/hooks/useRawg.ts`:
   ```ts
   export function useGameSearch(query: string)        // enabled only when query.length > 1
   export function useGameDetail(id: number | null)
   export function useNewReleases()
   export function useTopRated()
   ```
   All hooks use `staleTime: 5 * 60 * 1000`.

4. Configure `QueryClient` in `app/_layout.tsx` with default options.

5. Quick integration test: in `app/(tabs)/search.tsx`, call `useNewReleases()` and render the first game title as a `<Text>` to confirm the API works end-to-end.

### Verification Checklist
- [ ] `searchGames('zelda')` returns typed `RawgGame[]` results
- [ ] `getGameDetail(3498)` (GTA V) returns correct `RawgGameDetail`
- [ ] `getNewReleases()` returns games from the last 30 days
- [ ] React Query caches results (navigating away and back does not re-fetch)
- [ ] No TypeScript errors in rawg.ts or hooks
- [ ] RAWG API key is loaded from env var (not hardcoded)
- [ ] Test component on Search screen displays a game title correctly

---

---

## Phase 6 — Search Screen

**Goal:** Fully functional search screen with debounced input, paginated results, and quick-add.

### Tasks

1. Create `useDebounce` hook in `/hooks/useDebounce.ts` (300ms)

2. Build `<GameCard>` component in `/components/GameCard.tsx`:
   - Cover image via `expo-image` with fade-in and gray placeholder
   - Game title (truncated to 2 lines)
   - Release year (parsed from `released` date string)
   - Metacritic score badge (green ≥75, yellow ≥60, red <60, hidden if null)
   - Platform icons (PS, Xbox, PC, Nintendo — use simple text abbreviations or icons)
   - `<AddToLibraryButton />` (stub for now — just shows a `+` icon, wired in Phase 7)

3. Build `<GameListItem>` — compact horizontal variant of `GameCard` for search results:
   - Small thumbnail (60×80)
   - Title + year + top genre
   - Metacritic score
   - `+` add button

4. Build `app/(tabs)/search.tsx`:
   - Search input bar (autofocus on mount, clear button)
   - When query is empty: show `useTopRated()` results in a grid (2 columns) titled "Popular Games"
   - When query has 2+ chars: show `useGameSearch(debouncedQuery)` results as a list
   - Infinite scroll: "Load more" button at bottom (or `onEndReached` FlatList)
   - Loading state: show `<SkeletonLoader />` rows
   - No results state: show `<EmptyState />` with search icon
   - `<RawgFooter />` at the very bottom

5. Ensure the screen is scrollable and keyboard-dismissable on mobile

### Verification Checklist
- [ ] Typing "zelda" shows relevant results within 1 second
- [ ] Empty search shows popular/top-rated games
- [ ] Results are paginated (Load more works)
- [ ] Images load with placeholder fallback
- [ ] Loading skeleton shows while fetching
- [ ] "No results" empty state shows for gibberish queries
- [ ] Keyboard dismisses on scroll on mobile
- [ ] `<RawgFooter />` is visible at the bottom

---

---

## Phase 7 — Library Management (Core Feature)

**Goal:** Full CRUD for library entries, status management, library screen with filters.

### Tasks

1. Create Supabase library hooks in `/hooks/useLibrary.ts`:
   ```ts
   export function useLibraryEntries()                          // all entries for current user
   export function useLibraryEntry(rawgGameId: number | null)   // single entry by rawg id
   export function useAddToLibrary()                            // mutation
   export function useUpdateLibraryEntry()                      // mutation
   export function useRemoveFromLibrary()                       // mutation
   ```
   All mutations use **optimistic updates** — update React Query cache before server confirms.

2. Build `<StatusPicker>` modal/bottom sheet in `/components/StatusPicker.tsx`:
   - Renders as bottom sheet on mobile, centered modal on web
   - Shows all 4 status options as large tappable rows with color indicators and icons
   - "Remove from Library" option at the bottom (destructive, red)
   - Dismiss on backdrop tap

3. Build `<AddToLibraryButton>` in `/components/AddToLibraryButton.tsx`:
   ```ts
   interface Props {
     game: Pick<RawgGame, 'id' | 'name' | 'background_image'>
   }
   ```
   - If game not in library: shows `+ Add` button (primary)
   - If game in library: shows current status chip (colored by status) — tap to open `<StatusPicker>`
   - Calls `useLibraryEntry(game.id)` to determine state

4. Wire `<AddToLibraryButton>` into `<GameCard>` and `<GameListItem>` (from Phase 6)

5. Build `app/(tabs)/library.tsx`:
   - Filter tab bar at top: All · Want to Play · Playing · Done · DNF
   - Each tab shows count badge
   - Sort dropdown: Recently Added · Title (A–Z) · Rating · Playtime
   - Toggle: Grid view (2-col) / List view
   - Game card shows: cover, title, status chip, personal rating (if set), playtime (if set)
   - Pull-to-refresh
   - Empty state per tab
   - `<RawgFooter />` at bottom

6. Add swipe-to-delete on list view items (native only, using `react-native-gesture-handler`)

### Verification Checklist
- [ ] Adding a game saves a row in `library_entries` with correct `user_id`
- [ ] Optimistic update shows status change instantly (no loading flicker)
- [ ] Changing status updates the DB row correctly
- [ ] Removing a game deletes the DB row and disappears from library
- [ ] Library filter tabs show correct subset of entries
- [ ] Entry counts on tabs are accurate
- [ ] Two different logged-in users cannot see each other's libraries
- [ ] Pull-to-refresh works

---

---

## Phase 8 — Game Detail Page

**Goal:** Rich game detail page with RAWG metadata and personal tracking fields.

### Tasks

1. Build `app/game/[id].tsx` using `useLocalSearchParams` to get game ID:

2. **Hero section:**
   - Full-bleed background image (blurred) behind a gradient overlay
   - Cover art + title + developer + release year overlaid on gradient
   - Metacritic badge + RAWG community rating
   - Platform chips

3. **Info section:**
   - Genre chips
   - Description text with "Read more / Show less" toggle (collapse at 3 lines)
   - Screenshots horizontal scroll gallery (tap to view fullscreen)

4. **Library action bar** (sticky at bottom or prominent button):
   - `<AddToLibraryButton>` prominently placed

5. **Personal tracking section** (only render if game is in user's library):
   - **Rating:** Numeric slider 0–10 (0.5 increments), shows current value
   - **Playtime:** Text input (hours), converts to minutes for storage
   - **Notes:** Multi-line `TextInput`, auto-saves on blur with 500ms debounce
   - **Started / Finished dates:** Date pickers using `@react-native-community/datetimepicker`
   - All fields call `useUpdateLibraryEntry()` mutation on change

6. **"More Like This" section:**
   - Compact `<GameCard>` variant

7. `<RawgFooter />` at the bottom

8. Set web `<Head>` meta tags: title = game name, description = first 160 chars of description

### Verification Checklist
- [ ] Page loads with correct game data from RAWG
- [ ] Hero image renders correctly on both platforms
- [ ] Personal tracking section only appears when game is in library
- [ ] Rating slider saves to DB on change
- [ ] Notes auto-save (confirmed by refreshing page and seeing notes persist)
- [ ] Playtime (hours input) converts to minutes and saves correctly
- [ ] "More Like This" shows relevant games
- [ ] Web page has correct `<title>` and meta description

---

---

## Phase 9 — Dashboard / Home Screen

**Goal:** Personalized, data-rich home screen with discovery sections.

### Tasks

1. Create recommendation logic hook `/hooks/useRecommendations.ts`:
   - Pull user's library entries with status `done` or `playing`
   - Extract unique genre slugs from those games (need to fetch RAWG details for each, cache aggressively)
   - Query RAWG `/games` with top 3 genres as filter
   - Exclude games already in user's library from results

2. Build `app/(tabs)/index.tsx` with these sections:

   **Header:**
   - "Good [morning/afternoon/evening], [displayName] 👾" (time-based greeting)
   - Quick stats strip: `[X] Games · [Y] Playing · [Z] Completed`

   **"Continue Playing"** (only if user has games with status `playing`):
   - Horizontal scroll of `<GameCard>`
   - Sorted by `updated_at DESC`

   **"New Releases":**
   - Horizontal scroll using `useNewReleases()`
   - Section header with "See all" link → navigates to search pre-filtered

   **"Recommended for You"** (only if user has 3+ games in library):
   - Horizontal scroll using `useRecommendations()`
   - If insufficient library data: show "Top Rated" instead with label "Discover Games"

   **"Recently Added":**
   - Last 5 games added to user's library, horizontal scroll

3. Each section uses `<SkeletonLoader />` while loading
4. Pull-to-refresh on entire screen
5. `<RawgFooter />` at bottom

### Verification Checklist
- [ ] Greeting text reflects correct time of day
- [ ] Stats strip shows accurate counts from library
- [ ] "Continue Playing" shows only games with `playing` status
- [ ] "New Releases" shows games from last 30 days
- [ ] "Recommended" section appears only after 3+ library entries
- [ ] Recommendations don't include games already in user's library
- [ ] Pull-to-refresh works and updates all sections
- [ ] All sections show skeleton loaders while fetching

---

---

## Phase 10 — Profile Screen

**Goal:** User stats, library breakdown visualization, and account management.

### Tasks

1. Create `/hooks/useProfileStats.ts`:
   ```ts
   interface ProfileStats {
     totalGames: number
     byStatus: Record<LibraryStatus, number>
     totalPlaytimeMinutes: number
     averageRating: number | null
     topGenres: string[]      // derived from library
   }
   export function useProfileStats(): ProfileStats
   ```

2. Build `app/(tabs)/profile.tsx`:

   **Header:**
   - User avatar (from Google, via `expo-image`)
   - Display name (editable inline — tap to edit)
   - Username (if set) or email

   **Stats Card:**
   - Total games in library
   - Breakdown by status (4 colored numbers)
   - Total playtime (formatted: "142h 30m")
   - Average personal rating (if any ratings set)

   **Library Breakdown Chart:**
   - Horizontal stacked bar or simple 4-segment bar
   - Built with `react-native-svg` — NO external chart library needed for this
   - Colored by `STATUS_COLORS` from `CLAUDE.md`

   **Top Genres:**
   - Derived from library — top 5 genre chips

   **Settings Section:**
   - "Edit Display Name" row
   - "Sign Out" row (destructive)

3. Implement display name edit:
   - Tap → show `TextInput` inline
   - Confirm on blur or Return key
   - Calls Supabase `profiles` update mutation

### Verification Checklist
- [ ] Stats accurately reflect library data
- [ ] Total playtime formats correctly (e.g., "0h 0m" if none set)
- [ ] Average rating shows null state gracefully ("No ratings yet")
- [ ] Chart renders without crashing on both platforms
- [ ] Display name edit saves to Supabase `profiles` table
- [ ] Sign out works and redirects to login
- [ ] Avatar loads from Google profile URL

---

---

## Phase 11 — Web Deployment (Vercel)

**Goal:** Web version live on Vercel with working auth and all features.

### Tasks

1. Verify `app.json` web config:
   ```json
   { "web": { "bundler": "metro", "output": "static" } }
   ```

2. Create `vercel.json`:
   ```json
   {
     "buildCommand": "npx expo export --platform web",
     "outputDirectory": "dist",
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

3. Create `package.json` build script:
   ```json
   { "scripts": { "build:web": "expo export --platform web" } }
   ```

4. Push project to GitHub

5. Connect GitHub repo to Vercel:
   - Framework: Other
   - Build command: `npx expo export --platform web`
   - Output directory: `dist`

6. Add environment variables in Vercel dashboard:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_RAWG_API_KEY`

7. In Supabase Auth settings, add Vercel deployment URL to:
   - Site URL
   - Redirect URLs

8. In Google Cloud Console, add Vercel URL to authorized redirect URIs

9. Test full OAuth flow on the deployed URL

10. Verify responsive layout at 375px, 768px, 1280px breakpoints

### Verification Checklist
- [ ] `npx expo export --platform web` completes locally without errors
- [ ] Vercel deployment succeeds (no build errors in dashboard)
- [ ] Web app loads at Vercel URL
- [ ] Google OAuth login works on deployed web
- [ ] All 4 tabs and game detail page load without 404
- [ ] Environment variables are not visible in page source
- [ ] RAWG footer appears on all pages
- [ ] Layout looks correct at mobile, tablet, and desktop widths

---

---

## Phase 12 — Android Build & Play Store (Internal App Sharing)

**Goal:** Signed Android AAB uploaded to Play Store via Internal App Sharing.

### Tasks

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Initialize EAS in project:
   ```bash
   eas build:configure
   ```

3. Configure `eas.json`:
   ```json
   {
     "build": {
       "production": {
         "android": {
           "buildType": "app-bundle",
           "credentialsSource": "remote"
         }
       }
     }
   }
   ```

4. Download `google-services.json` from Google Cloud Console (Firebase project for the Android app):
   - Add to project root
   - Add to `.gitignore`
   - Reference in `app.json`: `"googleServicesFile": "./google-services.json"`

5. Set up Android credentials via EAS:
   ```bash
   eas credentials --platform android
   ```
   Choose "Generate new keystore" — EAS stores it securely.

6. Add Android OAuth Client ID to Google Cloud Console:
   - Get SHA-1 from keystore: `eas credentials` shows it
   - Create Android client ID in Google Cloud Console with correct package name + SHA-1

7. Update Supabase Auth → Google provider with Android client ID

8. Run production build:
   ```bash
   eas build --platform android --profile production
   ```

9. Download the `.aab` from EAS dashboard when build completes

10. Upload to Play Store:
    - Go to Google Play Console → Internal testing
    - Upload the `.aab`
    - Go to "Internal app sharing" → copy the sharing link
    - Test on a physical Android device using the sharing link

### Verification Checklist
- [ ] EAS build completes without errors
- [ ] `.aab` file downloads from EAS dashboard
- [ ] App installs on physical Android device via Internal App Sharing link
- [ ] Google OAuth login works on the physical device
- [ ] Session persists after closing the app on the physical device
- [ ] All screens load correctly on the physical device
- [ ] App doesn't crash on first launch

---

---

## Phase 13 — Polish, Performance & Error Handling

**Goal:** Production-quality resilience, performance, and cross-platform polish.

### Tasks

1. **Error Boundaries:**
   - Create `/components/ErrorBoundary.tsx` class component
   - Wrap each tab screen with it
   - Show a friendly error card with "Try again" button

2. **Network error handling:**
   - Install `@react-native-community/netinfo`
   - Create `useNetworkStatus` hook
   - Show offline banner when `isConnected === false`
   - React Query `retry: 2` for all queries

3. **Image optimization:**
   - Ensure all images use `expo-image` (not `Image` from react-native)
   - Set `cachePolicy="disk"` on all `<Image>` components
   - Add `contentFit="cover"` and `transition={200}` for smooth load-in

4. **Pull-to-refresh audit:**
   - Verify pull-to-refresh is implemented on: Home, Library, Profile, Search (when showing top-rated)

5. **Haptic feedback (native only):**
   - Add `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on:
     - Adding a game to library
     - Changing status
     - Rating a game

6. **Web responsive audit:**
   - Test all screens at 375px (mobile), 768px (tablet), 1280px (desktop)
   - Fix any layout overflow or font-size issues
   - Ensure touch targets are ≥44px on mobile, but not oversized on desktop

7. **SEO / Web meta tags:**
   - `app/(tabs)/index.tsx` → title "Goodgame — Your Gaming Backlog"
   - `app/game/[id].tsx` → dynamic title from game name
   - Add `og:image` meta using game cover art

8. **App icon + Splash screen:**
   - Create 1024×1024 app icon (use text-based or simple graphic)
   - Configure adaptive icon for Android in `app.json`
   - Create splash screen image
   - Use `expo-splash-screen` to hide splash only after fonts loaded

9. **Performance checks:**
   - Ensure no component re-renders unnecessarily (use React DevTools / Flipper)
   - Memoize expensive derived state in hooks with `useMemo`
   - Ensure FlatLists use `keyExtractor` and `getItemLayout` where possible

10. **Final RAWG attribution audit:**
    - Confirm `<RawgFooter />` is present on every single screen
    - Confirm the link opens `http://rawg.io/` correctly on both platforms

### Verification Checklist
- [ ] App works gracefully with WiFi disabled (shows offline banner, cached data visible)
- [ ] No blank white screens — all error states show friendly messages
- [ ] All screens have pull-to-refresh
- [ ] Haptics fire correctly on Android for key actions
- [ ] Web layout looks good at 375px, 768px, and 1280px
- [ ] App icon shows correctly in Android launcher
- [ ] Splash screen shows on launch then transitions smoothly
- [ ] `<RawgFooter />` confirmed on all screens
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] No ESLint errors (`npx eslint . --ext .ts,.tsx` passes)

---

_End of PHASES.md_
