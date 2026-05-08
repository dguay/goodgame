const requiredProductionEnvVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_RAWG_API_KEY',
  'GOOGLE_SERVICES_JSON',
]

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

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  }
}
