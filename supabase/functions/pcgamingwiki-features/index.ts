import {
  credentialsFromEnv,
  handlePcGamingWikiFeaturesRequest,
  PcgwLookupError,
} from './lookup.ts'

Deno.serve(async (req) => {
  try {
    return await handlePcGamingWikiFeaturesRequest(req, {
      credentials: credentialsFromEnv(Deno.env),
    })
  } catch (error) {
    const lookupError = error instanceof PcgwLookupError
      ? error
      : new PcgwLookupError('transport', 'PCGamingWiki request failed')
    return new Response(JSON.stringify({
      error: { kind: lookupError.kind, message: lookupError.message },
    }), {
      status: lookupError.kind === 'configuration' ? 500 : 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
