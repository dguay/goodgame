# Public Repo Remediation Plan

## Goal

Prepare Goodgame to be made public on GitHub for employers by removing detected sensitive or non-public material from the current tree and Git history, disabling the Vercel frontend, and polishing the repository presentation.

This plan intentionally excludes key rotation. If a future pass decides to rotate keys, handle that as a separate operational task.

## Success Criteria

- No Supabase anon JWT or other token-shaped secret remains in the current tracked tree.
- No detected Supabase anon JWT remains in reachable Git history.
- No local-only secret/config files are tracked.
- Vercel no longer auto-deploys the frontend from GitHub, and public Vercel aliases are removed or disabled.
- Employer-facing docs are clean, accurate, and do not expose unnecessary personal/local-machine details.
- A fresh clone of the rewritten repository passes the same secret scans.

## Assumptions

- The GitHub repository has remained private until this cleanup is complete.
- Rewriting history is acceptable before making the repository public.
- The current hosted Supabase project can remain identified by its project ref unless explicitly scrubbed in the polish phase.
- Supabase anon key rotation is out of scope for this plan.
- Service-role keys, OAuth secrets, Resend keys, signing keys, private keys, `.env` files, and Firebase config were not found tracked in the current audit.

## Edge Cases To Handle

- Current files can be clean while historical commits still contain the leaked anon JWT.
- Local branches and remote branches may preserve old commits after rewriting `master`.
- Tags, if added later, may retain old commits unless included in the rewrite.
- GitHub, Vercel, local clones, and CI caches can continue referencing old commit SHAs after a force push.
- Ignored files such as `.env` and `google-services.json` can still be accidentally uploaded outside Git.
- Vercel may keep old deployments reachable even after Git integration is disabled.
- Rewriting history will break existing clones and open PR references.

## Phase 1: Freeze And Backup

1. Confirm no one else is pushing to the repo during cleanup.
2. Record the current branch and HEAD SHA.
3. Create a local backup branch before any rewrite:

   ```bash
   git branch backup/private-before-public-cleanup
   ```

4. Confirm working tree state:

   ```bash
   git status --short
   git branch --all --verbose
   git tag --list
   ```

Verify:

- Backup branch exists locally.
- Any existing uncommitted user changes are understood and not overwritten.

## Phase 2: Clean Current Tracked Files

### Remove Committed Supabase Anon JWT

Replace hardcoded `Authorization: Bearer <anon-jwt>` usage in migrations with non-secret placeholders or Vault/env-secret references.

Known current locations:

- `supabase/migrations/20260527000001_add_reddit_threads_rss.sql`
- `supabase/migrations/20260604000003_schedule_news_ingestion.sql`
- `supabase/migrations/20260604000004_secure_news_cron.sql`

Preferred direction:

- For migrations that are already superseded by Vault-based cron setup, replace literal JWT headers with comments or placeholder examples.
- Keep the SQL understandable without embedding real credentials.
- Do not alter already-applied production database behavior unless a new migration is intentionally created.

Verify:

```bash
rg -n --hidden -g '!.git/*' 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
```

Expected result: no matches in tracked files.

### Remove Or Sanitize Local/Tooling Artifacts

Review whether these should stay public:

- `.claude/settings.json`
- `.expo/README.md`
- `.expo/devices.json`
- `.expo/types/router.d.ts`
- `.expo/web/cache/.../favicon-48.png`
- `claude_insights.html`
- `graphify-out/`
- local API key scratch files

Recommended action:

- Remove generated or personal tooling artifacts from Git.
- Add ignore rules for local tool output that should not return.
- Keep only files that are clearly useful to an employer reviewing the project.

Verify:

```bash
git ls-files | rg '^\.claude/|^\.expo/|claude_insights\.html|^graphify-out/|LOCAL_API_KEY_FILE'
```

Expected result: no tracked personal/generated artifacts unless deliberately justified.

### Sanitize Local Paths And Personal Setup Details

Review docs for absolute local paths and personal-machine details:

- `LOCAL_ANDROID_APK_BUILD.md`
- `README.md`
- scripts under `scripts/`

Recommended action:

- Replace absolute local path examples with repo-relative paths.
- Keep package names and GitHub username only where they are intentionally part of the project identity.

Verify:

```bash
rg -n 'LOCAL_USER_PATH|PRIVATE_EMAIL|LOCAL_API_KEY_FILE'
```

Expected result: no accidental local path or private email references in public-facing docs.

## Phase 3: Disable Vercel Frontend

The audit found a Vercel project named `goodgame` connected to GitHub with recent production deployments from `dguay/goodgame` on `master`.

Actions in Vercel dashboard:

1. Open the `goodgame` project under `dguays-projects`.
2. Disable or disconnect Git integration for `dguay/goodgame`.
3. Remove production and branch aliases if the frontend should not remain accessible:
   - `goodgame-lovat.vercel.app`
   - `goodgame-dguays-projects.vercel.app`
   - `goodgame-git-master-dguays-projects.vercel.app`
4. If the project is no longer needed, delete or archive the Vercel project.
5. Confirm future GitHub pushes do not trigger deployments.

Verify:

