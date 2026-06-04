#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/mobile"
ANDROID_STUDIO_JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
DEFAULT_ANDROID_HOME="${HOME}/Library/Android/sdk"

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -x "${ANDROID_STUDIO_JAVA_HOME}/bin/java" ]]; then
    export JAVA_HOME="${ANDROID_STUDIO_JAVA_HOME}"
  else
    fail "JAVA_HOME is not set and Android Studio's bundled JDK was not found. Install Android Studio or set JAVA_HOME to a JDK 17+ path."
  fi
fi

if [[ ! -x "${JAVA_HOME}/bin/java" ]]; then
  fail "JAVA_HOME does not point to a usable JDK: ${JAVA_HOME}"
fi

if [[ -z "${ANDROID_HOME:-}" && -d "${DEFAULT_ANDROID_HOME}" ]]; then
  export ANDROID_HOME="${DEFAULT_ANDROID_HOME}"
fi

printf 'Using JAVA_HOME=%s\n' "${JAVA_HOME}"
if [[ -n "${ANDROID_HOME:-}" ]]; then
  printf 'Using ANDROID_HOME=%s\n' "${ANDROID_HOME}"
fi

pnpm --dir "${MOBILE_DIR}" exec eas build --platform android --profile development --local
