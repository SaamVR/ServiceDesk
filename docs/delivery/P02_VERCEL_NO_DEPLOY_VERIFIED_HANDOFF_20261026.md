# ServiceDesk V4 — P02 Vercel-only, NO-DEPLOY handoff (verified 2026-10-26)

## New-chat starting instruction

You are the **ServiceDesk AI V4 P02 Production Readiness Principal Integrator, Multilane Engineering Director, Independent Critic and Release Guardian** for [`SaamVR/ServiceDesk`](https://github.com/SaamVR/ServiceDesk). **FIRST ACTION:** read this handoff and reconcile the LIVE canonical GitHub branch, P02 issue and Vercel/Supabase accounts. This handoff is a dated observation, not permission to deploy, pay, create accounts, change environments or skip release gates.

**OWNER'S LATEST DIRECTIVE SUPERSEDES ALL HISTORICAL RENDER DEPLOYMENT PLANS: USE VERCEL. NEVER DEPLOY WITHOUT EXPLICIT USER PERMISSION.** This includes preview, staging, production, manually triggered deploys, Git-import-triggered deploys, automatic branch/PR deploys, promotions, rollbacks and aliases. The owner has NOT authorized any Vercel deployment or project creation. The exact intended Vercel project, commit and environment must be separately approved before any deployment action. No paid plan change without separate approval.

## Exact GitHub source state verified

- **Canonical integration branch:** `feat/servicedesk-v4-reconciled-qa-shell-20261012`.
- **Canonical HEAD:** `d5e86b369c46384278be8006812a3e27c41da21e` (merge of **[PR #855](https://github.com/SaamVR/ServiceDesk/pull/855)** on 2026-10-26).
- **PR #855:** **MERGED** (not pending); its head was `40de2aecafbaf1d959a27c27174c9f2a4055d775`. Introduced root `vercel.json`: `{"$schema":"https://openapi.vercel.sh/vercel.json","git":{"deploymentEnabled":false}}`. This disables Vercel automatic Git deployments globally, including previews. Its new source-level regression tests also verify Vercel host SHA and conflicting-identity fail-closed behavior.
- **PR #855 PR-head checks:** full-source, independent critic and merge-tree parity **ALL SUCCESS**.
- **Exact merged-head CI:** [full RC run #40250318536](https://github.com/SaamVR/ServiceDesk/actions/runs/40250318536) **SUCCESS** with 756/756 test files and 3,728/3,728 tests, TypeScript pass, ESLint 0 errors/48 warnings, Next production build pass, guest-route/anonymous-denial tests and Chrome synthetic pass; [guardian #40250318555](https://github.com/SaamVR/ServiceDesk/actions/runs/40250318555) **SUCCESS**; [PostgreSQL 17/worker #40250318600](https://github.com/SaamVR/ServiceDesk/actions/runs/40250318600) **SUCCESS**. CI expressly reports `authenticatedOwnerAcceptance=false`, `tenantRlsAcceptance=false`, `providerDeliveryAcceptance=false`. These are source-only results, **not hosting or real two-owner UAT**.
- **Historic GitHub-only Render RC branch** `deploy/servicedesk-v4-p02-rc-20261026` remains at `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4`: it PRE-DATES the Vercel no-auto-deploy config. **DO NOT use this branch for a Vercel import/deploy.** Its former purpose is historical/rollback evidence, not the current release target.
- The sole authorized `samvr` ServiceDesk checkout `/home/ubuntu/work/ServiceDesk` was last observed at previous SHA `1003075d1bfcefb6415d6c9a4bdda9c57a0546ff` (behind canonical). **Before any local work:** recheck its branch, Git status, remote and ancestor relationship; only if clean, update via `git fetch` + `git merge --ff-only`. No forced reset or destructive cleanup. Hosted GitHub CI already passes, so local full dependency installs are not required for source readiness. No `samai` changes.

## P02 issue and currently unsatisfied acceptance

- [**P02 issue #818**](https://github.com/SaamVR/ServiceDesk/issues/818): **OPEN, 2/7 checkboxes DONE, 5/7 UNCHECKED**.
- 5 pending scopes: (1) two approved distinct owner identities/sessions + fixture rollback scope; (2) real signup/login/session recovery/workspace and branch flows; (3) tenant denial/RLS under **real** owner JWTs; (4) real route/database UAT receipts and usable onboarding entry point; (5) saved business journey/staging acceptance evidence.
- [Program governance #808](https://github.com/SaamVR/ServiceDesk/issues/808); [operator decisions #829](https://github.com/SaamVR/ServiceDesk/issues/829). Both #818 and #829 have the Vercel-only, no-deploy owner directive at the top.
- **NEXT_BATCH = P02**. Do NOT claim P02 DONE, silently advance P03, or fabricate subagent/runtime progress. Multiple lanes must have file-disjoint actual work and independent evidence; blocker-first rule prohibits code churn when external gates are the only blockers.
- Feature Chat F01–F08 is a **separate isolated feature source track**. Do not merge draft Feature Chat PRs merely because they exist.

## Vercel read-only provider state

- Connected Vercel team: **Samvrc** / slug `samvrc` / ID `team_SwFPLhTkG0XpAX3RQ8B4vbLt`, **Hobby** plan.
- Read-only `list_projects` query for `SaamVR/ServiceDesk` and name `servicedesk` returned **zero matching Vercel projects**. No project has been created, no Git import/link, no preview or production deployed, no environment values configured. Existing other Vercel projects belong to other repos and MUST remain untouched.
- Vercel Git integration may auto-deploy on project creation/import; **do not create/link before explicit user permission**, even though source now includes `git.deploymentEnabled=false`. Verify effective settings independently before *any* authorized import.
- Vercel Hobby is non-commercial; **ServiceDesk as a sellable/customer-facing SaaS needs an appropriate compliant hosting plan**. Never upgrade plans or incur paid charges without exact approval.
- The Next.js `src/app/health/deployment-identity.ts` already accepts valid host-issued `VERCEL_GIT_COMMIT_SHA`, and rejects conflicting Render and Vercel claims; `/health` is read-only. Future deployment acceptance must check BOTH the host-reported SHA and the Vercel provider deployment metadata against the exact owner-approved commit, not a fabricated environment variable.

## Supabase existing primary database

- Project `cpmmgivhlkfbiwzhlcey` remains the **SOLE** ServiceDesk Supabase project by owner's selection. No new staging project or unauthorized workspace writes.
- Owner explicitly approved the narrowly scoped `0065` default-branch membership authorization repair. It was **INSTALLED** as migration ledger entry `20261025200147 sd_0065_v4_default_branch_membership_authority`; total 70 installed migrations. `0063`/`0064` remain **NOT applied** and NOT approved. This is an intentional out-of-order security hotfix; reconcile recorded migration ledger before any future `db push` and never replay 0065 blindly.
- Most recent independent DB proof shows installed `servicedesk_default_branch(uuid)` function MD5 `9f14160f16e16ffe6ac16f35c3f4557f`, anonymous EXECUTE false. Read-only role-context probes after patch: existing authorized owner resolves own branch, fictitious authenticated nonmember receives NULL and sees zero workspace rows.
- Existing data: 1 Supabase Auth user, 1 workspace, 1 active OWNER, 1 saved request; no second QA owner or seeded client requests. Other general security advisories (e.g. SECURITY DEFINER review and leaked-password protection) remain separate; do not advertise complete tenant hardening.
- Sensitive database IDs/emails/tokens do not belong in public GitHub issues or logs.

## QA identity and privacy boundary

- The owner provided **one personally controlled Gmail mailbox directly in the chat** as QA contact; **DO NOT copy the email address into public repo artifacts or issue comments**.
- **No consent yet** to create additional Supabase Auth users, automatically use Gmail plus aliases, send verification emails, or seed fictional business records. Confirm the intended second independent owner identity/alias plan first. One underlying inbox with two aliases is not independent security ownership by itself; treat as controlled functional test identities, not evidence of separate human control.
- The existing source has fail-closed server-only `SERVICEDESK_QA_FIXTURE_WRITES_APPROVED` and exact `SERVICEDESK_QA_FIXTURE_WORKSPACE_SLUGS` gates. No fixture writes without a new explicitly approved plan, owner verification and rollback inventory.
- The real read-only two-owner JWT test runner is in `scripts/release/v4-p02-two-owner-readonly-acceptance.mjs` (merged [PR #844](https://github.com/SaamVR/ServiceDesk/pull/844)); its 5/5 offline tests passed, but **never executed with two real JWTs**. No passwords/access tokens in chat or GitHub.

## Historical Render: preserve, do not use

- Old service `srv-db5p1s142hec739noohg` in workspace `tea-d1ihdsbipnbc73bpc8f0`, name `servicedesk-v3-frontend-review`, still **suspended** on Free V3 branch `deploy/servicedesk-v3-public-review-20261011` and old deploy SHA `3962aa5c84c3aa5f47ad72b62d51ae4382467708`. Oct 20 event: `Free Tier Usage Exceeded`. V4 was **never deployed there**. Previous Render plan is superseded by Vercel choice. **DO NOT resume, modify, deploy, delete or pay for Render**; preserve old revision for historical audit.
- Older `docs/delivery/P02_EXISTING_RENDER_RC_DEPLOYMENT_RUNBOOK.md` is HISTORICAL, not current authorization.

## Next-chat controlled multilane execution

**FIRST: READ-ONLY reconciliations.** Read this handoff, [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818), latest release lock, current GitHub canonical branch and PR #855, connected Vercel team/project inventory, existing main Supabase migration ledger; confirm no deployments. Reconcile any newer changes; don't assume the handoff is the live HEAD.

**Lane A — Release guardian:** ensure `vercel.json git.deploymentEnabled=false` remains present in the EXACT intended SHA; CI full/PG17/critic clean; no Vercel auto-deploy CI, deploy hooks or implicit import. Identify a safe non-deployment Vercel configuration checklist. No deployments or project creation.

**Lane B — Vercel architecture:** inspect app's Next.js 16 Node runtime, existing env **NAMES only** and region considerations; prepare a zero-secret mapping to existing Supabase and manual-only release controls. Report Hobby commercial restriction. Do not create a Vercel project, update environments or attach domains.

**Lane C — QA / tenant isolation:** prepare a precise two-owner onboarding/negative-path acceptance matrix and least-privilege credential handling using the *one* privately supplied mailbox; pause at user approval before using plus aliases/account creation. Never invent signed-in receipts.

**Lane D — SQL/governance:** read-only migration state + security adviser checks; preserve applied 0065 ledger and the private function preimage; mark 0063/64 untouched. No schema/data mutations or new staging project.

**Lane E — Independent critic:** block any merge/release if SHA/approvals don't match, public preview could autodeploy, Vercel Hobby would be used commercially, or real owner/tenant evidence is missing. All lanes contribute one durable GitHub handoff/evidence receipt, no repetitive PR churn.

If all gates remain externally blocked, STOP after a grounded status checkpoint. Do not claim that extending the runtime, increasing nominal agents, source CI green, or creating more code is equivalent to live acceptance.

### Explicit approval required later

Before any Vercel activity that can create a deployment: obtain an affirmative message specifying **project/team, 40-character SHA, preview or production environment, deployment scope, and any plan/cost implications**. If owner authorizes only preview, do not auto-promote. If owner authorizes project creation but not deployment, confirm the import operation is deploy-free first; otherwise do not create it. Never deploy merely on `continue`.

## Sources

- [P02 #818](https://github.com/SaamVR/ServiceDesk/issues/818) · [operator register #829](https://github.com/SaamVR/ServiceDesk/issues/829)
- [PR #855: manual-only Vercel source policy](https://github.com/SaamVR/ServiceDesk/pull/855)
- [P02 earlier Vercel manual-only runbook](https://github.com/SaamVR/ServiceDesk/blob/ops/servicedesk-fixed-delivery-program-20261025/docs/delivery/P02_VERCEL_MANUAL_ONLY_HANDOFF_20261026.md)
- [Source exact-HEAD full CI](https://github.com/SaamVR/ServiceDesk/actions/runs/40250318536) · [guardian](https://github.com/SaamVR/ServiceDesk/actions/runs/40250318555) · [PG17](https://github.com/SaamVR/ServiceDesk/actions/runs/40250318600)
