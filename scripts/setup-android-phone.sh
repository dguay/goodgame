#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/setup-mobile-production-env.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "Android phone setup for this script expects macOS"
fi

setup_mobile_production_env "goodgame-dev"

info ""
info "Android dev-client phone setup is ready."
info "Production Supabase URL: ${PRODUCTION_SUPABASE_URL}"
info "Env file written: ${ENV_FILE}"
info ""
info "Install a development build on your phone, then start Metro through a tunnel:"
info "pnpm run dev:android:build:local"
info "pnpm run start:dev:tunnel"
info ""
info "This uses the production database. Profile and library edits from the dev build are real production writes."
