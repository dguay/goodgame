import { parseAuthCallbackParams } from './authHelpers'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  equal: (actual: unknown, expected: unknown) => void
  deepEqual: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => void) => void

test('extracts code from query string (PKCE flow)', () => {
  const params = parseAuthCallbackParams('https://example.com/auth/callback?code=abc123')
  assert.equal(params.get('code'), 'abc123')
})

test('extracts access_token and refresh_token from hash (implicit / magic link flow)', () => {
  const params = parseAuthCallbackParams(
    'goodgame://auth/callback#access_token=tok_a&refresh_token=tok_r&token_type=bearer',
  )
  assert.equal(params.get('access_token'), 'tok_a')
  assert.equal(params.get('refresh_token'), 'tok_r')
})

test('hash params override same-named query params', () => {
  const params = parseAuthCallbackParams(
    'https://example.com/auth/callback?code=from_query#code=from_hash',
  )
  assert.equal(params.get('code'), 'from_hash')
})

test('merges both query and hash params when keys differ', () => {
  const params = parseAuthCallbackParams(
    'https://example.com/auth/callback?state=xyz#access_token=tok_a',
  )
  assert.equal(params.get('state'), 'xyz')
  assert.equal(params.get('access_token'), 'tok_a')
})

test('extracts error and error_description from query string', () => {
  const params = parseAuthCallbackParams(
    'https://example.com/auth/callback?error=access_denied&error_description=User+denied+access',
  )
  assert.equal(params.get('error'), 'access_denied')
  assert.equal(params.get('error_description'), 'User denied access')
})

test('extracts error from hash (Supabase implicit error format)', () => {
  const params = parseAuthCallbackParams(
    'https://example.com/auth/callback#error=otp_expired&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  )
  assert.equal(params.get('error'), 'otp_expired')
  assert.equal(params.get('error_code'), 'otp_expired')
  assert.equal(params.get('error_description'), 'Email link is invalid or has expired')
})

test('returns empty params for URL with no query or hash', () => {
  const params = parseAuthCallbackParams('https://example.com/auth/callback')
  assert.equal(params.get('code'), null)
  assert.equal(params.get('access_token'), null)
})

test('ignores empty hash (#)', () => {
  const params = parseAuthCallbackParams('https://example.com/auth/callback#')
  assert.equal(params.get('code'), null)
})

test('handles deep link scheme (non-https URL)', () => {
  const params = parseAuthCallbackParams(
    'goodgame://auth/callback?code=pkce_code',
  )
  assert.equal(params.get('code'), 'pkce_code')
})
