> **SUPERSEDED HOSTING TARGET — 2026-10-26:** The owner chose **Vercel**, NOT Render, for any future ServiceDesk deployment and expressly forbade **all deployments without separate permission** (including previews and Git-triggered builds). This file's Render instructions are retained as HISTORICAL evidence/rollback context only, not an active deploy authorization. Do not create a ServiceDesk Vercel project, link Git, change billing, deploy any environment or provision test users from this runbook. Follow [Vercel manual-only owner directive](./P02_VERCEL_MANUAL_ONLY_HANDOFF_20261026.md) and [release lock](./P02_SHARED_INFRA_RELEASE_LOCK.json). The database 0065 security patch is already installed; P02 real two-owner acceptance remains open.

> **2026-10-26 VERIFIED UPDATE (supersedes all older NOT APPLIED/through-0062 statements below):** The owner-approved 0065-only `servicedesk_default_branch(uuid)` security fix was successfully installed through the connected Supabase `apply_migration` on existing main project `cpmmgivhlkfbiwzhlcey`. Ledger now has 70 entries; latest `20261025200147 sd_0065_v4_default_branch_membership_authority`. Installed function MD5 `9f14160f16e16ffe6ac16f35c3f4557f`, active membership guard and authenticated-only EXECUTE verified. In READ-ONLY synthetic role-context probes, existing real owner's account may resolve its own default branch, unrelated authenticated nonmember receives NULL and sees zero workspace/branch rows. Existing 1 auth user, 1 workspace, 1 request unchanged; no new accounts, messages, or migrations 0063/0064. The approved 0065 **out-of-sequence** exception must be reconciled before any subsequent migration push; never modify or reapply applied migration blindly. **Real two-distinct-owner JWT/browser acceptance and existing Render V4 deployment remain unverified; P02 stays open.** [GitHub P02 live checkpoint](https://github.com/SaamVR/ServiceDesk/issues/818).

# P02 — reuse the existing Render service: exact deployment and rollback controls

**Operator choice:** keep the existing `ServiceDesk` Supabase project `cpmmgivhlkfbiwzhlcey` and **existing** Render web service `srv-db5p1s142hec739noohg`. No new services or databases, no paid upgrade, no unauthorized schema changes.

## Grounded observed state (2026-10-26)

