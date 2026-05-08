# Android Build and Internal App Sharing

Goodgame's EAS project root is `mobile/`, because that is where `app.json` lives.

On Windows PowerShell, if script execution policy blocks `pnpm` or `eas`, use the `.cmd` shim instead, for example `pnpm.cmd run build:android` or `eas.cmd login`.

## Repo Configuration

- Android package: `com.davidguay.goodgame`
- EAS build profile: `production`
- Android artifact: AAB (`app-bundle`)
- Credentials: EAS remote credentials
- Firebase config file path: `mobile/google-services.json`

`google-services.json` is intentionally ignored by git. Keep it local and never commit it.

## One-Time Setup

1. Install and log in to EAS:

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Configure the EAS project from the mobile app directory:

   ```bash
   cd mobile
   eas build:configure
   ```

   If EAS asks to create or link a project, use the Goodgame Expo account/project you want to own Android builds.

3. Download `google-services.json` from the Firebase project tied to the Android app and put it here:

   ```text
   mobile/google-services.json
   ```

4. Upload `google-services.json` to EAS as a production file environment variable:

   ```bash
   cd mobile
   eas env:create --name GOOGLE_SERVICES_JSON --environment production --visibility secret --type file --value ./google-services.json
   ```

   This is required because EAS cloud builds only upload files tracked by git, and `google-services.json` must stay gitignored.

5. Add the production Expo public environment variables to EAS:

   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --environment production --visibility sensitive --value "https://your-project.supabase.co"
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --environment production --visibility sensitive --value "your-supabase-anon-key"
   eas env:create --name EXPO_PUBLIC_RAWG_API_KEY --environment production --visibility sensitive --value "your-rawg-api-key"
   ```

   These values are embedded into the Android app at build time. A production EAS build will fail early if any of them are missing.

6. Set up Android credentials:

   ```bash
   cd mobile
   eas credentials --platform android
   ```

   Choose remote credentials and generate a new keystore if one does not already exist. Copy the SHA-1 fingerprint shown by EAS.

7. In Google Cloud Console, create or verify the Android OAuth client:

   - Package name: `com.davidguay.goodgame`
   - SHA-1: the fingerprint from EAS credentials

8. In Supabase Auth -> Providers -> Google, add the Android client ID from Google Cloud Console.

9. In Supabase Auth -> URL Configuration, add the native redirect URL to **Redirect URLs**:

   ```text
   goodgame://auth/callback
   ```

   If this is missing in the hosted Supabase project, Supabase falls back to the site URL after Google sign-in and Chrome will load the website instead of returning to the installed app.

## Build

Play Console requires every uploaded AAB to have a new Android `versionCode`. This project uses EAS remote versioning with `autoIncrement: true`, so EAS should increment `versionCode` on each production build.

If Play Console rejects an upload with `Version code 1 has already been used`, sync EAS remote versioning once:

```bash
cd mobile
eas build:version:set
```

Choose Android, keep/set remote app version source, and enter the latest version code already accepted by Play Console, for example `1`. The next production build will increment from there.

From the repository root:

```bash
pnpm run build:android
```

Equivalent from `mobile/`:

```bash
eas build --platform android --profile production
```

When the build finishes, download the `.aab` from the EAS dashboard.

## Play Store Internal App Sharing

1. Open Google Play Console.
2. Go to Internal testing or Internal app sharing for the Goodgame app.
3. Upload the EAS-produced `.aab`.
4. Copy the sharing link.
5. Install on a physical Android device using that link.

## Device Verification

- App installs from the Internal App Sharing link.
- Google sign-in works on the physical device.
- Session persists after fully closing and reopening the app.
- Home, Search, Library, Profile, and Game Detail screens load.
- First launch does not crash.
