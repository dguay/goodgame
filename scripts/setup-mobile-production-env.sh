#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="zjluauqdqockjswczndb"
PRODUCTION_SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/mobile"
ENV_FILE="${MOBILE_DIR}/.env.local"

info() {
  printf '%s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi

  awk -F= -v key="${key}" '
    $1 == key {
      sub(/^[^=]*=/, "")
      gsub(/^["'\'']|["'\'']$/, "")
      print
      exit
    }
  ' "${ENV_FILE}"
}

prompt_if_empty() {
  local key="$1"
  local prompt="$2"
  local current_value="${!key:-}"

  if [[ -n "${current_value}" ]]; then
    printf '%s' "${current_value}"
    return
  fi

  current_value="$(read_env_value "${key}")"
  if [[ -n "${current_value}" ]]; then
    printf '%s' "${current_value}"
    return
  fi

  read -r -p "${prompt}: " current_value
  if [[ -z "${current_value}" ]]; then
    fail "${key} is required"
  fi

  printf '%s' "${current_value}"
}

write_env_file() {
  local supabase_url="$1"
  local supabase_anon_key="$2"
  local rawg_api_key="$3"
  local auth_redirect_scheme="${4:-goodgame}"
  local tmp_file

  tmp_file="$(mktemp)"
  if [[ -f "${ENV_FILE}" ]]; then
    grep -vE '^(EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY|EXPO_PUBLIC_RAWG_API_KEY|EXPO_PUBLIC_AUTH_REDIRECT_SCHEME)=' "${ENV_FILE}" > "${tmp_file}" || true
  fi

  {
    printf 'EXPO_PUBLIC_SUPABASE_URL=%s\n' "${supabase_url}"
    printf 'EXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n' "${supabase_anon_key}"
    printf 'EXPO_PUBLIC_RAWG_API_KEY=%s\n' "${rawg_api_key}"
    printf 'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME=%s\n' "${auth_redirect_scheme}"
  } >> "${tmp_file}"

  mv "${tmp_file}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
}

setup_mobile_production_env() {
  local auth_redirect_scheme="${1:-goodgame}"

  command -v pnpm >/dev/null 2>&1 || fail "pnpm is not installed. Install it with: corepack enable && corepack prepare pnpm@10.33.2 --activate"

  info "Installing mobile dependencies..."
  pnpm --dir "${MOBILE_DIR}" install

  existing_supabase_url="$(read_env_value "EXPO_PUBLIC_SUPABASE_URL")"
  if [[ "${existing_supabase_url}" == http://127.0.0.1* || "${existing_supabase_url}" == http://localhost* ]]; then
    info "mobile/.env.local currently points at local Supabase. This setup will switch it to production."
  fi

  supabase_anon_key="$(prompt_if_empty "EXPO_PUBLIC_SUPABASE_ANON_KEY" "Production Supabase anon key")"
  rawg_api_key="$(prompt_if_empty "EXPO_PUBLIC_RAWG_API_KEY" "RAWG API key")"

  write_env_file "${PRODUCTION_SUPABASE_URL}" "${supabase_anon_key}" "${rawg_api_key}" "${auth_redirect_scheme}"
}