| Control | Verified value |
|---|---|
| Existing Render [service](https://dashboard.render.com/web/srv-db5p1s142hec739noohg) | `servicedesk-v3-frontend-review` |
| Existing URL | `https://servicedesk-v3-frontend-review.onrender.com` |
| Provider lifecycle | **SUSPENDED** on existing Free plan |
| Provider event | `2026-10-20T22:15:42Z`, `suspender_added` because **`Free Tier Usage Exceeded`** |
| Old configured branch | `deploy/servicedesk-v3-public-review-20261011` |
| Last successful old V3 SHA | `3962aa5c84c3aa5f47ad72b62d51ae4382467708` |
| Current reviewed V4 canonical | `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4` |
| New **pinned-at-creation GitHub-only** V4 RC ref | `deploy/servicedesk-v4-p02-rc-20261026`, pinned to above SHA |
| Auto-deploy setting | OFF |
| First live anonymous HTTP probe | **503** for `/health`, `/auth/sign-in` and internal delivery anonymous boundary |

The branch creation **did not** switch the Render service, unsuspend it, trigger a build or create a paid resource. The Render service's old V3 deployment remains its observed last successful provider deploy.

## Operator actions before V4 can be deployed to this SAME existing Render service

1. Open the existing [Render service dashboard](https://dashboard.render.com/web/srv-db5p1s142hec739noohg). Inspect **Monthly Included Usage / service suspension**. It is quota-blocked. Confirm actual resource/reset eligibility before trying to resume or upgrade; do not promise a date or alter billing. A Free tier may be unsuitable for sellable production.
2. Record a provider-backed snapshot of the existing service's branch, old deploy ID `dep-db9gv3rrjlhs73epr34g`, commit, region, runtime, instance plan, auto deploy, public URL, health path and existing environment-key NAMES (never secret values). Keep the previous revision available for rollback.
3. **Before changing Render, fetch the current GitHub deploy branch HEAD and require it to equal the recorded 40-character reviewed V4 SHA**; a Git branch is movable unless protected. **Separate source-switch/service-resume approval remains required.** When granted, use the authorized Render Dashboard/Work browser action (the connected Render plugin exposes deployment and reads but no safe branch-edit/resume action). Change **the same existing service** to release branch `deploy/servicedesk-v4-p02-rc-20261026`. Do not force-update the V3 branch or GitHub `main`. Keep auto deploy OFF until reviewed.
4. Confirm the app's Render environment has only secure server-side Supabase settings for the selected existing project `cpmmgivhlkfbiwzhlcey`; do not copy secrets into GitHub, chat, Markdown or frontend bundles. Registration flags and synthetic fixture flags must remain OFF until the approved security patch is genuinely installed, and two real owner sessions are tested.
5. After Render quota availability and branch/source approval, trigger only the approved V4 build on the **existing** service; record Render deploy ID, SHA, finished status, service URL and rollback revision.
6. Run the merged [host-only read-only identity gate](https://github.com/SaamVR/ServiceDesk/pull/848) with:
   ```sh
   SD_P02_RENDER_READONLY_PERMISSION=READ_ONLY \
   SD_P02_RENDER_EXPECTED_SHA=ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4 \
   node scripts/release/v4-p02-existing-render-readonly-preflight.mjs
   ```
   This program uses the **fixed existing Render URL**, has no credentials, and only makes three bounded GETs; `/health` must report the exact `sourceSha` from provider `render`, sign-in controls must exist and anonymous staff delivery must return 401. **Actual 2026-10-26 run: blocked; all three URLs returned HTTP 503**. A passing host self-report is not a separate provider deployment attestation.
7. Verify the Render provider build/deploy SHA independently matches the exact reviewed GitHub commit. Then run the separate authenticated two-owner [Supabase acceptance probe](./P02_TWO_REAL_OWNER_ACCEPTANCE_RUNBOOK.md) and V4 browser flow. Main database's approved 0065 default-branch authorization repair must be installed before accepting real multi-tenant onboarding.
8. Rollback criteria: wrong SHA, logout/session failure, unexpected 200 guest privilege, scope leakage, invoice/payment side effect, failed health, or provider rollback issue. **Restore old V3 branch and successful deploy** only through approved Render controls, preserve logs and account data; do not reset database or delete historical Git branches. Disable all signup/QA fixture writes pending investigation.

## Current gating state — no inference allowed

- **SOURCE_VERIFIED:** true for reviewed V4 SHA; [755/755 test suites, 3725/3725 tests, Next.js build/Chrome](https://github.com/SaamVR/ServiceDesk/actions/runs/40188428616), [PG17](https://github.com/SaamVR/ServiceDesk/actions/runs/40188428513), [independent guardian](https://github.com/SaamVR/ServiceDesk/actions/runs/40188428582) all green as of RC branch creation.
- **RENDER_DEPLOYED_V4:** false; the original service's V3 branch remains selected and its free quota is exhausted.
- **MAIN_SUPABASE_0065_INSTALLED:** false; owner already approved the narrow migration, but connected execution hit a safety block. [Tracked operator migration handoff](./P02_AUTHORIZED_0065_MIGRATION_HANDOFF.md).
- **TWO_REAL_OWNER_ACCEPTANCE:** false; the main database has only one owner and no controlled second owner JWT/session was available.
- **PRODUCTION_READY:** false. None of the above can be automatically promoted to operational acceptance by another set of source tests.

## Responsibilities

- Production Chat owns the eventual reviewed merge/release promotion, hosted exact-head CI, Render identity, database schema gate and security critic.
- Feature Chat owns independent F01–F08 draft PRs; keep them isolated from the frozen P02 branch.
- User action needed now only at blocked external boundaries: inspect Render quota/billing for restoring the existing service, use a supported authenticated Supabase migration path for the already-approved 0065 fix, and provide two controlled QA owner email inboxes when the fix and hosting are ready. Never request passwords, JWTs, service keys or recovery certificates in chat.

**Tracking:** [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818). Next `continue` remains P02 until deployment and authenticated acceptance are verified.
