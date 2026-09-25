import { reportProductionFeatureRecovery } from './pcFeaturesRecoveryCli'

declare const require: (module: string) => unknown
declare const __dirname: string
declare const process: { env: Record<string, string | undefined> }

const assert = require('node:assert/strict') as {
  equal: (actual: unknown, expected: unknown, message?: unknown) => void
}
const test = require('node:test') as (
  name: string,
  options: { skip: boolean },
  fn: () => void | Promise<void>,
) => void
const fs = require('node:fs') as { readFileSync: (path: string, encoding: string) => string }
const path = require('node:path') as { join: (...parts: string[]) => string }
const childProcess = require('node:child_process') as {
  spawnSync: (
    command: string,
    args: string[],
    options: { input?: string; encoding: 'utf8' },
  ) => { status: number | null; stdout: string; stderr: string }
}

const LOCAL_REST = 'http://127.0.0.1:54330'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

test('the report reads persisted after rows from the local recovery database',
  { skip: process.env.PCGW_DB_TEST !== '1' }, async () => {
  const mobileRoot = path.join(__dirname, '../..')
  const repoRoot = path.join(__dirname, '../../..')
  const beforePath = path.join(mobileRoot, 'fixtures/pcgw-features-before-2026-09-24.json')
  const before = fs.readFileSync(beforePath, 'utf8')
  const migration = fs.readFileSync(
    path.join(repoRoot, 'supabase/migrations/20260924171500_recover_poisoned_pcgw_features.sql'),
    'utf8',
  )
  const sql = `
TRUNCATE public.pcgamingwiki_features;
INSERT INTO public.pcgamingwiki_features
SELECT * FROM json_populate_recordset(NULL::public.pcgamingwiki_features, $pcgw$${before}$pcgw$);
${migration}
INSERT INTO public.pcgamingwiki_features (
  rawg_game_id, steam_app_id, pcgw_page_id, pcgw_page_name, sixty_fps, four_k_ultra_hd,
  controller_support, one_twenty_fps, ultrawidescreen, perspectives, official_discord_url,
  xbox_game_pass, xbox_game_pass_checked_at, refreshed_at, created_at, updated_at
) VALUES (
  10533, 238960, 99, 'Recovered Game', 'true', 'limited', 'true', 'false', 'hackable',
  ARRAY['First-person'], 'https://discord.gg/example', 'true', now(), now(), now(), now()
);
`
  const loaded = childProcess.spawnSync(
    'docker',
    ['exec', '-i', 'pcgw-recovery-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8' },
  )
  assert.equal(loaded.status, 0, loaded.stderr)
  const report = await reportProductionFeatureRecovery({
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
    PCGW_RECOVERY_REST_URL: LOCAL_REST,
    PCGW_RECOVERY_BEFORE: beforePath,
  })
  assert.equal(report, 'affected 9\npreserved 31\nrefreshed 1\nstill-failing 8')
})
