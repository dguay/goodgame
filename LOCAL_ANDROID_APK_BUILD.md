# Local Android APK Builds

This guide documents how to build and install a production Android APK locally when EAS cloud build quota is unavailable.

## Prerequisites

Use macOS with Homebrew, pnpm, Expo/EAS login, and a USB-connected Android phone with USB debugging enabled.

Installed local build tools:

```bash
brew install openjdk@17 android-commandlinetools
```

Environment paths used for this project:

```bash
export JAVA_HOME=/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/usr/local/share/android-commandlinetools
export ANDROID_SDK_ROOT=/usr/local/share/android-commandlinetools
export ANDROID_NDK_HOME=/usr/local/share/android-commandlinetools/ndk/27.1.12297006
export PATH="/usr/local/opt/openjdk@17/bin:/usr/local/share/android-commandlinetools/platform-tools:$PATH"
```

To make `adb` available in future terminals:

```bash
echo 'export PATH="/usr/local/share/android-commandlinetools/platform-tools:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Android SDK Setup

Accept Android SDK licenses:

```bash
yes | sdkmanager --licenses
```

Install required SDK packages:

```bash
sdkmanager \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "ndk;27.1.12297006" \
  "cmake;3.22.1"
```

## Build The Production APK

Make sure you are logged into EAS:

```bash
pnpm --dir mobile exec eas whoami
```

Run the local production APK build from the repo root:

```bash
JAVA_HOME=/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/usr/local/share/android-commandlinetools \
ANDROID_SDK_ROOT=/usr/local/share/android-commandlinetools \
ANDROID_NDK_HOME=/usr/local/share/android-commandlinetools/ndk/27.1.12297006 \
NODE_ENV=production \
GOOGLE_SERVICES_JSON=/Users/davidguay/git/goodgame/mobile/google-services.json \
PATH="/usr/local/opt/openjdk@17/bin:/usr/local/share/android-commandlinetools/platform-tools:$PATH" \
pnpm --dir mobile exec eas build --platform android --profile production-apk --local --non-interactive
```

The build uses:

- EAS production environment variables
- Remote Android signing credentials
- The `production-apk` profile in `mobile/eas.json`
- Local `mobile/google-services.json`

The generated APK will be written to:

```text
mobile/build-<timestamp>.apk
```

## Install On Phone

Check that the phone is connected:

```bash
adb devices
```

Install or update the APK:

```bash
adb install -r /Users/davidguay/git/goodgame/mobile/build-<timestamp>.apk
```

If `adb` is not on your PATH, use the full path:

```bash
/usr/local/share/android-commandlinetools/platform-tools/adb install -r /Users/davidguay/git/goodgame/mobile/build-<timestamp>.apk
```

## Signature Mismatch

If install fails with:

```text
INSTALL_FAILED_UPDATE_INCOMPATIBLE
```

The installed app was signed with a different key. Uninstall first:

```bash
adb uninstall com.davidguay.goodgame
adb install /Users/davidguay/git/goodgame/mobile/build-<timestamp>.apk
```

Uninstalling removes local app data on the phone. Supabase server-side data is unaffected.

## Crash Log Capture

Clear logs:

```bash
adb logcat -c
```

Launch the app:

```bash
adb shell monkey -p com.davidguay.goodgame -c android.intent.category.LAUNCHER 1
```

Filter crash logs:

```bash
adb logcat -d -v time | rg -i "goodgame|AndroidRuntime|FATAL EXCEPTION|ReactNativeJS|ReactNative|RuntimeException|Exception|crash"
```

Check whether the app process is still running:

```bash
adb shell pidof com.davidguay.goodgame
```

## Current Android Crash Workaround

The local APK crashed on launch with:

```text
java.lang.IndexOutOfBoundsException: getChildDrawingOrder() returned invalid index 2 (child count is 2)
```

The stack trace pointed to `react-native-screens` native `ScreenStack.performDraw`.

Current workaround:

- `mobile/app/_layout.tsx` disables native screens on Android with `enableScreens(false)`.
- This avoids the native `ScreenStack` draw-order crash.
- TypeScript passed after the change.
- The rebuilt APK installed and launched successfully on the connected phone.

## Notes

- Local EAS builds still increment remote Android `versionCode`.
- The next EAS/Play Store build must use a higher `versionCode`.
- `expo doctor` currently reports dependency warnings, but the APK build can still succeed.
- Local builds do not restore/save EAS cache, so native release compilation can still take 20+ minutes.
