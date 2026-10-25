> **OWNER OVERRIDE — 2026-10-25:** Use **EXISTING** ServiceDesk Supabase project `cpmmgivhlkfbiwzhlcey` and **EXISTING** suspended Render service `srv-db5p1s142hec739noohg` ONLY. The earlier recommendation to create a separate staging service/database is rejected. Preserve original user data and Render deploy `3962aa5c84c3aa5f47ad72b62d51ae4382467708`; do not create paid or extra resources. [Final owner decision](https://github.com/SaamVR/ServiceDesk/issues/829) · [P02 shared-infrastructure preflight](./P02_SHARED_INFRA_AUTH_PREFLIGHT.md).

# P01 — staging topology, integration graph and launch-risk acceptance

**Batch:** [P01 #817](https://github.com/SaamVR/ServiceDesk/issues/817) · **Source pinned:** `974e9f040071b1a2c1199c7ff6fb652a67812a47` · **Date:** 2026-10-25.

## Verified source-to-hosting gap

- **Canonical application candidate:** `feat/servicedesk-v4-reconciled-qa-shell-20261012` at `974e9f040071b1a2c1199c7ff6fb652a67812a47` (clean on samvr, `git fsck` passes).
- **GitHub `main`:** `56872ccbd7fbe6de043c35d9d8d37d32c4b726ac`, V4 is **3,476 commits ahead, 0 behind**. Do not reset main, squash unknown product history or call it production parity.
- **Committed `render.yaml`:** service `servicedesk-v2-rc`, `plan: free`, `region: virginia`, **branch `feat/servicedesk-v2-multilane-20261006`**, `autoDeployTrigger: off`, `healthCheckPath: /health`. This is an older *BLUEPRINT*, **NOT verification of the actual running service**.
- **`/health` source route** supports `sourceSha` from trusted `RENDER_GIT_COMMIT` or `VERCEL_GIT_COMMIT_SHA`, omits provenance on conflict/invalid source. Host readback and actual connected service metadata are required for DEPLOYMENT_VERIFIED.
- **Render connected account:** provider says one workspace exists: `My Workspace` / `tea-d1ihdsbipnbc73bpc8f0`. Its connector demands the owner select/confirm the workspace before listing services, so **NO Render service inspection, environment mutation or deploy has occurred**.
- **GitHub integrated source tests:** [application build/Chrome #40153003445](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003445), [PG17/worker #40153003465](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003465), [guardian #40153003408](https://github.com/SaamVR/ServiceDesk/actions/runs/40153003408), all SUCCESS at exact R52 SHA; these prove SOURCE_VERIFIED not running V4 staging.
- **Device:** samvr sole checkout, clean at exact V4 SHA; approx 1.5 GB free / 97% used; shared `samvr-disk-guard.timer` must not be disabled for project convenience. Remote device work only when essential; GitHub PR/CI first.

## Connected database readiness — read-only

- Supabase connected ServiceDesk `cpmmgivhlkfbiwzhlcey` (healthy PG17). Migration ledger through `0062`; `0063`, `0064`, `0065` exist as source SQL but are **not installed**. No migration approvals inferred.
- Actual business aggregates at inspection: 1 workspace, 0 services, 0 branch price books, 1 request, 0 quotes, 1 saved rule, 0 executions, 0 invoices. Source acceptance does not constitute operational SaaS acceptance.
- Security adviser observed **11 notices/findings** across RLS-enabled private tables without policies (4 INFO; not automatically an exposure), `citext` in public (WARN), 5 `SECURITY DEFINER` RPCs callable by authenticated roles (WARN, examine necessity/authorization), leaked-password protection disabled (WARN).
  - References: [RLS with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [public extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [callable SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Auth password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Performance adviser observed 95 unindexed FK INFO, 10 auth RLS init-plan WARN, 36 unused index INFO, 14 multiple permissive RLS policy WARN. Prioritize proven auth/tenant leakage or slow top queries; do not blindly apply hundreds of indexes or change RLS policies in unapproved DB.
  - References: [auth RLS init-plan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
- **No staging rows, provider calls, payments or permissions changed in P01.**

## Complete 67-open-PR triage and independent critique

The [full table](./P01_PR_AUDIT.md) and [machine-readable PR/path/sha manifest](./P01_PR_AUDIT.json) compare every open PR's changed-file blobs against the pinned canonical Git tree. Verified 67/67 unique PRs with count/path consistency and 66 overlapping changed-file hotspots.

| Class | Count | Handling |
|---|---:|---|
| `SUPERSEDED` | 15 | Entire PR changed-file blob set already exactly matches canonical; reverify before eventual PR closure. Not authorization to close historical PRs automatically. |
| `MERGE_CANDIDATE` | 19 | Small file diffs still exist; semantic file-level review, conflict/tenant tests and path ownership required. |
| `REBUILD` | 8 | Six competing quote-journal candidates, plus two core quote-pricing changes; rebase a *single* selected safe solution. |
| `DEFER` | 25 | Legacy V3/visual/critic PRs and one active Feature Chat F01 PR #830. Historical work not discarded. |

**Independent critic verdict:** A SHA-identical current file justifies classification `SUPERSEDED` for the *file contents*, but does not prove PR author intent, release staging parity, safety of branches with other files, or acceptance. No candidate is authorized to merge simply because it has <=4 residual files. 19 candidates contain overlapping UX/AI-owned files; they must be grouped by release value, not merged individually.

## File/path ownership and priority merge order

This is a **selection graph**, not a commit/merge command:

1. **P01/P02 Auth/host provenance:** Resolve staging workspace, deployment source SHA and owner identities first. Never merge legacy frontend V3 PRs #67–#127 simply to refresh styling.
2. **P03 owner setup & quote pricing**: Focus on current catalog/rate-book source `src/features/operations/operational-product-runtime.ts`, `verified-owner-price-evidence.ts`, `src/server/core/operational-quote-rate-card.ts`. Candidate [#568](https://github.com/SaamVR/ServiceDesk/pull/568) has four changed files; core conflicting [#564](https://github.com/SaamVR/ServiceDesk/pull/564) and [#569](https://github.com/SaamVR/ServiceDesk/pull/569) both touch `operational-quote-rate-card.ts`; reconstruct tests against current canonical rather than merging either unreviewed.
3. **P04 quote issuance, owner instructions:** [#371](https://github.com/SaamVR/ServiceDesk/pull/371) request checklist; [#566](https://github.com/SaamVR/ServiceDesk/pull/566) quote state filter; [#571](https://github.com/SaamVR/ServiceDesk/pull/571) quote expiry. `OperationalProductRoute.tsx` is contested by #371, #645, #668 and #681; designate ONE owner of the aggregate UI route.
4. **P05 0063 quote-source journal:** [#307](https://github.com/SaamVR/ServiceDesk/pull/307) is the most recently updated, titled 'verified' candidate; compare exact SQL source, owner opt-in, transactional trigger, worker replay, lease and negative RLS cases against #280/#259/#253/#224/#227. Migration SQL blob already exists on canonical source, but DB installed migration history stops at 0062. Do NOT apply 0063 or merge multiple implementations without exact SQL checksum, rollback and owner staging-write approval.
5. **P06/P07 operational UX:** Dispatcher [#681](https://github.com/SaamVR/ServiceDesk/pull/681), quality #682 (already byte-matched), invoice #683 (already byte-matched), delivery #598 (small remainder), outbox [#570](https://github.com/SaamVR/ServiceDesk/pull/570). Confirm actual saved-tenant journey first.
6. **P08 AI Studio + Feature Chat:** Active new [F01 PR #830](https://github.com/SaamVR/ServiceDesk/pull/830) belongs to separate Feature Chat. Studio `AiStudioWorkspace.tsx` is contested by [#633](https://github.com/SaamVR/ServiceDesk/pull/633) and [#650](https://github.com/SaamVR/ServiceDesk/pull/650). Owner quote UI [#645](https://github.com/SaamVR/ServiceDesk/pull/645), starter templates [#668](https://github.com/SaamVR/ServiceDesk/pull/668), owner diagnostic [#597](https://github.com/SaamVR/ServiceDesk/pull/597)/[#602](https://github.com/SaamVR/ServiceDesk/pull/602), workflow [#689](https://github.com/SaamVR/ServiceDesk/pull/689), revision [#716](https://github.com/SaamVR/ServiceDesk/pull/716), inbox [#723](https://github.com/SaamVR/ServiceDesk/pull/723), bulk starters [#750](https://github.com/SaamVR/ServiceDesk/pull/750). Do not race Feature Chat or publish AI drafts without owner approval.
7. **P09 external providers:** owner confirmation and sandbox credential configuration first. Source [#570](https://github.com/SaamVR/ServiceDesk/pull/570) may supply resolver protection, while prior R19/R20 provider PR blobs appear already identical. No sandbox outbound send to actual customer.
8. **P10/P11/P12:** Once staged real SaaS business/AI/provider tests are accepted, select only changes needed for payment/subscription/readiness, run one exact merged-head full gate and deploy through an approved target; old V3 visual PRs remain parked.

## Approved operational architecture proposal (NOT DEPLOYED)

Proposed: separate **isolated V4 staging Render service** built from exact canonical SHA, attached to a **designated staging Supabase project** only, with two explicitly controlled fake owner accounts and no real customer data. Use server-held secrets and explicit environment flags default OFF for paid AI, Meta sends, Stripe live charges and journal replay. Preview `/health` `sourceSha` must match a recorded SHA plus provider metadata before any authenticated browser acceptance. Validate row-level tenant boundaries before P03 pricing writes. Host migration 0063/64/65 require separate approvals and rollback.

**Why isolated:** Checked-in render.yaml targets V2 Free branch; current Render actual service is not yet inspected; the connected database already has a workspace/request that might be user-owned. Never overwrite a possible live service or assume connected Supabase is disposable.

## Owner-dependent gate to finish P01

[Operator decision register #829](https://github.com/SaamVR/ServiceDesk/issues/829): explicitly select Render `My Workspace` / `tea-d1ihdsbipnbc73bpc8f0` for inspection, approve which project receives fake staging writes (existing ServiceDesk DB or new isolated staging DB), provide/authorize two controlled fictional test inboxes and a hosting budget. Until Render choice is confirmed, exact **deployed** source SHA and service URL remain **UNVERIFIED** and P01 must stay open as `BLOCKED_OWNER`.

## Deliverable-level completion status

- **DONE:** Immutable canonical source SHA pinned and local clean; 67 PRs compared and classified with path overlap/independent consistency; authored safe merge order, staging topology and security adviser evidence; no destructive/database/provider action.
- **PENDING_OWNER:** Render workspace confirmation; resulting service URL, deployed exact SHA and staging host selection; two-tenant staging target and synthetic owner input.
- **P01 not marked DONE:** Without those, an accepted staging/deploy reference does not exist; next `continue` must resume the same P01 gate, even though independent P02/P03 code reconnaissance can proceed without writes.