- Vercel dashboard shows Git integration disabled or project deleted.
- A new GitHub push does not create a Vercel deployment.
- Public Vercel URLs no longer expose the app, or are intentionally protected/removed.

## Phase 4: Rewrite Git History

Use `git-filter-repo` for history rewriting. It is the standard replacement for `filter-branch` and is safer for this class of cleanup.

### Prepare Replacement Rules

Create a temporary replacements file outside the repo or in `/tmp`.

Replacement targets:

- Replace the leaked Supabase anon JWT with a placeholder such as:

  ```text
  <SUPABASE_ANON_KEY>
  ```

- Optionally replace the Supabase project URL/ref if the polish decision is to hide backend identity:

  ```text
  https://<project-ref>.supabase.co
  <project-ref>
  ```

### Rewrite All Reachable History

Run the rewrite across all refs that will remain in the public repository.

Example shape:

```bash
git filter-repo --replace-text /tmp/goodgame-replacements.txt --force
```

If old side branches should not be public, delete them instead of preserving and rewriting them.

Local branches to evaluate:

- `master`
- `test-github-actions`
- `backup/private-before-public-cleanup` must not be pushed public.

Verify:

```bash
git grep -I -n -E -e 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' $(git rev-list --all)
git log --all --name-only --pretty=format: | sort -u | rg '(^|/)\.env($|\.)|google-services\.json|client_secret.*\.json|\.jks$|\.keystore$|\.p8$|\.p12$|\.pem$|\.key$|\.apk$|\.aab$'
```

Expected result:

- No JWT matches.
- No historical tracked secret files.

### Push Rewritten History

After local verification, force-push only the cleaned public branches:

```bash
git push --force-with-lease origin master
```

For old remote branches that should not be public:

```bash
git push origin --delete test-github-actions
```

Verify:

- GitHub shows only intended branches.
- GitHub commit history no longer contains the leaked JWT.
- A fresh clone has the cleaned history.

## Phase 5: Fresh Clone Verification

Clone the repository into a temporary directory after force-pushing.

Run current-tree scans:

```bash
rg -n --hidden -g '!.git/*' -g '!node_modules/*' -g '!mobile/node_modules/*' '<JWT_REGEX>|<PRIVATE_KEY_REGEX>|<GITHUB_TOKEN_REGEX>|<RESEND_TOKEN_REGEX>'
find . -maxdepth 4 -type f \( -name '.env*' -o -name '*secret*' -o -name '*token*' -o -name '*key*' -o -name 'google-services.json' -o -name 'client_secret*.json' -o -name '*.keystore' -o -name '*.jks' -o -name '*.p8' -o -name '*.pem' \)
```

Run history scans:

```bash
git grep -I -n -E -e '<JWT_REGEX>|<PRIVATE_KEY_REGEX>|<GITHUB_TOKEN_REGEX>|<RESEND_TOKEN_REGEX>' $(git rev-list --all)
git log --all --name-only --pretty=format: | sort -u | rg '(^|/)\.env($|\.)|google-services\.json|client_secret.*\.json|\.jks$|\.keystore$|\.p8$|\.p12$|\.pem$|\.key$|\.apk$|\.aab$'
```

Expected result:

- No token/private-key matches.
- No secret-bearing filenames appear in history.

## Phase 6: Public Repo Polish

### README

Update `README.md` so an employer can quickly understand:

- What Goodgame does.
- Main product flows.
- Tech stack.
- Architecture overview.
- Screenshots or short demo GIFs if available and safe.
- Setup instructions with placeholder env vars only.
- Test/typecheck commands.
- Deployment status: Android/internal sharing and web frontend disabled.
- Add the tech stack as pill

### Project Narrative

Review and decide whether to keep, remove, or archive:

- `PRODUCT.md`
- `DESIGN.md`
- `docs/old/PHASES.md`
- `docs/plans/*`
- external reference docs under `docs/external/`

Recommended action:

- Keep files that demonstrate product thinking or engineering rigor.
- Remove stale internal notes, generated reports, and outdated implementation plans that distract from the public story.

### Package Metadata

Review `package.json` and `mobile/package.json`:

- Decide whether `"private": true` should remain. It is acceptable for apps, but can look odd in a public portfolio repo.
- Add useful scripts if missing from README.
- Confirm package names and descriptions are employer-facing.

### Repository Hygiene

Add or verify ignore rules for:

- local env files
- Firebase configs
- native signing artifacts
- APK/AAB build outputs
- generated Expo output
- AI/tooling output

Verify:

```bash
git status --ignored --short | rg '\.env|google-services|\.apk|\.aab|\.jks|\.p8|graphify|claude|expo'
```

Expected result:

- Sensitive local files are ignored.
- Public tracked files are intentional.

## Phase 7: Final Go/No-Go Checklist

- Current tree has no detected secrets.
- History has no detected leaked JWT or key material.
- Vercel frontend is disabled or removed.
- Old remote branches that preserve risky history are deleted or rewritten.
- README is employer-ready.
- Local-only artifacts are untracked and ignored.
- Fresh clone verification passes.
- GitHub repository settings are ready for public visibility.

Only after all checklist items pass should the GitHub repository visibility be changed to public.
