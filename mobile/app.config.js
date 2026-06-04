const requiredProductionEnvVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_RAWG_API_KEY',
  'GOOGLE_SERVICES_JSON',
]

function appVariant() {
  return process.env.GOODGAME_APP_VARIANT === 'development' ? 'development' : 'production'
}

function assertProductionEnv() {
  if (process.env.EAS_BUILD !== 'true' || process.env.EAS_BUILD_PROFILE !== 'production') {
    return
  }

  const missing = requiredProductionEnvVars.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required EAS production environment variables: ${missing.join(', ')}`)
  }
}

module.exports = ({ config }) => {
  assertProductionEnv()
  const variant = appVariant()
  const isDevelopment = variant === 'development'

  return {
    ...config,
    name: isDevelopment ? `${config.name} Dev` : config.name,
    scheme: isDevelopment ? 'goodgame-dev' : config.scheme,
    android: {
      ...config.android,
      package: isDevelopment ? `${config.android.package}.dev` : config.android.package,
      googleServicesFile: isDevelopment
        ? undefined
        : process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  }
}
